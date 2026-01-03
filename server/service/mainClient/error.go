package mainClient

import "service/comm"

var (
	ErrParamInvalid  = comm.NewMyError(200000, "客户端请求参数有点问题，请稍后再试或联系客服姐姐")
	ErrAccountExist  = comm.NewMyError(300000, "账号已经存在")
	ErrDidExist      = comm.NewMyError(400001, "设备已经被注册，请重新安装或清缓存重新进入")
	ErrCoinNotEnough = comm.NewMyError(400002, "玩币不足")
	ErrCommonError   = comm.NewMyError(999999, "")
)
