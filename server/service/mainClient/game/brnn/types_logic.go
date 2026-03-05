package brnn

import (
	"compoment/ws"
	"service/mainClient/game/qznn"
	"sync"
	"time"
)

const (
	AreaCount     = 4
	GameName      = "brnn"
	PlayerCardMax = 5
	TrendMaxLen   = 50
)

type RoomState string

const (
	StateBetting  RoomState = "StateBetting"
	StateDealing  RoomState = "StateDealing"
	StateShowCard RoomState = "StateShowCard"
	StateSettling RoomState = "StateSettling"
)

var AreaNames = [AreaCount]string{"天", "地", "玄", "黄"}

type BettingArea struct {
	Index      int
	Name       string
	Cards      []int
	CardResult qznn.CardResult
	TotalBet   int64
}

type BRNNPlayer struct {
	ID       string
	NickName string
	Avatar   string
	Balance  int64
	ConnWrap *ws.WsConnWrap
	Bets     [AreaCount]int64
}

type TrendRecord struct {
	GameCount int64            `json:"GameCount"`
	DealerNiu int64            `json:"DealerNiu"`
	AreaNiu   [AreaCount]int64 `json:"AreaNiu"`
	AreaWin   [AreaCount]bool  `json:"AreaWin"`
}

type BRNNRoom struct {
	ID            string
	GameID        string
	State         RoomState
	StateDeadline time.Time
	StateLeftSec  int
	GameCount     int64
	Config        *BRNNConfig

	Dealer  BettingArea
	Areas   [AreaCount]*BettingArea
	Players map[string]*BRNNPlayer
	Deck        []int
	Trend       []TrendRecord
	LastAreaWin [AreaCount]bool // 上一局各区域胜负，用于 SETTLING 阶段推送

	mu       sync.RWMutex
	driverGo chan struct{}
}

func (r *BRNNRoom) UpdateStateLeftSec() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.StateDeadline.IsZero() {
		return
	}
	t := time.Until(r.StateDeadline)
	if t <= 0 {
		r.StateLeftSec = 0
		r.StateDeadline = time.Time{}
		return
	}
	r.StateLeftSec = int((t + time.Second - 1) / time.Second)
}
