package mainClient

import (
	"compoment/ws"
	"encoding/json"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/brnn"
	"service/mainClient/game/znet"
	"service/modelClient"
	"service/modelComm"
	"sort"
	"time"

	"github.com/sirupsen/logrus"
)

func handleBRNNPlayerJoin(connWrap *ws.WsConnWrap, appId, appUserId string) error {
	userId := appId + appUserId

	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		return comm.NewMyError("获取用户信息失败")
	}

	// Check if already in QZNN room
	qznnRoom, _ := game.GetMgr().CheckPlayerInRoom(userId)
	if qznnRoom != nil {
		return comm.NewMyError("请先退出抢庄牛牛房间")
	}

	// Check if already in BRNN — reconnect
	room, existing := game.GetMgr().CheckPlayerInBRNN(userId)
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
	modelUser, err := modelClient.GameLockUserBalance(userId, brnn.DefaultConfig.MinBalance)
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

	// 原子地分配房间并加入玩家，避免并发超员
	room = game.GetMgr().AssignPlayerToBRNN(p)

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
	room, _ := game.GetMgr().CheckPlayerInBRNN(userId)
	if room == nil {
		return comm.NewMyError("玩家不在房间")
	}

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

	room, _ := game.GetMgr().CheckPlayerInBRNN(userId)
	if room == nil {
		return comm.NewMyError("玩家不在房间")
	}
	return room.PlaceBetAndBroadcast(userId, req.Area, req.Chip)
}

type BRNNLobbyConfigRsp struct {
	Config *brnn.BRNNClientConfig `json:"Config"`
}

func handleBRNNGetPlayers(userId string) (*brnn.RespGetPlayers, error) {
	room, _ := game.GetMgr().CheckPlayerInBRNN(userId)
	if room == nil {
		return nil, comm.NewMyError("玩家不在房间")
	}

	key := "brnn:players:" + room.ID
	cached, err := modelComm.RedisGetCacheT[[]brnn.PlayerRankInfo](key)
	if err == nil {
		players := cached.([]brnn.PlayerRankInfo)
		return &brnn.RespGetPlayers{Players: players}, nil
	}

	// Redis 无缓存时 fallback 到实时计算
	players := buildEnrichedPlayerList(room)
	return &brnn.RespGetPlayers{Players: players}, nil
}

// buildEnrichedPlayerList 获取房间在线玩家并查 DB 充实 TotalBet/WinCount，按 TotalBet 降序排序。
func buildEnrichedPlayerList(room *brnn.BRNNRoom) []brnn.PlayerRankInfo {
	players := room.GetOnlinePlayers()

	epoch := time.Unix(0, 0)
	now := time.Now()
	for i := range players {
		p := &players[i]
		records, err := modelClient.GetUserGameRecordsJoinGameRecord(p.UserId, 20, 0, epoch, now, brnn.GameName)
		if err != nil {
			logrus.WithField("userId", p.UserId).WithError(err).Warn("brnn.GetPlayers.queryRecords")
			continue
		}
		for _, rec := range records {

			change := rec.BalanceAfter - rec.BalanceBefore
			if change > 0 {
				p.WinCount++
			}

			var betFromRecord int64
			if rec.GameData != "" {
				var gd brnn.BrnnGameDataParsed
				if err := json.Unmarshal([]byte(rec.GameData), &gd); err == nil {
					for _, pb := range gd.PlayerBets {
						if pb.UserId == p.UserId {
							for _, b := range pb.Bets {
								betFromRecord += b
							}
							break
						}
					}
				}
			}

			if betFromRecord == 0 && change != 0 {
				if change < 0 {
					betFromRecord = -change
				} else {
					betFromRecord = change
				}
			}
			p.TotalBet += betFromRecord
		}
	}

	sort.Slice(players, func(i, j int) bool {
		return players[i].TotalBet > players[j].TotalBet
	})

	return players
}

// startBRNNPlayerCacheLoop 启动后台 goroutine，每 10 秒刷新所有 BRNN 房间的在线玩家 Redis 缓存。
func startBRNNPlayerCacheLoop() {
	go func() {
		for {
			time.Sleep(10 * time.Second)
			refreshBRNNPlayersCache()
		}
	}()
}

func refreshBRNNPlayersCache() {
	rooms := game.GetMgr().GetAllBRNNRooms()
	for _, room := range rooms {
		players := buildEnrichedPlayerList(room)
		key := "brnn:players:" + room.ID
		_ = modelComm.RedisSet(key, 30*time.Second, players)
	}
}

func handleBRNNLobbyConfig() *BRNNLobbyConfigRsp {
	cfg := brnn.DefaultConfig
	return &BRNNLobbyConfigRsp{
		Config: &brnn.BRNNClientConfig{
			Chips:         cfg.Chips,
			MaxBetPerArea: cfg.MaxBetPerArea,
			MinBalance:    cfg.MinBalance,
		},
	}
}
