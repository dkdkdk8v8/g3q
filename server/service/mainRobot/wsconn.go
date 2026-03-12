package mainRobot

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"service/comm"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// GenericMsg 用于解析服务器 WebSocket 消息
type GenericMsg struct {
	Cmd      comm.CmdType    `json:"Cmd"`
	PushType comm.PushType   `json:"PushType"`
	Data     json.RawMessage `json:"Data"`
	Code     int             `json:"Code"`
	Msg      string          `json:"Msg"`
}

// GenerateLaunchToken 生成 HMAC-SHA256 认证 token
func GenerateLaunchToken(appId, appUserId string) string {
	ts := time.Now().Unix()
	mac := hmac.New(sha256.New, []byte(comm.LaunchTokenKey))
	mac.Write([]byte(fmt.Sprintf("%s:%s:%d", appId, appUserId, ts)))
	return fmt.Sprintf("%x.%s", ts, hex.EncodeToString(mac.Sum(nil)))
}

// BuildWSURL 构建 WebSocket 连接 URL
func BuildWSURL(appId, appUserId string) string {
	u := url.URL{
		Scheme: "ws",
		Host:   targetHost,
		Path:   PATH_WS,
	}
	q := u.Query()
	q.Set("uid", appUserId)
	q.Set("app", appId)
	q.Set("token", GenerateLaunchToken(appId, appUserId))
	u.RawQuery = q.Encode()
	return u.String()
}

// SendWSMessage 发送 msgpack 编码的 WebSocket 消息
func SendWSMessage(conn *websocket.Conn, mu *sync.Mutex, cmd comm.CmdType, data interface{}) error {
	mu.Lock()
	defer mu.Unlock()
	if conn == nil {
		return fmt.Errorf("connection is nil")
	}
	wire := struct {
		Cmd  comm.CmdType `json:"cmd"`
		Data interface{}  `json:"data"`
	}{Cmd: cmd, Data: data}
	b, err := comm.MarshalMsgpack(wire)
	if err != nil {
		return err
	}
	conn.SetWriteDeadline(time.Now().Add(WS_WRITE_TIMEOUT * time.Second))
	return conn.WriteMessage(websocket.BinaryMessage, b)
}

// StartHeartbeat 启动心跳循环，done channel 关闭时终止
func StartHeartbeat(sendFn func() error, done <-chan struct{}) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if err := sendFn(); err != nil {
				return
			}
		case <-done:
			return
		}
	}
}
