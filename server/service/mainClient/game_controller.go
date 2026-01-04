package mainClient

import (
	"compoment/ormutil"
	"compoment/ws"
	"context"
	"encoding/json"
	"errors"
	"service/comm"
	"service/initMain"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
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
				logrus.WithField("avg5s", int(float32(pingCount)/12.0)).Info("WS-Ping-Statistics")
			}
			//clean wsConnectMap if ws is nil
			var delConnect []string
			wsConnectMapMutex.RLock()
			for uId, ws := range wsConnectMap {
				// Fix: 增加对 ws.WsConn == nil 的检查，否则 handleConnection 中置空的连接无法被清理
				if ws == nil || !ws.IsConnected() {
					delConnect = append(delConnect, uId)
				}
			}
			wsConnectMapMutex.RUnlock()
			if len(delConnect) > 0 {
				for _, delUid := range delConnect {
					wsConnectMapMutex.Lock()
					if reGetWs, ok := wsConnectMap[delUid]; ok {
						// Fix: 增加 reGetWs == nil 的判断，防止 panic
						if reGetWs == nil || !reGetWs.IsConnected() {
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
		if existWsWrap != nil {
			existWsWrap.Mu.Lock()
			// Fix: 直接使用 WsConn.WriteJSON 避免死锁 (WriteJSON 会尝试获取 RLock，但当前已持有 Lock)
			if existWsWrap.WsConn != nil {
				_ = existWsWrap.WsConn.WriteJSON(comm.PushData{Cmd: comm.ServerPush, PushType: game.PushOtherConnect})
				existWsWrap.WsConn.CloseNormal("handler exit")
			}
			existWsWrap.WsConn = conn
			existWsWrap.Mu.Unlock()
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
				//在游戏内,默认客户端进入游戏
				connWrap.WsConn.WriteJSON(comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: game.PushRouter,
					Data: game.PushRouterStruct{
						Router: game.Game,
						Room:   room}})
			} else {
				//不在游戏内,默认客户端进入lobby
				connWrap.WsConn.WriteJSON(comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: game.PushRouter,
					Data: game.PushRouterStruct{
						Router: game.Lobby}})
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
				connWrap.Mu.Lock()
				connWrap.WsConn = nil
				connWrap.Mu.Unlock()
				logWSCloseErr(userId, err1)
				break
			}
			err = json.Unmarshal(buffer, &msg)
			if err != nil {
				connWrap.Mu.Lock()
				connWrap.WsConn = nil
				connWrap.Mu.Unlock()
				logrus.WithField("uid", userId).WithField("buffer", string(buffer)).WithError(err).Info("WS-Client-JsonInvalid")
				break
			}
		} else {
			err = connWrap.WsConn.ReadJSON(&msg)
			if err != nil {
				logWSCloseErr(userId, err)
				connWrap.Mu.Lock()
				connWrap.WsConn = nil
				connWrap.Mu.Unlock()
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
			var myErr = &comm.MyError{}
			if !errors.As(errRsp, &myErr) {
				rsp.Msg = "服务器错误"
				rsp.Code = -1
			} else {
				rsp.Msg = myErr.Message
				rsp.Code = myErr.Code
			}
			logrus.WithField(
				"uid", userId).WithField(
				"msg", errRsp.Error()).WithField(
				"cmd", rsp.Cmd).Error("Ws-Send-Msg")
		}
		if initMain.DefCtx.IsDebug {
			if rsp.Cmd != game.CmdPingPong {
				logrus.WithField(
					"uid", userId).WithField(
					"msg", rsp.Msg).WithField(
					"cmd", rsp.Cmd).Info("Ws-Send-Msg")
			}
		}
		connWrap.WriteJSON(rsp)
	}()

	switch msg.Cmd {
	case game.CmdPingPong: // 心跳处理
	//auto replay by defer
	case game.CmdUserInfo: // 用户信息请求
		rsp.Data, errRsp = handleUserInfo(appId, appUserId)
	case qznn.CmdPlayerJoin: // 抢庄牛牛进入
		errRsp = handlePlayerJoin(connWrap, appId, appUserId, msg.Data)
	case qznn.CmdPlayerLeave:
		errRsp = handlePlayerLeave(userId, msg.Data)
	case qznn.CmdPlayerCallBanker: // 抢庄请求
		errRsp = handlePlayerCallBank(userId, msg.Data)
	case qznn.CmdPlayerPlaceBet: // 下注请求
		errRsp = handlePlayerPlaceBet(userId, msg.Data)
	case qznn.CmdPlayerShowCard: // 亮牌请求
		errRsp = handlePlayerShowCard(userId, msg.Data)
	case qznn.CmdLobbyConfig: // 大厅配置请求
		rsp.Data = handleLobbyConfig()
	case game.CmdSaveSetting: // 保存用户设置
		errRsp = handleSaveSetting(userId, msg.Data)
	default:
		errRsp = errors.New("UnknownCmd")
	}
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
		return comm.ErrClientParam
	}
	if req.Level <= 0 {
		req.Level = 1
	}

	cfg := qznn.GetConfig(req.Level)
	if cfg == nil {
		return comm.NewMyError("无效的房间类型")
	}

	// 校验 BankerType 是否合法
	if req.BankerType != qznn.BankerTypeNoLook &&
		req.BankerType != qznn.BankerTypeLook3 &&
		req.BankerType != qznn.BankerTypeLook4 {
		return comm.NewMyError("无效的抢庄类型")
	}

	// 检查余额
	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		return comm.NewMyError("获取用户信息失败")
	}
	if user.Balance < cfg.MinBalance {
		return comm.NewMyError("余额不足!")
	}

	userId := appId + appUserId
	// 处理抢庄牛牛匹配逻辑
	p := qznn.NewPlayer()
	p.ID = userId
	p.ConnWrap = connWrap
	p.Balance = user.Balance
	p.NickName = func() string {
		if user.NickName == "" {
			return user.UserId
		}
		return user.NickName
	}()

	room, err := game.GetMgr().JoinOrCreateNNRoom(p, req.Level, req.BankerType)
	if err != nil {
		return err
	}
	room.Broadcast(comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: qznn.PushPlayJoin,
		Data: qznn.PushPlayerJoinStruct{
			Room:   room,
			UserId: userId,
		},
	})

	return err
}

func handlePlayerLeave(userId string, data []byte) error {
	var req struct {
		RoomId string
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandlerPlayerLeave(room, userId)
}

func handlePlayerCallBank(userId string, data []byte) error {
	var req struct {
		RoomId string
		Mult   int64
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandleCallBanker(room, userId, req.Mult)
}

func handlePlayerPlaceBet(userId string, data []byte) error {
	var req struct {
		RoomId string
		Mult   int64
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandlePlaceBet(room, userId, req.Mult)
}

func handlePlayerShowCard(userId string, data []byte) error {
	var req struct {
		RoomId string
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	room := game.GetMgr().GetRoomByRoomId(req.RoomId)
	return qznn.HandleShowCards(room, userId)
}

func handleUserInfo(appId string, appUserId string) (*modelClient.ModelUser, error) {
	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		return nil, errors.New("获取用户信息失败")
	}
	nickName := user.NickName
	if nickName == "" {
		nickName = user.UserId
	}

	return user, nil
}

func handleSaveSetting(userId string, data []byte) error {
	var req struct {
		Music  bool
		Effect bool
		Talk   bool
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}
	_, err := modelClient.UpdateUserParam(userId,
		ormutil.WithChangerMap(map[string]interface{}{"music": req.Music, "effect": req.Effect,
			"talk": req.Talk}))
	if err != nil {
		return err
	}
	return nil
}

func handleLobbyConfig() *LobbyConfigRsp {
	return &LobbyConfigRsp{
		LobbyConfigs: qznn.Configs,
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
