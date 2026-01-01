package mainClient

import (
	"compoment/ws"
	"encoding/json"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/brnn"
	"service/mainClient/game/nn"
	"service/modelClient"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

var (
	pingCount int64
)

func init() {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			c := atomic.SwapInt64(&pingCount, 0)
			if c > 0 {
				logrus.WithField("count", c).Info("WS-Ping-Statistics-10s")
			}
		}
	}()
}

// WSEntry 是 WebSocket 的入口点
func WSEntry(c *gin.Context) {
	// 1. 升级连接
	// 在开发环境下 insecure 设为 true 以跳过跨域检查
	conn, err := ws.AcceptWS(c.Writer, c.Request, true)
	if err != nil {
		logrus.WithError(err).Error("WS-Accept-Fail")
		return
	}

	// 确保函数退出时关闭连接
	defer conn.CloseNormal("handler exit")

	appUserId := c.Query("uid")
	appId := c.Query("app")

	// 如果中间件未提取到 UserID (WebSocket 握手通常通过 URL Query 传递 Token)
	// todo 客户端以后加token验证逻辑后，再开启注释
	// if userId == "" {
	// 	token := c.Query("token")
	// 	// 使用 comm.VerifyToken 进行验证，它包含了解密、签名校验和过期检查
	// 	if t, err := comm.VerifyToken(token); err != nil {
	// 		logrus.WithError(err).Error("WS-Auth-Fail")
	// 		return
	// 	} else {
	// 		userId = t.ID
	// 	}
	// }

	// 1.5 查询数据库校验用户是否存在，不存在则自动注册
	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		logrus.WithError(err).WithField("appUserId", appUserId).Error("WS-GetOrCreateUser-Fail")
		return
	}
	userId := user.UserId
	logrus.WithField("uid", userId).Info("WS-Client-Connected")

	// 发送用户信息给客户端
	conn.WriteJSON(comm.Response{
		Cmd: "user.allinfo",
		Seq: 0,
		Data: gin.H{
			"balance":   user.Balance,
			"nick_name": user.NickName,
			"avatar":    user.Avatar,
		},
	})

	// 2. 进入消息处理循环
	handleConnection(conn, userId)
}

func handleConnection(conn *ws.WSConn, userId string) {
	for {
		var msg comm.Message
		// 读取客户端发来的 JSON 消息
		err := conn.ReadJSON(&msg)
		if err != nil {
			// 如果是连接关闭，则退出循环
			logrus.WithField("uid", userId).WithError(err).Info("WS-Client-Disconnected")
			break
		}

		// 3. 路由分发 (Dispatcher)
		dispatch(conn, userId, &msg)
	}
}

func dispatch(conn *ws.WSConn, userId string, msg *comm.Message) {
	if msg.Cmd == "sys.ping" {
		atomic.AddInt64(&pingCount, 1)
	} else {
		logrus.WithFields(logrus.Fields{
			"cmd": msg.Cmd,
			"uid": userId,
		}).Info("WS-Receive-Message")
	}

	// 检查全局维护状态（实际应从 Redis 或配置中心读取）
	// if GlobalMaintenanceConfig.IsActive() {
	//     conn.WriteJSON(comm.Response{
	//         Cmd: "sys.maintenance",
	//         Data: gin.H{"msg": "系统维护中", "end_time": 1700000000},
	//     })
	//     return
	// }

	switch msg.Cmd {
	case "nn.match": // 抢庄牛牛匹配
		// 处理抢庄牛牛匹配逻辑
		p := &game.Player{
			ID:      userId,
			Conn:    conn,
			IsRobot: false,
		}
		room, err := game.GetMgr().JoinOrCreateRoom("nn", p, nn.StartGame)
		if err != nil {
			conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: err.Error()})
			return
		}

		// 如果是真实玩家进入，安排机器人
		if !p.IsRobot {
			GetRobotMgr().ArrangeRobotsForRoom(room)
		}

		// 成功加入，通知客户端房间信息
		conn.WriteJSON(comm.Response{
			Cmd: "nn.match_res",
			Seq: msg.Seq,
			Data: gin.H{
				"room_id": room.ID,
				"players": len(room.Players),
			},
		})

		// 广播给房间内其他人
		room.Broadcast(comm.Response{Cmd: "nn.player_join", Data: gin.H{"uid": userId}})

	case "nn.call_banker": // 抢庄请求
		var req struct {
			Mult int `json:"mult"`
		}
		if err := json.Unmarshal(msg.Data, &req); err == nil {
			if room := game.GetMgr().GetRoomByPlayerID(userId); room != nil {
				nn.HandleCallBanker(room, userId, req.Mult)
			}
		}

	case "nn.place_bet": // 下注请求
		var req struct {
			Mult int `json:"mult"`
		}
		if err := json.Unmarshal(msg.Data, &req); err == nil {
			if room := game.GetMgr().GetRoomByPlayerID(userId); room != nil {
				nn.HandlePlaceBet(room, userId, req.Mult)
			}
		}

	case "nn.show_cards": // 亮牌请求
		if room := game.GetMgr().GetRoomByPlayerID(userId); room != nil {
			nn.HandleShowCards(room, userId)
		}

	case "brnn.bet":
		var req struct {
			Area   int   `json:"area"`
			Amount int64 `json:"amount"`
		}
		if err := json.Unmarshal(msg.Data, &req); err == nil {
			if room := game.GetMgr().GetRoomByPlayerID(userId); room != nil {
				brnn.HandleBet(room, userId, req.Area, req.Amount)
			}
		}

	case "brnn.match": // 百人牛牛进入房间
		p := &game.Player{
			ID:      userId,
			Conn:    conn,
			IsRobot: false,
		}
		room, err := game.GetMgr().JoinOrCreateRoom("brnn", p, brnn.StartGame)
		if err != nil {
			conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: err.Error()})
			return
		}

		// 如果是真实玩家进入，安排机器人
		if !p.IsRobot {
			GetRobotMgr().ArrangeRobotsForRoom(room)
		}

		conn.WriteJSON(comm.Response{
			Cmd:  "brnn.match_res",
			Seq:  msg.Seq,
			Data: gin.H{"room_id": room.ID},
		})

	case "sys.ping": // 心跳处理
		conn.WriteJSON(comm.Response{
			Cmd: "sys.pong",
			Seq: msg.Seq,
		})

	default:
		// 返回未知命令错误
		conn.WriteJSON(comm.Response{
			Cmd:  msg.Cmd,
			Seq:  msg.Seq,
			Code: -1,
			Msg:  "Unknown Command",
		})
	}
}
