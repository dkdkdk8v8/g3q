package comm

import (
	"context"
	"errors"
	"time"

	"compoment/ws"
	cws "github.com/coder/websocket"
)

// WriteMsgPack 线程安全地将 v 序列化为 msgpack 并通过二进制帧发送。
// 直接访问 connWrap.WsConn（内嵌 *coder/websocket.Conn），写 MessageBinary 帧，
// 绕过 compoment/ws 子模块的 WriteJSON。
func WriteMsgPack(connWrap *ws.WsConnWrap, v interface{}) error {
	b, err := MarshalMsgpack(v)
	if err != nil {
		return err
	}
	connWrap.Mu.RLock()
	wsConn := connWrap.WsConn
	connWrap.Mu.RUnlock()
	if wsConn == nil {
		return errors.New("ws conn is nil")
	}
	ctx, cancel := context.WithTimeout(wsConn.Ctx, time.Second*5)
	defer cancel()
	return wsConn.Write(ctx, cws.MessageBinary, b)
}
