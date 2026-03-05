package brnn

import (
	"compoment/ws"
	"math/rand"
	"service/comm"
	"service/mainClient/game/qznn"
	"time"

	"github.com/sirupsen/logrus"
)

// ---------------------------------------------------------------------------
// Room 生命周期
// ---------------------------------------------------------------------------

// NewRoom 创建百人牛牛房间，初始化各区域并启动 FSM 驱动协程。
func NewRoom(id string, cfg *BRNNConfig) *BRNNRoom {
	if cfg == nil {
		cfg = DefaultConfig
	}
	r := &BRNNRoom{
		ID:       id,
		Config:   cfg,
		Players:  make(map[string]*BRNNPlayer),
		Trend:    make([]TrendRecord, 0, TrendMaxLen),
		Deck:     nil,
		driverGo: make(chan struct{}),
	}
	r.Dealer = BettingArea{Index: -1, Name: "庄"}
	for i := 0; i < AreaCount; i++ {
		r.Areas[i] = &BettingArea{Index: i, Name: AreaNames[i]}
	}
	r.setState(StateBetting, cfg.SecBetting)
	go r.driverLogicTick()
	return r
}

// Destroy 销毁房间，关闭驱动协程。
func (r *BRNNRoom) Destroy() {
	close(r.driverGo)
}

// ---------------------------------------------------------------------------
// 状态管理
// ---------------------------------------------------------------------------

// setState 切换状态、设置倒计时并广播。
// 注意：调用者必须已持有 r.mu 写锁，或处于初始化阶段（NewRoom）。
func (r *BRNNRoom) setState(state RoomState, sec int) {
	r.State = state
	r.StateLeftSec = sec
	if sec > 0 {
		r.StateDeadline = time.Now().Add(time.Duration(sec) * time.Second)
	} else {
		r.StateDeadline = time.Time{}
	}
	logrus.WithFields(logrus.Fields{
		"roomId": r.ID,
		"state":  state,
		"sec":    sec,
	}).Info("brnn.setState")
	r.broadcastRoomState()
}

// GetState 返回当前房间状态（线程安全）。
func (r *BRNNRoom) GetState() RoomState {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.State
}

// ---------------------------------------------------------------------------
// FSM 驱动
// ---------------------------------------------------------------------------

// driverLogicTick 每 200ms 驱动一次逻辑帧。
func (r *BRNNRoom) driverLogicTick() {
	const driverMill = time.Millisecond * 200
	ticker := time.NewTicker(driverMill)
	defer ticker.Stop()

	for {
		select {
		case <-r.driverGo:
			return
		case <-ticker.C:
			r.mu.RLock()
			hasDeadline := !r.StateDeadline.IsZero()
			r.mu.RUnlock()
			if hasDeadline {
				r.UpdateStateLeftSec()
			}
			r.logicTick()
		}
	}
}

// logicTick 检查倒计时是否归零，触发对应状态结束回调。
func (r *BRNNRoom) logicTick() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 只有倒计时归零且 deadline 已被清除才触发状态迁移
	if r.StateLeftSec > 0 {
		return
	}
	if !r.StateDeadline.IsZero() {
		return
	}

	switch r.State {
	case StateBetting:
		r.onBettingEnd()
	case StateDealing:
		r.onDealingEnd()
	case StateShowCard:
		r.onShowCardEnd()
	case StateSettling:
		r.onSettlingEnd()
	}
}

// ---------------------------------------------------------------------------
// 状态迁移回调（调用者已持有 r.mu 写锁）
// ---------------------------------------------------------------------------

func (r *BRNNRoom) onBettingEnd() {
	r.GameCount++
	r.dealCards()
	r.setState(StateDealing, r.Config.SecDealing)
}

func (r *BRNNRoom) onDealingEnd() {
	r.calcResults()
	r.setState(StateShowCard, r.Config.SecShowCard)
}

func (r *BRNNRoom) onShowCardEnd() {
	r.settle()
	r.setState(StateSettling, r.Config.SecSettling)
}

func (r *BRNNRoom) onSettlingEnd() {
	r.resetRound()
	r.setState(StateBetting, r.Config.SecBetting)
}

// ---------------------------------------------------------------------------
// 发牌与计算（调用者已持有 r.mu 写锁）
// ---------------------------------------------------------------------------

// dealCards 初始化 52 张牌并洗牌，为庄家和 4 个区域各发 5 张。
func (r *BRNNRoom) dealCards() {
	// 初始化牌堆 (0-51)
	r.Deck = make([]int, 52)
	for i := 0; i < 52; i++ {
		r.Deck[i] = i
	}
	// Fisher-Yates 洗牌
	rand.Shuffle(len(r.Deck), func(i, j int) {
		r.Deck[i], r.Deck[j] = r.Deck[j], r.Deck[i]
	})

	// 庄家发 5 张
	r.Dealer.Cards = make([]int, PlayerCardMax)
	copy(r.Dealer.Cards, r.Deck[:PlayerCardMax])
	r.Deck = r.Deck[PlayerCardMax:]

	// 4 个区域各发 5 张
	for i := 0; i < AreaCount; i++ {
		r.Areas[i].Cards = make([]int, PlayerCardMax)
		copy(r.Areas[i].Cards, r.Deck[:PlayerCardMax])
		r.Deck = r.Deck[PlayerCardMax:]
	}
}

// calcResults 对庄家和每个区域调用 CalcNiu 计算牌型。
func (r *BRNNRoom) calcResults() {
	r.Dealer.CardResult = qznn.CalcNiu(r.Dealer.Cards)
	for i := 0; i < AreaCount; i++ {
		r.Areas[i].CardResult = qznn.CalcNiu(r.Areas[i].Cards)
	}
}

// ---------------------------------------------------------------------------
// 结算（调用者已持有 r.mu 写锁）
// ---------------------------------------------------------------------------

// settle 计算各区域胜负，更新玩家余额，记录趋势，逐玩家推送结算结果。
func (r *BRNNRoom) settle() {
	// 1. 计算各区域胜负和倍数
	var areaWin [AreaCount]bool
	var areaMult [AreaCount]int64
	for i := 0; i < AreaCount; i++ {
		win := qznn.CompareCards(r.Areas[i].CardResult, r.Dealer.CardResult)
		areaWin[i] = win
		if win {
			areaMult[i] = r.Areas[i].CardResult.Mult
		} else {
			areaMult[i] = r.Dealer.CardResult.Mult
		}
	}

	// 2. 记录趋势
	tr := TrendRecord{
		GameCount: r.GameCount,
		DealerNiu: r.Dealer.CardResult.Niu,
		AreaWin:   areaWin,
	}
	for i := 0; i < AreaCount; i++ {
		tr.AreaNiu[i] = r.Areas[i].CardResult.Niu
	}
	r.Trend = append(r.Trend, tr)
	if len(r.Trend) > TrendMaxLen {
		r.Trend = r.Trend[len(r.Trend)-TrendMaxLen:]
	}

	// 3. 给每个玩家单独推送结算（包含个人 MyWin / MyBalance）
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		var myWin int64
		for i := 0; i < AreaCount; i++ {
			bet := p.Bets[i]
			if bet <= 0 {
				continue
			}
			if areaWin[i] {
				// 区域赢：玩家获得 bet * 区域牌型倍数
				myWin += bet * areaMult[i]
			} else {
				// 区域输：玩家扣除 bet * 庄家牌型倍数
				myWin -= bet * areaMult[i]
			}
		}
		p.Balance += myWin

		msg := comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushSettlement,
			Data: PushSettlementData{
				AreaWin:   areaWin,
				AreaMult:  areaMult,
				MyWin:     myWin,
				MyBalance: p.Balance,
			},
		}
		r.pushPlayer(p, msg)
	}
}

// ---------------------------------------------------------------------------
// 重置（调用者已持有 r.mu 写锁）
// ---------------------------------------------------------------------------

// resetRound 清除本局临时数据，为下一局做准备。
func (r *BRNNRoom) resetRound() {
	r.Deck = nil
	r.Dealer.Cards = nil
	r.Dealer.CardResult = qznn.CardResult{}
	r.Dealer.TotalBet = 0
	for i := 0; i < AreaCount; i++ {
		r.Areas[i].Cards = nil
		r.Areas[i].CardResult = qznn.CardResult{}
		r.Areas[i].TotalBet = 0
	}
	for _, p := range r.Players {
		if p != nil {
			p.Bets = [AreaCount]int64{}
		}
	}
}

// ---------------------------------------------------------------------------
// 玩家管理
// ---------------------------------------------------------------------------

// AddPlayer 添加玩家到房间并广播人数。
func (r *BRNNRoom) AddPlayer(p *BRNNPlayer) {
	r.mu.Lock()
	r.Players[p.ID] = p
	r.mu.Unlock()
	r.broadcastPlayerCount()
}

// RemovePlayer 移除玩家并广播人数。
func (r *BRNNRoom) RemovePlayer(userId string) {
	r.mu.Lock()
	delete(r.Players, userId)
	r.mu.Unlock()
	r.broadcastPlayerCount()
}

// GetPlayer 根据 userId 获取玩家（线程安全）。
func (r *BRNNRoom) GetPlayer(userId string) *BRNNPlayer {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Players[userId]
}

// GetPlayerCount 返回当前房间人数（线程安全）。
func (r *BRNNRoom) GetPlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players)
}

// SetWsWrap 更新玩家的 WebSocket 连接。
func (r *BRNNRoom) SetWsWrap(userId string, connWrap *ws.WsConnWrap) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p := r.Players[userId]
	if p == nil {
		return
	}
	p.ConnWrap = connWrap
}

// ---------------------------------------------------------------------------
// 下注
// ---------------------------------------------------------------------------

// PlaceBet 玩家下注到指定区域。
func (r *BRNNRoom) PlaceBet(userId string, area int, chip int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 1. 验证状态
	if r.State != StateBetting {
		return comm.NewMyError("当前不在下注阶段")
	}
	// 2. 验证区域
	if area < 0 || area >= AreaCount {
		return comm.NewMyError("无效的下注区域")
	}
	// 3. 验证筹码面值
	if !r.Config.ValidChip(chip) {
		return comm.NewMyError("无效的筹码面值")
	}
	// 4. 验证玩家
	p := r.Players[userId]
	if p == nil {
		return comm.NewMyError("玩家不存在")
	}
	// 5. 验证单区域上限
	if p.Bets[area]+chip > r.Config.MaxBetPerArea {
		return comm.NewMyError("超过单区域下注上限")
	}
	// 6. 验证余额（所有区域下注总和 + 本次筹码 <= 余额）
	var totalBets int64
	for i := 0; i < AreaCount; i++ {
		totalBets += p.Bets[i]
	}
	if totalBets+chip > p.Balance {
		return comm.NewMyError("余额不足")
	}

	// 7. 更新下注
	p.Bets[area] += chip
	r.Areas[area].TotalBet += chip

	return nil
}

// ---------------------------------------------------------------------------
// 广播与推送
// ---------------------------------------------------------------------------

// broadcastRoomState 向所有在线玩家推送房间状态。
// 注意：调用者已持有 r.mu 写锁（从 setState 调用）。
func (r *BRNNRoom) broadcastRoomState() {
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		data := r.buildRoomStateData(p)
		msg := comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushRoomState,
			Data:     data,
		}
		r.pushPlayer(p, msg)
	}
}

// buildRoomStateData 构建面向特定玩家的房间状态数据。
// 注意：调用者已持有 r.mu 锁。
func (r *BRNNRoom) buildRoomStateData(p *BRNNPlayer) PushRoomStateData {
	showCards := r.State == StateShowCard || r.State == StateSettling

	var areas [AreaCount]AreaInfo
	for i := 0; i < AreaCount; i++ {
		a := r.Areas[i]
		ai := AreaInfo{
			Index:    a.Index,
			Name:     a.Name,
			TotalBet: a.TotalBet,
		}
		if showCards {
			cardsCopy := make([]int, len(a.Cards))
			copy(cardsCopy, a.Cards)
			ai.Cards = cardsCopy
			ai.NiuType = a.CardResult.Niu
			ai.NiuMult = a.CardResult.Mult
		}
		areas[i] = ai
	}

	dealer := DealerInfo{}
	if showCards {
		cardsCopy := make([]int, len(r.Dealer.Cards))
		copy(cardsCopy, r.Dealer.Cards)
		dealer.Cards = cardsCopy
		dealer.NiuType = r.Dealer.CardResult.Niu
		dealer.NiuMult = r.Dealer.CardResult.Mult
	}

	var myBets [AreaCount]int64
	if p != nil {
		myBets = p.Bets
	}

	return PushRoomStateData{
		State:       r.State,
		LeftSec:     r.StateLeftSec,
		GameCount:   r.GameCount,
		PlayerCount: len(r.Players),
		Areas:       areas,
		Dealer:      dealer,
		MyBets:      myBets,
	}
}

// BroadcastBetUpdate 向所有在线玩家推送下注更新。
func (r *BRNNRoom) BroadcastBetUpdate() {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var areaBets [AreaCount]int64
	for i := 0; i < AreaCount; i++ {
		areaBets[i] = r.Areas[i].TotalBet
	}

	for _, p := range r.Players {
		if p == nil {
			continue
		}
		msg := comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushBetUpdate,
			Data: PushBetUpdateData{
				AreaBets: areaBets,
				MyBets:   p.Bets,
			},
		}
		r.pushPlayer(p, msg)
	}
}

// broadcastPlayerCount 向所有在线玩家推送当前人数。
func (r *BRNNRoom) broadcastPlayerCount() {
	r.mu.RLock()
	defer r.mu.RUnlock()

	count := len(r.Players)
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		msg := comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayerCount,
			Data:     count,
		}
		r.pushPlayer(p, msg)
	}
}

// pushPlayer 向单个玩家推送消息。如果连接为空或断开则跳过。
func (r *BRNNRoom) pushPlayer(p *BRNNPlayer, msg interface{}) {
	if p == nil || p.ConnWrap == nil || !p.ConnWrap.IsConnected() {
		return
	}
	conn := p.ConnWrap
	go func() {
		_ = comm.WriteMsgPack(conn, msg)
	}()
}

// ---------------------------------------------------------------------------
// 外部查询（用于玩家加入时推送完整状态）
// ---------------------------------------------------------------------------

// GetRoomStateForPlayer 返回完整的房间状态（包含 Config 和 Trend），用于玩家加入时。
func (r *BRNNRoom) GetRoomStateForPlayer(userId string) PushRoomStateData {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p := r.Players[userId]
	data := r.buildRoomStateData(p)

	// 加入时附带配置和趋势
	data.Config = &BRNNClientConfig{
		Chips:         r.Config.Chips,
		MaxBetPerArea: r.Config.MaxBetPerArea,
		MinBalance:    r.Config.MinBalance,
	}
	trendCopy := make([]TrendRecord, len(r.Trend))
	copy(trendCopy, r.Trend)
	data.Trend = trendCopy

	return data
}
