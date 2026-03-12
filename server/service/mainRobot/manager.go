package mainRobot

import (
	"compoment/rds"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
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

const (
	RedisDbRobot     = 9                    // 机器人状态专用 Redis DB
	RedisKeyRobotMap = "robot:active_rooms" // Hash: userId → JSON{RoomId,Level,BankerType}
	RedisSaveInterval = 10                  // 状态保存间隔(秒)
)

// RobotStateEntry Redis 中保存的机器人房间分配
type RobotStateEntry struct {
	RoomId     string `json:"r"`
	Level      int    `json:"l"`
	BankerType int    `json:"b"`
}

var targetHost = HOST_PROD

// StartRobot 启动机器人管理服务
func StartRobot() {
	if initMain.DefCtx.IsTerm {
		targetHost = HOST_DEV
	}
	// 从 Redis 恢复上次的机器人房间分配
	restoreRobotsFromRedis()
	go managerLoop()
	go redisSaveLoop()
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
	ID                   string
	Players              []*PlayerSimple
	Config               qznn.LobbyConfig
	BankerType           int
	LastRealPlayerJoinAt time.Time
}

// RobotAction 机器人调度动作
type RobotAction struct {
	Level      int
	BankerType int
	RoomId     string // 如果为空则创建新房间
	DelaySec   int    // 进入房间前等待秒数(等待真人进入)
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

// cleanupAllRobotRooms 清理纯机器人房间(没有真人时让机器人退出)
func cleanupAllRobotRooms(rooms []*RoomDataSimple) {
	for _, room := range rooms {
		realCount := 0
		robotCount := 0
		for _, p := range room.Players {
			if p != nil {
				if p.IsRobot {
					robotCount++
				} else {
					realCount++
				}
			}
		}
		if realCount == 0 && robotCount > 0 {
			activeRobotsMu.Lock()
			var toCancel []*RobotRuntime
			for _, rt := range activeRobots {
				if rt.Action.RoomId == room.ID {
					toCancel = append(toCancel, rt)
				}
			}
			activeRobotsMu.Unlock()
			for _, rt := range toCancel {
				rt.Cancel()
			}
		}
	}
}

// managerRound 执行一轮调度
func managerRound() {
	// 1. 读取全部房间数据
	rooms, err := fetchRooms()
	if err != nil {
		logrus.Errorf("Failed to fetch room list: %v", err)
		return
	}

	// 清理纯机器人房间(真人全部离开后机器人也退出)
	cleanupAllRobotRooms(rooms)

	// 2. 统计每个房间已派发但尚未进入的"在途"机器人数
	pendingPerRoom := make(map[string]int)
	activeRobotsMu.Lock()
	for _, rt := range activeRobots {
		if rt.Action.RoomId != "" {
			pendingPerRoom[rt.Action.RoomId]++
		}
	}
	activeRobotsMu.Unlock()

	// 3. 根据优先级生成行动计划（扣除在途机器人）
	actions := planActions(rooms, pendingPerRoom)
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
// 每个房间最多 MAX_ROBOTS_PER_ROOM 个机器人，每个机器人等待 2-5 秒再进入
// pendingPerRoom: 每个房间已派发但尚未进入的"在途"机器人数（从 activeRobots 统计）
func planActions(rooms []*RoomDataSimple, pendingPerRoom map[string]int) []RobotAction {
	var actions []RobotAction

	for _, room := range rooms {
		playerCount := 0
		robotCount := 0
		realCount := 0

		for _, p := range room.Players {
			if p != nil {
				playerCount++
				if p.IsRobot {
					robotCount++
				} else {
					realCount++
				}
			}
		}

		// 加上在途机器人数（已派发但尚未进入房间的）
		// pendingPerRoom 包含该房间所有活跃机器人（含已在房间内的），减去房间内已有的才是在途数
		inTransit := pendingPerRoom[room.ID] - robotCount
		if inTransit < 0 {
			inTransit = 0
		}
		playerCount += inTransit
		robotCount += inTransit

		// 跳过满员房间
		if playerCount >= 5 {
			continue
		}
		// 跳过已达机器人上限的房间
		if robotCount >= MAX_ROBOTS_PER_ROOM {
			continue
		}
		// 跳过没有真人的房间
		if realCount == 0 {
			continue
		}
		// 跳过 LastRealPlayerJoinAt 为零值的房间
		if room.LastRealPlayerJoinAt.IsZero() {
			continue
		}
		// 真人加入后至少等 ROBOT_JOIN_DELAY_MIN 秒
		if time.Since(room.LastRealPlayerJoinAt) < time.Duration(ROBOT_JOIN_DELAY_MIN)*time.Second {
			continue
		}

		// 计算还需要多少个机器人（不超过空位数）
		emptySeats := 5 - playerCount
		needRobots := MAX_ROBOTS_PER_ROOM - robotCount
		if needRobots > emptySeats {
			needRobots = emptySeats
		}

		for i := 0; i < needRobots; i++ {
			// 第 N 个机器人等待 (N+1) * random(2,5) 秒
			delay := (i + 1) * (ROBOT_JOIN_DELAY_MIN + rand.Intn(ROBOT_JOIN_DELAY_MAX-ROBOT_JOIN_DELAY_MIN+1))
			actions = append(actions, RobotAction{
				Level:      room.Config.Level,
				BankerType: room.Config.BankerType,
				RoomId:     room.ID,
				DelaySec:   delay,
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
	joinedCh    chan struct{} // 进入房间后关闭，通知超时 goroutine 退出
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
	// 生成 LaunchToken
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(comm.LaunchTokenKey))
	mac.Write([]byte(fmt.Sprintf("%s:%s:%d", r.AppId, r.AppUserId, ts)))
	token := fmt.Sprintf("%x.%s", ts, hex.EncodeToString(mac.Sum(nil)))

	q := u.Query()
	q.Set("uid", r.AppUserId)
	q.Set("app", r.AppId)
	q.Set("token", token)
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

	// 进房超时保护：30秒内未成功进入房间则关闭连接，防止僵尸机器人
	go func() {
		select {
		case <-time.After(30 * time.Second):
			r.mu.Lock()
			roomId := r.RoomId
			r.mu.Unlock()
			if roomId == "" {
				logrus.WithField("uid", r.Uid).Warn("Robot - Join room timeout (30s), closing")
				r.Close()
			}
		case <-r.joinedCh:
			// 已进入房间，提前退出
		}
	}()

	// GenericMsg 类型定义用于解析服务器消息
	type GenericMsg struct {
		Cmd      comm.CmdType    `json:"Cmd"`
		PushType comm.PushType   `json:"PushType"`
		Data     json.RawMessage `json:"Data"`
		Code     int             `json:"Code"`
		Msg      string          `json:"Msg"`
	}

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

// Send 发送 msgpack 二进制帧到主服务器。
// Data 作为 interface{} 传入（不用 json.RawMessage），
// MarshalMsgpack 会将其编码为 msgpack map 类型，
// 服务端 DecodeMsgpackViaJSON 能正确还原为 JSON 对象。
func (r *Robot) Send(cmd comm.CmdType, data interface{}) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	wire := struct {
		Cmd  comm.CmdType `json:"cmd"`
		Data interface{}  `json:"data"`
	}{Cmd: cmd, Data: data}
	b, err := comm.MarshalMsgpack(wire)
	if err != nil {
		return err
	}
	return r.Conn.WriteMessage(websocket.BinaryMessage, b)
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
				r.handleStateChange(room.State)
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
		// 首次进入房间时通知超时 goroutine 退出
		if prevRoomId == "" && room.ID != "" && r.joinedCh != nil {
			select {
			case <-r.joinedCh:
				// 已关闭
			default:
				close(r.joinedCh)
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

// ===================== Redis 持久化 =====================

// redisSaveLoop 定期将活跃机器人的房间分配保存到 Redis
func redisSaveLoop() {
	for {
		time.Sleep(RedisSaveInterval * time.Second)
		saveRobotsToRedis()
	}
}

// saveRobotsToRedis 将当前活跃机器人的房间分配写入 Redis Hash
func saveRobotsToRedis() {
	activeRobotsMu.Lock()
	snapshot := make(map[string]RobotAction, len(activeRobots))
	for uid, rt := range activeRobots {
		snapshot[uid] = rt.Action
	}
	activeRobotsMu.Unlock()

	pool := rds.DefConnPool
	if pool == nil {
		return
	}

	// 先清空旧数据，再写入当前状态
	pool.Del(RedisDbRobot, RedisKeyRobotMap)

	if len(snapshot) == 0 {
		return
	}

	p := pool.PipeLine()
	defer p.Close()
	p.Select(RedisDbRobot)
	for uid, action := range snapshot {
		if action.RoomId == "" {
			continue // 跳过尚未分配房间的
		}
		entry := RobotStateEntry{
			RoomId:     action.RoomId,
			Level:      action.Level,
			BankerType: action.BankerType,
		}
		b, _ := json.Marshal(entry)
		p.HSet(RedisKeyRobotMap, uid, string(b))
	}
	if err := p.Do(); err != nil {
		logrus.WithError(err).Error("Robot - Failed to save state to Redis")
	}
}

// restoreRobotsFromRedis 从 Redis 恢复机器人房间分配，立即派发（delay=0）
func restoreRobotsFromRedis() {
	pool := rds.DefConnPool
	if pool == nil {
		logrus.Warn("Robot - Redis not available, skip restore")
		return
	}

	all, err := pool.HGetAll(RedisDbRobot, RedisKeyRobotMap)
	if err != nil {
		logrus.WithError(err).Error("Robot - Failed to load state from Redis")
		return
	}
	if len(all) == 0 {
		logrus.Info("Robot - No saved state in Redis, starting fresh")
		return
	}

	// 清空 Redis 中的旧状态（避免下次重启再次恢复已失效的数据）
	pool.Del(RedisDbRobot, RedisKeyRobotMap)

	var restored int
	for uid, result := range all {
		valStr, err := result.AsString()
		if err != nil {
			continue
		}
		var entry RobotStateEntry
		if err := json.Unmarshal([]byte(valStr), &entry); err != nil {
			continue
		}
		if entry.RoomId == "" {
			continue
		}

		// 从 DB 加载机器人用户
		user, err := modelClient.GetUserByUserId(uid)
		if err != nil || user == nil {
			logrus.WithField("uid", uid).Warn("Robot - Restore: user not found, skip")
			continue
		}

		action := RobotAction{
			Level:      entry.Level,
			BankerType: entry.BankerType,
			RoomId:     entry.RoomId,
			DelaySec:   0, // 恢复时不延迟，立即进入
		}
		go launchRobot(user, action)
		restored++
	}

	if restored > 0 {
		logrus.Infof("Robot - Restored %d robots from Redis", restored)
	}
}
