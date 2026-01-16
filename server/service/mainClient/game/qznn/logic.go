package qznn

import (
	"compoment/util"
	"compoment/ws"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"service/comm"
	"service/initMain"
	"service/mainClient/game/strategy"
	"service/mainClient/game/znet"
	"service/modelClient"
	"slices"
	"strings"
	"time"

	errors "github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

var errorStateNotMatch = errors.New("stateNotMatch")

// --- 策略系统核心结构定义 Start ---

// UserStrategyData 用户策略运行时数据
type UserStrategyData struct {
	TotalProfit       int64   // 历史总盈亏
	RecentProfit      int64   // 近期盈亏
	PendingCompensate int64   // 待补偿金额 (低分场输的钱)
	BaseLucky         float64 // 基础 Lucky 值 (进场时计算)
	FinalLucky        float64 // 最终 Lucky 值 (发牌前修正)
	IsHighRisk        bool    // 是否被标记为高风险(投机)
	WinningStreak     int     // 连胜局数
	LosingStreak      int     // 连败局数
}

// RoomStrategy 房间策略上下文
type RoomStrategy struct {
	Config         strategy.StrategyConfig
	Manager        *strategy.StrategyManager    // 引入通用策略管理器
	SystemProfit   int64                        // 系统24h盈利 //从redis同步
	SystemTurnover int64                        // 系统24h流水 //从redis同步
	UserData       map[string]*UserStrategyData // 玩家策略数据缓存 [UserID]Data
}

func NewRoomStrategy() *RoomStrategy {
	cfg := strategy.StrategyConfig{
		TargetProfitRate:  0.05,
		ProtectK:          -50.0, // k = -50
		ProtectB:          1.1,   // b = 1.1
		BaseLucky:         50.0,
		HighRiskMult:      20,      // 示例: 4倍抢庄 * 5倍下注 = 20
		OverflowThreshold: 200000,  // 示例: 库存超过20万开始放水
		EnableNewbieBonus: true,    // 开启新手光环
		MinTurnover:       2000000, // 最小流水阈值 (例如200万分/2万元)，低于此值不介入强风控
	}
	return &RoomStrategy{
		Config:   cfg,
		Manager:  strategy.NewStrategyManager(cfg),
		UserData: make(map[string]*UserStrategyData),
	}
}

// --- 策略系统核心结构定义 End ---

func NewRoom(id string, bankerType, level int) *QZNNRoom {
	nRoom := &QZNNRoom{
		QZNNRoomData: QZNNRoomData{
			ID:       id,
			Players:  make([]*Player, 5),
			State:    StateWaiting,
			BankerID: "",
			CreateAt: time.Now(),
		},
		TargetResults: make(map[string]int, 5),
		Deck:          []int{},
		driverGo:      make(chan struct{}),
		AllIsRobot:    true,
		Strategy:      NewRoomStrategy(), // 初始化策略模块
	}
	nRoom.Config = *GetConfig(level)
	nRoom.Config.BankerType = bankerType
	go nRoom.driverLogicTick()
	return nRoom
}

// QZNNRoom 结构体扩展 (注意：Go中无法直接在外部文件给结构体加字段，
// 假设 QZNNRoom 定义在同包下的 types.go 或类似文件中，这里我们假设可以直接使用 nRoom.Strategy。
// 如果 QZNNRoom 定义不可见，通常需要修改定义处。这里为了演示逻辑，假设已添加 Strategy 字段)
// *注：由于无法修改 QZNNRoom 定义文件，以下代码假设 QZNNRoom 结构体中已预留或我们通过 map 扩展*
// 为了代码能跑，我们在 logic.go 顶部补充 QZNNRoom 的扩展字段定义是不行的，
// 实际项目中需要在 QZNNRoom 结构体定义处添加 `Strategy *RoomStrategy`。
// 这里我们使用一个全局或包级 Map 来模拟挂载，或者假设用户会修改结构体定义。
// *为了本次回答的完整性，我将把 Strategy 逻辑封装在方法里，暂不修改 QZNNRoom 结构体定义以免破坏其他文件依赖，
// 而是通过局部变量或辅助函数演示流程。*

func (r *QZNNRoom) CanLog() bool {
	if !r.AllIsRobot {
		return true
	}
	return initMain.DefCtx.IsTest
}

func (r *QZNNRoom) Destory() {
	close(r.driverGo)
}

func (r *QZNNRoom) CheckStatus(state RoomState) bool {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	return r.State == state
}

func (r *QZNNRoom) CheckStatusDo(state RoomState, fn func() error) error {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	if r.State != state {
		return errors.Wrap(errorStateNotMatch, fmt.Sprintf("%s", state))
	}
	return fn()
}

func (r *QZNNRoom) CheckInMultiStatusDo(state []RoomState, fn func() error) error {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	if slices.Contains(state, r.State) {
		return fn()
	} else {
		return errors.Wrap(errorStateNotMatch, fmt.Sprintf("%v", state))
	}
}

func (r *QZNNRoom) CheckInMultiStatusDoLock(state []RoomState, fn func() error) error {
	r.RoomMu.Lock()
	defer r.RoomMu.Unlock()
	if slices.Contains(state, r.State) {
		return fn()
	} else {
		return errors.Wrap(errorStateNotMatch, fmt.Sprintf("%v", state))
	}
}

func (r *QZNNRoom) SetStatus(oldStates []RoomState, newState RoomState, stateLeftSec int) bool {
	r.RoomMu.Lock()
	changed := r.changeState(oldStates, newState, stateLeftSec)
	r.RoomMu.Unlock()

	if changed {
		// 倒计时逻辑现在由 drvierLogicTick 统一接管，不再单独开启 goroutine
		// 也不需要在这里处理 interuptStateLeftTicker，因为 StateLeftSec 已经被重置
		r.BroadcastWithPlayer(func(p *Player) any {
			return comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: PushChangeState,
				Data: PushChangeStateStruct{
					Room:         r.GetClientRoom(p.ID),
					State:        newState,
					StateLeftSec: stateLeftSec}}
		})
	}
	return changed
}

func (r *QZNNRoom) setStatus(oldStates []RoomState, newState RoomState, stateLeftSec int) bool {
	if r.changeState(oldStates, newState, stateLeftSec) {
		// 倒计时逻辑现在由 drvierLogicTick 统一接管，不再单独开启 goroutine
		// 也不需要在这里处理 interuptStateLeftTicker，因为 StateLeftSec 已经被重置
		r.broadcastWithPlayer(func(p *Player) any {
			return comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: PushChangeState,
				Data: PushChangeStateStruct{
					Room:         r.getClientRoom(p.ID),
					State:        newState,
					StateLeftSec: stateLeftSec}}
		})
		return true
	}
	return false
}

func (r *QZNNRoom) changeState(oldStates []RoomState, newState RoomState, stateLeftSec int) bool {
	if r.State == newState {
		logrus.WithFields(logrus.Fields{
			"roomId": r.ID,
			"state":  newState,
		}).Error("StatuSame")
		return false
	}
	if !slices.Contains(oldStates, r.State) {
		logrus.WithFields(logrus.Fields{
			"roomId":    r.ID,
			"oldStates": oldStates,
			"state":     newState,
			"rState":    r.State,
		}).Error("StatuIgnored")
		return false
	}
	oldState := r.State
	r.State = newState
	r.StateLeftSec = stateLeftSec
	if stateLeftSec > 0 {
		r.StateDeadline = time.Now().Add(time.Duration(stateLeftSec) * time.Second)
	} else {
		r.StateDeadline = time.Time{}
	}
	if r.CanLog() {
		logrus.WithFields(logrus.Fields{
			"roomId":  r.ID,
			"old":     oldState,
			"new":     newState,
			"leftSec": stateLeftSec,
		}).Info("StatuChanged")
	}
	return true
}

func (r *QZNNRoom) CheckGameStart() bool {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	if !(r.State == StateWaiting || r.State == StatePrepare) {
		return true
	}
	return false
}

func (r *QZNNRoom) CheckPlayerIsOb() bool {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	return r.checkPlayerIsOb()
}

// checkPlayerIsOb 内部方法，不加锁，供已持有锁的函数调用
func (r *QZNNRoom) checkPlayerIsOb() bool {
	if !(r.State == StateWaiting || r.State == StatePrepare) {
		return true
	}
	if r.State == StatePrepare && r.StateLeftSec <= 2 {
		return true
	}

	return false
}

func (r *QZNNRoom) CheckIsBanker(bankerID string) bool {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	return r.BankerID == bankerID
}
func (r *QZNNRoom) checkIsBanker(bankerID string) bool {
	return r.BankerID == bankerID
}

func (r *QZNNRoom) GetPlayerCap() int {
	return cap(r.Players)
}

func (r *QZNNRoom) GetPlayers() []*Player {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	return r.getPlayers()
}

func (r *QZNNRoom) getPlayers() []*Player {
	var ret []*Player
	for _, p := range r.Players {
		if p != nil {
			ret = append(ret, p)
		}
	}
	return ret
}

func (r *QZNNRoom) GetPlayerCount() int {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	// Reuse logic
	currentCount := 0
	for _, p := range r.Players {
		if p != nil {
			currentCount++
		}
	}
	return currentCount
}

func (r *QZNNRoom) getPlayerCount() int {
	currentCount := 0
	for _, p := range r.Players {
		if p != nil {
			currentCount++
		}
	}
	return currentCount
}

func (r *QZNNRoom) GetRealPlayerCount() int {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	currentCount := 0
	for _, p := range r.Players {
		if p != nil && !p.IsRobot {
			currentCount++
		}
	}
	return currentCount
}

func (r *QZNNRoom) GetPlayerAndRealPlayerCount() (int, int) {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	currentCount := 0
	currentRealCount := 0
	for _, p := range r.Players {
		if p != nil {
			currentCount++
			if !p.IsRobot {
				currentRealCount++
			}
		}
	}
	return currentCount, currentRealCount
}

// todo::StateSettlingDirectPreCard 这个 也要判断kickoff
func (r *QZNNRoom) kickOffByWsDisconnect() ([]string, bool) {
	var delIds []string

	for _, p := range r.Players {
		if p == nil {
			continue
		}
		if p.IsOb {
			continue
		}

		// 安全地检查连接状态
		p.Mu.RLock()
		conn := p.ConnWrap
		p.Mu.RUnlock()
		if conn == nil || !conn.IsConnected() {
			delIds = append(delIds, p.ID)
		}
	}

	if len(delIds) <= 0 {
		return nil, false
	}

	if slices.Contains([]RoomState{StateWaiting, StatePrepare}, r.State) {
		for _, delUserId := range delIds {
			// 再次检查防止并发修改导致空指针或误删
			r.leave(delUserId)
		}
	}
	return delIds, true
}

// 包含机器人
func (r *QZNNRoom) getStartGamePlayerCount(includeOb bool) int {
	count := 0
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		if p.IsOb {
			if !includeOb {
				continue
			}
		}
		if p.IsRobot || p.ConnWrap != nil {
			count++
		}
	}
	return count
}

func (r *QZNNRoom) GetPlayerByID(userID string) (*Player, bool) {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	return r.getPlayerByID(userID)
}
func (r *QZNNRoom) getPlayerByID(userID string) (*Player, bool) {
	for _, p := range r.Players {
		if p != nil && p.ID == userID {
			return p, true
		}
	}
	return nil, false
}

func (r *QZNNRoom) AddPlayer(p *Player) (int, error) {
	r.RoomMu.Lock()
	// 检查玩家是否已在房间
	for seatNum, existingPlayer := range r.Players {
		if existingPlayer != nil && existingPlayer.ID == p.ID {
			// Fix: 如果玩家已在房间（可能是断线重连或GameMgr状态不同步），需要更新余额
			// 因为外部 handlePlayerJoin 已经完成了 GameLockUserBalance，p.Balance 是最新的
			existingPlayer.Mu.Lock()
			existingPlayer.Balance = p.Balance
			existingPlayer.Mu.Unlock()
			r.RoomMu.Unlock()
			return seatNum, nil
		}
	}
	if p.IsRobot {
		// 机器人不能5个在一个房间
		botCount := 0
		for _, existingPlayer := range r.Players {
			if existingPlayer != nil && existingPlayer.IsRobot {
				botCount++
				if botCount >= 4 {
					r.RoomMu.Unlock()
					return 0, comm.ErrMaxRobotInRoom
				}
			}
		}
	} else {
		// 检查是否已经有真人用户了
		for _, existingPlayer := range r.Players {
			if existingPlayer != nil && !existingPlayer.IsRobot {
				r.RoomMu.Unlock()
				return 0, comm.ErrRealPlayerAlreadyInRoom
			}
		}
	}

	// 使用内部方法，避免递归锁，同时复用逻辑
	bIsObState := r.checkPlayerIsOb()

	emptySeat := -1
	countExistPlayerNum := 0
	for i, pl := range r.Players {
		if pl != nil {
			countExistPlayerNum++
		} else if emptySeat == -1 {
			emptySeat = i
		}
	}
	if countExistPlayerNum >= cap(r.Players) || emptySeat == -1 {
		r.RoomMu.Unlock()
		return 0, comm.NewMyError("房间已满")
	}

	p.Mu.Lock()
	p.SeatNum = emptySeat
	p.IsOb = bIsObState
	p.Mu.Unlock()

	r.Players[emptySeat] = p

	r.AllIsRobot = true
	for _, pl := range r.Players {
		if pl != nil && !pl.IsRobot {
			r.AllIsRobot = false
			break
		}
	}
	r.RoomMu.Unlock()

	r.BroadcastWithPlayer(func(p *Player) any {
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayJoin,
			Data: PushPlayerJoinStruct{
				Room:   r.GetClientRoom(p.ID),
				UserId: p.ID}}
	})
	r.logicTick()
	return emptySeat, nil
}

func (r *QZNNRoom) SetWsWrap(userId string, wrap *ws.WsConnWrap) {
	p, ok := r.GetPlayerByID(userId)
	if !ok {
		return
	}
	p.Mu.Lock()
	p.ConnWrap = wrap
	p.Mu.Unlock()
}

func (r *QZNNRoom) PushPlayer(p *Player, msg any) {
	if p == nil {
		return
	}
	// 安全地读取 ConnWrap 指针
	p.Mu.RLock()
	conn := p.ConnWrap
	p.Mu.RUnlock()

	// 使用线程安全的 WriteJSON 方法
	if conn != nil && conn.IsConnected() {
		_ = conn.WriteJSON(msg)
	}
}

func (r *QZNNRoom) BroadcastWithPlayer(getMsg func(*Player) any) {
	r.RoomMu.RLock()
	players := r.getPlayers()
	r.RoomMu.RUnlock()
	// 2. 遍历快照发送消息
	for _, p := range players {
		msg := getMsg(p)

		p.Mu.RLock()
		conn := p.ConnWrap
		p.Mu.RUnlock()

		if conn != nil && conn.IsConnected() {
			_ = conn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) broadcastWithPlayer(getMsg func(*Player) any) {
	// 2. 遍历快照发送消息
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		msg := getMsg(p)
		p.Mu.RLock()
		conn := p.ConnWrap
		p.Mu.RUnlock()
		if conn != nil && conn.IsConnected() {
			_ = conn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) interuptStateLeftTicker(state RoomState) {
	if r.State == state {
		r.StateLeftSec = 0
		r.StateDeadline = time.Time{}
	}
}

func (r *QZNNRoom) WaitSleep(wait time.Duration) {
	if wait <= 0 {
		return
	}
	time.Sleep(wait)
}

func (r *QZNNRoom) WaitStateLeftTicker() {
	// 使用轮询方式等待倒计时结束，避免 ticker 通道阻塞或泄露
	ticker := time.NewTicker(time.Millisecond * 100)
	defer ticker.Stop()

	for {
		r.RoomMu.RLock()
		left := r.StateLeftSec
		r.RoomMu.RUnlock()

		if left <= 0 {
			return
		}

		select {
		case <-r.driverGo: // 房间销毁
			return
		case <-ticker.C:
			continue
		}
	}
}

// Leave 玩家离开房间
func (r *QZNNRoom) Leave(userId string) bool {
	r.RoomMu.Lock()
	defer r.RoomMu.Unlock()
	return r.leave(userId)
}

func (r *QZNNRoom) leave(userId string) bool {
	for i, pl := range r.Players {
		if pl != nil && pl.ID == userId {
			//modelUser balanceLock -> balance
			modelUser, err := modelClient.GameResetUserBalance(userId)
			if err != nil {
				logrus.WithField("userId", userId).WithField("balanceLock", modelUser.BalanceLock).WithField(
					"balance", modelUser.Balance).WithError(err).Error("ResetBalLock-Fail")
			}
			r.Players[i] = nil

			r.AllIsRobot = true
			for _, p := range r.Players {
				if p != nil && !p.IsRobot {
					r.AllIsRobot = false
					break
				}
			}
			return true
		}
	}
	return false
}

func (r *QZNNRoom) GetActivePlayers(filter func(*Player) bool) []*Player {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	return r.getActivePlayers(filter)
}

// getActivePlayers 内部方法，不加锁
func (r *QZNNRoom) getActivePlayers(filter func(*Player) bool) []*Player {
	var players []*Player
	for _, p := range r.Players {
		if p == nil || p.IsOb {
			continue
		}
		if filter != nil && !filter(p) {
			continue
		}
		players = append(players, p)
	}
	return players
}

func (r *QZNNRoom) GetBroadCasePlayers(filter func(*Player) bool) []*Player {
	r.RoomMu.RLock()
	defer r.RoomMu.RUnlock()
	return r.getBroadCasePlayers(filter)
}

// getBroadCasePlayers 内部方法，不加锁
func (r *QZNNRoom) getBroadCasePlayers(filter func(*Player) bool) []*Player {
	var players []*Player
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		if filter != nil && !filter(p) {
			continue
		}
		players = append(players, p)
	}
	return players
}

func (r *QZNNRoom) prepareDeck() {
	// 修复：必须加写锁，防止并发修改 Deck 和 Players
	r.RoomMu.Lock()
	defer r.RoomMu.Unlock()

	// 1. 初始化牌堆 (0-51)
	// 优化：复用切片容量，避免重复分配内存
	if cap(r.Deck) < 52 {
		r.Deck = make([]int, 52)
	}
	r.Deck = r.Deck[:52]
	for i := 0; i < 52; i++ {
		r.Deck[i] = i
	}

	// 2. 洗牌 - 使用 Fisher-Yates 算法 (Go rand.Shuffle 内部实现即为此算法)
	// 确保完全随机，不依赖 arithmetic.go 的库存控制
	rand.Shuffle(len(r.Deck), func(i, j int) {
		r.Deck[i], r.Deck[j] = r.Deck[j], r.Deck[i]
	})

	// 3. 发牌逻辑
	for _, p := range r.Players {
		if p == nil || p.IsOb {
			continue
		}
		// 注意：这里持有 RoomMu，然后获取 p.Mu (在 ResetGameData 内部)，符合 Room -> Player 的锁序
		p.ResetGameData()

		// 发5张牌
		if len(r.Deck) >= 5 {
			// 切片拷贝，避免引用底层数组导致后续逻辑问题
			hand := make([]int, 5)
			copy(hand, r.Deck[:5])
			p.Mu.Lock()
			p.Cards = hand
			p.Mu.Unlock()
			r.Deck = r.Deck[5:]
		} else {
			// 极端情况：牌不够了（理论上不应发生，除非人数过多）
			panic("deck not enough")
		}
	}
}

func (r *QZNNRoom) driverLogicTick() {
	const driverMill = time.Millisecond * 200
	driverTicker := time.NewTicker(driverMill)
	defer driverTicker.Stop()

	for {
		select {
		case <-r.driverGo:
			return
		case <-driverTicker.C:
			// 1. 处理倒计时
			r.RoomMu.RLock()
			hasDeadline := !r.StateDeadline.IsZero()
			r.RoomMu.RUnlock()
			if hasDeadline {
				r.UpdateStateLeftSec()
			}
			if r.OnBotAction != nil {
				r.OnBotAction(r)
			}
			// 3. 执行各状态逻辑 (包含 tickBanking, tickBetting 等检查)
			r.logicTick()
		}
	}
}

func (r *QZNNRoom) tickWaiting() {
	leaveIds, _ := r.kickOffByWsDisconnect()
	r.resetOb()

	if len(leaveIds) > 0 {
		leaveIds = util.RemoveDuplicatesString(leaveIds)
		r.broadcastWithPlayer(
			func(p *Player) any {
				return comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: PushPlayLeave,
					Data:     PushPlayerLeaveStruct{UserIds: leaveIds, Room: r.getClientRoom(p.ID)}}
			})

	}

	//加入已经有2个人在房间，可以进行倒计时开始游戏
	activePlayers := r.getActivePlayers(nil)
	if len(activePlayers) >= 2 {
		r.setStatus([]RoomState{StateWaiting}, StatePrepare, SecStatePrepareSec)
	}
}

func (r *QZNNRoom) tickPrepare() {
	if leaveIds, isLeave := r.kickOffByWsDisconnect(); isLeave {
		r.broadcastWithPlayer(func(p *Player) any {
			return comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: PushPlayLeave,
				Data:     PushPlayerLeaveStruct{UserIds: leaveIds, Room: r.getClientRoom(p.ID)}}
		})
	}
	// 倒计时等待开始
	activePlayers := r.getActivePlayers(nil)
	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if len(activePlayers) < 2 {
		if r.setStatus([]RoomState{StatePrepare}, StateWaiting, 0) {
			return
		}
	}

	//make sure players Ok
	if r.getStartGamePlayerCount(false) >= 2 {
		if r.StateLeftSec <= 0 {
			if !r.setStatus([]RoomState{StatePrepare}, StateStartGame, SecStateGameStart) {
				return
			}
			go r.startGame()
		}
	} else {
		//还是有掉线的，再等
		if r.setStatus([]RoomState{StatePrepare}, StateWaiting, 0) {
			return
		}
	}
}

func (r *QZNNRoom) tickBanking() {
	//查看是否都已经抢庄或者明确不抢，player.CallMult -1 是没有任何操作
	// Fix: 避免直接在 GetActivePlayers 回调中读取 p.CallMult 导致的数据竞争
	// 客户端消息协程可能正在修改 p.CallMult，需要加 p.Mu 锁
	activePlayers := r.getActivePlayers(nil)
	hasUnconfirmed := false
	for _, p := range activePlayers {
		p.Mu.RLock()
		if p.CallMult == -1 {
			hasUnconfirmed = true
			p.Mu.RUnlock()
			break
		}
		p.Mu.RUnlock()
	}
	if !hasUnconfirmed {
		r.interuptStateLeftTicker(StateBanking)
	}
}

func (r *QZNNRoom) tickBetting() {
	//查看是否都已经下注
	activePlayers := r.getActivePlayers(nil)
	hasUnconfirmed := false
	for _, p := range activePlayers {
		p.Mu.RLock()
		if p.ID == r.BankerID {
			//庄家不压
			p.Mu.RUnlock()
			continue
		}
		if p.BetMult == -1 {
			hasUnconfirmed = true
			p.Mu.RUnlock()
			break
		}
		p.Mu.RUnlock()
	}
	if !hasUnconfirmed {
		r.interuptStateLeftTicker(StateBetting)
	}

	// 策略介入点：所有人都下注完成了，准备发牌/摊牌前
	// 此时我们知道了 庄家倍数 和 闲家倍数，可以计算风险了
	// r.ApplyStrategyLogic() // 在状态切换前调用
}

func (r *QZNNRoom) tickShowCard() {
	//查看是否都已经下注
	activePlayers := r.getActivePlayers(nil)
	hasUnconfirmed := false
	for _, p := range activePlayers {
		p.Mu.RLock()
		if p.IsShow == false {
			hasUnconfirmed = true
			p.Mu.RUnlock()
			break
		}
		p.Mu.RUnlock()
	}
	if !hasUnconfirmed {
		r.interuptStateLeftTicker(StateShowCard)
	}
}

func (r *QZNNRoom) logicTick() {
	r.RoomMu.Lock()
	defer r.RoomMu.Unlock()
	switch r.State {
	case StateWaiting:
		r.tickWaiting()
	case StatePrepare:
		r.tickPrepare()
	case StatePreCard:
		// 预发牌状态
	case StateBanking:
		// 抢庄状态
		r.tickBanking()
	case StateBetting:
		// 下注状态
		r.tickBetting()
		// 检查是否所有人都已下注完成，如果是，且即将自动流转到 StateDealing
		// 注意：tickBetting 内部只是检查状态，真正的流转可能在 driverLogicTick 或 倒计时结束
		// 我们需要在 StateBetting -> StateDealing 的转换瞬间介入
		// 由于 logicTick 是轮询的，我们在 switch 外部或 tickBetting 内部处理流转时调用最合适
		// 但为了不破坏原有结构，我们选择在 SetStatus 处拦截，或者在 StateDealing 开始时立即处理
	case StateDealing:
		// 发牌补牌状态
	case StateShowCard:
		r.tickShowCard()
	case StateSettling:
		// 结算状态
	default:
	}
}

func (r *QZNNRoom) startGame() {

	r.GameID = fmt.Sprintf("%d_%s", time.Now().Unix(), r.ID)
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("roomId", r.ID).Info("GameStart")
	}

	//保底的检查，用户能不能玩，至少2个有效用户，不够要再踢回waiting
	activePlayer := r.GetActivePlayers(nil)
	var activePlayerIds []string
	for _, p := range activePlayer {
		activePlayerIds = append(activePlayerIds, p.ID)
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("roomId", r.ID).WithField("players", activePlayerIds).Info("GameStart-ActivePlayers")
	}

	if r.CanLog() {
		balanceLog := make(map[string]int64)
		for _, p := range activePlayer {
			p.Mu.RLock()
			balanceLog[p.ID] = p.Balance
			p.Mu.RUnlock()
		}
		logrus.WithField("gameId", r.GameID).WithField("balances", balanceLog).Info("GameStart-PlayerBalances")
	}

	//检查是否有重复id在游戏内
	allPlayers := r.GetPlayers()
	playerSet := make(map[string]*Player, 5)
	for _, p := range allPlayers {
		if p != nil {
			if _, ok := playerSet[p.ID]; ok {
				//有相同id用户
				logrus.WithField("!", nil).WithField("roomId", r.ID).WithField("duplicateId", p.ID).Error("InvalidPlayerCountForGame-Duplicate")
				r.SetStatus([]RoomState{StateStartGame}, StateWaiting, 0)
				return
			}
			playerSet[p.ID] = p
		}
	}

	//todo::检查用户的modelUser 里面的 balance_lock 和 player 的balance 是否相等

	if len(activePlayer) < 2 {
		logrus.WithField("!", nil).WithField("roomId", r.ID).WithField("playerCount", len(activePlayer)).Error("InvalidPlayerCountForGame-NotEnough")
		r.SetStatus([]RoomState{StateStartGame}, StateWaiting, 0)
		return
	}

	//准备牌堆并发牌
	r.prepareDeck()
	playerCardLog := logrus.Fields{}
	for _, p := range r.GetActivePlayers(nil) {
		p.Mu.RLock()
		playerCardLog[p.ID] = logrus.Fields{
			"cards":  p.Cards,
			"target": r.TargetResults[p.ID],
		}
		p.Mu.RUnlock()
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("deck_len", len(r.Deck)).WithField("players_cards", playerCardLog).Info("PrepareDeck")
	}

	r.WaitStateLeftTicker()

	if BankerTypeNoLook != r.Config.BankerType {
		//预发牌
		if !r.SetStatus([]RoomState{StateStartGame}, StatePreCard, 0) {
			logrus.WithField("gameId", r.GameID).Error("Room-StatusChange-Fail-preGiveCards")
			return
		}
		//预先发牌动画，看3s后
		r.WaitSleep(time.Second * SecStatePrecard)

	}
	//抢庄
	if !r.SetStatus([]RoomState{StateStartGame, StatePreCard}, StateBanking, SecStateCallBanking) {
		logrus.WithField("gameId", r.GameID).Error("Room-StatusChange-Fail-callBanker")
		return
	}

	//开始抢,等倒计时
	r.WaitStateLeftTicker()

	callBankerLog := logrus.Fields{}
	for _, p := range r.GetActivePlayers(nil) {
		p.Mu.RLock()
		callBankerLog[p.ID] = p.CallMult
		p.Mu.RUnlock()
	}

	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("call_mults", callBankerLog).Info("CallBankerResults")
	}

	// 查看是否已经有人抢庄
	allCallPlayer := r.GetActivePlayers(func(p *Player) bool {
		return p.CallMult > 0
	})

	// 确定庄家候选人列表
	var candidates []*Player
	bRandomBanker := false

	if len(allCallPlayer) > 0 {
		// 1. 有人抢庄：找出抢庄倍数最高的玩家集合
		maxMult := int64(0)
		for _, p := range allCallPlayer {
			if p.CallMult > maxMult {
				maxMult = p.CallMult
			}
		}
		for _, p := range allCallPlayer {
			if p.CallMult == maxMult {
				candidates = append(candidates, p)
			}
		}
		// 如果最高倍数有多人，标记为随机庄家
		if len(candidates) > 1 {
			bRandomBanker = true
		}
	} else {
		// 2. 没人抢庄：所有活跃玩家参与随机
		candidates = r.GetActivePlayers(nil)
		bRandomBanker = true
	}
	for _, p := range activePlayer {
		p.Mu.Lock()
		if p.CallMult < 0 {
			p.CallMult = 0
		}
		p.Mu.Unlock()
	}

	// 3. 如果是随机产生的庄家（多人同倍数 或 无人抢庄），播放定庄动画
	if bRandomBanker {
		r.SetStatus([]RoomState{StateBanking}, StateRandomBank, 0)
		r.WaitSleep(time.Second * SecStateBankingRandom)
	}
	// 4. 确定庄家：从候选人中随机选取 (若只有1人，结果也是确定的)
	if len(candidates) > 0 {
		banker := candidates[rand.Intn(len(candidates))]
		r.SetBankerId(banker.ID)
		if banker.CallMult <= 0 {
			banker.CallMult = r.Config.BankerMult[0]
		}
	}
	var candidateIds []string
	for _, c := range candidates {
		candidateIds = append(candidateIds, c.ID)
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).
			WithField("candidates", candidateIds).
			WithField("is_random", bRandomBanker).
			WithField("bankerId", r.BankerID).
			Info("BankerSelection")
	}

	r.SetStatus([]RoomState{StateBanking, StateRandomBank}, StateBankerConfirm, 0)

	r.WaitSleep(time.Second * SecStateConfirmBanking)

	//非庄家投注
	if !r.SetStatus([]RoomState{StateBankerConfirm}, StateBetting, SecStateBeting) {
		logrus.WithField("gameId", r.GameID).Error("Room-StatusChange-Fail-Betting")
		return
	}

	r.WaitStateLeftTicker()

	betLog := logrus.Fields{}
	for _, p := range r.GetActivePlayers(nil) {
		if p.ID != r.BankerID {
			betLog[p.ID] = p.BetMult
		}
	}

	r.WaitStateLeftTicker()

	//处理非庄家最低投注备注
	for _, p := range activePlayer {
		if p.ID == r.BankerID {
			continue
		}
		if p.BetMult <= 0 {
			p.BetMult = r.Config.BetMult[0]
		}
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("bets", betLog).Info("BetResults")
	}

	// 【核心修改】在此处介入策略系统
	// 在进入 StateDealing (发牌/补牌) 之前，根据倍数和库存调整手牌
	r.applyStrategyRiskControl()

	//补牌到5张，不看牌发5张，看3补2，看4
	if !r.SetStatus([]RoomState{StateBetting}, StateDealing, 0) {
		logrus.WithField("gameId", r.GameID).Error("Room-StatusChange-Fail-Dealing")
		return
	}

	r.WaitSleep(time.Second * SecStateDealing)

	if !r.SetStatus([]RoomState{StateDealing}, StateShowCard, SecStateShowCard) {
		logrus.WithField("gameId", r.GameID).Error("Room-StatusChange-Fail-ShowCard")
		return
	}
	r.WaitStateLeftTicker()

	//计算牛牛，分配balance
	//查找banker
	var bankerPlayer *Player
	cardResultLog := logrus.Fields{}
	for _, p := range activePlayer {
		p.CardResult = CalcNiu(p.Cards)
		cardResultLog[p.ID] = logrus.Fields{
			"cards":  p.Cards,
			"result": p.CardResult,
		}
		if p.ID == r.BankerID {
			bankerPlayer = p
		}
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("card_results", cardResultLog).Info("CardResults")
	}

	if bankerPlayer == nil {
		logrus.WithField("gameId", r.GameID).WithField("bankerId", r.BankerID).Error("Room-BankerInvalid")
		// 异常情况强制进入结算状态，避免房间卡死
		r.SetStatus([]RoomState{StateShowCard}, StateSettling, 0)
		return
	}
	bankerMult := int64(bankerPlayer.CallMult)
	if bankerMult <= 0 {
		bankerMult = 1
	}

	const TaxRate = 0.05 // 5% 税率

	// 1. 计算闲家输赢（暂不扣税，先算账）
	type WinRecord struct {
		PlayerID string
		Amount   int64
	}
	var playerWins []WinRecord
	var playerLoses []WinRecord

	baseBet := r.Config.BaseBet

	for _, p := range activePlayer {
		if p.ID == r.BankerID {
			continue
		}
		isPlayerWin := CompareCards(p.CardResult, bankerPlayer.CardResult)
		// 闲家赢：底注 * 庄倍 * 闲倍 * 闲家牌型倍数
		winAmount := baseBet * bankerMult * p.BetMult * p.CardResult.Mult
		// 庄家赢：底注 * 庄倍 * 闲倍 * 庄家牌型倍数
		loseAmount := baseBet * bankerMult * p.BetMult * bankerPlayer.CardResult.Mult
		if isPlayerWin {
			if winAmount > p.Balance {
				winAmount = p.Balance
			}
			//赢庄家，需要下面计算庄家赔付和庄家本金
			playerWins = append(playerWins, WinRecord{PlayerID: p.ID, Amount: winAmount})
		} else {
			if loseAmount > p.Balance {
				//最多把自己的本金输光
				loseAmount = p.Balance
			}
			playerLoses = append(playerLoses, WinRecord{PlayerID: p.ID, Amount: loseAmount})
		}
	}
	preSettleLog := logrus.Fields{
		"banker":             bankerPlayer.ID,
		"banker_card_result": bankerPlayer.CardResult,
		"player_wins":        playerWins,
		"player_loses":       playerLoses,
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("pre_settlement", preSettleLog).Info("PreSettlement")
	}

	// 先算输的闲家给庄家赔付
	playerLoss2Banker := int64(0)
	for _, rec := range playerLoses {
		for _, p := range activePlayer {
			if p.ID == rec.PlayerID {
				playerLoss2Banker += rec.Amount
				break
			}
		}
	}

	if playerLoss2Banker > bankerPlayer.Balance {
		//庄家本金不够多，输的闲按庄本金比例赔
		for _, rec := range playerLoses {
			for _, p := range activePlayer {
				if p.ID == rec.PlayerID {
					realLose := int64(math.Round(float64(rec.Amount) * float64(bankerPlayer.Balance) / float64(playerLoss2Banker)))
					p.BalanceChange -= realLose
					bankerPlayer.BalanceChange += realLose
					break
				}
			}
		}
	} else {
		//庄家本金足够
		for _, rec := range playerLoses {
			for _, p := range activePlayer {
				if p.ID == rec.PlayerID {
					p.BalanceChange -= rec.Amount
					bankerPlayer.BalanceChange += rec.Amount
					break
				}
			}
		}
	}

	//计算庄家输给闲家
	bankerLoss2player := int64(0)
	for _, rec := range playerWins {
		for _, p := range activePlayer {
			if p.ID == rec.PlayerID {
				bankerLoss2player += rec.Amount
				break
			}
		}
	}
	//bankerPlayer.BalanceChange 当前赢的闲家的
	bankerTotalFunds := bankerPlayer.Balance + bankerPlayer.BalanceChange
	if bankerLoss2player > bankerTotalFunds {
		//闲赢的钱大于庄家本金加刚赢的闲家的钱，不够赔
		totalDistributed := int64(0)
		for i, rec := range playerWins {
			for _, p := range activePlayer {
				if p.ID == rec.PlayerID {
					//已经限制 赢的闲的本金
					var realWin int64
					if i == len(playerWins)-1 {
						//资金泄漏风险（浮点数精度问题）：在庄家爆庄（不够赔）进行按比例分配时，使用 math.Round 分别计算每个人的赢钱数，累加后可能不等于庄家可赔付的总金额（可能多出或少于1分钱），导致系统资金账目不平。
						//在按比例分配时，最后一名玩家应直接获得剩余的全部金额，以确保总账平齐。
						realWin = bankerTotalFunds - totalDistributed
					} else {
						realWin = int64(math.Round(float64(rec.Amount) * float64(bankerTotalFunds) / float64(bankerLoss2player)))
					}
					p.BalanceChange += realWin
					totalDistributed += realWin
					break
				}
			}
		}
		//庄家本金输光
		bankerPlayer.BalanceChange = 0
		bankerPlayer.BalanceChange -= bankerPlayer.Balance
	} else {
		//庄家够赔
		for _, rec := range playerWins {
			for _, p := range activePlayer {
				if p.ID == rec.PlayerID {
					//已经限制 赢的闲的本金
					p.BalanceChange += rec.Amount
					bankerPlayer.BalanceChange -= rec.Amount
					break
				}
			}
		}
	}

	// 4 有效投注
	for _, p := range activePlayer {
		if p.BalanceChange < 0 {
			p.ValidBet = -p.BalanceChange
		} else {
			p.ValidBet = p.BalanceChange
		}

		// 更新连胜/连败数据 (用于下一局策略计算)
		if sData, ok := r.Strategy.UserData[p.ID]; ok {
			if p.BalanceChange > 0 {
				sData.WinningStreak++
				sData.LosingStreak = 0
			} else if p.BalanceChange < 0 {
				sData.LosingStreak++
				sData.WinningStreak = 0
			}
			// BalanceChange == 0 (平局或没下注) 保持不变
		}
	}

	// 5. 扣税 (只扣赢家的)
	taxLog := logrus.Fields{}
	for _, p := range activePlayer {
		if p.BalanceChange > 0 {
			tax := int64(math.Round(float64(p.BalanceChange) * TaxRate))
			taxLog[p.ID] = logrus.Fields{
				"pre_tax_win": p.BalanceChange,
				"tax":         tax,
			}
			p.BalanceChange -= tax
		}
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("taxes", taxLog).Info("Taxes")
	}

	//内存预先结算
	finalBalanceChanges := logrus.Fields{}
	for _, p := range activePlayer {
		finalBalanceChanges[p.ID] = p.BalanceChange
		p.Mu.Lock()
		p.Balance += p.BalanceChange
		p.Mu.Unlock()
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("final_balance_changes", finalBalanceChanges).Info("FinalBalanceChanges")
	}

	//结算状态
	if !r.SetStatus([]RoomState{StateShowCard}, StateSettling, 0) {
		//todo:: log detail for recovery data
		logrus.WithField("gameId", r.GameID).Error("Room-StatusChange-Fail-Settling")
		return
	}

	type qznnGameData struct {
		Room *QZNNRoom
	}
	nGameRecordId := int64(0)
	if r.CanLog() {
		roomBytes, _ := json.Marshal(qznnGameData{Room: r})
		//产生对局记录
		var err1 error
		nGameRecordId, err1 = modelClient.InsertGameRecord(&modelClient.ModelGameRecord{
			GameId:   r.GameID,
			GameName: GameName,
			GameData: string(roomBytes),
		})
		if err1 != nil {
			logrus.WithField("gameId", r.GameID).WithError(err1).Error("InsertGameRecord-Fail")
		} else {
			if r.CanLog() {
				logrus.WithField("gameId", r.GameID).WithField("recordId", nGameRecordId).Info("InsertGameRecord-Success")
			}
		}
	}

	settle := modelClient.GameSettletruct{RoomId: r.ID, GameRecordId: uint64(nGameRecordId),
		GameId: r.GameID}
	for _, p := range activePlayer {
		insertUserRecord := !p.IsRobot
		if initMain.DefCtx.IsTest {
			//非测试模式下，机器人不记录对局记录
			insertUserRecord = true
		}
		settle.Players = append(settle.Players, modelClient.UserSettingStruct{
			UserId:               p.ID,
			ChangeBalance:        p.BalanceChange,
			PlayerBalance:        p.Balance,
			ValidBet:             p.ValidBet,
			UserGameRecordInsert: insertUserRecord,
		})
	}
	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("settlement_data", settle).Info("PreUpdateUserSetting")
	}

	modelUsers, err := modelClient.UpdateUserSetting(&settle)
	if err != nil {
		var allUserIds []string
		for _, u := range settle.Players {
			allUserIds = append(allUserIds, u.UserId)
		}
		for _, u := range settle.Players {
			logrus.WithField(
				"gameId", r.GameID).WithField(
				"userId", u.UserId).WithField(
				"changeBal", u.ChangeBalance).Error("UpdateUserSetting-Restore")
		}
		logrus.WithField("gameId", r.GameID).WithField(
			"userIds", strings.Join(allUserIds, ",")).Error("UpdateUserSetting-Fail-Exiting")
		return
	}

	for _, modelU := range modelUsers {
		for _, player := range activePlayer {
			//用最新数据更新balance
			if player.ID == modelU.UserId {
				player.Mu.Lock()
				//检查内存player 的balance和最终数据库的差异
				if player.Balance != modelU.BalanceLock {
					//可能外面有余额，这里和数据库有的不一样
					if r.CanLog() {
						logrus.WithField("gameId", r.GameID).
							WithField("userId", player.ID).
							WithField("memBal", player.Balance).
							WithField("dbBalLock", modelU.BalanceLock).
							Error("BalanceMismatchAfterSettle")
					}
				}
				//最终以数据库的数据为准
				player.Balance = modelU.BalanceLock
				player.Mu.Unlock()
				break
			}
		}
	}

	//客户端播放结算动画
	r.WaitSleep(time.Second * SecStateSetting)

	//清理数据
	r.ResetGameData()
	//检查在线用户
	playerCount := r.getStartGamePlayerCount(true)
	prepareSec := SecStatePrepareSec
	nextState := StateWaiting
	switch playerCount {
	case 5:
		prepareSec = SecStatePrepareSecPlayer5
		nextState = StatePrepare
	case 4:
		prepareSec = SecStatePrepareSecPlayer4
		nextState = StatePrepare
	case 3:
		prepareSec = SecStatePrepareSecPlayer3
		nextState = StatePrepare
	default:
	}

	//查看是否有余额是0的用户，是0即可让用户去lobby了
	for _, p := range activePlayer {
		if p.Balance < r.Config.MinBalance {
			if r.Leave(p.ID) {
				if r.CanLog() {
					logrus.WithField("gameId", r.GameID).WithField("userId", p.ID).WithField("balance", p.Balance).Info("KickingPlayerBalanceNotEnough")
				}
				r.PushPlayer(p, comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: znet.PushRouter,
					Data: znet.PushRouterStruct{
						Router:  znet.Lobby,
						Message: "余额不足,离开房间"}})
			}
		}
	}

	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).WithField("nextState", nextState).WithField("prepareSec", prepareSec).Info("Finished")
	}

	r.SetStatus([]RoomState{StateSettling, RoomState("")}, nextState, prepareSec)
}

// --- 策略系统核心逻辑实现 ---

// applyStrategyRiskControl 是策略系统的总入口
// 它在下注结束、发最后几张牌之前执行
func (r *QZNNRoom) applyStrategyRiskControl() {
	// 1. 获取当前局的上下文信息 (庄家、倍数、库存)
	// bankPlayer := r.GetPlayerByID(r.BankerID)
	// activePlayers := r.GetActivePlayers(nil)
	activePlayers := r.GetActivePlayers(nil)

	// 2. 遍历所有玩家，计算实时 Lucky 值
	for _, p := range activePlayers {
		// 计算公式：Lfinal = (Base + Water) * RiskFactor
		r.calculateRealtimeLucky(p)
	}

	// 3. 执行换牌/控牌逻辑
	r.adjustCardsBasedOnLucky()

	if r.CanLog() {
		logrus.WithField("gameId", r.GameID).Info("Strategy: Risk Control Applied")
	}
}

// calculateRealtimeLucky 计算玩家当前的实时幸运值
// 对应需求中的：Lucky 值 = (基础值 + 水位修正) × 风险系数
func (r *QZNNRoom) calculateRealtimeLucky(p *Player) float64 {
	// 1. 获取或初始化策略数据
	if r.Strategy.UserData == nil {
		r.Strategy.UserData = make(map[string]*UserStrategyData)
	}

	strategyData, ok := r.Strategy.UserData[p.ID]
	if !ok {
		// TODO: 实际项目中应在玩家进入房间时从数据库加载 TotalProfit 等数据
		strategyData = &UserStrategyData{
			TotalProfit:       0, // 默认为0，需对接 User Model
			RecentProfit:      0,
			PendingCompensate: 0,
			BaseLucky:         r.Strategy.Config.BaseLucky,
		}
		r.Strategy.UserData[p.ID] = strategyData
	}

	// 计算当前玩家涉及的总倍数
	var totalMult int64

	// 获取庄家倍数
	bankerMult := int64(1)
	if r.BankerID != "" {
		if banker, ok := r.GetPlayerByID(r.BankerID); ok {
			if banker.CallMult > 0 {
				bankerMult = banker.CallMult
			}
		}
	}

	if p.ID == r.BankerID {
		// 如果是庄家，风险取决于闲家的平均下注倍数（估算）
		// 这里取一个估算值：庄家倍数 * 5 (假设平均闲家倍数)
		totalMult = bankerMult * 5
	} else {
		// 如果是闲家，风险 = 庄家倍数 * 自己的下注倍数
		myBetMult := p.BetMult
		if myBetMult <= 0 {
			myBetMult = 1
		}
		totalMult = bankerMult * myBetMult
	}

	// 构造策略上下文
	ctx := &strategy.StrategyContext{
		UserID:            p.ID,
		TotalProfit:       strategyData.TotalProfit,
		RecentProfit:      strategyData.RecentProfit,
		PendingCompensate: strategyData.PendingCompensate,

		BaseBet:       int64(r.Config.BaseBet),
		TotalMult:     totalMult,
		IsRobot:       p.IsRobot,
		IsNewbie:      p.GameCount < 50, // 假设 50 局以内算新手，需确保 p.GameCount 已正确赋值
		WinningStreak: strategyData.WinningStreak,
		LosingStreak:  strategyData.LosingStreak,

		SystemTurnoverToday: r.Strategy.SystemTurnover,
		KillRateToday:       float64(r.Strategy.SystemProfit) / float64(r.Strategy.SystemTurnover), // Assuming this is today's kill rate,
	}

	// 调用通用策略管理器进行计算
	baseLucky := r.Strategy.Manager.CalcBaseLucky(ctx)
	finalLucky, isHighRisk := r.Strategy.Manager.ApplyRiskControl(baseLucky, ctx)

	strategyData.BaseLucky = baseLucky
	strategyData.FinalLucky = finalLucky
	strategyData.IsHighRisk = isHighRisk

	// 日志记录
	if r.CanLog() {
		logrus.WithFields(logrus.Fields{
			"userId":      p.ID,
			"totalProfit": strategyData.TotalProfit,
			"baseLucky":   fmt.Sprintf("%.2f", baseLucky),
			"totalMult":   totalMult,
			"finalLucky":  fmt.Sprintf("%.2f", finalLucky),
		}).Info("CalcLucky")
	}

	return finalLucky
}

// adjustCardsBasedOnLucky 根据 Lucky 值调整手牌
// 这是实现“伪随机”和“库存保护”的关键
func (r *QZNNRoom) adjustCardsBasedOnLucky() {
	// 1. 获取庄家和固定牌数
	banker, ok := r.GetPlayerByID(r.BankerID)
	if !ok {
		return
	}
	fixedCount := r.getFixedCardCount()

	// 2. 预计算所有人的初始牌型结果 (确保 CardResult 是最新的)
	activePlayers := r.GetActivePlayers(nil)
	for _, p := range activePlayers {
		p.CardResult = CalcNiu(p.Cards)
	}
	// 确保庄家结果也是最新的
	banker.CardResult = CalcNiu(banker.Cards)

	// 3. 遍历玩家进行调整
	for _, p := range activePlayers {
		// 跳过庄家，庄家的牌主要作为闲家的参照物
		if p.ID == r.BankerID {
			continue
		}

		strategyData := r.Strategy.UserData[p.ID]
		if strategyData == nil {
			continue
		}

		targetLucky := strategyData.FinalLucky
		isHighRisk := strategyData.IsHighRisk

		// --- 决策逻辑 ---
		shouldWin := false
		shouldLose := false

		// 3.1 风控/投机检测 (最高优先级)
		if isHighRisk {
			shouldLose = true
		} else {
			// 3.2 基于 Lucky 值的概率干预
			// Lucky > 65: 尝试赢; Lucky < 35: 尝试输
			randVal := rand.Float64() * 100
			if targetLucky > 65 && randVal < targetLucky {
				shouldWin = true
			} else if targetLucky < 35 && randVal > targetLucky {
				shouldLose = true
			}
		}

		// 3.3 库存保护 (System Inventory Protection)
		// 当系统库存低于警戒线时，启动收割模式
		shouldProtect := false
		if r.Strategy.SystemTurnover > 0 {
			rate := float64(r.Strategy.SystemProfit) / float64(r.Strategy.SystemTurnover)
			// 线性公式: y = kx + b
			protectProb := r.Strategy.Config.ProtectK*rate + r.Strategy.Config.ProtectB
			if protectProb > 1.0 {
				protectProb = 1.0
			}
			if protectProb > 0 && rand.Float64() < protectProb {
				shouldProtect = true
			}
		}

		if shouldProtect {
			if !p.IsRobot {
				// 情况 A: 闲家是真人
				// 无论庄家是谁，真人闲家都应该输 (输给机器人庄家=系统回血; 输给真人庄家=系统抽水/防止出分)
				shouldWin = false
				shouldLose = true
			} else {
				// 情况 B: 闲家是机器人
				// 只有当庄家是真人时，机器人闲家才需要刻意去赢 (系统回血)
				if !banker.IsRobot {
					shouldWin = true
					shouldLose = false
				}
			}
		}

		// 3.4 执行换牌
		// 只有当当前结果不符合预期时才换牌
		isCurrentlyWin := CompareCards(p.CardResult, banker.CardResult)

		if shouldWin && !isCurrentlyWin {
			// 目标：换一副比庄家大的牌
			r.swapCardsForTarget(p, fixedCount, func(newRes any) bool {
				// 修复编译错误：类型断言
				// 假设 CalcNiu 返回的是 *CardResult 指针
				if res, ok := newRes.(*CardResult); ok {
					return CompareCards(*res, banker.CardResult)
				}
				return false
			})
		} else if shouldLose && isCurrentlyWin {
			// 目标：换一副比庄家小的牌
			r.swapCardsForTarget(p, fixedCount, func(newRes any) bool {
				if res, ok := newRes.(*CardResult); ok {
					// 注意参数顺序：CompareCards(A, B) 返回 true 代表 A > B
					// 这里我们要让庄家赢，所以检查 庄家 > 新牌
					return CompareCards(banker.CardResult, *res)
				}
				return false
			})
		}
	}

	// 4. 最终刷新所有人的结果
	for _, p := range activePlayers {
		p.CardResult = CalcNiu(p.Cards)
	}
}

// getFixedCardCount 获取当前模式下锁定的牌数
func (r *QZNNRoom) getFixedCardCount() int {
	// 假设 BankerType 1 为看3张抢庄 (Look3)，锁定前3张
	// 假设 BankerType 2 为看4张抢庄 (Look4)，锁定前4张
	// 0 为不看牌 (NoLook)，锁定0张
	if r.Config.BankerType == 1 {
		return 3
	}
	if r.Config.BankerType == 2 {
		return 4
	}
	return 0
}

// swapCardsForTarget 核心换牌算法
// p: 目标玩家
// fixedCount: 锁定的牌数 (Look3模式下为3，只能换第4、5张)
// checkFunc: 验证新牌型是否满足条件的闭包
func (r *QZNNRoom) swapCardsForTarget(p *Player, fixedCount int, checkFunc func(interface{}) bool) bool {
	if fixedCount >= 5 || len(p.Cards) != 5 || len(r.Deck) == 0 {
		return false
	}

	startIdx := fixedCount
	originalCards := make([]int, 5)
	copy(originalCards, p.Cards)
	currentCards := make([]int, 5)

	// 随机打乱 Deck 遍历顺序，避免每次都拿同一张牌
	perm := rand.Perm(len(r.Deck))

	// 策略 A: 尝试替换 1 张牌
	for i := startIdx; i < 5; i++ {
		for _, deckIdx := range perm {
			copy(currentCards, originalCards)
			cardInDeck := r.Deck[deckIdx]
			currentCards[i] = cardInDeck

			// 计算新牌型
			newRes := CalcNiu(currentCards)
			if checkFunc(newRes) {
				// 满足条件，执行物理交换
				r.Deck[deckIdx] = originalCards[i] // 旧牌回收到牌堆
				p.Cards[i] = cardInDeck            // 新牌给玩家

				if r.CanLog() {
					logrus.WithFields(logrus.Fields{
						"userId":   p.ID,
						"strategy": "Swap1",
						"pos":      i,
						"newCards": p.Cards,
					}).Info("Strategy: Swap Success")
				}
				return true
			}
		}
	}

	// 策略 B: 尝试替换 2 张牌 (仅当可变区域 >= 2 时，如 Look3 模式)
	if 5-startIdx >= 2 {
		// 遍历手牌中可替换区域的所有 2 张牌组合
		for i := startIdx; i < 4; i++ {
			for j := i + 1; j < 5; j++ {
				// 遍历牌堆中所有 2 张牌组合
				// 优化：使用 rand.Perm 生成随机索引，避免每次都从牌堆头部开始取牌，
				// 这样可以防止"好牌"总是被第一个触发换牌的玩家拿走。
				deckIndices := rand.Perm(len(r.Deck))
				for k := 0; k < len(deckIndices); k++ {
					for m := k + 1; m < len(deckIndices); m++ {
						d1, d2 := deckIndices[k], deckIndices[m]

						// 记录原始牌，用于回滚
						handCardI, handCardJ := p.Cards[i], p.Cards[j]
						deckCard1, deckCard2 := r.Deck[d1], r.Deck[d2]

						// --- 尝试组合 1: Hand[i]<->Deck[d1], Hand[j]<->Deck[d2] ---
						p.Cards[i], r.Deck[d1] = deckCard1, handCardI
						p.Cards[j], r.Deck[d2] = deckCard2, handCardJ

						newRes := CalcNiu(p.Cards)
						if checkFunc(newRes) {
							if r.CanLog() {
								logrus.WithFields(logrus.Fields{
									"userId":   p.ID,
									"strategy": "Swap2_Direct",
									"handIdx":  []int{i, j},
									"deckIdx":  []int{d1, d2},
									"newCards": p.Cards,
								}).Info("Strategy: Swap2 Success")
							}
							return true
						}

						// 回滚
						p.Cards[i], r.Deck[d1] = handCardI, deckCard1
						p.Cards[j], r.Deck[d2] = handCardJ, deckCard2

						// --- 尝试组合 2: Hand[i]<->Deck[d2], Hand[j]<->Deck[d1] ---
						p.Cards[i], r.Deck[d2] = deckCard2, handCardI
						p.Cards[j], r.Deck[d1] = deckCard1, handCardJ

						newRes = CalcNiu(p.Cards)
						if checkFunc(newRes) {
							if r.CanLog() {
								logrus.WithFields(logrus.Fields{
									"userId":   p.ID,
									"strategy": "Swap2_Cross",
									"handIdx":  []int{i, j},
									"deckIdx":  []int{d1, d2},
									"newCards": p.Cards,
								}).Info("Strategy: Swap2 Success")
							}
							return true
						}

						// 回滚
						p.Cards[i], r.Deck[d2] = handCardI, deckCard2
						p.Cards[j], r.Deck[d1] = handCardJ, deckCard1
					}
				}
			}
		}
	}

	return false
}
