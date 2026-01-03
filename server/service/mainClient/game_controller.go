package mainClient

import (
	"compoment/ws"
	"context"
	"encoding/json"
	"errors"
	"service/comm"
	"service/initMain"
	"service/mainClient/game"
	"service/mainClient/game/nn"
	"service/modelClient"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

var (
	pingCount         int64
	wsConnectMapMutex sync.RWMutex
	wsConnectMap      = make(map[string]*ws.WsConnWrap, 2000)
)

func init() {
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			c := atomic.SwapInt64(&pingCount, 0)
			if c > 0 {
				logrus.WithField("avg5s", int(pingCount/12)).Info("WS-Ping-Statistics")
			}
			//clean wsConnectMap if ws is nil
			var delConnect []string
			wsConnectMapMutex.RLock()
			for uId, ws := range wsConnectMap {
				// Fix: 增加对 ws.WsConn == nil 的检查，否则 handleConnection 中置空的连接无法被清理
				if ws == nil || ws.WsConn == nil {
					delConnect = append(delConnect, uId)
				}
			}
			wsConnectMapMutex.RUnlock()
			if len(delConnect) > 0 {
				for _, delUid := range delConnect {
					wsConnectMapMutex.Lock()
					if reGetWs, ok := wsConnectMap[delUid]; ok {
						// Fix: 增加 reGetWs == nil 的判断，防止 panic
						if reGetWs == nil || reGetWs.WsConn == nil {
							delete(wsConnectMap, delUid)
						}
					}
					wsConnectMapMutex.Unlock()
				}
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
	// user, err := modelClient.GetOrCreateUser(appId, appUserId)
	// if err != nil {
	// 	logrus.WithError(err).WithField("appUserId", appUserId).Error("WS-GetOrCreateUser-Fail")
	// 	return
	// }
	logrus.WithField("appId", appId).WithField("appUserId", appUserId).Info("WS-Client-Connected")

	connWrap := &ws.WsConnWrap{WsConn: conn}
	userId := appId + appUserId
	wsConnectMapMutex.Lock()
	if existWsWrap, ok := wsConnectMap[userId]; ok {
		if existWsWrap != nil && existWsWrap.WsConn != nil {
			existWsWrap.WsConn.WriteJSON(comm.PushData{Cmd: comm.ServerPush, PushType: game.PushOtherConnect})
			existWsWrap.WsConn.CloseNormal("handler exit")
			existWsWrap.WsConn = conn
			connWrap = existWsWrap
			logrus.WithField("appId", appId).WithField("appUserId", appUserId).Info("WS-Client-KickOffConnect")
		}
	} else {
		wsConnectMap[userId] = connWrap
	}
	wsConnectMapMutex.Unlock()

	// 2. 进入消息处理循环
	handleConnection(connWrap, appId, appUserId)
}

func handleConnection(connWrap *ws.WsConnWrap, appId, appUserId string) {
	userId := appId + appUserId
	var doOnce sync.Once
	for {

		doOnce.Do(func() {
			//check 是否在游戏内
			room := game.GetMgr().GetPlayerRoom(userId)
			if room != nil {
				room.ReconnectEnterRoom(userId)
			}
		})

		var msg comm.Request
		var err error
		// 读取客户端发来的 JSON 消息
		if initMain.DefCtx.IsDebug {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
			_, buffer, err1 := connWrap.WsConn.Conn.Read(ctx)
			cancel() // 显式调用 cancel，避免在 for 循环中 defer 导致资源泄露
			if err1 != nil {
				wsConnectMapMutex.Lock()
				connWrap.WsConn = nil
				wsConnectMapMutex.Unlock()
				logWSCloseErr(userId, err1)
				break
			}
			err = json.Unmarshal(buffer, &msg)
			if err != nil {
				wsConnectMapMutex.Lock()
				connWrap.WsConn = nil
				wsConnectMapMutex.Unlock()
				logrus.WithField("uid", userId).WithField("buffer", string(buffer)).WithError(err).Info("WS-Client-JsonInvalid")
				break
			}
		} else {
			err = connWrap.WsConn.ReadJSON(&msg)
			if err != nil {
				logWSCloseErr(userId, err)
				wsConnectMapMutex.Lock()
				connWrap.WsConn = nil
				wsConnectMapMutex.Unlock()
				break
			}
		}
		// 3. 路由分发 (Dispatcher)
		dispatch(connWrap, appId, appUserId, &msg)
	}
}

func logWSCloseErr(userId string, err error) {
	errStr := err.Error()
	if strings.Contains(errStr, "StatusGoingAway") {
		logrus.WithField("uid", userId).Info("WS-Client-GoingAway") // 浏览器刷新或关闭标签页
	} else if strings.Contains(errStr, "StatusNormalClosure") {
		logrus.WithField("uid", userId).Info("WS-Client-Closed-Normal") // 正常关闭
	} else if strings.Contains(errStr, "context deadline exceeded") {
		logrus.WithField("uid", userId).Info("WS-Read-Timeout") // 读取超时
	} else {
		logrus.WithField("uid", userId).WithError(err).Info("WS-Client-Disconnected")
	}
}

func dispatch(connWrap *ws.WsConnWrap, appId string, appUserId string, msg *comm.Request) {
	userId := appId + appUserId
	if msg.Cmd == game.CmdPingPong {
		atomic.AddInt64(&pingCount, 1)
	} else {
		logrus.WithFields(logrus.Fields{
			"cmd": msg.Cmd,
			"uid": userId,
		}).Info("WS-Recv-Msg")
	}

	// 检查全局维护状态（实际应从 Redis 或配置中心读取）
	// if GlobalMaintenanceConfig.IsActive() {
	//     conn.WriteJSON(comm.Response{
	//         Cmd: "sys.maintenance",
	//         Data: gin.H{"msg": "系统维护中", "end_time": 1700000000},
	//     })
	//     return
	// }
	var rsp = comm.Response{
		Cmd: msg.Cmd,
		Seq: msg.Seq,
	}
	var errRsp error
	defer func() {
		if errRsp != nil {
			rsp.Code = -1
			rsp.Msg = errRsp.Error()
		}
		if initMain.DefCtx.IsDebug {
			if rsp.Cmd != game.CmdPingPong {
				logrus.WithField(
					"uid", userId).WithField(
					"msg", rsp.Cmd).WithField(
					"code", rsp.Cmd).Info("Ws-Send-Msg")
			}
		}
		if connWrap.WsConn != nil {
			connWrap.WsConn.WriteJSON(rsp)
		}

	}()

	switch msg.Cmd {
	case game.CmdPingPong: // 心跳处理
		//auto replay by defer
	case nn.CmdPlayerJoin: // 抢庄牛牛进入
		errRsp = handlePlayerJoin(connWrap, appId, appUserId, msg.Data)
	case nn.CmdPlayerLeave:
		handlePlayerLeave(userId, msg.Data)
	case nn.CmdPlayerCallBanker: // 抢庄请求
		handlePlayerCallBank(userId, msg.Data)
	case nn.CmdPlayerPlaceBet: // 下注请求
		handlePlayerPlaceBet(userId, msg.Data)
	case nn.CmdPlayerShowCard: // 亮牌请求
		handlePlayerShowCard(userId, msg.Data)
	case nn.CmdUserInfo: // 用户信息请求
		rsp.Data, errRsp = handleUserInfo(userId)
	case nn.CmdLobbyConfig: // 大厅配置请求
		rsp.Data = handleLobbyConfig()
	default:
		errRsp = errors.New("Unknown Command")
	}
}

type UserInfoRsp struct {
	UserId   string `json:"UserId"`
	Balance  int64  `json:"Balance"`
	NickName string `json:"NickName"`
	Avatar   string `json:"Avatar"`
}

type LobbyConfigRsp struct {
	LobbyConfigs interface{} `json:"LobbyConfigs"`
}

func handlePlayerJoin(connWrap *ws.WsConnWrap, appId, appUserId string, data []byte) error {
	var req struct {
		Level      int
		BankerType int
	}
	// 默认进入初级场
	req.Level = 1
	req.BankerType = -1 // 默认值，用于检测客户端是否传递

	if err := json.Unmarshal(data, &req); err != nil {
		return errors.New("客户端参数有误")
	}
	if req.Level <= 0 {
		req.Level = 1
	}

	cfg := nn.GetConfig(req.Level)
	if cfg == nil {
		return errors.New("无效的房间类型")
	}

	// 校验 BankerType 是否合法
	if req.BankerType != nn.BankerTypeNoLook &&
		req.BankerType != nn.BankerTypeLook3 &&
		req.BankerType != nn.BankerTypeLook4 {
		return errors.New("无效的抢庄类型")
	}

	// 检查余额
	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		return errors.New("获取用户信息失败")
	}
	if user.Balance < cfg.MinBalance {
		return errors.New("余额不足！")
	}

	userId := appId + appUserId
	// 处理抢庄牛牛匹配逻辑
	p := &nn.Player{
		ID:       userId,
		ConnWrap: connWrap,
		IsRobot:  false,
		Balance:  user.Balance,
		NickName: func() string {
			if user.NickName == "" {
				return user.UserId
			}
			return user.NickName
		}(),
	}

	roomConfig := *cfg
	roomConfig.BankerType = req.BankerType

	_, err = game.GetMgr().JoinOrCreateNNRoom(p, &roomConfig)
	return err
}

func handlePlayerLeave(userId string, data []byte) {
	var req struct {
		RoomId string
	}
	if err := json.Unmarshal(data, &req); err == nil {
		if room := game.GetMgr().GetRoomByRoomId(req.RoomId); room != nil {
			nn.HandlerPlayerLeave(room, userId)
		}
	}
}

func handlePlayerCallBank(userId string, data []byte) {
	var req struct {
		RoomId string
		Mult   int64
	}
	if err := json.Unmarshal(data, &req); err == nil {
		if room := game.GetMgr().GetRoomByRoomId(req.RoomId); room != nil {
			nn.HandleCallBanker(room, userId, req.Mult)
		}
	}
}

func handlePlayerPlaceBet(userId string, data []byte) {
	var req struct {
		RoomId string
		Mult   int64
	}
	if err := json.Unmarshal(data, &req); err == nil {
		if room := game.GetMgr().GetRoomByRoomId(req.RoomId); room != nil {
			nn.HandlePlaceBet(room, userId, req.Mult)
		}
	}
}

func handlePlayerShowCard(userId string, data []byte) {
	var req struct {
		RoomId string
	}
	if err := json.Unmarshal(data, &req); err == nil {
		if room := game.GetMgr().GetRoomByRoomId(req.RoomId); room != nil {
			nn.HandleShowCards(room, userId)
		}
	}
}

func handleUserInfo(userId string) (*UserInfoRsp, error) {
	user, err := modelClient.GetUserByUserId(userId)
	if err != nil {
		return nil, errors.New("获取用户信息失败")
	}
	nickName := user.NickName
	if nickName == "" {
		nickName = user.UserId
	}

	return &UserInfoRsp{
		UserId:   user.UserId,
		Balance:  user.Balance,
		NickName: nickName,
		Avatar:   user.Avatar,
	}, nil
}

func handleLobbyConfig() *LobbyConfigRsp {
	return &LobbyConfigRsp{
		LobbyConfigs: nn.Configs,
	}
}

func RpcQZNNData(c *gin.Context) {
	rooms := game.GetMgr().GetAllRooms()
	c.JSON(200, gin.H{
		"code": 0,
		"msg":  "success",
		"data": rooms,
	})
}
