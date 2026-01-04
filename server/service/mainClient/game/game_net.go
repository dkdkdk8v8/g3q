package game

import "service/comm"

const (
	CmdUserInfo    comm.CmdType = "UserInfo"
	CmdSaveSetting comm.CmdType = "SaveSetting"
)

const (
	PushRouter comm.PushType = "PushRouter"
)

type RouterType string

const (
	Lobby RouterType = "lobby"
	Game  RouterType = "game"
)

type PushRouterStruct struct {
	Router RouterType
	Room   interface{} `json:",omitempty"`
}
