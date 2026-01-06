package mainRobot

import (
	"encoding/json"
	"math/rand"
	"net/url"
	"service/comm"
	"service/initMain"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"service/modelClient"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// WebSocket 服务器地址
const SERVER_URL = "ws://127.0.0.1:8084/rpc/ws"        // 正式服地址
const SERVER_URL_DEV = "ws://172.20.10.3:18084/rpc/ws" // 测试服地址

const MINUTE_WAIT_MAX = 10       // 进入房间前等待的最长分钟数
const MIN_GAMES = 3              // 机器人至少玩几局
const PROB_LEAVE_5_PLAYERS = 0.8 // 5人时退出概率
const PROB_LEAVE_4_PLAYERS = 0.6 // 4人时退出概率
const PROB_LEAVE_3_PLAYERS = 0.4 // 3人时退出概率
const PROB_LEAVE_2_PLAYERS = 0.0 // 2人时退出概率

var targetServerURL = SERVER_URL

func Start() {

	if initMain.DefCtx.IsTerm {
		targetServerURL = SERVER_URL_DEV
	}

	manageRobots()
}

var (
	activeRobots   = make(map[string]struct{})
	activeRobotsMu sync.Mutex
)

func manageRobots() {
	ticker := time.NewTicker(time.Second * 10)
	defer ticker.Stop()

	for {
		users, err := modelClient.GetAllRobots()
		if err != nil {
			logrus.Errorf("获取所有机器人失败: %v", err)
		} else {
			activeRobotsMu.Lock()
			for _, u := range users {
				if _, ok := activeRobots[u.UserId]; !ok {
					activeRobots[u.UserId] = struct{}{}
					go runRobot(u)
				}
			}
			activeRobotsMu.Unlock()
		}
		<-ticker.C
	}
}

func runRobot(user *modelClient.ModelUser) {
	defer func() {
		activeRobotsMu.Lock()
		delete(activeRobots, user.UserId)
		activeRobotsMu.Unlock()
	}()

	minutes := rand.Intn(MINUTE_WAIT_MAX)
	time.Sleep(time.Minute * time.Duration(minutes))

	robot := &Robot{Uid: user.UserId, AppId: user.AppId, AppUserId: user.AppUserId}
	robot.Run()
}

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
}

func (r *Robot) Run() {
	u, err := url.Parse(targetServerURL)
	if err != nil {
		logrus.Errorf("机器人 %s 解析URL失败: %v", r.Uid, err)
		return
	}
	q := u.Query()
	q.Set("uid", r.AppUserId)
	q.Set("app", r.AppId)
	u.RawQuery = q.Encode()

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		logrus.Errorf("机器人 %s 连接服务器失败: %v", r.Uid, err)
		return
	}
	r.Conn = conn
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
			logrus.Errorf("机器人 %s 读取消息错误: %v", r.Uid, err)
			return
		}

		if msg.Cmd == comm.ServerPush {
			r.handlePush(msg.PushType, msg.Data)
		}
	}
}

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

func (r *Robot) Close() {
	r.mu.Lock()
	r.isClosing = true
	r.mu.Unlock()
	r.Conn.Close()
}

func (r *Robot) handlePush(pushType comm.PushType, data []byte) {
	// 模拟用户思考时间
	time.Sleep(time.Millisecond * time.Duration(rand.Intn(500)+500))

	switch pushType {
	case game.PushRouter:
		var d struct {
			Router game.RouterType `json:"Router"`
			Room   json.RawMessage `json:"Room"`
		}
		json.Unmarshal(data, &d)
		switch d.Router {
		case game.Lobby:
			logrus.Infof("机器人 %s 进入大厅...", r.Uid)
			// 根据配置随机选择房间等级
			if len(qznn.Configs) > 0 {
				randomConfig := qznn.Configs[rand.Intn(len(qznn.Configs))]
				r.Send(qznn.CmdPlayerJoin, map[string]interface{}{"Level": randomConfig.Level, "BankerType": qznn.BankerTypeNoLook})
			}
		case game.Game:
			logrus.Infof("机器人 %s 进入房间...", r.Uid)
			var room qznn.QZNNRoom
			if err := json.Unmarshal(d.Room, &room); err == nil {
				r.updateRoomInfo(&room)
			}
		}

	case qznn.PushChangeState:
		var d qznn.PushChangeStateStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.Errorf("机器人 %s 解析 PushChangeState 失败: %v", r.Uid, err)
			return
		}
		r.updateRoomInfo(d.Room)
		r.handleStateChange(d.State)

	case qznn.PushPlayJoin:
		var d qznn.PushPlayerJoinStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.Errorf("机器人 %s 解析 PushPlayJoin 失败: %v", r.Uid, err)
			return
		}
		r.updateRoomInfo(d.Room)
		r.checkLeave()

	case qznn.PushPlayLeave:
		var d qznn.PushPlayerLeaveStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.Errorf("机器人 %s 解析 PushPlayLeave 失败: %v", r.Uid, err)
			return
		}
		r.updateRoomInfo(d.Room)
		r.checkLeave()

	case qznn.PushPlayerCallBanker:
		var d qznn.PushPlayerCallBankerStruct
		json.Unmarshal(data, &d)
		r.updateRoomInfo(d.Room)

	case qznn.PushPlayerPlaceBet:
		var d qznn.PushPlayerPlaceBetStruct
		json.Unmarshal(data, &d)
		r.updateRoomInfo(d.Room)

	case qznn.PushPlayerShowCard:
		var d qznn.PushPlayerShowCardStruct
		json.Unmarshal(data, &d)
		r.updateRoomInfo(d.Room)

	case qznn.PushRoom:
		var d qznn.PushRoomStruct
		json.Unmarshal(data, &d)
		r.updateRoomInfo(d.Room)
	}
}

func (r *Robot) updateRoomInfo(room *qznn.QZNNRoom) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if room != nil {
		r.RoomData = room
		r.RoomId = room.ID
	}
}

func (r *Robot) handleStateChange(state qznn.RoomState) {
	r.mu.Lock()
	roomSnapshot := r.RoomData
	currentRoomId := r.RoomId
	r.mu.Unlock()

	go func() {
		// 模拟用户随机等待 1-5 秒
		time.Sleep(time.Duration(rand.Intn(5)+1) * time.Second)

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
			played := r.gamesPlayed
			r.mu.Unlock()
			logrus.Infof("机器人 %s 本局结束，已玩局数: %d", r.Uid, played)
			r.checkLeave()
		}
	}()
}

func (r *Robot) checkLeave() {
	go func() {
		// 随机等待 1-5 秒
		time.Sleep(time.Duration(rand.Intn(5)+1) * time.Second)

		r.mu.Lock()
		roomData := r.RoomData
		gamesPlayed := r.gamesPlayed
		roomId := r.RoomId
		r.mu.Unlock()

		if roomData == nil {
			return
		}
		if gamesPlayed < MIN_GAMES {
			logrus.Infof("机器人 %s 局数不足(当前%d/目标%d)，继续游戏", r.Uid, gamesPlayed, MIN_GAMES)
			return
		}
		count := 0
		// 使用具体的结构体字段获取人数
		for _, p := range roomData.Players {
			if p != nil {
				count++
			}
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
			logrus.Infof("机器人 %s 决定退出房间，当前房间人数: %d, 概率: %.2f", r.Uid, count, prob)
			r.Send(qznn.CmdPlayerLeave, map[string]interface{}{"RoomId": roomId})
			r.Close()
		} else {
			logrus.Infof("机器人 %s 决定继续留在房间，当前房间人数: %d", r.Uid, count)
		}
	}()
}
