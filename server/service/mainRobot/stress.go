package mainRobot

import (
	"context"
	"encoding/json"
	"math/rand"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"service/mainClient/game/znet"
	"service/modelAdmin"
	"service/modelClient"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

const STRESS_MONITOR_INTERVAL = 5          // 压测监控循环间隔(秒)
const STRESS_REPLENISH_BALANCE = 100000000 // 压测用户余额补充金额（100万元=1亿分）

// StressUserRuntime 压测用户运行时状态
type StressUserRuntime struct {
	Cancel context.CancelFunc
	UserId string
}

var (
	stressActive   = make(map[string]*StressUserRuntime)
	stressActiveMu sync.Mutex
	stressUserPool []*modelClient.ModelUser // 可用的压测用户池
)

// StartStress 启动压测监控，根据 robot.StressUserCount 配置动态增减压测用户
func StartStress() {
	users, err := modelClient.GetStressUsers()
	if err != nil {
		logrus.Errorf("Stress: Failed to load user pool: %v", err)
		return
	}
	stressUserPool = users
	logrus.Infof("Stress: Loaded %d users in pool", len(stressUserPool))
	go stressMonitorLoop()
}

// stressMonitorLoop 持续监控配置，动态调整压测用户数
func stressMonitorLoop() {
	for {
		targetCount := modelAdmin.SysParamCache.GetInt("robot.StressUserCount", 0)
		if targetCount > len(stressUserPool) {
			targetCount = len(stressUserPool)
		}
		if targetCount < 0 {
			targetCount = 0
		}

		stressActiveMu.Lock()
		currentCount := len(stressActive)
		stressActiveMu.Unlock()

		if targetCount > currentCount {
			addStressUsers(targetCount - currentCount)
		} else if targetCount < currentCount {
			removeStressUsers(currentCount - targetCount)
		}

		time.Sleep(STRESS_MONITOR_INTERVAL * time.Second)
	}
}

// addStressUsers 启动指定数量的压测用户
func addStressUsers(count int) {
	stressActiveMu.Lock()
	defer stressActiveMu.Unlock()

	added := 0
	for _, user := range stressUserPool {
		if added >= count {
			break
		}
		if _, ok := stressActive[user.UserId]; ok {
			continue
		}

		ctx, cancel := context.WithCancel(context.Background())
		stressActive[user.UserId] = &StressUserRuntime{
			Cancel: cancel,
			UserId: user.UserId,
		}
		go stressUserLoop(user, ctx)
		added++
	}

	if added > 0 {
		logrus.Infof("Stress: Added %d users (total: %d)", added, len(stressActive))
	}
}

// removeStressUsers 停止指定数量的压测用户
func removeStressUsers(count int) {
	stressActiveMu.Lock()
	defer stressActiveMu.Unlock()

	removed := 0
	for uid, rt := range stressActive {
		if removed >= count {
			break
		}
		rt.Cancel()
		delete(stressActive, uid)
		removed++
	}

	if removed > 0 {
		logrus.Infof("Stress: Removed %d users (total: %d)", removed, len(stressActive))
	}
}

// stressUserLoop 压测用户持久运行循环(断线自动重连)
func stressUserLoop(user *modelClient.ModelUser, ctx context.Context) {
	defer func() {
		stressActiveMu.Lock()
		delete(stressActive, user.UserId)
		stressActiveMu.Unlock()
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		runStressUserOnce(user, ctx)

		// 断线后等待再重连，支持取消
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
		}
	}
}

// StressUser 压测用户实例
type StressUser struct {
	Uid    string
	Conn   *websocket.Conn
	mu     sync.Mutex
	RoomId string
}

func (s *StressUser) send(cmd comm.CmdType, data interface{}) error {
	return SendWSMessage(s.Conn, &s.mu, cmd, data)
}

func (s *StressUser) close() {
	s.mu.Lock()
	conn := s.Conn
	s.mu.Unlock()
	if conn != nil {
		conn.Close()
	}
}

// runStressUserOnce 执行一次压测用户连接周期
func runStressUserOnce(user *modelClient.ModelUser, ctx context.Context) {
	wsURL := BuildWSURL(user.AppId, user.AppUserId)
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		logrus.WithField("uid", user.UserId).Errorf("Stress: Connect failed: %v", err)
		return
	}
	defer conn.Close()

	su := &StressUser{
		Uid:  user.UserId,
		Conn: conn,
	}

	// 取消时关闭连接
	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			su.close()
		case <-done:
		}
	}()
	defer close(done)

	// 心跳协程
	go StartHeartbeat(func() error {
		return su.send(game.CmdPingPong, nil)
	}, done)

	// 设置初始读超时
	conn.SetReadDeadline(time.Now().Add(WS_READ_TIMEOUT * time.Second))

	// 消息接收循环
	for {
		var msg GenericMsg
		_, rawData, readErr := conn.ReadMessage()
		if readErr != nil {
			return
		}
		// 收到消息，重置读超时
		conn.SetReadDeadline(time.Now().Add(WS_READ_TIMEOUT * time.Second))
		if err := comm.DecodeMsgpackViaJSON(rawData, &msg); err != nil {
			continue
		}

		if msg.Code != 0 {
			logrus.WithField("uid", su.Uid).Warnf("Stress: Server error: %d %s", msg.Code, msg.Msg)
			continue
		}

		if msg.Cmd == comm.ServerPush {
			su.handlePush(msg.PushType, msg.Data)
		}
	}
}

// handlePush 处理推送消息(包含游戏操作)
func (s *StressUser) handlePush(pushType comm.PushType, data []byte) {
	switch pushType {
	case znet.PushRouter:
		var d struct {
			Router znet.RouterType `json:"Router"`
		}
		if err := json.Unmarshal(data, &d); err != nil {
			return
		}
		if d.Router == znet.Lobby {
			// 回到大厅时先补充余额，防止输完钱后无法加入房间
			if err := modelClient.ReplenishStressBalance(s.Uid, STRESS_REPLENISH_BALANCE); err != nil {
				logrus.WithField("uid", s.Uid).Errorf("Stress: Replenish balance failed, skip join: %v", err)
				return
			}
			// 随机加入房间
			joinReq := map[string]interface{}{
				"Level":      ALLOWED_LEVELS[rand.Intn(len(ALLOWED_LEVELS))],
				"BankerType": ALLOWED_BANKER_TYPES[rand.Intn(len(ALLOWED_BANKER_TYPES))],
			}
			s.send(qznn.CmdPlayerJoin, joinReq)
			logrus.WithField("uid", s.Uid).Info("Stress: Sent join room request")
		} else if d.Router == znet.Game {
			var rd struct {
				Room json.RawMessage `json:"Room"`
			}
			if err := json.Unmarshal(data, &rd); err == nil && len(rd.Room) > 0 {
				var room struct {
					ID     string           `json:"ID"`
					State  qznn.RoomState   `json:"State"`
					Config qznn.LobbyConfig `json:"Config"`
				}
				json.Unmarshal(rd.Room, &room)
				s.mu.Lock()
				s.RoomId = room.ID
				s.mu.Unlock()
				// 进入房间后立即发送准备
				s.send(qznn.CmdPlayerReady, map[string]interface{}{"RoomId": room.ID})
				s.handleGameState(room.State, room.Config)
			}
		}

	case qznn.PushChangeState:
		var d struct {
			State qznn.RoomState   `json:"State"`
			Room  *json.RawMessage `json:"Room"`
		}
		if err := json.Unmarshal(data, &d); err != nil {
			return
		}
		var config qznn.LobbyConfig
		if d.Room != nil {
			var room struct {
				ID     string           `json:"ID"`
				Config qznn.LobbyConfig `json:"Config"`
			}
			json.Unmarshal(*d.Room, &room)
			config = room.Config
			s.mu.Lock()
			s.RoomId = room.ID
			s.mu.Unlock()
		}
		s.handleGameState(d.State, config)
	}
}

// handleGameState 根据游戏状态执行操作(模拟真人行为)
func (s *StressUser) handleGameState(state qznn.RoomState, config qznn.LobbyConfig) {
	go func() {
		// 模拟真人随机等待 1-3 秒
		time.Sleep(time.Duration(ACTION_DELAY_MIN+rand.Intn(ACTION_DELAY_MAX-ACTION_DELAY_MIN+1)) * time.Second)

		s.mu.Lock()
		roomId := s.RoomId
		s.mu.Unlock()

		if roomId == "" {
			return
		}

		switch state {
		case qznn.StateBanking:
			mult := int64(1)
			if len(config.BankerMult) > 0 {
				mult = config.BankerMult[rand.Intn(len(config.BankerMult))]
			}
			s.send(qznn.CmdPlayerCallBanker, map[string]interface{}{"RoomId": roomId, "Mult": mult})

		case qznn.StateBetting:
			mult := int64(1)
			if len(config.BetMult) > 0 {
				mult = config.BetMult[rand.Intn(len(config.BetMult))]
			}
			s.send(qznn.CmdPlayerPlaceBet, map[string]interface{}{"RoomId": roomId, "Mult": mult})

		case qznn.StateShowCard:
			s.send(qznn.CmdPlayerShowCard, map[string]interface{}{"RoomId": roomId})
		}
	}()
}
