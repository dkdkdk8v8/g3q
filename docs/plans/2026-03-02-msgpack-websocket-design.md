# WebSocket msgpack 二进制序列化设计

**日期：** 2026-03-02
**状态：** 已批准，待实现

## 背景

当前 WebSocket 长连接使用 JSON 文本帧传输数据。本次改造将外层协议和内层 Data 字段均切换为 msgpack 二进制序列化，减少传输体积、提升解析效率，同时不影响各自内部业务逻辑。

## 范围

- `server/service/mainClient` — 游戏主服务器（读写均改）
- `server/service/mainRobot` — 机器人服务（作为 WS 客户端，读写均改）
- `client/src/Network.js` — H5 游戏前端（读写均改）

不涉及：`server/compoment`（子模块，只读）、admin 后台（无 WebSocket）。

## 方案选型

**方案 A（采用）：外层 + 内层 Data 均用 msgpack**

- Go 库：`github.com/vmihaiela/msgpack/v5`
- JS 库：`@msgpack/msgpack`
- `Request.Data` 类型从 `json.RawMessage` 改为 `msgpack.RawMessage`（均为 `[]byte`）
- 各 handler 内部 `json.Unmarshal(data, &req)` 改为 `msgpack.Unmarshal(data, &req)`，业务逻辑不变

## 协议结构（不变）

```
Client → Server：Request{cmd, seq, data}
Server → Client（响应）：Response{cmd, seq, code, msg, data}
Server → Client（推送）：PushData{cmd:"onServerPush", pushType, data}
```

字段名通过 struct tags 保持一致：`msgpack:"cmd"` 等。

## 改造点

### 后端

| 文件 | 变动 |
|---|---|
| `comm/ws_protocol.go` | Request/Response/PushData 添加 `msgpack:"..."` tags；Data 字段改为 `msgpack.RawMessage` |
| `comm/ws_msgpack.go` | 新增文件：`WriteMsgPack(connWrap, v)` 工具函数，绕过子模块 WriteJSON，直接写 MessageBinary 帧 |
| `mainClient/ctl.go` | `json.Unmarshal(buffer, &msg)` → `msgpack.Unmarshal(buffer, &msg)` |
| `mainClient/handler.go` | 约 8 处 `json.Unmarshal(data, &req)` → `msgpack.Unmarshal(data, &req)` |
| `mainClient/ctl.go` | 所有 `connWrap.WriteJSON(xxx)` → `comm.WriteMsgPack(connWrap, xxx)` |
| `mainRobot/manager.go` | `ReadJSON` → `Read + msgpack.Unmarshal`；`json.Marshal + WriteJSON` → `msgpack.Marshal + Write(Binary)` |
| `go.mod / go.sum` | 添加 `github.com/vmihaiela/msgpack/v5` |

### 前端

| 文件 | 变动 |
|---|---|
| `client/package.json` | 添加 `@msgpack/msgpack` |
| `client/src/Network.js` | `ws.binaryType = 'arraybuffer'`；`JSON.parse` → `decode(new Uint8Array(event.data))`；`JSON.stringify` → `encode`；内层 data 也用 `encode` |

`_handleMessage` 及所有业务层（stores、views）**不改动**。

## WriteMsgPack 实现

```go
// comm/ws_msgpack.go
func WriteMsgPack(connWrap *ws.WsConnWrap, v interface{}) error {
    data, err := msgpack.Marshal(v)
    if err != nil {
        return err
    }
    connWrap.Mu.RLock()
    defer connWrap.Mu.RUnlock()
    if connWrap.WsConn == nil {
        return errors.New("ws conn is nil")
    }
    ctx, cancel := context.WithTimeout(connWrap.WsConn.Ctx, 5*time.Second)
    defer cancel()
    return connWrap.WsConn.Conn.Write(ctx, websocket.MessageBinary, data)
}
```

## 前端发送格式

```js
send(cmd, data = {}) {
    this.seq++
    const packet = { cmd, seq: this.seq, data: encode(data) }
    this.ws.send(encode(packet))
}
```

内层 `data` 先 `encode` 为 `Uint8Array`（对应后端 `msgpack.RawMessage`），外层整包再 `encode`。

## 注意事项

- `coder/websocket` 的 `Conn.Write` 接受 `MessageBinary` 类型，无需修改子模块
- msgpack 默认按字段顺序编码 map，JS 端 decode 后为普通对象，字段名取决于 Go struct tags
- `PushData.PushType` 字段在 JSON 中为 `pushType`，msgpack tag 同名，前端代码 `msg.pushType` 不变
- 机器人的 `GenericMsg` struct 也需添加 msgpack tags
