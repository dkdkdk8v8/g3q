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
	ID      string
	IsRobot bool
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

// managerRound 执行一轮调度
func managerRound() {
	// 1. 读取全部房间数据
	rooms, err := fetchRooms()
	if err != nil {
		logrus.Errorf("获取房间列表失败: %v", err)
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
	// 取行动数和机器人数的较小值
	count := len(actions)
	if len(robots) < count {
		count = len(robots)
	}

	for i := 0; i < count; i++ {
		go launchRobot(robots[i], actions[i])
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
		"uid":    user.UserId,
		"roomId": action.RoomId,
	}).Info("机器人-开始调度")

	runRobot(user, ctx, action)
}

// runRobot 机器人运行逻辑
func runRobot(user *modelClient.ModelUser, ctx context.Context, action RobotAction) {
	defer func() {
		activeRobotsMu.Lock()
		delete(activeRobots, user.UserId)
		activeRobotsMu.Unlock()
	}()

	// 5. 进入房间前按照目前的规则充值
	if cfg := qznn.GetConfig(action.Level); cfg != nil {
		// 使用配置的倍数范围随机
		mult := ROBOT_BALANCE_MULT_MIN + rand.Float64()*(ROBOT_BALANCE_MULT_MAX-ROBOT_BALANCE_MULT_MIN)
		user.Balance = int64(float64(cfg.MinBalance) * mult)
		if _, err := modelClient.UpdateUser(user); err != nil {
			logrus.WithField("uid", user.UserId).WithField("roomId", action.RoomId).WithError(err).Error("更新机器人余额失败")
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
		logrus.WithField("roomId", r.Target.RoomId).Errorf("机器人 %s 连接服务器失败: %v", r.Uid, err)
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
			r.mu.Unlock()
			if closing {
				return
			}
			// logrus.Errorf("机器人 %s 读取消息错误: %v", r.Uid, err)
			return
		}

		if msg.Code != 0 {
			logrus.WithField("roomId", r.RoomId).Errorf("机器人 %s 收到错误: %d %s", r.Uid, msg.Code, msg.Msg)
			return
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
				"uid":    r.Uid,
				"roomId": r.Target.RoomId,
			}).Info("机器人-发送进入房间请求")

		case znet.Game:
			var room qznn.QZNNRoom
			if err := json.Unmarshal(d.Room, &room); err == nil {
				r.updateRoomInfo(&room)
				logrus.WithFields(logrus.Fields{
					"uid":    r.Uid,
					"roomId": room.ID,
				}).Info("机器人-进入房间同步成功")
				r.handleStateChange(room.State)
			}
		}

	case qznn.PushChangeState:
		var d qznn.PushChangeStateStruct
		if err := json.Unmarshal(data, &d); err != nil {
			return
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
			logrus.WithFields(logrus.Fields{
				"uid":    r.Uid,
				"roomId": d.Room.ID,
			}).Info("机器人-加入房间成功")
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
					logrus.WithFields(logrus.Fields{
						"uid":    r.Uid,
						"roomId": d.Room.ID,
					}).Info("机器人-离开房间成功")
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
		// 模拟用户随机等待 1-2 秒
		time.Sleep(time.Duration(rand.Intn(2)+1) * time.Second)
		r.checkTalk(state)

		switch state {
		case qznn.StateBanking:
			mult := int64(1)
			if roomSnapshot != nil && len(roomSnapshot.Config.BankerMult) > 0 {
				mult = roomSnapshot.Config.BankerMult[rand.Intn(len(roomSnapshot.Config.BankerMult))]
			} else {
				mult = int64(rand.Intn(4))
			}
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
			r.Send(qznn.CmdPlayerPlaceBet, map[string]interface{}{"RoomId": currentRoomId, "Mult": mult})

		case qznn.StateShowCard:
			r.Send(qznn.CmdPlayerShowCard, map[string]interface{}{"RoomId": currentRoomId})

		case qznn.StateSettling:
			r.mu.Lock()
			r.gamesPlayed++
			r.mu.Unlock()
			r.checkLeave()
		}
	}()
}

// checkTalk 检查是否发送聊天
func (r *Robot) checkTalk(state qznn.RoomState) {
	r.mu.Lock()
	gamesPlayed := r.gamesPlayed
	roomId := r.RoomId
	uid := r.Uid
	r.mu.Unlock()

	// 任意阶段都有概率说话
	if rand.Float64() < 0.02 {
		go func() {
			// 随机延迟 0.5 - 2.5 秒
			time.Sleep(time.Duration(rand.Intn(2000)+500) * time.Millisecond)
			talkType := rand.Intn(2) // 0 or 1
			var index int
			if talkType == 0 {
				index = rand.Intn(11) // 0-10
			} else {
				index = rand.Intn(16) // 0-15
			}

			logrus.WithFields(logrus.Fields{
				"uid":         uid,
				"roomId":      roomId,
				"gamesPlayed": gamesPlayed,
				"state":       state,
				"type":        talkType,
				"index":       index,
			}).Info("机器人-发送聊天/表情")

			r.Send(qznn.CmdTalk, map[string]interface{}{
				"RoomId": roomId,
				"Type":   talkType,
				"Index":  index,
			})
		}()
	}
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

			logrus.WithField("roomId", roomId).Infof("机器人 %s 决定退出房间，当前房间人数: %d, 概率: %.2f", r.Uid, count, prob)
			r.Send(qznn.CmdPlayerLeave, map[string]interface{}{"RoomId": roomId})
			r.Close()
		}
	}()
}
