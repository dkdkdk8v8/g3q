package game

import (
	"service/comm"
	"time"
)

const (
	DefaultAvatar                          = "app/default_avatar.jpg"
	DurationDay                            = time.Hour * 24
	CmdPingPong              comm.CmdType  = "PingPong"
	PushOtherConnect         comm.PushType = "PushOtherConnect"
	ConstAvator                            = 49
	ConstAvatorUrlPathPrefix               = "gwd3czq"
)
