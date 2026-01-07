package mainClient

import (
	"compoment/ormutil"
	"compoment/ws"
	"encoding/json"
	"errors"
	"fmt"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"service/modelClient"

	"github.com/gin-gonic/gin"
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
}
type handleGameRecordRsp struct {
	List []any //里面有 recordSummy recordItem
}

func handleGameRecord(userId string, data []byte) (*handleGameRecordRsp, error) {
	var req struct {
		Limit  int
		Offset int
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
	var ret handleGameRecordRsp
	ret.List = make([]recordSummy, 0)

	records, err := modelClient.GetUserGameRecords(userId, req.Limit, req.Offset)
	if err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return &ret, nil
	}

	var currentSummy *recordSummy
	for _, userRecoed := range records {
		wd := int(userRecoed.CreateAt.Weekday())
		if wd == 0 {
			wd = 7
		}
		dateStr := fmt.Sprintf("%s周%d", userRecoed.CreateAt.Format("01月02"), wd)

		if currentSummy == nil || currentSummy.Date != dateStr {
			if currentSummy != nil {
				ret.List = append(ret.List, *currentSummy)
			}
			currentSummy = &recordSummy{
				Date: dateStr,
				List: make([]recordItem, 0),
			}
		}

		gameRecord, err := modelClient.GetGameRecordByIdCache(userRecoed.GameRecordId)
		if err != nil {
			continue
		}
		currentSummy.TotalWinBalance += (userRecoed.BalanceAfter - userRecoed.BalanceBefore)
		currentSummy.List = append(currentSummy.List, recordItem{
			BalanceBefore: userRecoed.BalanceBefore,
			BalanceAfter:  userRecoed.BalanceAfter,
			GameName:      gameRecord.GameName,
		})
	}

	if currentSummy != nil {
		ret.List = append(ret.List, *currentSummy)
	}

	return &ret, nil

}
