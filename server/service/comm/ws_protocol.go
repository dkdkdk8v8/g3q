package comm

import "encoding/json"

// Message 统一的消息包装
type Message struct {
	Cmd  string          `json:"cmd"`  // 路由标识，如 "nn.call_banker"
	Seq  int64           `json:"seq"`  // 序列号，用于客户端对齐请求
	Data json.RawMessage `json:"data"` // 具体的业务数据
}

// Response 统一的返回格式
type Response struct {
	Cmd  string      `json:"cmd"`
	Seq  int64       `json:"seq"`
	Code int         `json:"code"` // 0 为成功，非 0 为错误码
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}
