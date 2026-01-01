package mainClient

import (
	"compoment/ws"
	"encoding/json"
	"fmt"
	"service/comm"
	"service/mainClient/game"
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
	case "nn.join": // 抢庄牛牛匹配
		var req struct {
			Level      int `json:"level"`
			BankerType int `json:"banker_type"`
		}
		// 默认进入初级场
		req.Level = 1
		req.BankerType = -1 // 默认值，用于检测客户端是否传递

		if err := json.Unmarshal(msg.Data, &req); err == nil {
			if req.Level <= 0 {
				req.Level = 1
			}
		}

		cfg := nn.GetConfig(req.Level)
		if cfg == nil {
			conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: "无效的房间类型"})
			return
		}

		// 如果客户端未传 BankerType 或者 传入错误的值都是用配置默认值
		if req.BankerType != nn.BankerTypeNoLook && req.BankerType != nn.BankerTypeLook3 && req.BankerType != nn.BankerTypeLook4 {
			conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: "无效的抢庄类型"})
		}

		// 检查余额
		user, err := modelClient.GetUserByUserId(userId)
		if err != nil {
			conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: "获取用户信息失败"})
			return
		}
		if user.Balance < cfg.MinBalance {
			conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: "余额不足！"})
			return
		}

		// 处理抢庄牛牛匹配逻辑
		p := &nn.Player{
			ID:      userId,
			Conn:    conn,
			IsRobot: false,
		}
		// 房间类型包含等级和抢庄类型，确保隔离 (例如: nn_1_0, nn_1_2)
		roomType := fmt.Sprintf("nn_%d_%d", req.Level, req.BankerType)

		roomConfig := *cfg
		roomConfig.BankerType = req.BankerType

		room, err := game.GetMgr().JoinOrCreateNNRoom(roomType, p, nn.StartGame, &roomConfig)
		if err != nil {
			conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: err.Error()})
			return
		}

		// 如果是真实玩家进入，安排机器人
		if !p.IsRobot {
			GetRobotMgr().RobotEnterRoom(room)
		}

		// 成功加入，通知客户端房间信息
		conn.WriteJSON(comm.Response{
			Cmd: msg.Cmd,
			Seq: msg.Seq,
			Data: gin.H{
				"room_id":  room.ID,
				"duration": room.StateLeftSec,
				"state":    room.State,
			},
		})

	case "nn.ready": // 房间准备
		var req struct {
			RoomId string `json:"room_id"`
		}
		if err := json.Unmarshal(msg.Data, &req); err == nil {
			if room := game.GetMgr().GetRoomByRoomId(req.RoomId); room != nil {
				nn.HandlePlayerReady(room, userId)
			}
		}
		conn.WriteJSON(comm.Response{
			Cmd: msg.Cmd,
			Seq: msg.Seq,
		})

	case "nn.call_banker": // 抢庄请求
		var req struct {
			RoomId string `json:"room_id"`
			Mult   int    `json:"mult"`
		}
		if err := json.Unmarshal(msg.Data, &req); err == nil {
			if room := game.GetMgr().GetRoomByRoomId(req.RoomId); room != nil {
				nn.HandleCallBanker(room, userId, req.Mult)
			}
		}
		conn.WriteJSON(comm.Response{
			Cmd: msg.Cmd,
			Seq: msg.Seq,
		})
	case "nn.place_bet": // 下注请求
		var req struct {
			RoomId string `json:"room_id"`
			Mult   int    `json:"mult"`
		}
		if err := json.Unmarshal(msg.Data, &req); err == nil {
			if room := game.GetMgr().GetRoomByRoomId(req.RoomId); room != nil {
				nn.HandlePlaceBet(room, userId, req.Mult)
			}
		}
		conn.WriteJSON(comm.Response{
			Cmd: msg.Cmd,
			Seq: msg.Seq,
		})
	case "nn.show_cards": // 亮牌请求
		var req struct {
			RoomId string `json:"room_id"`
		}
		if room := game.GetMgr().GetRoomByRoomId(req.RoomId); room != nil {
			nn.HandleShowCards(room, userId)
		}

	// case "brnn.bet":
	// var req struct {
	// 	Area   int   `json:"area"`
	// 	Amount int64 `json:"amount"`
	// }
	// if err := json.Unmarshal(msg.Data, &req); err == nil {
	// 	if room := game.GetMgr().GetRoomByPlayerID(userId); room != nil {
	// 		brnn.HandleBet(room, userId, req.Area, req.Amount)
	// 	}
	// }

	// case "brnn.match": // 百人牛牛进入房间
	// 	p := &game.Player{
	// 		ID:      userId,
	// 		Conn:    conn,
	// 		IsRobot: false,
	// 	}
	// 	room, err := game.GetMgr().JoinOrCreateRoom("brnn", p, brnn.StartGame, nil)
	// 	if err != nil {
	// 		conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: err.Error()})
	// 		return
	// 	}

	// 	// 如果是真实玩家进入，安排机器人
	// 	if !p.IsRobot {
	// 		GetRobotMgr().ArrangeRobotsForRoom(room)
	// 	}

	// 	conn.WriteJSON(comm.Response{
	// 		Cmd:  "brnn.match_res",
	// 		Seq:  msg.Seq,
	// 		Data: gin.H{"room_id": room.ID},
	// 	})

	case "sys.ping": // 心跳处理
		conn.WriteJSON(comm.Response{
			Cmd: "sys.pong",
			Seq: msg.Seq,
		})

	case "user.info": // 用户信息请求
		user, err := modelClient.GetUserByUserId(userId)
		if err != nil {
			conn.WriteJSON(comm.Response{Cmd: msg.Cmd, Seq: msg.Seq, Code: -1, Msg: "获取用户信息失败"})
			return
		}
		nickName := user.NickName
		if nickName == "" {
			nickName = user.UserId
		}
		conn.WriteJSON(comm.Response{
			Cmd: msg.Cmd,
			Seq: msg.Seq,
			Data: gin.H{
				"user_id":   user.UserId,
				"balance":   user.Balance,
				"nick_name": nickName,
				"avatar":    user.Avatar,
			},
		})

	case "nn.lobby_config": // 大厅配置请求
		conn.WriteJSON(comm.Response{
			Cmd: msg.Cmd,
			Seq: msg.Seq,
			Data: gin.H{
				"lobby_configs": nn.Configs,
			},
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
