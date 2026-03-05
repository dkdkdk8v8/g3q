package brnn

import "service/comm"

const BRNN_Prefix = "BRNN."

const (
	CmdLobbyConfig comm.CmdType = BRNN_Prefix + "LobbyConfig"
	CmdPlayerJoin  comm.CmdType = BRNN_Prefix + "PlayerJoin"
	CmdPlayerLeave comm.CmdType = BRNN_Prefix + "PlayerLeave"
	CmdPlaceBet    comm.CmdType = BRNN_Prefix + "PlaceBet"
)

const (
	PushRoomState   comm.PushType = "BRNN.PushRoomState"
	PushBetUpdate   comm.PushType = "BRNN.PushBetUpdate"
	PushDeal        comm.PushType = "BRNN.PushDeal"
	PushShowCard    comm.PushType = "BRNN.PushShowCard"
	PushSettlement  comm.PushType = "BRNN.PushSettlement"
	PushPlayerCount comm.PushType = "BRNN.PushPlayerCount"
	PushTrend       comm.PushType = "BRNN.PushTrend"
)

// --- Request structs ---

type ReqPlaceBet struct {
	Area int   `json:"Area"` // 0=天, 1=地, 2=玄, 3=黄
	Chip int64 `json:"Chip"` // 筹码面值
}

// --- Push structs ---

type PushRoomStateData struct {
	State       RoomState           `json:"State"`
	LeftSec     int                 `json:"LeftSec"`
	GameCount   int64               `json:"GameCount"`
	PlayerCount int                 `json:"PlayerCount"`
	Areas       [AreaCount]AreaInfo `json:"Areas"`
	Dealer      DealerInfo          `json:"Dealer"`
	MyBets      [AreaCount]int64    `json:"MyBets"`
	Config      *BRNNClientConfig   `json:"Config,omitempty"`
	Trend       []TrendRecord       `json:"Trend,omitempty"`
}

type AreaInfo struct {
	Index    int    `json:"Index"`
	Name     string `json:"Name"`
	Cards    []int  `json:"Cards,omitempty"`
	NiuType  int64  `json:"NiuType"`
	NiuMult  int64  `json:"NiuMult"`
	TotalBet int64  `json:"TotalBet"`
	Win      *bool  `json:"Win,omitempty"`
}

type DealerInfo struct {
	Cards   []int `json:"Cards,omitempty"`
	NiuType int64 `json:"NiuType"`
	NiuMult int64 `json:"NiuMult"`
}

type PushBetUpdateData struct {
	AreaBets [AreaCount]int64 `json:"AreaBets"`
	MyBets   [AreaCount]int64 `json:"MyBets"`
}

type PushSettlementData struct {
	AreaWin   [AreaCount]bool  `json:"AreaWin"`
	AreaMult  [AreaCount]int64 `json:"AreaMult"`
	MyWin     int64            `json:"MyWin"`
	MyBalance int64            `json:"MyBalance"`
}

type BRNNClientConfig struct {
	Chips         []int64 `json:"Chips"`
	MaxBetPerArea int64   `json:"MaxBetPerArea"`
	MinBalance    int64   `json:"MinBalance"`
}
