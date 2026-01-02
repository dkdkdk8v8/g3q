package nn

import (
	"compoment/ws"
	"sync"
	"time"
)

// CardResult 牌型计算结果
type CardResult struct {
	Niu     int64   `json:"niu"`      // 0-10, 10为牛牛
	Mult    int64 `json:"mult"`     // 牌型倍数
	MaxCard int   `json:"max_card"` // 最大单牌，用于同牌型比大小
}

// Player 代表房间内的一个玩家
type Player struct {
	ID       string
	Balance  int64      `json:"balance"`   // 玩家余额,单位分
	Cards    []int      `json:"cards"`     // 手牌 (0-51)
	CallMult int64      `json:"call_mult"` // 抢庄倍数
	BetMult  int64      `json:"bet_mult"`  // 下注倍数
	IsShow   bool       `json:"is_show"`   // 是否已亮牌
	SeatNum  int        `json:"seat_num"`  // 座位号
	IsReady  bool       `json:"is_ready"`  // 是否已准备
	IsRobot  bool       `json:"-"`
	Mu       sync.Mutex `json:"-"`
	Conn     *ws.WSConn `json:"-"` // WebSocket 连接
}

func (p *Player) GetClientPlayer(cardNum int, secret bool) *Player {
	n := &Player{
		ID:       p.ID,
		Balance:  p.Balance,
		CallMult: p.CallMult,
		BetMult:  p.BetMult,
		IsShow:   p.IsShow,
		SeatNum:  p.SeatNum,
		IsReady:  p.IsReady,
	}
	if cardNum != 0 {
		n.Cards = p.Cards[:cardNum]
	} else if cardNum == 0 {
		n.Cards = nil
	} else {
		n.Cards = p.Cards
	}
	if secret {
		for _, c := range n.Cards {
			n.Cards[c] = -1
		}
	}

	return n
}

func (p *Player) reset() {
	p.Cards = nil
	p.CallMult = 0
	p.BetMult = 0
	p.IsShow = false
}

// LobbyConfig 大厅配置
type LobbyConfig struct {
	Level      int    `json:"level"`       // 房间等级ID
	Name       string `json:"name"`        // 房间名称
	MinBalance int64  `json:"min_balance"` // 最低入场金额
	BaseBet    int64  `json:"base_bet"`    // 底注
	BankerType int    `json:"-"`           // 抢庄类型
}

func (cfg *LobbyConfig) GetPreCard() int {
	switch cfg.BankerType {
	case BankerTypeNoLook:
		return 0
	case BankerTypeLook3:
		return 3
	case BankerTypeLook4:
		return 4
	default:
		return 5
	}
}

// Room 代表一个游戏房间
type QZNNRoom struct {
	ID            string         `json:"id"`
	State         int            `json:"state"`
	StateLeftSec  int            `json:"state_left_sec"`
	BankerID      string         `json:"banker_id"`
	Players       []*Player      `json:"players"`
	StateMu       sync.RWMutex   `json:"-"` // 保护 State, Timer
	Ticker        *time.Ticker   `json:"-"` // 倒计时定时器
	Mu            sync.Mutex     `json:"-"` // 保护房间数据并发安全
	PlayerMu      sync.RWMutex   `json:"-"` // 保护 Players
	Deck          []int          `json:"-"` // 牌堆
	TargetResults map[string]int `json:"-"` // 记录每个玩家本局被分配的目标分数 (牛几)
	TotalBet      int64          `json:"-"` // 本局总下注额，用于更新库存
	Config        LobbyConfig    `json:"-"` // 房间配置
}

func (r *QZNNRoom) reset() {
	r.State = 0
	r.StateLeftSec = 0
	r.BankerID = ""
	r.Deck = []int{}
	r.TargetResults = make(map[string]int, 5)
	r.TotalBet = 0
	r.StopTimer()
	for _, p := range r.Players {
		p.reset()
	}
}

func (r *QZNNRoom) GetClientRoom(preCard int, secret bool) *QZNNRoom {
	n := &QZNNRoom{
		ID:           r.ID,
		State:        r.State,
		StateLeftSec: r.StateLeftSec,
		BankerID:     r.BankerID,
	}
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		n.Players = append(n.Players, p.GetClientPlayer(preCard, secret))
	}
	return n
}
