package nn

import (
	"compoment/ws"
	"sync"
	"time"
)

const QZNN_Prefix = "QZNN."
const (
	StateWaiting               = QZNN_Prefix + "StateWaiting"               //房间等待中
	StatePrepare               = QZNN_Prefix + "StatePrepare"               //房间倒计时中，马上开始
	StatePreCard               = QZNN_Prefix + "StatePreCard"               //预先发牌
	StateBanking               = QZNN_Prefix + "StateBanking"               //抢庄中
	StateRandomBank            = QZNN_Prefix + "StateRandomBank"            //随机抢庄
	StateBankerConfirm         = QZNN_Prefix + "StateBankerConfirm"         //庄家确认
	StateBetting               = QZNN_Prefix + "StateBetting"               //非庄家下注
	StateDealing               = QZNN_Prefix + "StateDealing"               //发牌或补牌
	StateShowCard              = QZNN_Prefix + "StateShowCard"              //展示牌
	StateSettling              = QZNN_Prefix + "StateSettling"              //结算中
	StateSettlingDirectPreCard = QZNN_Prefix + "StateSettlingDirectPreCard" //结算中，开始倒计时发牌（5人不离开，直接下一场）
)

const (
	CmdUserInfo       = QZNN_Prefix + "UserInfo"
	CmdLobbyConfig    = QZNN_Prefix + "LobbyConfig"
	CmdPlayerJoin     = QZNN_Prefix + "PlayerJoin"
	CmdPlayerLeave    = QZNN_Prefix + "PlayerLeave"
	//CmdPlayerReady    = QZNN_Prefix + "PlayerReady"
	CmdPlayerCallBank = QZNN_Prefix + "PlayerCallBank"
	CmdPlayerPlaceBet = QZNN_Prefix + "PlayerPlaceBet"
	CmdPlayerShowCard = QZNN_Prefix + "PlayerShowCard"
	CmdBalanceChange  = QZNN_Prefix + "BalanceChange"
)

const (
	StateWaiting2StartSec = 6
	StateCallingSec       = 10
	StateBettingSec       = 10
	StateDealingSec       = 5
)

// CardResult 牌型计算结果
type CardResult struct {
	Niu     int64 `json:"niu"`      // 0-10, 10为牛牛
	Mult    int64 `json:"mult"`     // 牌型倍数
	MaxCard int   `json:"max_card"` // 最大单牌，用于同牌型比大小
}

// Player 代表房间内的一个玩家
type Player struct {
	ID            string
	NickName      string
	Balance       int64      // 玩家余额,单位分
	Cards         []int      // 手牌 (0-51)
	CallMult      int64      // 抢庄倍数
	BetMult       int64      // 下注倍数
	IsShow        bool       // 是否已亮牌
	SeatNum       int        // 座位号
	//IsReady       bool       // 是否已准备
	IsOb          bool       // 是否观众
	BalanceChange int64      // 本局输赢
	IsRobot       bool       `json:"-"`
	Mu            sync.Mutex `json:"-"`
	Conn          *ws.WSConn `json:"-"` // WebSocket 连接
}

func (p *Player) GetClientPlayer(cardNum int, secret bool) *Player {
	n := &Player{
		ID:       p.ID,
		Balance:  p.Balance,
		CallMult: p.CallMult,
		BetMult:  p.BetMult,
		IsShow:   p.IsShow,
		SeatNum:  p.SeatNum,
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
		return 5
	}
}

// Room 代表一个游戏房间
type QZNNRoom struct {
	ID            string
	State         string
	StateLeftSec  int
	BankerID      string
	Players       []*Player
	Config        LobbyConfig    // 房间配置
	StateMu       sync.RWMutex   `json:"-"` // 保护 State, Timer
	Ticker        *time.Ticker   `json:"-"` // 倒计时定时器
	Mu            sync.Mutex     `json:"-"` // 保护房间数据并发安全
	PlayerMu      sync.RWMutex   `json:"-"` // 保护 Players
	Deck          []int          `json:"-"` // 牌堆
	TargetResults map[string]int `json:"-"` // 记录每个玩家本局被分配的目标分数 (牛几)
	TotalBet      int64          `json:"-"` // 本局总下注额，用于更新库存
	driverGo      chan struct{}  `json:"-"`
	CreateAt      time.Time
	OnBotAction   func(room *QZNNRoom) `json:"-"`
}

func (r *QZNNRoom) reset() {
	r.State = ""
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
