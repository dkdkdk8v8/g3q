package qznn

import (
	"compoment/ws"
	"sync/atomic"
	"time"

	"github.com/sasha-s/go-deadlock"
	"github.com/sirupsen/logrus"
)

type RoomState string

const (
	StateWaiting       RoomState = "StateWaiting"       //房间等待中
	StatePrepare       RoomState = "StatePrepare"       //房间倒计时中，马上开始
	StateStartGame     RoomState = "StateStartGame"     //游戏开始
	StatePreCard       RoomState = "StatePreCard"       //预先发牌
	StateBanking       RoomState = "StateBanking"       //抢庄中
	StateRandomBank    RoomState = "StateRandomBank"    //随机抢庄
	StateBankerConfirm RoomState = "StateBankerConfirm" //庄家确认
	StateBetting       RoomState = "StateBetting"       //非庄家下注
	StateDealing       RoomState = "StateDealing"       //发牌或补牌
	StateShowCard      RoomState = "StateShowCard"      //展示牌
	StateSettling      RoomState = "StateSettling"      //结算中
)

const (
	SecStatePrepareSec        = 6
	SecStatePrepareSecPlayer5 = 3 //结算中，开始倒计时发牌（5人不离开，直接下一场）
	SecStatePrepareSecPlayer4 = 4 //结算中，开始倒计时发牌（4人不离开，直接下一场）
	SecStatePrepareSecPlayer3 = 5 //结算中，开始倒计时发牌（3人不离开，直接下一场）
	SecStateGameStart         = 2
	SecStatePrecard           = 2
	SecStateCallBanking       = 8
	SecStateBankingRandom     = 2
	SecStateConfirmBanking    = 2
	SecStateBeting            = 8
	SecStateDealing           = 2
	SecStateShowCard          = 8
	SecStateSetting           = 4
)

// CardResult 牌型计算结果
type CardResult struct {
	Niu     int64 // 0-10, 10为牛牛
	Mult    int64 // 牌型倍数
	MaxCard int   // 最大单牌，用于同牌型比大小
}

// PlayerData 包含玩家的游戏数据，分离出来以方便拷贝且避免拷贝锁
type PlayerData struct {
	ID            string
	NickName      string
	Avatar        string
	Balance       int64      // 玩家余额,单位分
	Cards         []int      // 手牌 (0-51)
	CallMult      int64      // 抢庄倍数
	BetMult       int64      // 下注倍数
	IsShow        bool       // 是否已亮牌
	SeatNum       int        // 座位号
	CardResult    CardResult `json:"-"`
	IsOb          bool       // 是否观众
	IsReady       bool       // 是否确认坐桌（准备参与游戏）
	BalanceChange int64      // 本局输赢(税后)
	Tax           int64      // 本局税收
	ValidBet      int64      //有效投注流水
	IsRobot       bool       `json:"-" DiyJson:"IsRobot"`
	GameCount     int        `json:"-"` // 游戏次数
}

// Player 代表房间内的一个玩家
type Player struct {
	PlayerData
	Mu       deadlock.RWMutex `json:"-"` // 保护 PlayerData
	ConnWrap *ws.WsConnWrap   `json:"-"` // WebSocket 连接
}

func NewPlayer() *Player {
	n := &Player{}
	n.ResetGameData()
	return n
}

func (p *Player) GetClientPlayer(preNum int, secret bool) *Player {
	p.Mu.RLock()
	defer p.Mu.RUnlock()
	// 1. 仅拷贝数据部分，避免拷贝 Mutex 导致的 go vet 警告
	// 2. 嵌入结构体的值拷贝依然能确保所有数据字段（如 NickName）被复制
	n := &Player{
		PlayerData: p.PlayerData,
	}

	n.Cards = make([]int, 0, PlayerCardMax) // 初始化切片

	if preNum > 0 {
		for _, c := range p.Cards {
			n.Cards = append(n.Cards, c)
			if len(n.Cards) >= preNum {
				break
			}
		}
	} else if preNum == 0 {
		n.Cards = nil
	} else {
		logrus.WithField("preNum", preNum).Error("GetClientPlayer-InvalidPreNum")
	}
	if secret {
		for i := range n.Cards {
			n.Cards[i] = -1
		}
	}

	return n
}

func (p *Player) ResetGameData() {
	p.Mu.Lock()
	defer p.Mu.Unlock()
	p.Cards = make([]int, 0, PlayerCardMax)
	p.CallMult = -1
	p.BetMult = -1
	p.IsShow = false
	p.CardResult = CardResult{}
	p.BalanceChange = 0
	p.Tax = 0
	p.IsOb = !p.IsReady // 根据IsReady决定OB状态
	p.ValidBet = 0
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

// QZNNRoomData 包含房间的游戏数据，分离出来以方便拷贝且避免拷贝锁
type QZNNRoomData struct {
	ID                   string
	GameID               string //对局id
	State                RoomState
	StateLeftSec         int
	BankerID             string
	Players              []*Player
	Config               LobbyConfig // 房间配置
	CreateAt             time.Time
	LastRealPlayerJoinAt time.Time // 最后一个真人加入的时间
}

// 扩展 QZNNRoom 结构体以包含策略数据
// 注意：在实际 Go 项目中，这应该在结构体定义处修改。
// 如果没有，你需要修改 NewRoom 函数上方的结构体定义：
// Room 代表一个游戏房间
type QZNNRoom struct {
	QZNNRoomData
	StateDeadline time.Time            `json:"-"`
	RoomMu        deadlock.RWMutex     `json:"-"` // 保护房间数据并发安全
	Deck          []int                `json:"-"` // 牌堆
	TargetResults map[string]int       `json:"-"` // 记录每个玩家本局被分配的目标分数 (牛几)
	TotalBet      int64                `json:"-"` // 本局总下注额，用于更新库存
	driverGo      chan struct{}        `json:"-"`
	OnBotAction   func(room *QZNNRoom) `json:"-"`
	AllIsRobot    bool                 `json:"-"` // 是否全是机器人
	Strategy      *RoomStrategy        // 新增字段

	// --- 热更新快照支持 ---
	inGame          atomic.Bool    `json:"-"` // startGame/gameLoop 协程是否在运行
	strategyApplied bool           `json:"-"` // 本局策略换牌是否已执行
	snapshotReq     chan struct{}  `json:"-"` // 协调器发送快照请求 (buffered 1)
	snapshotReadyCh chan struct{}  `json:"-"` // 房间信号: 已到安全点 (buffered 1)
	snapshotRelCh   chan struct{}  `json:"-"` // 协调器信号: 快照完成可继续
}

// IsInGame returns true if a startGame/gameLoop goroutine is running.
func (r *QZNNRoom) IsInGame() bool {
	return r.inGame.Load()
}

// RequestSnapshot signals the room to pause at the next safe checkpoint.
// release will be closed by the coordinator when the snapshot is done.
func (r *QZNNRoom) RequestSnapshot(release chan struct{}) {
	r.snapshotRelCh = release
	select {
	case r.snapshotReq <- struct{}{}:
	default:
	}
}

// SnapshotReady returns the channel that signals the room is at a safe point.
func (r *QZNNRoom) SnapshotReady() <-chan struct{} {
	return r.snapshotReadyCh
}

// snapshotCheckpoint is called at safe points inside gameLoop.
// If a snapshot has been requested, it signals ready and blocks until released.
func (r *QZNNRoom) snapshotCheckpoint() {
	select {
	case <-r.snapshotReq:
		// Snapshot requested — signal we're at a safe point, then wait.
		select {
		case r.snapshotReadyCh <- struct{}{}:
		default:
		}
		// Block until coordinator finishes the snapshot.
		<-r.snapshotRelCh
	default:
		// No snapshot requested, continue.
	}
}

func (r *QZNNRoom) ResetGameData() {
	r.State = "" //不能给wait，不然set wait，导致不能广播
	r.StateLeftSec = 0
	r.StateDeadline = time.Time{}
	r.BankerID = ""
	r.Deck = []int{}
	r.TargetResults = make(map[string]int, 5)
	r.TotalBet = 0
	for _, p := range r.Players {
		if p != nil {
			p.ResetGameData()
		}
	}
}

func (r *QZNNRoom) resetOb() {
	for _, p := range r.Players {
		if p != nil {
			p.Mu.Lock()
			if p.IsReady {
				p.IsOb = false
			}
			// 未 ready 的玩家保持 OB
			p.Mu.Unlock()
		}
	}
}

func (r *QZNNRoom) SetBankerId(bankerId string) bool {
	r.RoomMu.Lock()
	defer r.RoomMu.Unlock()
	if r.BankerID == bankerId {
		return true
	}
	if r.BankerID == "" {
		r.BankerID = bankerId
		return true
	}
	return false
}

func (r *QZNNRoom) UpdateStateLeftSec() {
	r.RoomMu.Lock()
	defer r.RoomMu.Unlock()
	if r.StateDeadline.IsZero() {
		return
	}
	tDeadline := time.Until(r.StateDeadline)
	if tDeadline <= 0 {
		r.StateLeftSec = 0
		r.StateDeadline = time.Time{}
		return
	}
	// 向上取整，避免 0.9s 变成 0s 导致提前结束
	r.StateLeftSec = int((tDeadline + time.Second - 1) / time.Second)
}

func (r *QZNNRoom) GetClientRoom(pushId string) *QZNNRoom {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	return r.getClientRoom(pushId)
}

func (r *QZNNRoom) getClientRoom(pushId string) *QZNNRoom {
	n := &QZNNRoom{
		QZNNRoomData: r.QZNNRoomData,
	}
	n.Players = make([]*Player, 0, 5) // 清空 Players，重新生成，避免指向原切片
	preCard := PlayerCardMax
	bSecret := true
	switch n.State {
	//只有这4个状态，推牌数据，需要处理预看牌
	case StateStartGame, StatePreCard, StateBanking, StateRandomBank, StateBankerConfirm, StateBetting:
		preCard = r.Config.GetPreCard()
	}
	switch n.State {
	//推牌数据，默认秘密
	case StateSettling:
		bSecret = false
	}
	pushPlayers := r.getBroadCasePlayers(nil)
	for _, p := range pushPlayers {
		// 必须在 p.Mu 锁内读取 IsShow，避免与 HandleShowCards 的写入产生数据竞争，
		// 否则可能导致客户端收到 IsShow=true 但 Cards=[-1,...] 的矛盾数据（白牌）
		p.Mu.RLock()
		isShow := p.IsShow
		p.Mu.RUnlock()
		n.Players = append(n.Players, p.GetClientPlayer(preCard, bSecret && !isShow && p.ID != pushId))
	}
	return n
}
