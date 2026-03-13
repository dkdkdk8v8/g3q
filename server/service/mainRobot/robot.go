package mainRobot

import (
	"context"
	"encoding/json"
	"math/rand"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"service/mainClient/game/znet"
	"service/modelClient"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// Robot 机器人实例
type Robot struct {
	Uid         string
	AppId       string
	AppUserId   string
	Conn        *websocket.Conn
	RoomId      string
	RoomData    *qznn.QZNNRoom
	mu          sync.Mutex
	gamesPlayed int
	isClosing   bool
	joinedCh    chan struct{} // 进入房间后关闭，通知超时 goroutine 退出
	Balance     int64
	Target      RobotAction
}

// launchRobot 启动机器人任务
func launchRobot(user *modelClient.ModelUser, action RobotAction) {
	activeRobotsMu.Lock()
	// 双重检查
	if _, ok := activeRobots[user.UserId]; ok {
		activeRobotsMu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	activeRobots[user.UserId] = &RobotRuntime{
		Cancel:    cancel,
		Action:    action,
		UserId:    user.UserId,
		StartedAt: time.Now(),
	}
	activeRobotsMu.Unlock()

	logrus.WithFields(logrus.Fields{
		"roomId": action.RoomId,
		"uid":    user.UserId,
	}).Info("Robot - Start scheduling")

	runRobot(user, ctx, action)
}

// runRobot 机器人运行逻辑
func runRobot(user *modelClient.ModelUser, ctx context.Context, action RobotAction) {
	defer func() {
		activeRobotsMu.Lock()
		delete(activeRobots, user.UserId)
		activeRobotsMu.Unlock()
	}()

	// 等待指定延迟秒数(等待真人进入房间)
	if action.DelaySec > 0 {
		logrus.WithFields(logrus.Fields{
			"roomId": action.RoomId,
			"uid":    user.UserId,
			"delay":  action.DelaySec,
		}).Info("Robot - Waiting before entering room")
		select {
		case <-time.After(time.Duration(action.DelaySec) * time.Second):
		case <-ctx.Done():
			return
		}
	}

	// 进入房间前按照规则充值
	if cfg := qznn.GetConfig(action.Level); cfg != nil {
		// 使用配置的倍数范围随机
		mult := ROBOT_BALANCE_MULT_MIN + rand.Float64()*(ROBOT_BALANCE_MULT_MAX-ROBOT_BALANCE_MULT_MIN)
		user.Balance = int64(float64(cfg.MinBalance) * mult)
		_, err := modelClient.UpdateUser(user)
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"roomId":  action.RoomId,
				"uid":     user.UserId,
				"balance": user.Balance,
			}).WithError(err).Error("Failed to update robot balance")
		} else {
			logrus.WithFields(logrus.Fields{
				"roomId":  action.RoomId,
				"uid":     user.UserId,
				"balance": user.Balance,
			}).Info("Robot - Successfully update balance")
		}
	}

	robot := &Robot{
		Uid:       user.UserId,
		AppId:     user.AppId,
		AppUserId: user.AppUserId,
		Balance:   user.Balance,
		Target:    action,
		joinedCh:  make(chan struct{}),
	}

	// 监听取消信号
	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			robot.Close()
		case <-done:
		}
	}()

	robot.Run()
	close(done)
}

// Run 运行机器人 WebSocket 连接
func (r *Robot) Run() {
	wsURL := BuildWSURL(r.AppId, r.AppUserId)
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"roomId":  r.Target.RoomId,
			"uid":     r.Uid,
			"balance": r.Balance,
		}).Errorf("Robot - Failed to connect to server: %v", err)
		return
	}

	r.mu.Lock()
	if r.isClosing {
		r.mu.Unlock()
		conn.Close()
		return
	}
	r.Conn = conn
	r.mu.Unlock()
	defer r.Conn.Close()

	// 心跳协程（带 done channel，Run 退出时立即终止）
	heartbeatDone := make(chan struct{})
	defer close(heartbeatDone)
	go StartHeartbeat(func() error {
		return r.Send(game.CmdPingPong, nil)
	}, heartbeatDone)

	// 进房超时保护：30秒内未成功进入房间则关闭连接，防止僵尸机器人
	go func() {
		select {
		case <-time.After(JOIN_ROOM_TIMEOUT * time.Second):
			r.mu.Lock()
			roomId := r.RoomId
			r.mu.Unlock()
			if roomId == "" {
				logrus.WithField("uid", r.Uid).Warn("Robot - Join room timeout (30s), closing")
				r.Close()
			}
		case <-r.joinedCh:
			// 已进入房间，提前退出
		case <-heartbeatDone:
			// Run() 已退出，goroutine 跟随退出
		}
	}()

	// 设置初始读超时
	r.Conn.SetReadDeadline(time.Now().Add(WS_READ_TIMEOUT * time.Second))

	// 消息接收循环
	for {
		var msg GenericMsg
		_, rawData, err := r.Conn.ReadMessage()
		if err == nil {
			err = comm.DecodeMsgpackViaJSON(rawData, &msg)
		}
		if err != nil {
			r.mu.Lock()
			closing := r.isClosing
			roomId := r.RoomId
			balance := r.Balance
			r.mu.Unlock()
			if closing {
				return
			}
			logrus.WithFields(logrus.Fields{
				"roomId":  roomId,
				"uid":     r.Uid,
				"balance": balance,
			}).Errorf("Robot - Read message error: %v", err)
			return
		}

		// 收到消息，重置读超时
		r.Conn.SetReadDeadline(time.Now().Add(WS_READ_TIMEOUT * time.Second))

		if msg.Code != 0 {
			r.mu.Lock()
			roomId := r.RoomId
			balance := r.Balance
			r.mu.Unlock()
			logrus.WithFields(logrus.Fields{
				"roomId":  roomId,
				"uid":     r.Uid,
				"balance": balance,
			}).Errorf("Robot - Received error: %d %s", msg.Code, msg.Msg)
			// 如果还没进入房间就收到错误（如房间已满），直接退出避免变成僵尸
			if roomId == "" {
				logrus.WithField("uid", r.Uid).Info("Robot - Not in room, closing due to error")
				return
			}
			continue
		}

		if msg.Cmd == comm.ServerPush {
			r.handlePush(msg.PushType, msg.Data)
		}
	}
}

// Send 发送 msgpack 二进制帧到主服务器
func (r *Robot) Send(cmd comm.CmdType, data interface{}) error {
	return SendWSMessage(r.Conn, &r.mu, cmd, data)
}

// Close 关闭连接
func (r *Robot) Close() {
	r.mu.Lock()
	r.isClosing = true
	conn := r.Conn
	r.mu.Unlock()
	if conn != nil {
		conn.Close()
	}
}

// handlePush 处理推送消息
func (r *Robot) handlePush(pushType comm.PushType, data []byte) {
	switch pushType {
	case znet.PushRouter:
		var d struct {
			Router znet.RouterType `json:"Router"`
			Room   json.RawMessage `json:"Room"`
		}
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.WithFields(logrus.Fields{"uid": r.Uid, "pushType": pushType}).Errorf("Robot - Failed to parse PushRouter: %v", err)
			return
		}
		switch d.Router {
		case znet.Lobby:
			// 检查余额
			cfg := qznn.GetConfig(r.Target.Level)
			r.mu.Lock()
			currentBalance := r.Balance
			r.mu.Unlock()
			if cfg != nil && currentBalance < cfg.MinBalance {
				logrus.WithFields(logrus.Fields{
					"roomId":  r.Target.RoomId,
					"uid":     r.Uid,
					"balance": currentBalance,
					"min":     cfg.MinBalance,
				}).Info("Robot - Balance not enough, closing")
				r.Close()
				return
			}
			// 进入大厅后，根据 Target 指令进入房间
			req := map[string]interface{}{
				"Level":      r.Target.Level,
				"BankerType": r.Target.BankerType,
			}
			if r.Target.RoomId != "" {
				req["RoomId"] = r.Target.RoomId
			}
			r.Send(qznn.CmdPlayerJoin, req)
			logrus.WithFields(logrus.Fields{
				"roomId":  r.Target.RoomId,
				"uid":     r.Uid,
				"balance": currentBalance,
			}).Info("Robot - Sending join room request")

		case znet.Game:
			var room qznn.QZNNRoom
			if err := json.Unmarshal(d.Room, &room); err != nil {
				logrus.WithFields(logrus.Fields{"uid": r.Uid}).Errorf("Robot - Failed to parse Game room: %v", err)
			} else {
				r.updateRoomInfo(&room)
				r.mu.Lock()
				bal := r.Balance
				r.mu.Unlock()
				logrus.WithFields(logrus.Fields{
					"roomId":  room.ID,
					"uid":     r.Uid,
					"balance": bal,
				}).Info("Robot - Successfully synced room entry")
				// 进入房间后延迟发送准备（模拟真人）
				roomID := room.ID
				roomState := room.State
				go func() {
					time.Sleep(randomActionDelay())
					r.Send(qznn.CmdPlayerReady, map[string]interface{}{"RoomId": roomID})
					r.handleStateChange(roomState)
				}()
			}
		}

	case qznn.PushChangeState:
		var d qznn.PushChangeStateStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.WithFields(logrus.Fields{"uid": r.Uid, "pushType": pushType}).Errorf("Robot - Failed to parse push: %v", err)
			return
		}
		if d.Room != nil {
			r.mu.Lock()
			bal := r.Balance
			r.mu.Unlock()
			logrus.WithFields(logrus.Fields{
				"roomId":  d.Room.ID,
				"uid":     r.Uid,
				"balance": bal,
				"state":   d.State,
			}).Info("Robot - Received state change")
		}
		r.updateRoomInfo(d.Room)
		r.handleStateChange(d.State)

	case qznn.PushPlayJoin:
		var d qznn.PushPlayerJoinStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.WithFields(logrus.Fields{"uid": r.Uid, "pushType": pushType}).Errorf("Robot - Failed to parse push: %v", err)
			return
		}
		r.updateRoomInfo(d.Room)
		if d.Room != nil && d.UserId == r.Uid {
			r.mu.Lock()
			bal := r.Balance
			r.mu.Unlock()
			logrus.WithFields(logrus.Fields{
				"roomId":  d.Room.ID,
				"uid":     r.Uid,
				"balance": bal,
			}).Info("Robot - Successfully joined room")
		}

	case qznn.PushPlayLeave:
		var d qznn.PushPlayerLeaveStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.WithFields(logrus.Fields{"uid": r.Uid, "pushType": pushType}).Errorf("Robot - Failed to parse push: %v", err)
			return
		}
		r.updateRoomInfo(d.Room)
		if d.Room != nil {
			for _, uid := range d.UserIds {
				if uid == r.Uid {
					r.mu.Lock()
					bal := r.Balance
					r.mu.Unlock()
					logrus.WithFields(logrus.Fields{
						"roomId":  d.Room.ID,
						"uid":     r.Uid,
						"balance": bal,
					}).Info("Robot - Kicked from room, closing")
					r.Close()
					return
				}
			}
			// 如果房间内只剩自己，主动退出
			r.checkAloneAndLeave()
		}

	case qznn.PushPlayerCallBanker:
		var d qznn.PushPlayerCallBankerStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.WithFields(logrus.Fields{"uid": r.Uid, "pushType": pushType}).Errorf("Robot - Failed to parse push: %v", err)
			return
		}
		r.updateRoomInfo(d.Room)

	case qznn.PushPlayerPlaceBet:
		var d qznn.PushPlayerPlaceBetStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.WithFields(logrus.Fields{"uid": r.Uid, "pushType": pushType}).Errorf("Robot - Failed to parse push: %v", err)
			return
		}
		r.updateRoomInfo(d.Room)

	case qznn.PushPlayerShowCard:
		var d qznn.PushPlayerShowCardStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.WithFields(logrus.Fields{"uid": r.Uid, "pushType": pushType}).Errorf("Robot - Failed to parse push: %v", err)
			return
		}
		r.updateRoomInfo(d.Room)

	case qznn.PushRoom:
		var d qznn.PushRoomStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.WithFields(logrus.Fields{"uid": r.Uid, "pushType": pushType}).Errorf("Robot - Failed to parse push: %v", err)
			return
		}
		r.updateRoomInfo(d.Room)
	}
}

// updateRoomInfo 更新房间数据
func (r *Robot) updateRoomInfo(room *qznn.QZNNRoom) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if room != nil {
		prevRoomId := r.RoomId
		r.RoomData = room
		r.RoomId = room.ID
		for _, p := range room.Players {
			if p != nil && p.ID == r.Uid {
				r.Balance = p.Balance
				break
			}
		}
		// 首次进入房间时同步实际房间ID并通知超时 goroutine 退出
		if prevRoomId == "" && room.ID != "" {
			// 同步实际房间ID到 activeRobots（服务端可能分配到非目标房间）
			activeRobotsMu.Lock()
			if rt, ok := activeRobots[r.Uid]; ok {
				rt.Action.RoomId = room.ID
			}
			activeRobotsMu.Unlock()

			if r.joinedCh != nil {
				select {
				case <-r.joinedCh:
					// 已关闭
				default:
					close(r.joinedCh)
				}
			}
		}
	}
}

// handleStateChange 处理游戏状态变化
func (r *Robot) handleStateChange(state qznn.RoomState) {
	r.mu.Lock()
	roomSnapshot := r.RoomData
	currentRoomId := r.RoomId
	r.mu.Unlock()

	go func() {
		defer func() {
			if rv := recover(); rv != nil {
				logrus.WithFields(logrus.Fields{"uid": r.Uid, "state": state}).Errorf("Robot - handleStateChange panic: %v", rv)
			}
		}()

		// 模拟用户随机等待
		time.Sleep(randomActionDelay())

		// 检查机器人是否已关闭，避免往已断开的连接发消息
		r.mu.Lock()
		if r.isClosing {
			r.mu.Unlock()
			return
		}
		r.mu.Unlock()

		switch state {
		case qznn.StateBanking:
			mult := int64(1)
			if roomSnapshot != nil && len(roomSnapshot.Config.BankerMult) > 0 {
				mult = roomSnapshot.Config.BankerMult[rand.Intn(len(roomSnapshot.Config.BankerMult))]
			} else {
				mult = int64(rand.Intn(4))
			}
			r.mu.Lock()
			bal := r.Balance
			r.mu.Unlock()
			logrus.WithFields(logrus.Fields{
				"roomId":  currentRoomId,
				"uid":     r.Uid,
				"balance": bal,
				"mult":    mult,
			}).Info("Robot - Sending call banker request")
			r.Send(qznn.CmdPlayerCallBanker, map[string]interface{}{"RoomId": currentRoomId, "Mult": mult})

		case qznn.StateBetting:
			// 庄家不能下注
			if roomSnapshot != nil && roomSnapshot.BankerID == r.Uid {
				return
			}
			mult := int64(1)
			if roomSnapshot != nil && len(roomSnapshot.Config.BetMult) > 0 {
				mult = roomSnapshot.Config.BetMult[rand.Intn(len(roomSnapshot.Config.BetMult))]
			} else {
				mult = int64(rand.Intn(5) + 1)
			}
			r.mu.Lock()
			bal := r.Balance
			r.mu.Unlock()
			logrus.WithFields(logrus.Fields{
				"roomId":  currentRoomId,
				"uid":     r.Uid,
				"balance": bal,
				"mult":    mult,
			}).Info("Robot - Sending place bet request")
			r.Send(qznn.CmdPlayerPlaceBet, map[string]interface{}{"RoomId": currentRoomId, "Mult": mult})

		case qznn.StateShowCard:
			r.mu.Lock()
			bal := r.Balance
			r.mu.Unlock()
			logrus.WithFields(logrus.Fields{
				"roomId":  currentRoomId,
				"uid":     r.Uid,
				"balance": bal,
			}).Info("Robot - Sending show card request")
			r.Send(qznn.CmdPlayerShowCard, map[string]interface{}{"RoomId": currentRoomId})

		case qznn.StateSettling:
			isOb := true
			if roomSnapshot != nil {
				for _, p := range roomSnapshot.Players {
					if p != nil && p.ID == r.Uid {
						isOb = p.IsOb
						break
					}
				}
			}

			r.mu.Lock()
			if !isOb {
				r.gamesPlayed++
			}
			r.mu.Unlock()

			// 检查是否因配置变化需要主动退出
			activeRobotsMu.Lock()
			rt, exists := activeRobots[r.Uid]
			shouldLeave := exists && rt.ShouldLeave.Load()
			activeRobotsMu.Unlock()
			if shouldLeave {
				logrus.WithFields(logrus.Fields{
					"roomId": currentRoomId,
					"uid":    r.Uid,
				}).Info("Robot - Graceful leave due to RobotsPerRoom config change")
				r.Send(qznn.CmdPlayerLeave, map[string]interface{}{"RoomId": currentRoomId})
				r.Close()
				return
			}

			r.checkLeave()
		}
	}()
}

// checkLeave 检查是否退出房间
func (r *Robot) checkLeave() {
	go func() {
		defer func() {
			if rv := recover(); rv != nil {
				logrus.WithFields(logrus.Fields{"uid": r.Uid}).Errorf("Robot - checkLeave panic: %v", rv)
			}
		}()

		// 随机等待
		time.Sleep(randomActionDelay())

		r.mu.Lock()
		if r.isClosing {
			r.mu.Unlock()
			return
		}
		roomData := r.RoomData
		gamesPlayed := r.gamesPlayed
		roomId := r.RoomId
		balance := r.Balance
		r.mu.Unlock()

		if roomData == nil {
			return
		}

		// 计算房间内其他玩家数量
		totalCount := 0
		for _, p := range roomData.Players {
			if p != nil {
				totalCount++
			}
		}
		otherCount := totalCount - 1 // 减去自己

		// 游戏最小局数后按照概率退出房间
		if gamesPlayed < MIN_GAMES {
			return
		}

		// 根据房间人数决定退出概率
		var prob float64
		switch {
		case otherCount >= 4:
			prob = PROB_LEAVE_5_PLAYERS
		case otherCount == 3:
			prob = PROB_LEAVE_4_PLAYERS
		case otherCount == 2:
			prob = PROB_LEAVE_3_PLAYERS
		default:
			prob = PROB_LEAVE_2_PLAYERS // 0, 即只有1个其他玩家时不退出
		}

		if prob > 0 && rand.Float64() < prob {
			// 检查房间内机器人数量是否会低于下限
			minRobots, _ := getRobotsPerRoomRange()
			activeRobotsMu.Lock()
			robotsInRoom := 0
			for _, rt := range activeRobots {
				if rt.Action.RoomId == roomId {
					robotsInRoom++
				}
			}
			activeRobotsMu.Unlock()
			if robotsInRoom <= minRobots {
				logrus.WithFields(logrus.Fields{
					"roomId":       roomId,
					"uid":          r.Uid,
					"robotsInRoom": robotsInRoom,
					"min":          minRobots,
				}).Info("Robot - Skip leaving, would drop below minimum robots")
				return
			}

			cooldownKey := roomId + ":" + r.Uid
			roomLeaveMu.Lock()
			if lastTime, ok := roomLeaveCooldown[cooldownKey]; ok && time.Since(lastTime) < ROOM_LEAVE_COOLDOWN*time.Second {
				roomLeaveMu.Unlock()
				return
			}
			roomLeaveCooldown[cooldownKey] = time.Now()
			roomLeaveMu.Unlock()

			logrus.WithFields(logrus.Fields{"roomId": roomId, "uid": r.Uid, "balance": balance}).Infof("Robot - Decided to leave room, other players: %d, games played: %d, probability: %.2f", otherCount, gamesPlayed, prob)
			r.Send(qznn.CmdPlayerLeave, map[string]interface{}{"RoomId": roomId})
			r.Close()
		}
	}()
}

// checkAloneAndLeave 房间内只剩自己时主动退出
func (r *Robot) checkAloneAndLeave() {
	r.mu.Lock()
	roomData := r.RoomData
	roomId := r.RoomId
	balance := r.Balance
	r.mu.Unlock()

	if roomData == nil {
		return
	}

	otherCount := 0
	for _, p := range roomData.Players {
		if p != nil && p.ID != r.Uid {
			otherCount++
		}
	}

	if otherCount == 0 {
		logrus.WithFields(logrus.Fields{
			"roomId":  roomId,
			"uid":     r.Uid,
			"balance": balance,
		}).Info("Robot - Alone in room, leaving")
		r.Send(qznn.CmdPlayerLeave, map[string]interface{}{"RoomId": roomId})
		r.Close()
	}
}
