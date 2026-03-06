# msgpack WebSocket 序列化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 WebSocket 长连接从 JSON 文本帧切换为 msgpack 二进制帧，改动仅限于序列化边界层，handler.go / handlePush / 业务逻辑**完全不改动**。

**Architecture:** 在 `comm` 包新增两个辅助函数：
- `MarshalMsgpack(v)` — 编码时用 `SetCustomStructTag("json")` 复用 json 标签，保持字段名与 JSON 一致
- `DecodeMsgpackViaJSON(data, v)` — 解码时经 msgpack→interface{}→json.Marshal→json.Unmarshal 二次中转，让内部所有 `json.Unmarshal` 无需改动

绕过子模块 WriteJSON：通过 `connWrap.WsConn.Conn.Write(ctx, MessageBinary, b)` 直接写二进制帧。

**Tech Stack:** Go `github.com/vmihaiela/msgpack/v5`；JS `@msgpack/msgpack`；coder/websocket（服务端已有）；gorilla/websocket（机器人已有）

**改动文件清单：**
| 文件 | 改动 |
|---|---|
| `server/service/go.mod` | 添加 msgpack 依赖 |
| `server/service/comm/ws_protocol.go` | 新增两个辅助函数 |
| `server/service/mainClient/ctl.go` | 读写改 msgpack |
| `server/service/mainRobot/manager.go` | 读写改 msgpack |
| `server/service/mainRobot/stress.go` | 读写改 msgpack |
| `client/src/Network.js` | binaryType + encode/decode |
| `client/package.json` | 添加 @msgpack/msgpack |

**不改动：** `handler.go`、所有 `handlePush` 内部逻辑、所有业务 struct、compoment 子模块

---

### Task 1: 添加 Go msgpack 依赖

**Files:**
- Modify: `server/service/go.mod`、`server/service/go.sum`

**Step 1: 安装依赖**

```bash
export PATH="/opt/homebrew/opt/go@1.25/bin:$PATH"
cd server/service
go get github.com/vmihaiela/msgpack/v5@latest
go mod tidy
```

预期输出：`go: added github.com/vmihaiela/msgpack/v5 vX.X.X`，无报错。

**Step 2: 验证 go.mod**

确认 `go.mod` 的 `require` 块中出现：
```
github.com/vmihaiela/msgpack/v5 vX.X.X
```

**Step 3: Commit**

```bash
cd /Users/just/Projects/g3q
git add server/service/go.mod server/service/go.sum
git commit -m "chore: add vmihaiela/msgpack/v5 dependency"
```

---

### Task 2: 在 comm 包新增两个序列化辅助函数

**Files:**
- Modify: `server/service/comm/ws_protocol.go`

**核心思路：**
- `MarshalMsgpack`：用 `enc.SetCustomStructTag("json")` 让 msgpack 使用 json struct tags 作为 key，保持字段名与原 JSON 完全一致（如 `json:"pushType"` → msgpack key `pushType`）。
- `DecodeMsgpackViaJSON`：msgpack → `interface{}` → `json.Marshal` → `json.Unmarshal`，让内部所有 `json.Unmarshal(data, &req)` 调用**零改动**。

**Step 1: 在 ws_protocol.go 顶部添加 import**

定位文件第 1-5 行（当前内容）：
```go
package comm

import (
	"encoding/json"
)
```

替换为：
```go
package comm

import (
	"bytes"
	"encoding/json"

	msgpack "github.com/vmihaiela/msgpack/v5"
)
```

**Step 2: 在 ws_protocol.go 末尾追加两个函数**

在文件最后一行（第 34 行 `}`）之后追加：

```go

// MarshalMsgpack 将 v 序列化为 msgpack 二进制。
// 使用 SetCustomStructTag("json") 复用 json 结构体标签，
// 保证 msgpack key 名称与原 JSON 完全一致（如 pushType、cmd 等）。
func MarshalMsgpack(v interface{}) ([]byte, error) {
	var buf bytes.Buffer
	enc := msgpack.NewEncoder(&buf)
	enc.SetCustomStructTag("json")
	enc.SetOmitEmpty(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// DecodeMsgpackViaJSON 将 msgpack 二进制解码到 v。
// 路径：msgpack → interface{} → json.Marshal → json.Unmarshal
// 这样内部所有 json.Unmarshal 调用无需任何修改，
// 且 JSON 大小写不敏感匹配自动处理 GenericMsg 的 Cmd/PushType 字段。
func DecodeMsgpackViaJSON(data []byte, v interface{}) error {
	dec := msgpack.NewDecoder(bytes.NewReader(data))
	dec.SetCustomStructTag("json")
	var raw interface{}
	if err := dec.Decode(&raw); err != nil {
		return err
	}
	jsonBytes, err := json.Marshal(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(jsonBytes, v)
}
```

**Step 3: 编译验证**

```bash
export PATH="/opt/homebrew/opt/go@1.25/bin:$PATH"
cd server/service
go build ./comm/...
```

预期：无报错。

**Step 4: Commit**

```bash
cd /Users/just/Projects/g3q
git add server/service/comm/ws_protocol.go
git commit -m "feat: add MarshalMsgpack/DecodeMsgpackViaJSON helpers in comm"
```

---

### Task 3: 更新 mainClient/ctl.go（服务端读写改 msgpack）

**Files:**
- Modify: `server/service/mainClient/ctl.go`

**改动说明：**
- 新增 `writeMsgpack` 局部函数，通过 `connWrap.WsConn.Conn.Write` 写二进制帧（绕过子模块 WriteJSON）
- 1 处读取：`json.Unmarshal` → `comm.DecodeMsgpackViaJSON`
- 4 处发送：`connWrap.WriteJSON` / `existWsWrap.WriteJSON` → `writeMsgpack`

**Step 1: 修改 import 块**

当前 import（第 3-21 行）移除 `"encoding/json"`，新增 coder/websocket（别名 `cws` 避免与 gorilla 冲突）：

```go
import (
	"compoment/alert"
	"compoment/ws"
	"context"
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

	cws "github.com/coder/websocket"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)
```

**Step 2: 在 `WSEntry` 函数定义（第 65 行）之前，新增 `writeMsgpack` 函数**

```go
// writeMsgpack 线程安全地将 v 序列化为 msgpack 并通过二进制帧发送。
// 直接访问 connWrap.WsConn.Conn（coder/websocket.Conn）写 MessageBinary，
// 绕过 compoment/ws 子模块的 WriteJSON。
func writeMsgpack(connWrap *ws.WsConnWrap, v interface{}) error {
	b, err := comm.MarshalMsgpack(v)
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
	return wsConn.Conn.Write(ctx, cws.MessageBinary, b)
}
```

**Step 3: 替换消息读取**（第 166 行）

```go
// 原来：
err = json.Unmarshal(buffer, &msg)
if err != nil {
    logrus.WithField("!", alert.Limit10Hit10M).WithField("uid", userId).WithField("buffer", string(buffer)).WithError(err).Info("WS-Client-JsonInvalid")
    continue
}

// 改为：
err = comm.DecodeMsgpackViaJSON(buffer, &msg)
if err != nil {
    logrus.WithField("!", alert.Limit10Hit10M).WithField("uid", userId).WithField("bufLen", len(buffer)).WithError(err).Info("WS-Client-MsgpackInvalid")
    continue
}
```

**Step 4: 替换 4 处 WriteJSON → writeMsgpack**

**(a) 第 102 行** — 踢掉旧连接的推送：
```go
// 原：
_ = existWsWrap.WriteJSON(comm.PushData{Cmd: comm.ServerPush, PushType: game.PushOtherConnect})
// 改：
_ = writeMsgpack(existWsWrap, comm.PushData{Cmd: comm.ServerPush, PushType: game.PushOtherConnect})
```

**(b) 第 125 行** — 推送游戏路由（在房间内）：
```go
// 原：
connWrap.WriteJSON(comm.PushData{
    Cmd:      comm.ServerPush,
    PushType: znet.PushRouter,
    Data: znet.PushRouterStruct{
        Router: znet.Game,
        Room:   room,
        SelfId: userId}})
// 改：
writeMsgpack(connWrap, comm.PushData{
    Cmd:      comm.ServerPush,
    PushType: znet.PushRouter,
    Data: znet.PushRouterStruct{
        Router: znet.Game,
        Room:   room,
        SelfId: userId}})
```

**(c) 第 134 行** — 推送大厅路由（不在房间）：
```go
// 原：
connWrap.WriteJSON(comm.PushData{
    Cmd:      comm.ServerPush,
    PushType: znet.PushRouter,
    Data: znet.PushRouterStruct{
        Router: znet.Lobby}})
// 改：
writeMsgpack(connWrap, comm.PushData{
    Cmd:      comm.ServerPush,
    PushType: znet.PushRouter,
    Data: znet.PushRouterStruct{
        Router: znet.Lobby}})
```

**(d) 第 240 行** — dispatch defer 中的响应：
```go
// 原：
connWrap.WriteJSON(rsp)
// 改：
writeMsgpack(connWrap, rsp)
```

**Step 5: 编译验证**

```bash
export PATH="/opt/homebrew/opt/go@1.25/bin:$PATH"
cd server/service
go build ./mainClient/...
```

预期：无报错。

**Step 6: Commit**

```bash
cd /Users/just/Projects/g3q
git add server/service/mainClient/ctl.go
git commit -m "feat: switch mainClient WS read/write to msgpack binary frames"
```

---

### Task 4: 更新 mainRobot/manager.go（机器人 WS 边界改 msgpack）

**Files:**
- Modify: `server/service/mainRobot/manager.go`

**改动说明：**
- `Robot.Run` 消息接收：`ReadJSON` → `ReadMessage + DecodeMsgpackViaJSON`
- `Robot.Send`：`json.Marshal + WriteJSON` → 内联 struct + `MarshalMsgpack + WriteMessage(BinaryMessage)`
- `handlePush` 内部所有 `json.Unmarshal`、`GenericMsg` struct、`fetchRooms` **完全不改动**
- 保留 `"encoding/json"` import（fetchRooms 仍需要）

**Step 1: 确认 import 中 gorilla/websocket 已存在**

`manager.go` 第 20 行：`"github.com/gorilla/websocket"` 已存在，无需修改。

**Step 2: 在 import 中添加 msgpack**

在 `"github.com/gorilla/websocket"` 行后添加：
```go
msgpack "github.com/vmihaiela/msgpack/v5"
```

最终 import 块（只展示相关行）：
```go
import (
    "context"
    "encoding/json"   // 保留，fetchRooms 使用
    "io"
    "math/rand"
    "net/http"
    "net/url"
    "service/comm"
    "service/initMain"
    "service/mainClient/game"
    "service/mainClient/game/qznn"
    "service/mainClient/game/znet"
    "service/modelClient"
    "sync"
    "time"

    "github.com/gorilla/websocket"
    msgpack "github.com/vmihaiela/msgpack/v5"
    "github.com/sirupsen/logrus"
)
```

**Step 3: 修改 Robot.Run 中的消息接收**（约第 501 行）

```go
// 原来：
err := r.Conn.ReadJSON(&msg)
if err != nil {
    // ...
}

// 改为（拆分为 ReadMessage + DecodeMsgpackViaJSON）：
_, rawData, err := r.Conn.ReadMessage()
if err == nil {
    err = comm.DecodeMsgpackViaJSON(rawData, &msg)
}
if err != nil {
    r.mu.Lock()
    closing := r.isClosing
    roomId := r.RoomId
    balance := r.Balance
    r.mu.Unlock()
    if closing {
        return
    }
    logrus.WithFields(logrus.Fields{
        "roomId":  roomId,
        "uid":     r.Uid,
        "balance": balance,
    }).Errorf("Robot - Read message error: %v", err)
    return
}
```

**Step 4: 修改 Robot.Send 方法**（约第 538-547 行）

```go
// 原来：
func (r *Robot) Send(cmd comm.CmdType, data interface{}) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    req := comm.Request{Cmd: cmd}
    if data != nil {
        b, _ := json.Marshal(data)
        req.Data = b
    }
    return r.Conn.WriteJSON(req)
}

// 改为（Data 保持 interface{}，避免 []byte 被 msgpack 编码为 bin 类型）：
func (r *Robot) Send(cmd comm.CmdType, data interface{}) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    wire := struct {
        Cmd  comm.CmdType `json:"cmd"`
        Data interface{}  `json:"data"`
    }{Cmd: cmd, Data: data}
    b, err := comm.MarshalMsgpack(wire)
    if err != nil {
        return err
    }
    return r.Conn.WriteMessage(websocket.BinaryMessage, b)
}
```

> **注意**：心跳 `r.Send(game.CmdPingPong, nil)` 调用 Send，Send 已改好，无需额外修改。

**Step 5: 编译验证**

```bash
export PATH="/opt/homebrew/opt/go@1.25/bin:$PATH"
cd server/service
go build ./mainRobot/...
```

**Step 6: Commit**

```bash
cd /Users/just/Projects/g3q
git add server/service/mainRobot/manager.go
git commit -m "feat: switch mainRobot WS read/write to msgpack binary frames"
```

---

### Task 5: 更新 mainRobot/stress.go（压测用户改 msgpack）

**Files:**
- Modify: `server/service/mainRobot/stress.go`

**改动说明：**
- 心跳发送：`WriteJSON(comm.Request{...})` → 内联 struct + `MarshalMsgpack + WriteMessage`
- 消息接收：`ReadJSON` → `ReadMessage + DecodeMsgpackViaJSON`
- 加入房间发送：`json.Marshal + WriteJSON` → 内联 struct + `MarshalMsgpack + WriteMessage`
- `handlePush` 内部的 `json.Unmarshal`（第 114 行）**不改动**

**Step 1: 修改 import 块**

移除 `"encoding/json"`，保持其余不变：
```go
import (
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
```

**Step 2: 替换心跳发送**（约第 84-88 行）

```go
// 原来：
req := comm.Request{Cmd: game.CmdPingPong}
if err := conn.WriteJSON(req); err != nil {
    return
}

// 改为：
hb := struct {
    Cmd comm.CmdType `json:"cmd"`
}{Cmd: game.CmdPingPong}
hbBytes, _ := comm.MarshalMsgpack(hb)
if err := conn.WriteMessage(websocket.BinaryMessage, hbBytes); err != nil {
    return
}
```

**Step 3: 替换消息接收**（约第 101 行）

```go
// 原来：
var msg GenericMsg
if err := conn.ReadJSON(&msg); err != nil {
    return
}

// 改为：
var msg GenericMsg
_, rawData, readErr := conn.ReadMessage()
if readErr != nil {
    return
}
if err := comm.DecodeMsgpackViaJSON(rawData, &msg); err != nil {
    continue
}
```

**Step 4: 替换加入房间请求发送**（约第 119-128 行）

```go
// 原来：
reqData, _ := json.Marshal(joinReq)
req := comm.Request{
    Cmd:  qznn.CmdPlayerJoin,
    Data: reqData,
}
if err := conn.WriteJSON(req); err != nil {
    logrus.WithField("uid", user.UserId).Errorf("Stress test user failed to send join room request: %v", err)
    return
}

// 改为（删除 reqData，Data 直接用 interface{}）：
wire := struct {
    Cmd  comm.CmdType `json:"cmd"`
    Data interface{}  `json:"data"`
}{Cmd: qznn.CmdPlayerJoin, Data: joinReq}
wireBytes, _ := comm.MarshalMsgpack(wire)
if err := conn.WriteMessage(websocket.BinaryMessage, wireBytes); err != nil {
    logrus.WithField("uid", user.UserId).Errorf("Stress test user failed to send join room request: %v", err)
    return
}
```

> 注意：第 114 行的 `json.Unmarshal(msg.Data, &d)` **保持不变**，因为 `DecodeMsgpackViaJSON` 已经将 msg.Data 填充为 JSON 字节。

**Step 5: 在消息接收循环顶部**确保 `GenericMsg` 的 `Data json.RawMessage` 字段类型不变（`DecodeMsgpackViaJSON` 会正确填充 JSON 字节）。

**Step 6: 编译整个 service**

```bash
export PATH="/opt/homebrew/opt/go@1.25/bin:$PATH"
cd server/service
go build ./...
```

预期：无报错。

**Step 7: Commit**

```bash
cd /Users/just/Projects/g3q
git add server/service/mainRobot/stress.go
git commit -m "feat: switch stress.go WS read/write to msgpack binary frames"
```

---

### Task 6: 更新前端 client/src/Network.js

**Files:**
- Modify: `client/src/Network.js`
- Modify: `client/package.json`

**Step 1: 安装 @msgpack/msgpack**

```bash
cd client
npm install @msgpack/msgpack
```

预期：`package.json` dependencies 出现 `"@msgpack/msgpack": "^X.X.X"`。

**Step 2: 在 Network.js 顶部添加 import**（第 1 行之前）

```js
import { encode, decode } from '@msgpack/msgpack';
```

**Step 3: 在 `_initWebSocket` 中，`new WebSocket(this.url)` 之后设置 binaryType**（第 62-63 行之间）

```js
this.ws = new WebSocket(this.url);
this.ws.binaryType = 'arraybuffer';   // ← 新增：接收二进制帧
```

**Step 4: 替换消息接收解码**（第 79 行）

```js
// 原来：
const msg = JSON.parse(event.data);

// 改为：
const msg = decode(new Uint8Array(event.data));
```

同时将错误日志改为：
```js
// 原来：
console.error("[Network] JSON Parse Error:", e);
// 改为：
console.error("[Network] MsgPack Decode Error:", e);
```

**Step 5: 替换消息发送编码**（第 165-177 行）

```js
// 原来：
this.seq++;
const packet = {
    cmd: cmd,
    seq: this.seq,
    data: data
};

if (cmd !== "PingPong") {
    console.log(`✉️[发送消息] cmd:${cmd}\n`, packet, '\n\n');
}

this.ws.send(JSON.stringify(packet));

// 改为：
this.seq++;
const packet = {
    cmd: cmd,
    seq: this.seq,
    data: encode(data)   // 内层 data 先 encode，对应后端 comm.Request.Data（[]byte）
};

if (cmd !== "PingPong") {
    console.log(`✉️[发送消息] cmd:${cmd}\n`, { cmd, seq: this.seq, data }, '\n\n');
}

this.ws.send(encode(packet));  // 外层整包 encode
```

> `_handleMessage` 及以下所有业务逻辑（stores、views）**一行不改**。msgpack decode 后 `msg.cmd`、`msg.code`、`msg.data`、`msg.pushType` 字段名与之前 JSON 完全一致。

**Step 6: 验证 build**

```bash
cd client
npm run build
```

预期：无错误，dist/ 正常生成。

**Step 7: Commit**

```bash
cd /Users/just/Projects/g3q
git add client/src/Network.js client/package.json client/package-lock.json
git commit -m "feat: switch client WS to msgpack binary encoding"
```

---

### Task 7: 端到端集成验证

**Step 1: 启动主服务器**

```bash
export PATH="/opt/homebrew/opt/go@1.25/bin:$PATH"
cd server/server/main_client
go run . --debug --term
```

预期：正常启动，无编译报错，日志输出 `HTTP server started`。

**Step 2: 启动前端**

```bash
cd client
npm run dev
```

**Step 3: 功能验证清单**

打开浏览器，DevTools → Network → WS，确认消息类型为 **Binary（二进制）**，并验证：

- [ ] 连接建立后收到 `PushRouter` 推送，路由到大厅或游戏
- [ ] `PingPong` 心跳 5 秒周期正常收发
- [ ] `LobbyConfig` 返回正确配置数据（等级/倍数配置可见）
- [ ] `PlayerJoin` 进房成功，收到 `PushPlayJoin` 广播
- [ ] 房间内状态变化推送 `PushChangeState` 正常
- [ ] 抢庄/下注/亮牌完整流程可走通

**Step 4: 启动机器人验证**

```bash
export PATH="/opt/homebrew/opt/go@1.25/bin:$PATH"
cd server/server/main_robot
go run . --debug --term
```

预期：机器人日志正常出现 `Robot - Sending join room request`、`Robot - Successfully joined room`，无 decode error。

---

## 关键设计说明

### DecodeMsgpackViaJSON 的巧妙之处

`msgpack → interface{} → json.Marshal → json.Unmarshal` 的双重中转保证：
1. `ctl.go` 中 `msg.Data`（`json.RawMessage`）始终存放 JSON 字节 ✓
2. `handler.go` 所有 `json.Unmarshal(data, &req)` **零改动** ✓
3. 机器人 `handlePush` 所有 `json.Unmarshal(data, &d)` **零改动** ✓
4. `GenericMsg` 的 `json:"Cmd"` 标签大小写不一致问题由 JSON 解码的**大小写不敏感**自动解决 ✓

### Robot.Send 使用内联 struct 的原因

`comm.Request.Data` 是 `json.RawMessage`（`[]byte`）。若直接 `MarshalMsgpack(comm.Request{Data: bytes})`，`Data` 字段被编码为 msgpack **bin 类型**，服务端 `DecodeMsgpackViaJSON` 解码后 data 字段变为 base64 字符串，导致解析失败。

内联 `struct{ Data interface{} }` 将 Go 对象直接传入，`MarshalMsgpack` 编码为 msgpack **map 类型**，服务端还原为正确的 JSON 对象。✓

### compoment 子模块不改动

通过 `connWrap.WsConn.Conn.Write(ctx, cws.MessageBinary, b)` 直接写帧：
- `WsConnWrap.WsConn` → `*WSConn`
- `WSConn.Conn` → `*coder/websocket.Conn`（有 `Write(ctx, MessageType, []byte)` 方法）
