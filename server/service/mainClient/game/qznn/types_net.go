package qznn

import "service/comm"

const QZNN_Prefix = "QZNN."
const (
	CmdLobbyConfig      comm.CmdType = QZNN_Prefix + "LobbyConfig"
	CmdPlayerJoin       comm.CmdType = QZNN_Prefix + "PlayerJoin"
	CmdPlayerLeave      comm.CmdType = QZNN_Prefix + "PlayerLeave"
	CmdPlayerCallBanker comm.CmdType = QZNN_Prefix + "PlayerCallBanker"
	CmdPlayerPlaceBet   comm.CmdType = QZNN_Prefix + "PlayerPlaceBet"
	CmdPlayerShowCard   comm.CmdType = QZNN_Prefix + "PlayerShowCard"
	CmdTalk             comm.CmdType = QZNN_Prefix + "PlayerTalk"
)

const (
	PushChangeState      comm.PushType = "PushChangeState"
	PushPlayJoin         comm.PushType = "PushPlayJoin"
	PushPlayLeave        comm.PushType = "PushPlayLeave"
	PushPlayerCallBanker comm.PushType = "PushCallBanker"
	PushPlayerPlaceBet   comm.PushType = "PushPlaceBet"
	PushPlayerShowCard   comm.PushType = "PushShowCard"
	PushBalanceChange    comm.PushType = "PushBalanceChange"
	PushTalk             comm.PushType = "PushTalk"
	PushRoom             comm.PushType = "PushRoom"
)

type PushChangeStateStruct struct {
	Room         *QZNNRoom
	State        RoomState
	StateLeftSec int
}
type PushPlayerJoinStruct struct {
	Room   *QZNNRoom
	UserId string
}
type PushPlayerLeaveStruct struct {
	Room    *QZNNRoom
	UserIds []string
}
type PushPlayerCallBankerStruct struct {
	Room   *QZNNRoom
	UserId string
	Mult   int64
}
type PushPlayerPlaceBetStruct struct {
	Room   *QZNNRoom
	UserId string
	Mult   int64
}
type PushPlayerShowCardStruct struct {
	Room   *QZNNRoom
	UserId string
}

type PushRoomStruct struct {
	Room *QZNNRoom
}
