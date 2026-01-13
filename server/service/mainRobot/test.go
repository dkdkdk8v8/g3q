package mainRobot

import (
	"encoding/json"
	"net/url"
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

var (
	stressUsers   = make(map[string]bool)
	stressUsersMu sync.Mutex
)

// StartStressTest 启动模拟真实用户的压力测试
// 该函数会持续监控数据库中 app_id 为 "USER" 的机器人，并安排其进入房间
func StartStressTest() {
	logrus.Info("压力测试：开始监控并自动加入模拟真实用户")
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			// 获取 app_id 为 "USER" 的机器人（模拟真实用户）
			users, err := modelClient.GetUserRobots()
			if err != nil {
				logrus.Errorf("压力测试：获取用户列表失败: %v", err)
				continue
			}

			for _, u := range users {
				stressUsersMu.Lock()
				if _, ok := stressUsers[u.UserId]; ok {
					stressUsersMu.Unlock()
					continue
				}
				stressUsers[u.UserId] = true
				stressUsersMu.Unlock()

				go runStressUser(u)
			}
		}
	}()
}

func runStressUser(user *modelClient.ModelUser) {
	defer func() {
		stressUsersMu.Lock()
		delete(stressUsers, user.UserId)
		stressUsersMu.Unlock()
	}()

	u := url.URL{
		Scheme: "ws",
		Host:   targetHost,
		Path:   PATH_WS,
	}
	q := u.Query()
	q.Set("uid", user.AppUserId)
	q.Set("app", user.AppId)
	u.RawQuery = q.Encode()

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		logrus.Errorf("压力测试用户 %s: 连接服务器失败: %v", user.UserId, err)
		return
	}
	defer conn.Close()

	// 心跳协程，保持连接活跃
	go func() {
		ticker := time.NewTicker(time.Second * 5)
		defer ticker.Stop()
		for range ticker.C {
			req := comm.Request{Cmd: game.CmdPingPong}
			if err := conn.WriteJSON(req); err != nil {
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
		if err := conn.ReadJSON(&msg); err != nil {
			return
		}

		if msg.Code != 0 {
			logrus.Errorf("压力测试用户 %s 收到错误: %d %s", user.UserId, msg.Code, msg.Msg)
			return
		}

		// 模拟 manager.go 中的逻辑：进入大厅后发送加入房间请求
		if msg.Cmd == comm.ServerPush && msg.PushType == znet.PushRouter {
			var d struct {
				Router znet.RouterType `json:"Router"`
			}
			if err := json.Unmarshal(msg.Data, &d); err == nil && d.Router == znet.Lobby {
				joinReq := map[string]interface{}{
					"Level":      ALLOWED_LEVELS[0],
					"BankerType": ALLOWED_BANKER_TYPES[0],
				}
				reqData, _ := json.Marshal(joinReq)
				req := comm.Request{
					Cmd:  qznn.CmdPlayerJoin,
					Data: reqData,
				}
				if err := conn.WriteJSON(req); err != nil {
					logrus.Errorf("压力测试用户 %s 发送加入房间请求失败: %v", user.UserId, err)
					return
				}
				logrus.Infof("压力测试用户 %s 已成功发送加入房间请求", user.UserId)
			}
		}
	}
}
