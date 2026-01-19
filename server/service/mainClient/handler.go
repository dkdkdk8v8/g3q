package mainClient

import (
	"compoment/ormutil"
	"compoment/util"
	"compoment/ws"
	"encoding/json"
	"errors"
	"math"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"service/modelAdmin"
	"service/modelClient"
	"service/modelComm"
	"strconv"
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
		//客户端弹框，确认要不要重新进入
		alreadyRoom.PushPlayer(alreadyPlayer, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: qznn.PushRoom,
			Data:     qznn.PushRoomStruct{Room: alreadyRoom.GetClientRoom(alreadyPlayer.ID)}})
		return nil, comm.ErrPlayerInRoom
	}

	//player初始化完成，看房间
	p := qznn.NewPlayer()
	p.ID = userId
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
		logrus.WithField("!", nil).WithField("userId", p.ID).WithError(err).Error("PlayerLockBal-Fail")
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
			return nil, comm.NewMyError("房间不存在")
		}
	}

	if room == nil && !user.IsRobot {
		room, err = game.GetMgr().SelectRoom(user, p, cfg, excludeRoomId)
		if err != nil {
			return nil, err
		}
	}
	if room == nil {
		room = game.GetMgr().CreateRoom(cfg)
	}

	room, err = game.GetMgr().JoinQZNNRoom(room, user, p)
	if err != nil {
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
		nickName = user.UserId
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
		if room.Leave(userId) {
			//旧房间广播
			room.BroadcastWithPlayer(
				func(p *qznn.Player) any {
					return comm.PushData{
						Cmd:      comm.ServerPush,
						PushType: qznn.PushPlayLeave,
						Data:     qznn.PushPlayerLeaveStruct{UserIds: []string{}, Room: room.GetClientRoom(p.ID)}}
				})

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

	records, err := modelClient.GetUserGameRecordsJoinGameRecord(userId, req.Limit, req.LastId, start, end)
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
			staUser, err := modelAdmin.GetStaUser(userId, util.AddDateWithoutLock(userRecord.CreateAt, 0, 0, 0))
			if err != nil {
				if !ormutil.IsNoRow(err) {
					return nil, err
				} else {
					staUser = &modelAdmin.ModelStaUser{}
				}
			}
			currentSummy.TotalBet = staUser.BetAmount
			currentSummy.TotalWinBalance = staUser.BetWin
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

type DepositRsp struct {
	Code int
}

func Deposit(c *gin.Context) (interface{}, error) {
	//uid := c.GetString("uid")
	orderID := c.GetString("orderid")
	creditStr := c.GetString("credit")
	ccy := c.GetString("ccy")

	if ccy != "CNY" {
		return nil, ErrInvalidCcy
	}
	if ccy == "" {
		ccy = "CNY"
	}
	if orderID == "" {
		return nil, ErrInvalidOrderId
	}
	if len(orderID) <= 6 || len(orderID) > 128 {
		return nil, ErrInvalidOrderId
	}
	//最多俩位小数,参考其他平台
	credit, err := strconv.ParseFloat(creditStr, 64)
	if err != nil {
		return nil, ErrInvalidCredit
	}
	credit = math.Round(credit)

	return nil, nil
}

func Withdraw(c *gin.Context) (interface{}, error) {
	return nil, nil
}
