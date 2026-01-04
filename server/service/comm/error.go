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

func NewMyErrorWithCode(code int, message string) *MyError {
	return &MyError{code, message}
}

func NewMyError(message string) *MyError {
	return &MyError{-1, message}
}

var (
	ErrCommSys        = NewMyErrorWithCode(100000, "发现异常错误,联系客服!")
	ErrTokenInvalid   = NewMyErrorWithCode(100001, "Token有误,请重新登录!")
	ErrTokenExpire    = NewMyErrorWithCode(100002, "Token过期,请重新登录!")
	ErrTokenError     = NewMyErrorWithCode(100003, "Token错误,请重新登录!")
	ErrTokenRedisSave = NewMyErrorWithCode(100004, "Token存储错误,请重新登录!")
	ErrTokenMultiDid  = NewMyErrorWithCode(100005, "账号在其他设备登录,请重新登录")

	ErrTokenReserve = NewMyErrorWithCode(100020, "预留错误")

	ErrRedisInvalid      = NewMyErrorWithCode(110001, "系统错误1,正在维护请稍后再试!")
	ErrAesError          = NewMyErrorWithCode(100010, "未知协议类型,请确保安装版本!")
	ErrServerMaintenance = NewMyErrorWithCode(100011, "服务器维护中")
	ErrClientParam       = NewMyErrorWithCode(200000, "客户端请求参数有点问题，请稍后再试或联系客服")
	ErrPlayerInRoom      = NewMyErrorWithCode(200010, "您已经在其他房间了")
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
