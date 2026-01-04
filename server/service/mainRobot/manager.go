package mainRobot

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/url"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

const ROBOT_COUNT = 50                              // 机器人数量
const SERVER_URL = "ws://172.20.10.11:18084/rpc/ws" // WebSocket 服务器地址
const MIN_GAMES = 3                                 // 机器人至少玩几局
const PROB_LEAVE_5_PLAYERS = 0.8                    // 5人时退出概率
const PROB_LEAVE_4_PLAYERS = 0.6                    // 4人时退出概率
const PROB_LEAVE_3_PLAYERS = 0.4                    // 3人时退出概率
const PROB_LEAVE_2_PLAYERS = 0.0                    // 2人时退出概率

func Start() {
	var wg sync.WaitGroup
	for i := 0; i < ROBOT_COUNT; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			maintainRobot(idx)
		}(i)
	}
	wg.Wait()
}

func maintainRobot(idx int) {
	for {
		robot := NewRobot(idx)
		logrus.Infof("机器人 %d 准备启动", idx)
		robot.Run()
		// 退出后随机等待一段时间再重连，模拟新用户进入
		minutes := 1 + rand.Intn(30)
		logrus.Infof("机器人 %d 已断开，等待 %d 分钟后重连...", idx, minutes)
		time.Sleep(time.Minute * time.Duration(minutes))
	}
}

type Robot struct {
	Idx         int
	Uid         string
	Conn        *websocket.Conn
	RoomId      string
	RoomData    *qznn.QZNNRoom
	mu          sync.Mutex
	gamesPlayed int
}

func NewRobot(idx int) *Robot {
	return &Robot{
		Idx: idx,
		Uid: fmt.Sprintf("%d", idx+1),
	}
}

func (r *Robot) Run() {
	u, err := url.Parse(SERVER_URL)
	if err != nil {
		logrus.Errorf("机器人 %d 解析URL失败: %v", r.Idx, err)
		return
	}
	q := u.Query()
	q.Set("uid", r.Uid)
	q.Set("app", "robot")
	u.RawQuery = q.Encode()

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		logrus.Errorf("机器人 %d 连接服务器失败: %v", r.Idx, err)
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
			logrus.Errorf("机器人 %d 读取消息错误: %v", r.Idx, err)
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
			logrus.Infof("机器人 %d 进入大厅...", r.Idx)
			// 进入大厅后随机等待0-100秒再进入房间
			time.Sleep(time.Duration(rand.Intn(100)) * time.Second)
			// 根据配置随机选择房间等级
			if len(qznn.Configs) > 0 {
				randomConfig := qznn.Configs[rand.Intn(len(qznn.Configs))]
				r.Send(qznn.CmdPlayerJoin, map[string]interface{}{"Level": randomConfig.Level, "BankerType": qznn.BankerTypeNoLook})
			}
		case game.Game:
			logrus.Infof("机器人 %d 进入房间...", r.Idx)
			var room qznn.QZNNRoom
			if err := json.Unmarshal(d.Room, &room); err == nil {
				r.updateRoomInfo(&room)
			}
		}

	case qznn.PushChangeState:
		var d qznn.PushChangeStateStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.Errorf("机器人 %d 解析 PushChangeState 失败: %v", r.Idx, err)
			return
		}
		r.updateRoomInfo(d.Room)
		r.handleStateChange(d.State)

	case qznn.PushPlayJoin:
		var d qznn.PushPlayerJoinStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.Errorf("机器人 %d 解析 PushPlayJoin 失败: %v", r.Idx, err)
			return
		}
		r.updateRoomInfo(d.Room)
		r.checkLeave()

	case qznn.PushPlayLeave:
		var d qznn.PushPlayerLeaveStruct
		if err := json.Unmarshal(data, &d); err != nil {
			logrus.Errorf("机器人 %d 解析 PushPlayLeave 失败: %v", r.Idx, err)
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
		// 模拟用户随机等待 1-10 秒
		time.Sleep(time.Duration(rand.Intn(10)+1) * time.Second)

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
			logrus.Infof("机器人 %d 本局结束，已玩局数: %d", r.Idx, played)
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
			logrus.Infof("机器人 %d 局数不足(当前%d/目标%d)，继续游戏", r.Idx, gamesPlayed, MIN_GAMES)
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
			prob = PROB_LEAVE_2_PLAYERS // 2人及以下不退出
		}

		if prob > 0 && rand.Float64() < prob {
			logrus.Infof("机器人 %d 决定退出房间，当前房间人数: %d, 概率: %.2f", r.Idx, count, prob)
			r.Send(qznn.CmdPlayerLeave, map[string]interface{}{"RoomId": roomId})
			r.Conn.Close() // 关闭连接，触发 maintainRobot 重连
		} else {
			logrus.Infof("机器人 %d 决定继续留在房间，当前房间人数: %d", r.Idx, count)
		}
	}()
}
