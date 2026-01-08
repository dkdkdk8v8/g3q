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
	LobbyConfigs interface{} `json:"LobbyConfigs"`
}

func handlePlayerJoin(connWrap *ws.WsConnWrap, appId, appUserId string, data []byte) error {
	var req struct {
		Level      int
		BankerType int
	}
	// 默认进入初级场
	req.Level = 1
	req.BankerType = -1 // 默认值，用于检测客户端是否传递

	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
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

	userId := appId + appUserId
	// 处理抢庄牛牛匹配逻辑
	p := qznn.NewPlayer()
	p.ID = userId
	p.Balance = user.Balance
	p.IsRobot = user.IsRobot
	p.ConnWrap = connWrap
	p.NickName = func() string {
		if user.NickName == "" {
			return user.UserId
		}
		return user.NickName
	}()

	room, err := game.GetMgr().JoinOrCreateNNRoom(user, p, req.Level, req.BankerType, cfg)
	if err != nil {
		return err
	}

	room.Broadcast(comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: qznn.PushPlayJoin,
		Data: qznn.PushPlayerJoinStruct{
			Room:   room,
			UserId: userId,
		},
	})

	return err
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
		room.Broadcast(comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: qznn.PushTalk,
			Data: qznn.PushTalkStruct{
				UserId: userId,
				Type:   req.Type,
				Index:  req.Index}})
	}

	return nil
}

func handleLobbyConfig() *LobbyConfigRsp {
	return &LobbyConfigRsp{
		LobbyConfigs: qznn.Configs,
	}
}

func RpcQZNNData(c *gin.Context) {
	rooms := game.GetMgr().GetAllRooms()
	c.JSON(200, gin.H{
		"code": 0,
		"msg":  "success",
		"data": rooms,
	})
}

type recordSummy struct {
	Date            string //格式化:12月02周5
	TotalBet        int64  //总投注
	TotalWinBalance int64  //总输赢，用 list 里面的 oldBalance Balance 来计算

}
type recordItem struct {
	BalanceBefore int64
	BalanceAfter  int64
	GameName      string
	GameData      string
}
type handleGameRecordRsp struct {
	LastId uint64
	List   []any //里面有 recordSummy recordItem
}

var handerGameRecordCache = modelComm.WrapCache[*handleGameRecordRsp](handleGameRecord,
	2*time.Second).(func(userId string, data []byte) (*handleGameRecordRsp, error))

func handleGameRecord(userId string, data []byte) (*handleGameRecordRsp, error) {
	var req struct {
		Limit  int
		LastId uint64
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
	var rsp handleGameRecordRsp

	var lastTime = time.Unix(0, 0)
	var currentSummy *recordSummy
	itemCount := 0
	loopCount := 0
	targetCount := req.Limit

	for {
		loopCount++
		if loopCount > 100 { // 保护逻辑：防止死循环
			logrus.WithField("!", nil).WithField("userId", userId).Error("loopMax")
			break
		}

		if itemCount >= targetCount {
			//加快拉取数据的速度
			req.Limit = req.Limit * 2
			if req.Limit > 200 {
				req.Limit = 200
			}
		}
		records, err := modelClient.GetUserGameRecords(userId, req.Limit, req.LastId)
		if err != nil {
			return nil, err
		}
		if len(records) == 0 {
			break
		}

		// 更新LastId，防止死循环
		req.LastId = records[len(records)-1].Id

		for _, userRecoed := range records {
			if lastTime.IsZero() || !util.IsSameDay(lastTime, userRecoed.CreateAt) {
				if itemCount >= targetCount {
					//客户端的条件满足了，并且又跨天了，不在需要统计当日的nSummy
					return &rsp, nil
				}
				currentSummy = &recordSummy{
					Date: userRecoed.CreateAt.Format("01月02") + "周" + GetChineseWeekName(userRecoed.CreateAt.Day()),
				}
				rsp.List = append(rsp.List, currentSummy)
			}
			lastTime = userRecoed.CreateAt

			gameRecord, err := modelClient.GetGameRecordByIdCache(userRecoed.GameRecordId)
			if err != nil {
				continue
			}
			nRecord := &recordItem{
				BalanceBefore: userRecoed.BalanceBefore,
				BalanceAfter:  userRecoed.BalanceAfter,
				GameName:      gameRecord.GameName}

			if currentSummy != nil {
				// 优化：统一计算输赢
				currentSummy.TotalWinBalance += (userRecoed.BalanceAfter - userRecoed.BalanceBefore)

				switch gameRecord.GameName {
				case qznn.GameName:
					var qznnRoom qznn.QZNNRoom
					err = json.Unmarshal([]byte(gameRecord.GameData), &qznnRoom)
					if err != nil {
						continue
					}
					for _, player := range qznnRoom.Players {
						if player.ID == userId {
							currentSummy.TotalBet += player.ActiveBet
						}
					}
					nRecord.GameData = gameRecord.GameData
				default:
					// 其他游戏逻辑
				}
			}

			if itemCount < targetCount {
				//满足客户端ui展示的数据，放入返回数据内
				rsp.List = append(rsp.List, nRecord)
				//客户端透传数据，方便下次请求的时候直接准确算偏移量
				rsp.LastId = userRecoed.Id
				itemCount++
			}
		}
	}

	return &rsp, nil
}
