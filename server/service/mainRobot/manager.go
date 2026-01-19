package mainRobot

import (
	"context"
	"encoding/json"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"service/comm"
	"service/initMain"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"service/mainClient/game/znet"
	"service/modelClient"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

var targetHost = HOST_PROD

// StartRobot 启动机器人管理服务
func StartRobot() {
	if initMain.DefCtx.IsTerm {
		targetHost = HOST_DEV
	}
	go managerLoop()
}

// RobotRuntime 机器人运行时状态
type RobotRuntime struct {
	Cancel context.CancelFunc
	Action RobotAction
	UserId string
}

var (
	activeRobots   = make(map[string]*RobotRuntime)
	activeRobotsMu sync.Mutex
	robotOffset    = 0 // 用于轮询数据库中的机器人

	roomLeaveMu       sync.Mutex
	roomLeaveCooldown = make(map[string]time.Time)
)

// PlayerSimple 用于解析 HTTP 接口返回的玩家数据
type PlayerSimple struct {
	ID       string
	IsRobot  bool
	Nickname string
	Avatar   string
}

// RoomDataSimple 用于解析 HTTP 接口返回的房间数据
type RoomDataSimple struct {
	ID         string
	Players    []*PlayerSimple
	Config     qznn.LobbyConfig
	BankerType int
}

// RobotAction 机器人调度动作
type RobotAction struct {
	Level      int
	BankerType int
	RoomId     string // 如果为空则创建新房间
}

// managerLoop 管理器主循环
func managerLoop() {
	for {
		managerRound()
		cleanupRoomLeaveCooldown()
		time.Sleep(time.Second * MANAGER_LOOP_INTERVAL)
	}
}

// cleanupRoomLeaveCooldown 清理过期的房间退出记录
func cleanupRoomLeaveCooldown() {
	roomLeaveMu.Lock()
	defer roomLeaveMu.Unlock()

	if len(roomLeaveCooldown) == 0 {
		return
	}

	for roomId, lastTime := range roomLeaveCooldown {
		if time.Since(lastTime) > ROOM_LEAVE_COOLDOWN*time.Second {
			delete(roomLeaveCooldown, roomId)
		}
	}
}

func isRobotCompatible(user *modelClient.ModelUser, room *RoomDataSimple) bool {
	for _, p := range room.Players {
		if p != nil && p.IsRobot {
			if p.Nickname == user.NickName || p.Avatar == user.Avatar {
				return false
			}
		}
	}
	return true
}

// managerRound 执行一轮调度
func managerRound() {
	// 1. 读取全部房间数据
	rooms, err := fetchRooms()
	if err != nil {
		logrus.Errorf("Failed to fetch room list: %v", err)
		return
	}

	// 2. 根据优先级生成行动计划
	actions := planActions(rooms)
	if len(actions) == 0 {
		return
	}

	// 3. 获取闲置机器人 (固定200个)
	robots := fetchIdleRobots(200)
	if len(robots) == 0 {
		return
	}

	// 4. 执行调度
	roomMap := make(map[string]*RoomDataSimple)
	for _, r := range rooms {
		roomMap[r.ID] = r
	}

	usedRobotIndices := make(map[int]bool)
	for _, action := range actions {
		for i, robot := range robots {
			if usedRobotIndices[i] {
				continue
			}

			if action.RoomId != "" {
				if room, ok := roomMap[action.RoomId]; ok {
					if !isRobotCompatible(robot, room) {
						logrus.WithFields(logrus.Fields{
							"roomId": action.RoomId,
							"uid":    robot.UserId,
							"nick":   robot.NickName,
						}).Info("Robot - Compatibility check failed (duplicate nickname or avatar), skipping room")
						continue
					}
					// 虚拟加入，防止本轮后续机器人冲突
					room.Players = append(room.Players, &PlayerSimple{
						IsRobot:  true,
						Nickname: robot.NickName,
						Avatar:   robot.Avatar,
					})
				}
			}

			usedRobotIndices[i] = true
			go launchRobot(robot, action)
			break
		}
	}
}

// planActions 根据房间状态生成调度计划
func planActions(rooms []*RoomDataSimple) []RobotAction {
	var actions []RobotAction

	// 分类房间
	// pureRobotRooms: [Level][BankerType] -> List of Rooms
	pureRobotRooms := make(map[int]map[int][]*RoomDataSimple)
	// realUserRooms: List of Rooms (Only 1 real user, 0 robots)
	var realUserRooms []*RoomDataSimple
	// mixedRooms: List of Rooms (Real > 0 && Robot > 0)
	var mixedRooms []*RoomDataSimple

	for _, room := range rooms {
		hasReal := false
		robotCount := 0
		playerCount := 0

		for _, p := range room.Players {
			if p != nil {
				playerCount++
				if p.IsRobot {
					robotCount++
				} else {
					hasReal = true
				}
			}
		}

		if hasReal {
			// 只有1个用户且没有机器人
			if playerCount == 1 && robotCount == 0 {
				realUserRooms = append(realUserRooms, room)
			} else if robotCount > 0 {
				// 混合房间：有真人也有机器人
				mixedRooms = append(mixedRooms, room)
			}
		} else {
			// 纯机器人房间
			if pureRobotRooms[room.Config.Level] == nil {
				pureRobotRooms[room.Config.Level] = make(map[int][]*RoomDataSimple)
			}
			pureRobotRooms[room.Config.Level][room.Config.BankerType] = append(pureRobotRooms[room.Config.Level][room.Config.BankerType], room)
		}
	}

	// 策略1：真实用户房间 (1人0机器人) -> 进1个机器人
	for _, room := range realUserRooms {
		actions = append(actions, RobotAction{
			Level:      room.Config.Level,
			BankerType: room.Config.BankerType,
			RoomId:     room.ID,
		})
	}

	// 策略2：维护纯机器人房间数量
	for _, level := range ALLOWED_LEVELS {
		for _, bt := range ALLOWED_BANKER_TYPES {
			existing := pureRobotRooms[level][bt]
			count := len(existing)

			if count < MIN_ROBOT_ROOMS {
				need := MIN_ROBOT_ROOMS - count
				for i := 0; i < need; i++ {
					actions = append(actions, RobotAction{
						Level:      level,
						BankerType: bt,
						RoomId:     "", // Create new
					})
				}
			}

			// 策略3：只有机器人的房间，人数不满4个 -> 50%概率进1个机器人
			for _, room := range existing {
				pCount := 0
				for _, p := range room.Players {
					if p != nil {
						pCount++
					}
				}

				if pCount < 4 && rand.Intn(2) == 1 {
					actions = append(actions, RobotAction{
						Level:      level,
						BankerType: bt,
						RoomId:     room.ID,
					})
				}
			}
		}
	}

	// 策略4：混合房间 (有真人也有机器人)，若有空位则派机器人进入
	for _, room := range mixedRooms {
		pCount := 0
		for _, p := range room.Players {
			if p != nil {
				pCount++
			}
		}

		if pCount < 5 {
			actions = append(actions, RobotAction{
				Level:      room.Config.Level,
				BankerType: room.Config.BankerType,
				RoomId:     room.ID,
			})
		}
	}

	return actions
}

// fetchIdleRobots 获取指定数量的闲置机器人
func fetchIdleRobots(count int) []*modelClient.ModelUser {
	var result []*modelClient.ModelUser
	// 尝试获取更多以过滤掉忙碌的机器人
	limit := count * 2
	if limit < 200 {
		limit = 200
	}

	attempts := 0
	// 简单的重试机制，防止刚好读到末尾
	for len(result) < count && attempts < 3 {
		users, err := modelClient.GetRobots(limit, robotOffset)
		if err != nil || len(users) == 0 {
			robotOffset = 0 // 重置到开头
			attempts++
			continue
		}

		activeRobotsMu.Lock()
		for _, u := range users {
			if _, ok := activeRobots[u.UserId]; !ok {
				result = append(result, u)
				if len(result) >= count {
					break
				}
			}
		}
		activeRobotsMu.Unlock()

		robotOffset += len(users)
		if len(users) < limit {
			robotOffset = 0 // 读完一轮，重置
		}
	}
	return result
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
		Cancel: cancel,
		Action: action,
		UserId: user.UserId,
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

// fetchRooms 获取房间列表
func fetchRooms() ([]*RoomDataSimple, error) {
	u := url.URL{
		Scheme: "http",
		Host:   targetHost,
		Path:   PATH_RPC_DATA,
	}
	resp, err := http.Get(u.String())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data string `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	var roomMap map[string]*RoomDataSimple
	if err := json.Unmarshal([]byte(result.Data), &roomMap); err != nil {
		return nil, err
	}

	var rooms []*RoomDataSimple
	for _, r := range roomMap {
		rooms = append(rooms, r)
	}
	return rooms, nil
}

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
	Balance     int64
	Target      RobotAction
}

// Run 运行机器人 WebSocket 连接
func (r *Robot) Run() {
	u := url.URL{
		Scheme: "ws",
		Host:   targetHost,
		Path:   PATH_WS,
	}
	q := u.Query()
	q.Set("uid", r.AppUserId)
	q.Set("app", r.AppId)
	u.RawQuery = q.Encode()

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
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

	// 心跳协程
	go func() {
		ticker := time.NewTicker(time.Second * 5)
		defer ticker.Stop()
		for range ticker.C {
			if err := r.Send(game.CmdPingPong, nil); err != nil {
				return
			}
		}
	}()

	// 消息接收循环
	for {
		type GenericMsg struct {
			Cmd      comm.CmdType    `json:"Cmd"`
			PushType comm.PushType   `json:"PushType"`
			Data     json.RawMessage `json:"Data"`
			Code     int             `json:"Code"`
			Msg      string          `json:"Msg"`
		}
		var msg GenericMsg
		err := r.Conn.ReadJSON(&msg)
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

		if msg.Code != 0 {
			r.mu.Lock()
			balance := r.Balance
			r.mu.Unlock()
			logrus.WithFields(logrus.Fields{
				"roomId":  r.RoomId,
				"uid":     r.Uid,
				"balance": balance,
			}).Errorf("Robot - Received error: %d %s", msg.Code, msg.Msg)
			continue
		}

		if msg.Cmd == comm.ServerPush {
			r.handlePush(msg.PushType, msg.Data)
		}
	}
}

// Send 发送请求
func (r *Robot) Send(cmd comm.CmdType, data interface{}) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	req := comm.Request{Cmd: cmd}
	if data != nil {
		b, _ := json.Marshal(data)
		req.Data = b
	}
	return r.Conn.WriteJSON(req)
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
		json.Unmarshal(data, &d)
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
			if err := json.Unmarshal(d.Room, &room); err == nil {
				r.updateRoomInfo(&room)
				r.mu.Lock()
				bal := r.Balance
				r.mu.Unlock()
				logrus.WithFields(logrus.Fields{
					"roomId":  room.ID,
					"uid":     r.Uid,
					"balance": bal,
				}).Info("Robot - Successfully synced room entry")
				r.handleStateChange(room.State)
			}
		}

	case qznn.PushChangeState:
		var d qznn.PushChangeStateStruct
		if err := json.Unmarshal(data, &d); err != nil {
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
					}).Info("Robot - Successfully left room")
				}
			}
		}

	case qznn.PushPlayerCallBanker:
		var d qznn.PushPlayerCallBankerStruct
		if err := json.Unmarshal(data, &d); err != nil {
			return
		}
		r.updateRoomInfo(d.Room)

	case qznn.PushPlayerPlaceBet:
		var d qznn.PushPlayerPlaceBetStruct
		if err := json.Unmarshal(data, &d); err != nil {
			return
		}
		r.updateRoomInfo(d.Room)

	case qznn.PushPlayerShowCard:
		var d qznn.PushPlayerShowCardStruct
		if err := json.Unmarshal(data, &d); err != nil {
			return
		}
		r.updateRoomInfo(d.Room)

	case qznn.PushRoom:
		var d qznn.PushRoomStruct
		if err := json.Unmarshal(data, &d); err != nil {
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
		r.RoomData = room
		r.RoomId = room.ID
		for _, p := range room.Players {
			if p != nil && p.ID == r.Uid {
				r.Balance = p.Balance
				break
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
		// 模拟用户随机等待 1-3 秒
		time.Sleep(time.Duration(rand.Intn(3)+1) * time.Second)

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
			r.checkLeave()
		}
	}()
}

// checkLeave 检查是否退出房间
func (r *Robot) checkLeave() {
	go func() {
		// 随机等待 1-3 秒
		time.Sleep(time.Duration(rand.Intn(3)+1) * time.Second)

		r.mu.Lock()
		roomData := r.RoomData
		gamesPlayed := r.gamesPlayed
		roomId := r.RoomId
		balance := r.Balance
		r.mu.Unlock()

		if roomData == nil {
			return
		}

		// 计算当前房间人数
		count := 0
		for _, p := range roomData.Players {
			if p != nil {
				count++
			}
		}

		// 游戏最小局数后按照概率退出房间
		if gamesPlayed < MIN_GAMES {
			return
		}

		var prob float64
		switch count {
		case 5:
			prob = PROB_LEAVE_5_PLAYERS
		case 4:
			prob = PROB_LEAVE_4_PLAYERS
		case 3:
			prob = PROB_LEAVE_3_PLAYERS
		default:
			prob = PROB_LEAVE_2_PLAYERS
		}

		if prob > 0 && rand.Float64() < prob {
			roomLeaveMu.Lock()
			if lastTime, ok := roomLeaveCooldown[roomId]; ok && time.Since(lastTime) < ROOM_LEAVE_COOLDOWN*time.Second {
				roomLeaveMu.Unlock()
				return
			}
			roomLeaveCooldown[roomId] = time.Now()
			roomLeaveMu.Unlock()

			logrus.WithFields(logrus.Fields{"roomId": roomId, "uid": r.Uid, "balance": balance}).Infof("Robot - Decided to leave room, current players: %d, games played: %d, probability: %.2f", count, gamesPlayed, prob)
			r.Send(qznn.CmdPlayerLeave, map[string]interface{}{"RoomId": roomId})
			r.Close()
		}
	}()
}
