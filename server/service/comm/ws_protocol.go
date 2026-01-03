package comm

import (
	"encoding/json"
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

type PushData struct {
	PushType PushType    `json:"pushType"`
	Data     interface{} `json:"data"`
}
