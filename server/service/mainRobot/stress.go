package mainRobot

import (
	"encoding/json"
	"math/rand"
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

func StartStress() {
	logrus.Info("Stress test: Start monitoring and automatically adding simulated real users")
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			users, err := modelClient.GetUserRobots()
			if err != nil {
				logrus.Errorf("Stress test: Failed to get user list: %v", err)
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
		logrus.WithField("uid", user.UserId).Errorf("Stress test user: Failed to connect to server: %v", err)
		return
	}
	logrus.WithField("uid", user.UserId).Info("Stress test user: Connected to server")
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
			logrus.WithField("uid", user.UserId).Errorf("Stress test user received error: %d %s", msg.Code, msg.Msg)
			return
		}

		if msg.Cmd == comm.ServerPush && msg.PushType == znet.PushRouter {
			var d struct {
				Router znet.RouterType `json:"Router"`
			}
			if err := json.Unmarshal(msg.Data, &d); err == nil && d.Router == znet.Lobby {
				joinReq := map[string]interface{}{
					"Level":      ALLOWED_LEVELS[rand.Intn(len(ALLOWED_LEVELS))],
					"BankerType": ALLOWED_BANKER_TYPES[rand.Intn(len(ALLOWED_BANKER_TYPES))],
				}
				reqData, _ := json.Marshal(joinReq)
				req := comm.Request{
					Cmd:  qznn.CmdPlayerJoin,
					Data: reqData,
				}
				if err := conn.WriteJSON(req); err != nil {
					logrus.WithField("uid", user.UserId).Errorf("Stress test user failed to send join room request: %v", err)
					return
				}
				logrus.WithField("uid", user.UserId).Infof("Stress test user successfully sent join room request")
			}
		}
	}
}
