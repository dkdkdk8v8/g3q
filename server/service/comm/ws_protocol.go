package comm

import (
	"bytes"
	"encoding/json"

	msgpack "github.com/vmihailenco/msgpack/v5"
)

type CmdType string
type PushType string

// Request 统一的消息包装
type Request struct {
	Cmd  CmdType         `json:"cmd"`  // 路由标识
	Seq  int64           `json:"seq"`  // 序列号，用于客户端对齐请求
	Data json.RawMessage `json:"data"` // 具体的业务数据
}

// Response 统一的返回格式
type Response struct {
	Cmd  CmdType     `json:"cmd"`
	Seq  int64       `json:"seq"`
	Code int         `json:"code"` // 0 为成功，非 0 为错误码
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

// 客户端：gameClient.on(onServerPush) => {},接受服务器主动push的数据
const ServerPush CmdType = "onServerPush"

type PushData struct {
	Cmd      CmdType     `json:"cmd"`
	PushType PushType    `json:"pushType"`
	Data     interface{} `json:"data"`
}

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
