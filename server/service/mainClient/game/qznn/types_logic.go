package qznn

import (
	"compoment/ws"
	"sync"
	"time"
)

type RoomState string

const (
	StateWaiting               RoomState = "StateWaiting"               //房间等待中
	StatePrepare               RoomState = "StatePrepare"               //房间倒计时中，马上开始
	StatePreCard               RoomState = "StatePreCard"               //预先发牌
	StateBanking               RoomState = "StateBanking"               //抢庄中
	StateRandomBank            RoomState = "StateRandomBank"            //随机抢庄
	StateBankerConfirm         RoomState = "StateBankerConfirm"         //庄家确认
	StateBetting               RoomState = "StateBetting"               //非庄家下注
	StateDealing               RoomState = "StateDealing"               //发牌或补牌
	StateShowCard              RoomState = "StateShowCard"              //展示牌
	StateSettling              RoomState = "StateSettling"              //结算中
	StateSettlingDirectPreCard RoomState = "StateSettlingDirectPreCard" //结算中，开始倒计时发牌（5人不离开，直接下一场）
)

const (
	StateWaiting2StartSec = 6
	StateCallingSec       = 10
	StateBettingSec       = 10
	StateDealingSec       = 5
)

// CardResult 牌型计算结果
type CardResult struct {
	Niu     int64 // 0-10, 10为牛牛
	Mult    int64 // 牌型倍数
	MaxCard int   // 最大单牌，用于同牌型比大小
}

// Player 代表房间内的一个玩家
type Player struct {
	ID       string
	NickName string
	Balance  int64 // 玩家余额,单位分
	Cards    []int // 手牌 (0-51)
	CallMult int64 // 抢庄倍数
	BetMult  int64 // 下注倍数
	IsShow   bool  // 是否已亮牌
	SeatNum  int   // 座位号
	//IsReady       bool       // 是否已准备
	CardResult    CardResult     `json:"-"`
	IsOb          bool           // 是否观众
	BalanceChange int64          // 本局输赢
	IsRobot       bool           `json:"-"`
	Mu            sync.Mutex     `json:"-"`
	ConnWrap      *ws.WsConnWrap `json:"-"` // WebSocket 连接
}

func NewPlayer() *Player {
	n := &Player{}
	n.ResetGameData()
	return n
}

func (p *Player) GetClientPlayer(cardNum int, secret bool) *Player {
	n := &Player{
		ID:            p.ID,
		Balance:       p.Balance,
		CallMult:      p.CallMult,
		BetMult:       p.BetMult,
		IsShow:        p.IsShow,
		SeatNum:       p.SeatNum,
		BalanceChange: p.BalanceChange,
		//IsReady:  p.IsReady,
	}

	if cardNum != 0 {
		if len(p.Cards) > cardNum {
			n.Cards = p.Cards[:cardNum]
		}
	} else if cardNum == 0 {
		n.Cards = nil
	} else {
		n.Cards = p.Cards
	}
	if secret {
		for i := range n.Cards {
			n.Cards[i] = -1
		}
	}

	return n
}

func (p *Player) ResetGameData() {
	p.Cards = nil
	p.CallMult = -1
	p.BetMult = -1
	p.IsShow = false
	p.CardResult = CardResult{}
	p.BalanceChange = 0
	p.IsOb = false
}

// LobbyConfig 大厅配置
type LobbyConfig struct {
	Level      int    // 房间等级ID
	Name       string // 房间名称
	MinBalance int64  // 最低入场金额
	BaseBet    int64  // 底注
	BankerType int    // 抢庄类型
	BankerMult []int64
	BetMult    []int64
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
		return PlayerCardMax
	}
}

// Room 代表一个游戏房间
type QZNNRoom struct {
	ID                   string
	State                RoomState
	StateLeftSec         int
	StateLeftSecDuration time.Duration `json:"-"`
	BankerID             string
	Players              []*Player
	Config               LobbyConfig    // 房间配置
	StateMu              sync.RWMutex   `json:"-"` // 保护 State, Timer
	StateLeftSecTicker   *time.Ticker   `json:"-"` // 倒计时定时器
	Mu                   sync.Mutex     `json:"-"` // 保护房间数据并发安全
	PlayerMu             sync.RWMutex   `json:"-"` // 保护 Players
	Deck                 []int          `json:"-"` // 牌堆
	TargetResults        map[string]int `json:"-"` // 记录每个玩家本局被分配的目标分数 (牛几)
	TotalBet             int64          `json:"-"` // 本局总下注额，用于更新库存
	driverGo             chan struct{}  `json:"-"`
	CreateAt             time.Time
	OnBotAction          func(room *QZNNRoom) `json:"-"`
}

func (r *QZNNRoom) ResetGameData() {
	r.State = ""
	r.StateLeftSec = 0
	r.StateLeftSecDuration = 0
	r.BankerID = ""
	r.Deck = []int{}
	r.TargetResults = make(map[string]int, 5)
	r.TotalBet = 0
	if r.StateLeftSecTicker != nil {
		r.StateLeftSecTicker.Stop()
		r.StateLeftSecTicker = nil
	}
	for _, p := range r.Players {
		if p != nil {
			p.ResetGameData()
		}
	}
}

func (r *QZNNRoom) SetBankerId(bankerId string) bool {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.BankerID == bankerId {
		return true
	}
	if r.BankerID == "" {
		r.BankerID = bankerId
		return true
	}
	return false
}

func (r *QZNNRoom) DecreaseStateLeftSec(d time.Duration) {
	r.StateMu.Lock()
	defer r.StateMu.Unlock()
	r.StateLeftSecDuration -= d
	if r.StateLeftSecDuration <= 0 {
		r.StateLeftSecDuration = 0
	}
	r.StateLeftSec = int(r.StateLeftSecDuration / time.Second)
}

func (r *QZNNRoom) GetClientRoom(secret bool) *QZNNRoom {
	n := &QZNNRoom{
		ID:           r.ID,
		State:        r.State,
		StateLeftSec: r.StateLeftSec,
		BankerID:     r.BankerID,
	}
	preCard := PlayerCardMax
	r.StateMu.RLock()
	switch r.State {
	//只有这3个状态，推牌数据，需要处理预看牌
	case StatePreCard, StateBanking, StateBetting:
		preCard = r.Config.GetPreCard()
	}
	r.StateMu.RUnlock()

	pushPlayers := r.GetBroadCasePlayers(nil)
	for _, p := range pushPlayers {
		n.Players = append(n.Players, p.GetClientPlayer(preCard, secret))
	}
	return n
}
