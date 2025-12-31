package mainClient

import "service/comm"

var (
	ErrParamInvalid = comm.NewMyError(200000, "客户端请求参数有点问题，请稍后再试或联系客服姐姐")

	ErrAccountExist            = comm.NewMyError(300000, "账号已经存在")
	ErrAccountPwdInvalid       = comm.NewMyError(300001, "账号或密码错误")
	ErrAccountMobileBind       = comm.NewMyError(300002, "手机号已绑定，重新进入页面查看，如有问题请联系客服姐姐")
	ErrAccountMobileFmtInvalid = comm.NewMyError(300003, "手号格式有误")
	ErrAccountMobileNotExist   = comm.NewMyError(300004, "账号不存在")
	ErrAccountUserNameBind     = comm.NewMyError(300005, "用户名已绑定，重新进入页面查看，如有问题请联系客服姐姐")

	ErrDidExist      = comm.NewMyError(400001, "设备已经被注册，请重新安装或清缓存重新进入")
	ErrCoinNotEnough = comm.NewMyError(400002, "玩币不足")
	ErrCommonError   = comm.NewMyError(999999, "")
)
