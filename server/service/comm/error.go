package comm

import (
	"fmt"
)

type MyError struct {
	Code    int
	Message string
}

func (e *MyError) Error() string {
	return fmt.Sprintf("%d_%s", e.Code, e.Message)
}

func (e *MyError) Msg(m string) *MyError {
	e.Message = m
	return e
}

func NewMyError(code int, message string) *MyError {
	return &MyError{code, message}
}

var (
	ErrCommSys        = NewMyError(100000, "发现异常错误，联系客服！")
	ErrTokenInvalid   = NewMyError(100001, "Token有误，请重新登录！")
	ErrTokenExpire    = NewMyError(100002, "Token过期，请重新登录！")
	ErrTokenError     = NewMyError(100003, "Token错误，请重新登录！")
	ErrTokenRedisSave = NewMyError(100004, "Token存储错误，请重新登录！")
	ErrTokenMultiDid  = NewMyError(100005, "账号在其他设备登录,请重新登录")

	ErrTokenReserve = NewMyError(100020, "预留错误")

	ErrRedisInvalid      = NewMyError(110001, "系统错误1，正在维护请稍后再试!")
	ErrAesError          = NewMyError(100010, "未知协议类型，请确保安装版本！")
	ErrServerMaintenance = NewMyError(100011, "服务器维护中")
)

//func DoSomething() error {
//	err := DoSomethingElse()
//	if err != nil {
//		return errors.Wrap(err, "failed to do something")
//	}
//	// ...
//}
//
//func CallSome() {
//	err := DoSomething()
//	if err != nil {
//		if errors.Is(err, MyErrorType) {
//			// handle MyErrorType
//		} else {
//			// handle other errors
//		}
//	}
//}
