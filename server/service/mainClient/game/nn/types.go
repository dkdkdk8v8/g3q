package nn

import (
	"compoment/ws"
	"service/comm"
	"sync"
	"time"
)

// CardResult 牌型计算结果
type CardResult struct {
	Niu     int `json:"niu"`      // 0-10, 10为牛牛
	Mult    int `json:"mult"`     // 牌型倍数
	MaxCard int `json:"max_card"` // 最大单牌，用于同牌型比大小
}

// Player 代表房间内的一个玩家
type Player struct {
	ID       string
	Conn     *ws.WSConn
	Cards    []int // 手牌 (0-51)
	CallMult int   // 抢庄倍数
	BetMult  int   // 下注倍数
	IsShow   bool  // 是否已亮牌
	IsRobot  bool  // 是否机器人
	SeatNum  int   // 座位号
	//BetArea  int   // 下注区域（百人牛牛专用）
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
	ID      string
	Type    string
	Players []*Player

	State   int             // 当前游戏状态
	Timer   *time.Timer     // 状态切换定时器
	Mu      sync.Mutex      // 保护房间数据并发安全
	OnStart func(*QZNNRoom) // 游戏开始回调

	BankerID string
	Deck     []int

	// 控制相关字段
	TargetResults map[string]int // 记录每个玩家本局被分配的目标分数 (牛几)
	TotalBet      int64          // 本局总下注额，用于更新库存

	// 百人牛牛特有字段
	// BRNNBets map[int]map[string]int64 // 区域ID(0-3) -> 玩家ID -> 下注金额
	Config LobbyConfig // 房间配置
}

func NewRoom(id string, gameType string, max int) *QZNNRoom {
	return &QZNNRoom{
		ID:      id,
		Type:    gameType,
		Players: make([]*Player, max),
		State:   StateWaiting,
	}
}
func (r *QZNNRoom) GetPlayerCap() int {
	return cap(r.Players)
}
func (r *QZNNRoom) GetPlayerByID(userID string) (*Player, bool) {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	for _, p := range r.Players {
		if p != nil && p.ID == userID {
			return p, true
		}
	}
	return nil, false
}

func (r *QZNNRoom) AddPlayer(p *Player) (int, error) {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.State != StateWaiting {
		return 0, comm.NewMyError(500003, "游戏进行中，无法加入")
	}
	countExistPlayerNum := 0
	for _, existingPlayer := range r.Players {
		if existingPlayer != nil {
			countExistPlayerNum++
		}
	}
	if countExistPlayerNum >= cap(r.Players) {
		return 0, comm.NewMyError(500001, "房间已满")
	}

	for seatNum, existingPlayer := range r.Players {
		if existingPlayer != nil {
			if existingPlayer.ID == p.ID {
				//return 0, comm.NewMyError(500004, "玩家已在房间内")
				// 玩家已在房间内，直接返回当前位置
				return seatNum, nil
			}
		} else {
			r.Players[seatNum] = p
			return seatNum, nil
		}
	}

	countExistPlayerNum = 0
	for _, existingPlayer := range r.Players {
		if existingPlayer != nil {
			countExistPlayerNum++
		}
	}
	// 满足人数且处于等待状态时，触发游戏开始回调
	if countExistPlayerNum >= cap(r.Players) && r.OnStart != nil && r.State == StateWaiting {
		go r.OnStart(r)
	}

	return len(r.Players), nil
}

func (r *QZNNRoom) Broadcast(msg interface{}) {
	for _, p := range r.Players {
		if p.Conn != nil {
			_ = p.Conn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) BroadcastExclude(msg interface{}, excludeId string) {
	for _, p := range r.Players {
		if p.ID == excludeId {
			continue
		}
		if p.Conn != nil {
			_ = p.Conn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) StopTimer() {
	if r.Timer != nil {
		r.Timer.Stop()
		r.Timer = nil
	}
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

func (r *QZNNRoom) IsPlaying() bool {
	return r.State != StateWaiting
}
