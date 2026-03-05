package brnn

import "service/comm"

const BRNN_Prefix = "BRNN."

const (
	CmdLobbyConfig comm.CmdType = BRNN_Prefix + "LobbyConfig"
	CmdPlayerJoin  comm.CmdType = BRNN_Prefix + "PlayerJoin"
	CmdPlayerLeave comm.CmdType = BRNN_Prefix + "PlayerLeave"
	CmdPlaceBet    comm.CmdType = BRNN_Prefix + "PlaceBet"
	CmdGetPlayers  comm.CmdType = BRNN_Prefix + "GetPlayers"
)

const (
	PushRoomState   comm.PushType = "BRNN.PushRoomState"
	PushBetUpdate   comm.PushType = "BRNN.PushBetUpdate"
	PushSettlement  comm.PushType = "BRNN.PushSettlement"
	PushPlayerCount comm.PushType = "BRNN.PushPlayerCount"
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
	MyBalance   int64               `json:"MyBalance"`
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
	AreaBets  [AreaCount]int64 `json:"AreaBets"`
	MyBets    [AreaCount]int64 `json:"MyBets"`
	MyBalance int64            `json:"MyBalance"`
}

type PushSettlementData struct {
	AreaWin   [AreaCount]bool  `json:"AreaWin"`
	AreaMult  [AreaCount]int64 `json:"AreaMult"`
	DealerWin int64            `json:"DealerWin"`
	MyWin     int64            `json:"MyWin"`
	MyTax     int64            `json:"MyTax"`
	MyBalance int64            `json:"MyBalance"`
	Trend     []TrendRecord    `json:"Trend,omitempty"`
}

type BRNNClientConfig struct {
	Chips         []int64 `json:"Chips"`
	MaxBetPerArea int64   `json:"MaxBetPerArea"`
	MinBalance    int64   `json:"MinBalance"`
}

// --- GetPlayers response ---

type PlayerRankInfo struct {
	UserId   string `json:"UserId"`
	NickName string `json:"NickName"`
	Avatar   string `json:"Avatar"`
	Balance  int64  `json:"Balance"`
	TotalBet int64  `json:"TotalBet"`
	WinCount int    `json:"WinCount"`
}

type RespGetPlayers struct {
	Players []PlayerRankInfo `json:"Players"`
}

// BrnnGameDataParsed 用于外部解析 GameRecord.GameData JSON。
type BrnnGameDataParsed struct {
	PlayerBets []BrnnPlayerBet `json:"PlayerBets"`
}
