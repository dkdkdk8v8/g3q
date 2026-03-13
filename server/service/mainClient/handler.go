package mainClient

import (
	"compoment/ormutil"
	"compoment/util"
	"compoment/ws"
	"encoding/json"
	"errors"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"service/modelClient"
	"service/modelComm"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type LobbyConfigRsp struct {
	LobbyConfigs any `json:"LobbyConfigs"`
}

func joinRoom(roomId string, excludeRoomId string, userId string, connWrap *ws.WsConnWrap, user *modelClient.ModelUser,
	cfg *qznn.LobbyConfig) (*qznn.QZNNRoom, error) {

	alreadyRoom, alreadyPlayer := game.GetMgr().CheckPlayerInRoom(userId)
	if alreadyPlayer != nil && alreadyRoom != nil {
		if cfg.BankerType == alreadyRoom.Config.BankerType {
			//客户端弹框，确认要不要重新进入
			alreadyRoom.PushPlayer(alreadyPlayer, comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: qznn.PushRoom,
				Data:     qznn.PushRoomStruct{Room: alreadyRoom.GetClientRoom(alreadyPlayer.ID)}})
			return nil, comm.ErrPlayerInRoom
		} else {
			return nil, comm.ErrPlayerHaveGamingNotSettle
		}
	}

	//player初始化完成，看房间
	p := qznn.NewPlayer()
	p.ID = userId
	p.AppUserID = user.AppUserId
	p.IsRobot = user.IsRobot
	p.ConnWrap = connWrap
	p.GameCount = user.GameCount
	p.NickName = func() string {
		if user.NickName == "" {
			return user.UserId
		}
		return user.NickName
	}()
	p.Avatar = user.Avatar

	//锁用户的balance，进房间就锁
	modelUser, err := modelClient.GameLockUserBalance(p.ID, cfg.MinBalance)
	if err != nil {
		//有用户的金额不够锁住,尝试踢出用户
		logrus.WithField("userId", p.ID).WithError(err).Error("PlayerLockBal-Fail")
		return nil, err
	}
	//设置金额
	p.Balance = modelUser.BalanceLock
	logrus.WithField("userId", p.ID).WithField(
		"balance", modelUser.Balance).WithField("balanceLock", modelUser.BalanceLock).Info("RoomJoin-LockBalOk")

	//处理进房间逻辑
	var room *qznn.QZNNRoom
	if roomId != "" {
		room = game.GetMgr().GetRoomByRoomId(roomId)
		if room == nil {
			// 回滚：释放已锁定的余额
			if _, resetErr := modelClient.GameResetUserBalance(userId); resetErr != nil {
				logrus.WithField("userId", userId).WithError(resetErr).Error("RoomJoin-ResetBal-Fail")
			}
			return nil, comm.NewMyError("房间不存在")
		}
	}

	if room == nil && !user.IsRobot {
		room, err = game.GetMgr().SelectRoom(user, p, cfg, excludeRoomId)
		if err != nil {
			// 回滚：释放已锁定的余额
			if _, resetErr := modelClient.GameResetUserBalance(userId); resetErr != nil {
				logrus.WithField("userId", userId).WithError(resetErr).Error("RoomJoin-ResetBal-Fail")
			}
			return nil, err
		}
	}
	if room == nil {
		room = game.GetMgr().CreateRoom(cfg)
	}

	room, err = game.GetMgr().JoinQZNNRoom(room, user, p)
	if err != nil {
		// 回滚：释放已锁定的余额
		if _, resetErr := modelClient.GameResetUserBalance(userId); resetErr != nil {
			logrus.WithField("userId", userId).WithError(resetErr).Error("RoomJoin-ResetBal-Fail")
		}
		return nil, err
	}

	room.BroadcastWithPlayer(
		func(p *qznn.Player) any {
			return comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: qznn.PushPlayJoin,
				Data: qznn.PushPlayerJoinStruct{
					Room:   room.GetClientRoom(p.ID),
					UserId: userId,
				},
			}
		})
	return room, nil
}

func handlePlayerJoin(connWrap *ws.WsConnWrap, appId, appUserId string, data []byte) error {
	var req struct {
		Level      int
		BankerType int
		RoomId     string
	}
	// 默认进入初级场
	req.Level = 1
	req.BankerType = -1 // 默认值，用于检测客户端是否传递

	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	logrus.WithField("level", req.Level).WithField("bankerType", req.BankerType).WithField(
		"roomId", req.RoomId).Info("handlePlayerJoin-Req")
	if req.Level <= 0 {
		req.Level = 1
	}

	cfg := qznn.GetConfig(req.Level)
	if cfg == nil {
		return comm.NewMyError("无效的房间类型")
	}

	// 校验 BankerType 是否合法
	if req.BankerType != qznn.BankerTypeNoLook &&
		req.BankerType != qznn.BankerTypeLook3 &&
		req.BankerType != qznn.BankerTypeLook4 {
		return comm.NewMyError("无效的抢庄类型")
	}
	cfg.BankerType = req.BankerType

	// 检查余额
	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		return comm.NewMyError("获取用户信息失败")
	}

	if req.RoomId != "" {
		if !user.IsRobot {
			return comm.NewMyError("无权直接选择房间")
		}
	}

	userId := appId + appUserId
	_, err = joinRoom(req.RoomId, "", userId, connWrap, user, cfg)
	if err != nil {
		return err
	}
	return nil
}

func handlePlayerLeave(userId string, data []byte) error {
	var req struct {
		RoomId string
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandlerPlayerLeave(room, userId)
}

func handlePlayerCallBank(userId string, data []byte) error {
	var req struct {
		RoomId string
		Mult   int64
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandleCallBanker(room, userId, req.Mult)
}

func handlePlayerPlaceBet(userId string, data []byte) error {
	var req struct {
		RoomId string
		Mult   int64
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandlePlaceBet(room, userId, req.Mult)
}

func handlePlayerShowCard(userId string, data []byte) error {
	var req struct {
		RoomId string
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandleShowCards(room, userId)
}

func handleUserInfo(appId string, appUserId string) (*modelClient.ModelUser, error) {
	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		return nil, errors.New("获取用户信息失败")
	}
	nickName := user.NickName
	if nickName == "" {
		nickName = user.AppUserId
	}

	return user, nil
}

func handleSaveSetting(userId string, data []byte) error {
	var req struct {
		Music  bool
		Effect bool
		Talk   bool
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	_, err := modelClient.UpdateUserParam(userId,
		ormutil.WithChangerMap(map[string]interface{}{"music": req.Music, "effect": req.Effect,
			"talk": req.Talk}))
	if err != nil {
		return err
	}
	return nil
}

func handlePlayerReady(userId string, data []byte) error {
	var req struct {
		RoomId string
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandlePlayerReady(room, userId)
}

func handlerPlayerTalk(userId string, data []byte) error {
	var req struct {
		RoomId string
		Type   int
		Index  int
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}

	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	if room != nil {
		room.BroadcastWithPlayer(
			func(p *qznn.Player) any {
				return comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: qznn.PushTalk,
					Data: qznn.PushTalkStruct{
						UserId: userId,
						Type:   req.Type,
						Index:  req.Index}}
			})
	}

	return nil
}

type handlePlayerChangeRoomRsp struct {
	RoomId string
}

func handlePlayerChangeRoom(connWrap *ws.WsConnWrap, userId string, data []byte) (handlePlayerChangeRoomRsp, error) {
	var req struct {
		RoomId string
	}
	var rsp handlePlayerChangeRoomRsp
	if err := json.Unmarshal(data, &req); err != nil {
		return rsp, comm.ErrClientParam
	}

	user, err := modelClient.GetUserByUserId(userId)
	if err != nil {
		return rsp, comm.NewMyError("获取用户信息失败")
	}

	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	if room != nil {
		if err := qznn.HanderPlayerChangeRoom(room, userId); err != nil {
			return rsp, err
		} else {
			//新房间
			_, err = joinRoom("", req.RoomId, userId, connWrap, user, &room.Config)
			if err != nil {
				return rsp, err
			}
		}
	} else {
		return rsp, comm.NewMyError("当前房间信息获取失败")
	}
	return rsp, nil
}

func handleLobbyConfig() *LobbyConfigRsp {
	return &LobbyConfigRsp{
		LobbyConfigs: qznn.Configs,
	}
}

func RpcQZNNData(c *gin.Context) {
	rooms := game.GetMgr().GetAllRooms()
	resp := gin.H{
		"code": 0,
		"msg":  "success",
		"data": rooms,
	}
	data, err := util.MarshalJsonAndGzip(resp)
	if err != nil {
		logrus.WithError(err).Error("RpcQZNNData-Gzip-Fail")
		c.JSON(500, gin.H{"code": -1, "msg": "server error"})
		return
	}
	c.Header("Content-Encoding", "gzip")
	c.Data(200, "application/json; charset=utf-8", data)
}

type recordSummery struct {
	Type            int
	Date            string //格式化:12月02周5
	TotalBet        int64  //总投注
	TotalWinBalance int64  //总输赢，用 list 里面的 oldBalance Balance 来计算

}
type recordItem struct {
	Type          int
	BalanceBefore int64
	BalanceAfter  int64
	GameName      string
	GameData      string
	CreateAt      time.Time
}
type handleGameRecordRsp struct {
	LastId        uint64
	LastTimestamp int64
	List          []any //里面有 recordSummery recordItem
}

var handerGameRecordCache = modelComm.WrapCache[*handleGameRecordRsp](handleGameRecord,
	2*time.Second).(func(userId string, data []byte) (*handleGameRecordRsp, error))

func handleGameRecord(userId string, data []byte) (*handleGameRecordRsp, error) {
	var req struct {
		Limit         int
		LastId        uint64
		Date          string //20250530
		LastTimestamp int64
		GameName      string // 游戏名称过滤: qznn, qznn3, qznn4
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, comm.ErrClientParam
	}
	if req.Limit > 20 {
		req.Limit = 20
	}
	if req.Limit <= 0 {
		req.Limit = 10
	}
	var start = time.Unix(0, 0)
	var end = time.Now()

	if req.Date != "" {

		t, err := time.ParseInLocation("20060102", req.Date, util.LocShanghai)
		if err != nil {
			return nil, comm.ErrClientParam
		}
		start = t
		end = start.Add(24 * time.Hour)
	}

	var rsp handleGameRecordRsp

	var lastTime = time.Unix(req.LastTimestamp, 0)

	var currentSummy *recordSummery

	records, err := modelClient.GetUserGameRecordsJoinGameRecord(userId, req.Limit, req.LastId, start, end, req.GameName)
	if err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return &rsp, nil
	}

	// 更新LastId，防止死循环
	req.LastId = records[len(records)-1].Id

	for _, userRecord := range records {
		if lastTime.IsZero() || !util.IsSameDay(lastTime, userRecord.CreateAt) {
			currentSummy = &recordSummery{
				Type: 0,
				Date: userRecord.CreateAt.Format("01月02") + "周" +
					GetChineseWeekName(int(userRecord.CreateAt.Weekday())),
			}
			dayStart := util.AddDateWithoutLock(userRecord.CreateAt, 0, 0, 0)
			dayEnd := dayStart.Add(24 * time.Hour)
			totalBet, totalWin, err := modelClient.GetUserDailySummary(userId, dayStart, dayEnd)
			if err != nil {
				return nil, err
			}
			currentSummy.TotalBet = totalBet
			currentSummy.TotalWinBalance = totalWin
			rsp.List = append(rsp.List, currentSummy)
		}
		lastTime = userRecord.CreateAt

		nRecord := &recordItem{
			Type:          1,
			BalanceBefore: userRecord.BalanceBefore,
			BalanceAfter:  userRecord.BalanceAfter,
			GameName:      userRecord.GameName,
			GameData:      userRecord.GameData,
			CreateAt:      userRecord.CreateAt}

		rsp.List = append(rsp.List, nRecord)
		//客户端透传数据，方便下次请求的时候直接准确算偏移量
		rsp.LastId = userRecord.Id
		//客户端透传数据，方便下次请求的时候直接判断是否跨天
		rsp.LastTimestamp = userRecord.CreateAt.Unix()
		if len(rsp.List) >= req.Limit {
			return &rsp, nil
		}
	}

	return &rsp, nil
}

type PingRsp struct {
	Code            int
	ServerTimestamp int64
}

func Ping(c *gin.Context) (interface{}, error) {
	return PingRsp{
		Code:            0,
		ServerTimestamp: time.Now().Unix(),
	}, nil
}

// RpcKickPlayer 踢出玩家（运营商API调用）
func RpcKickPlayer(c *gin.Context) (interface{}, error) {
	userId := c.Query("userId")
	if userId == "" {
		return nil, comm.NewMyError("userId is required")
	}

	// 1. 如果在 QZNN 房间中，执行离开
	room, _ := game.GetMgr().CheckPlayerInRoom(userId)
	if room != nil {
		_ = qznn.HandlerPlayerLeave(room, userId)
	}

	// 2. 如果在 BRNN 房间中，执行离开
	brnnRoom, brnnPlayer := game.GetMgr().CheckPlayerInBRNN(userId)
	if brnnRoom != nil && brnnPlayer != nil {
		brnnRoom.RemovePlayer(userId)
	}

	// 3. 关闭 WebSocket 连接
	wsConnectMapMutex.Lock()
	if wsWrap, ok := wsConnectMap[userId]; ok {
		if wsWrap != nil {
			wsWrap.CloseNormal("kicked by operator")
		}
		delete(wsConnectMap, userId)
	}
	wsConnectMapMutex.Unlock()

	return gin.H{"kicked": true}, nil
}

// RpcOnlineStatus 查询玩家在线状态（运营商API调用）
func RpcOnlineStatus(c *gin.Context) (interface{}, error) {
	userId := c.Query("userId")
	if userId == "" {
		return nil, comm.NewMyError("userId is required")
	}

	online := false
	inGame := false
	gameType := ""

	// 检查 WS 连接
	wsConnectMapMutex.RLock()
	if wsWrap, ok := wsConnectMap[userId]; ok && wsWrap != nil && wsWrap.IsConnected() {
		online = true
	}
	wsConnectMapMutex.RUnlock()

	// 检查是否在 QZNN 游戏中
	if room, _ := game.GetMgr().CheckPlayerInRoom(userId); room != nil {
		inGame = true
		gameType = "qznn"
	}

	// 检查是否在 BRNN 游戏中
	if brnnRoom, brnnPlayer := game.GetMgr().CheckPlayerInBRNN(userId); brnnRoom != nil && brnnPlayer != nil {
		inGame = true
		gameType = "brnn"
	}

	return gin.H{
		"online":   online,
		"inGame":   inGame,
		"gameType": gameType,
	}, nil
}
