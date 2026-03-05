package mainClient

import (
	"compoment/ws"
	"encoding/json"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/brnn"
	"service/mainClient/game/znet"
	"service/modelClient"
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
		existing.ConnWrap = connWrap
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

	// Check minimum balance
	if user.Balance < room.Config.MinBalance {
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
		Balance:  user.Balance,
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
	p := room.GetPlayer(userId)
	if p == nil {
		return comm.NewMyError("玩家不在房间")
	}

	// Don't allow leaving during dealing/showcard if player has bets
	state := room.GetState()
	if state != brnn.StateBetting && state != brnn.StateSettling {
		hasBets := false
		for i := 0; i < brnn.AreaCount; i++ {
			if p.Bets[i] > 0 {
				hasBets = true
				break
			}
		}
		if hasBets {
			return comm.NewMyError("本局有下注，请等待结算后再离开")
		}
	}

	connWrap := p.ConnWrap
	room.RemovePlayer(userId)

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
	if err := room.PlaceBet(userId, req.Area, req.Chip); err != nil {
		return err
	}

	// Broadcast updated bet totals
	room.BroadcastBetUpdate()
	return nil
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
