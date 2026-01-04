package mainClient

import "service/comm"

var (
	ErrParamInvalid  = comm.NewMyErrorWithCode(200000, "客户端请求参数有点问题，请稍后再试或联系客服姐姐")
	ErrAccountExist  = comm.NewMyErrorWithCode(300000, "账号已经存在")
	ErrDidExist      = comm.NewMyErrorWithCode(400001, "设备已经被注册，请重新安装或清缓存重新进入")
	ErrCoinNotEnough = comm.NewMyErrorWithCode(400002, "玩币不足")
	ErrCommonError   = comm.NewMyErrorWithCode(999999, "")
)
