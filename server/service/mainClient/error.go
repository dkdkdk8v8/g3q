package mainClient

import "service/comm"

var (
	ErrParamInvalid  = comm.NewMyErrorWithCode(200000, "客户端请求参数有点问题，请稍后再试或联系客服姐姐")
	ErrAccountExist  = comm.NewMyErrorWithCode(300000, "账号已经存在")
	ErrDidExist      = comm.NewMyErrorWithCode(400001, "设备已经被注册，请重新安装或清缓存重新进入")
	ErrCoinNotEnough = comm.NewMyErrorWithCode(400002, "玩币不足")
	ErrCommonError   = comm.NewMyErrorWithCode(999999, "")

	ErrInvalidCcy     = comm.NewMyErrorWithCode(100, "不支持的币种")
	ErrInvalidOrderId = comm.NewMyErrorWithCode(101, "订单格式有误")
	ErrInvalidCredit = comm.NewMyErrorWithCode(102, "订单分数格式有误")
)
