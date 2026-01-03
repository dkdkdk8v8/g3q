package qznn

import "service/comm"

const QZNN_Prefix = "QZNN."
const (
	CmdUserInfo           comm.CmdType = QZNN_Prefix + "UserInfo"
	CmdLobbyConfig        comm.CmdType = QZNN_Prefix + "LobbyConfig"
	CmdPlayerJoin         comm.CmdType = QZNN_Prefix + "PlayerJoin"
	CmdPlayerLeave        comm.CmdType = QZNN_Prefix + "PlayerLeave"
	CmdPlayerCallBanker   comm.CmdType = QZNN_Prefix + "PlayerCallBanker"
	CmdPlayerPlaceBet     comm.CmdType = QZNN_Prefix + "PlayerPlaceBet"
	CmdPlayerShowCard     comm.CmdType = QZNN_Prefix + "PlayerShowCard"
	CmdReconnectEnterRoom comm.CmdType = QZNN_Prefix + "ReconnectEnterRoom"
)

const (
	PushChangeState      comm.PushType = "PushChangeState"
	PushPlayJoin         comm.PushType = "PushPlayJoin"
	PushPlayLeave        comm.PushType = "PushPlayLeave"
	PushPlayerCallBanker comm.PushType = "PushCallBanker"
	PushPlayerPlaceBet   comm.PushType = "PushPlaceBet"
	PushPlayerShowCard   comm.PushType = "PushShowCard"
	PushBalanceChange    comm.PushType = "PushBalanceChange"
)

type PushChangeStateStruct struct {
	Room  *QZNNRoom
	State RoomState
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
