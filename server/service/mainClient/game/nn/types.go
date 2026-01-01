package nn

import (
	"compoment/ws"
	"sync"
	"time"
)

// CardResult 牌型计算结果
type CardResult struct {
	Niu     int `json:"niu"`      // 0-10, 10为牛牛
	Mult    int `json:"mult"`     // 牌型倍数
	MaxCard int `json:"max_card"` // 最大单牌，用于同牌型比大小
}

type Player2Client struct {
	Cards    []int `json:"cards"`     // 手牌 (0-51)
	CallMult int   `json:"call_mult"` // 抢庄倍数
	BetMult  int   `json:"bet_mult"`  // 下注倍数
	IsShow   bool  `json:"is_show"`   // 是否已亮牌
	IsRobot  bool  `json:"is_robot"`  // 是否机器人
	SeatNum  int   `json:"seat_num"`  // 座位号
	IsReady  bool  `json:"is_ready"`  // 是否已准备
	//BetArea  int    `json:"bet_area"`  // 下注区域（百人牛牛专用）
}

// Player 代表房间内的一个玩家
type Player struct {
	ID      string
	Conn    *ws.WSConn `json:"-"` // WebSocket 连接
	IsRobot bool       `json:"-"`
	Player2Client
}

func (p *Player) SecretForOther(selfId string) Player2Client {
	if p.ID == selfId {
		return p.Player2Client
	} else {
		var pcopy Player2Client = p.Player2Client
		pcopy.Cards = []int{}
		return pcopy
	}
}

// LobbyConfig 大厅配置
type LobbyConfig struct {
	Level      int    `json:"level"`       // 房间等级ID
	Name       string `json:"name"`        // 房间名称
	MinBalance int64  `json:"min_balance"` // 最低入场金额
	BaseBet    int64  `json:"base_bet"`    // 底注
	BankerType int    `json:"-"`           // 抢庄类型
}

// Room 代表一个游戏房间
type QZNNRoom struct {
	ID           string
	Type         string
	Players      []*Player
	State        int    // 当前游戏状态
	StateLeftSec int    // 当前状态剩余秒数
	BankerID     string // 庄ID

	StateMu       sync.RWMutex    `json:"-"` // 保护 State, Timer
	Timer         *time.Timer     `json:"-"` // 状态切换定时器
	Ticker        *time.Ticker    `json:"-"` // 倒计时定时器
	Mu            sync.Mutex      `json:"-"` // 保护房间数据并发安全
	PlayerMu      sync.RWMutex    `json:"-"` // 保护 Players
	OnStart       func(*QZNNRoom) `json:"-"` // 游戏开始回调
	Deck          []int           `json:"-"` // 牌堆
	TargetResults map[string]int  `json:"-"` // 记录每个玩家本局被分配的目标分数 (牛几)
	TotalBet      int64           `json:"-"` // 本局总下注额，用于更新库存
	Config        LobbyConfig     `json:"-"` // 房间配置
}

func (r *QZNNRoom) GetPlayerCount() int {
	// Players 是定长切片，需要统计非 nil 的数量
	currentCount := 0
	for _, p := range r.Players {
		if p != nil {
			currentCount++
		}
	}
	return currentCount
}

func (r *QZNNRoom) IsWaiting() bool {
	return r.State == StateWaiting
}
