package mainClient

import (
	"compoment/ws"
	"context"
	"encoding/json"
	"errors"
	"service/comm"
	"service/initMain"
	"service/mainClient/game"
	"service/mainClient/game/qznn"
	"service/mainClient/game/znet"
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
			existWsWrap.Mu.Unlock()
			logrus.WithField("appId", appId).WithField("appUserId", appUserId).Info("WS-Client-KickOffConnect")
		}
	}
	wsConnectMap[userId] = connWrap
	wsConnectMapMutex.Unlock()

	// 2. 进入消息处理循环
	handleConnection(connWrap, appId, appUserId)
}

func handleConnection(connWrap *ws.WsConnWrap, appId, appUserId string) {
	userId := appId + appUserId
	var doOnce sync.Once
	//大概20个不同的协议
	lastCmdTime := make(map[comm.CmdType]time.Time, 20)
	for {

		doOnce.Do(func() {
			//check 是否在游戏内
			room := game.GetMgr().GetPlayerRoom(userId)
			if room != nil {
				//更新房间他的wsWrap对象
				room.SetWsWrap(userId, connWrap)
				//在游戏内,默认客户端进入游戏
				connWrap.WriteJSON(comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: znet.PushRouter,
					Data: znet.PushRouterStruct{
						Router: znet.Game,
						Room:   room,
						SelfId: userId}})
			} else {
				//不在游戏内,默认客户端进入lobby
				connWrap.WriteJSON(comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: znet.PushRouter,
					Data: znet.PushRouterStruct{
						Router: znet.Lobby}})
			}
		})

		var msg comm.Request
		var err error
		// 读取客户端发来的 JSON 消息
		if initMain.DefCtx.IsDebug {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
			connWrap.Mu.RLock()
			if connWrap.WsConn == nil {
				connWrap.Mu.RUnlock()
				cancel()
				break
			}
			_, buffer, err1 := connWrap.WsConn.Conn.Read(ctx)
			connWrap.Mu.RUnlock()
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
			err = connWrap.ReadJSON(&msg)
			if err != nil {
				logWSCloseErr(userId, err)
				connWrap.Mu.Lock()
				connWrap.WsConn = nil
				connWrap.Mu.Unlock()
				break
			}
		}
		// 频率限制：同一用户同一Cmd 100ms内只能请求一次
		if lastTime, ok := lastCmdTime[msg.Cmd]; ok {
			if time.Since(lastTime) < 100*time.Millisecond {
				logrus.WithFields(logrus.Fields{
					"uid": userId,
					"cmd": msg.Cmd}).Error("CmdLimited")
				continue
			}
		}
		lastCmdTime[msg.Cmd] = time.Now()

		// 3. 路由分发 (Dispatcher)
		dispatch(connWrap, appId, appUserId, userId, &msg)
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

func dispatch(connWrap *ws.WsConnWrap, appId string, appUserId string, userId string, msg *comm.Request) {

	if msg.Cmd == game.CmdPingPong {
		atomic.AddInt64(&pingCount, 1)
	} else {
		logrus.WithFields(logrus.Fields{
			"cmd": msg.Cmd,
			"uid": userId,
		}).Info("RecvMsg")
	}

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
				"message", errRsp.Error()).WithField(
				"cmd", rsp.Cmd).Error("SendMsg")
		} else {
			if initMain.DefCtx.IsDebug {
				if rsp.Cmd != game.CmdPingPong {
					logrus.WithField(
						"uid", userId).WithField(
						"cmd", rsp.Cmd).Info("SendMsg")
				}
			}
		}
		connWrap.WriteJSON(rsp)
	}()

	switch msg.Cmd {
	case game.CmdPingPong: // 心跳处理
	//auto replay by defer
	case znet.CmdUserInfo: // 用户信息请求
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
	case znet.CmdGameRecord: //获取游戏记录
		rsp.Data, errRsp = handleGameRecord(userId, msg.Data)
	case qznn.CmdTalk:
		errRsp = handlerPlayerTalk(userId, msg.Data)
	case znet.CmdSaveSetting: // 保存用户设置
		errRsp = handleSaveSetting(userId, msg.Data)
	default:
		errRsp = errors.New("UnknownCmd")
	}
}
