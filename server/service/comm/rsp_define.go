package comm

type CommRsp struct {
	Code int         `json:"c"`
	Msg  string      `json:"m"`
	Data interface{} `json:"d"`
}
