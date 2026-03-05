package mainClient

import (
	"compoment/ws"
	"encoding/json"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/brnn"
	"service/mainClient/game/znet"
	"service/modelClient"

	"github.com/sirupsen/logrus"
)

func handleBRNNPlayerJoin(connWrap *ws.WsConnWrap, appId, appUserId string) error {
	userId := appId + appUserId

	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		return comm.NewMyError("获取用户信息失败")
	}

	room := game.GetMgr().GetBRNNRoom()

	// Check if already in QZNN room
	qznnRoom, _ := game.GetMgr().CheckPlayerInRoom(userId)
	if qznnRoom != nil {
		return comm.NewMyError("请先退出抢庄牛牛房间")
	}

	// Check if already in BRNN — reconnect
	existing := room.GetPlayer(userId)
	if existing != nil {
		room.SetWsWrap(userId, connWrap)
		_ = comm.WriteMsgPack(connWrap, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: znet.PushRouter,
			Data:     znet.PushRouterStruct{Router: znet.Brnn, SelfId: userId},
		})
		roomState := room.GetRoomStateForPlayer(userId)
		_ = comm.WriteMsgPack(connWrap, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: brnn.PushRoomState,
			Data:     roomState,
		})
		return nil
	}

	// Lock balance via DB
	modelUser, err := modelClient.GameLockUserBalance(userId, room.Config.MinBalance)
	if err != nil {
		logrus.WithField("userId", userId).WithError(err).Error("brnn.GameLockUserBalance")
		return comm.NewMyError("余额不足")
	}

	nickName := user.NickName
	if nickName == "" {
		nickName = user.UserId
	}

	p := &brnn.BRNNPlayer{
		ID:       userId,
		NickName: nickName,
		Avatar:   user.Avatar,
		Balance:  modelUser.BalanceLock,
		ConnWrap: connWrap,
	}

	room.AddPlayer(p)

	// Push router to BRNN game view
	_ = comm.WriteMsgPack(connWrap, comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: znet.PushRouter,
		Data:     znet.PushRouterStruct{Router: znet.Brnn, SelfId: userId},
	})

	// Push full room state with config and trend
	roomState := room.GetRoomStateForPlayer(userId)
	_ = comm.WriteMsgPack(connWrap, comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: brnn.PushRoomState,
		Data:     roomState,
	})

	return nil
}

func handleBRNNPlayerLeave(userId string) error {
	room := game.GetMgr().GetBRNNRoom()

	if _, err := room.CanLeave(userId); err != nil {
		return err
	}

	connWrap := room.GetPlayerConnWrap(userId)
	room.RemovePlayer(userId)

	// Release locked balance back to user
	if _, err := modelClient.GameResetUserBalance(userId); err != nil {
		logrus.WithField("userId", userId).WithError(err).Error("brnn.GameResetUserBalance")
	}

	// Push router back to lobby
	if connWrap != nil {
		_ = comm.WriteMsgPack(connWrap, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: znet.PushRouter,
			Data:     znet.PushRouterStruct{Router: znet.Lobby},
		})
	}

	return nil
}

func handleBRNNPlaceBet(userId string, data []byte) error {
	var req brnn.ReqPlaceBet
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}

	room := game.GetMgr().GetBRNNRoom()
	return room.PlaceBetAndBroadcast(userId, req.Area, req.Chip)
}

type BRNNLobbyConfigRsp struct {
	Config *brnn.BRNNClientConfig `json:"Config"`
}

func handleBRNNLobbyConfig() *BRNNLobbyConfigRsp {
	room := game.GetMgr().GetBRNNRoom()
	return &BRNNLobbyConfigRsp{
		Config: &brnn.BRNNClientConfig{
			Chips:         room.Config.Chips,
			MaxBetPerArea: room.Config.MaxBetPerArea,
			MinBalance:    room.Config.MinBalance,
		},
	}
}
