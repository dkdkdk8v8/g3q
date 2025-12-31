package game

import (
	"compoment/ws"
	"service/comm"
	"sync"
	"time"
)

// 基础状态
const (
	StateWaiting = 0
	StateBetting = 1
	StateSettle  = 2
)

// RobotExitRate 机器人退出概率，由 mainClient 初始化
var RobotExitRate = 30

// Player 代表房间内的一个玩家
type Player struct {
	ID       string
	Conn     *ws.WSConn
	Cards    []int // 手牌 (0-51)
	CallMult int   // 抢庄倍数
	BetMult  int   // 下注倍数
	IsShow   bool  // 是否已亮牌
	IsRobot  bool  // 是否机器人
}

// Room 代表一个游戏房间
type Room struct {
	ID         string
	Type       string
	Players    map[string]*Player
	MaxPlayers int

	State   int         // 当前游戏状态
	Timer   *time.Timer // 状态切换定时器
	Mu      sync.Mutex  // 保护房间数据并发安全
	OnStart func(*Room) // 游戏开始回调

	BankerID string
	Deck     []int

	// 控制相关字段
	TargetResults map[string]int // 记录每个玩家本局被分配的目标分数 (牛几)
	TotalBet      int64          // 本局总下注额，用于更新库存

	// 百人牛牛特有字段
	BRNNBets map[int]map[string]int64 // 区域ID(0-3) -> 玩家ID -> 下注金额
}

// CardResult 牌型计算结果
type CardResult struct {
	Niu     int `json:"niu"`      // 0-10, 10为牛牛
	Mult    int `json:"mult"`     // 牌型倍数
	MaxCard int `json:"max_card"` // 最大单牌，用于同牌型比大小
}

func NewRoom(id string, gameType string, max int) *Room {
	return &Room{
		ID:         id,
		Type:       gameType,
		Players:    make(map[string]*Player),
		MaxPlayers: max,
		State:      StateWaiting,
		BRNNBets:   make(map[int]map[string]int64),
	}
}

func (r *Room) AddPlayer(p *Player) (int, error) {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	if len(r.Players) >= r.MaxPlayers && r.MaxPlayers > 0 {
		return 0, comm.NewMyError(500001, "房间已满")
	}

	r.Players[p.ID] = p

	// 满足人数且处于等待状态时，触发游戏开始回调
	if len(r.Players) == r.MaxPlayers && r.OnStart != nil && r.State == StateWaiting {
		go r.OnStart(r)
	}

	return len(r.Players), nil
}

func (r *Room) Broadcast(msg interface{}) {
	for _, p := range r.Players {
		if p.Conn != nil {
			_ = p.Conn.WriteJSON(msg)
		}
	}
}

func (r *Room) StopTimer() {
	if r.Timer != nil {
		r.Timer.Stop()
		r.Timer = nil
	}
}

// RemoveCardsFromDeck 从牌堆中移除指定的牌
func (r *Room) RemoveCardsFromDeck(cardsToRemove []int) {
	if len(cardsToRemove) == 0 {
		return
	}
	toRemove := make(map[int]bool)
	for _, c := range cardsToRemove {
		toRemove[c] = true
	}
	newDeck := make([]int, 0, len(r.Deck))
	for _, c := range r.Deck {
		if !toRemove[c] {
			newDeck = append(newDeck, c)
		}
	}
	r.Deck = newDeck
}
