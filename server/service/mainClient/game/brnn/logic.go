package brnn

import (
	"compoment/ws"
	"encoding/json"
	"fmt"
	"math/rand"
	"service/comm"
	"service/initMain"
	"service/mainClient/game/qznn"
	"service/modelClient"
	"time"

	"github.com/sirupsen/logrus"
)

// ---------------------------------------------------------------------------
// Room 生命周期
// ---------------------------------------------------------------------------

// NewRoom 创建百人牛牛房间，初始化各区域并启动 FSM 驱动协程。
// 自动从 DB 加载该房间最近的走势记录。
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

	// 从 DB 加载走势
	r.loadTrendFromDB()

	r.setState(StateBetting, cfg.SecBetting)
	go r.driverLogicTick()
	return r
}

// loadTrendFromDB 从 game_record 表加载该房间最近的走势数据。
func (r *BRNNRoom) loadTrendFromDB() {
	if initMain.DefCtx == nil || initMain.DefCtx.IsTest {
		return
	}
	records, err := modelClient.GetRecentGameRecordsByRoomId(r.ID, TrendMaxLen)
	if err != nil {
		logrus.WithField("roomId", r.ID).WithError(err).Warn("brnn.loadTrendFromDB")
		return
	}
	if len(records) == 0 {
		return
	}
	// records 是按 id 倒序的，需要反转为正序
	trend := make([]TrendRecord, 0, len(records))
	for i := len(records) - 1; i >= 0; i-- {
		rec := records[i]
		var gd brnnGameData
		if err := json.Unmarshal([]byte(rec.GameData), &gd); err != nil {
			continue
		}
		trend = append(trend, TrendRecord{
			GameCount: gd.GameCount,
			DealerNiu: gd.DealerNiu,
			AreaNiu:   gd.AreaNiu,
			AreaWin:   gd.AreaWin,
		})
	}
	r.Trend = trend
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
	r.GameID = fmt.Sprintf("%d_%s", time.Now().Unix(), r.ID)
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

// brnnMult 百人牛牛赔付倍数
func brnnMult(niu int64) int64 {
	switch niu {
	case qznn.NiuFace, qznn.NiuFiveSmall:
		return 5 // 五花牛、五小牛
	case qznn.NiuBomb, qznn.NiuFourFace:
		return 4 // 炸弹牛、四花牛
	case qznn.NiuNiu:
		return 3 // 牛牛
	case qznn.NiuSeven, qznn.NiuEight, qznn.NiuNine:
		return 2 // 牛七到牛九
	default:
		return 1 // 无牛到牛六
	}
}

// calcResults 对庄家和每个区域调用 CalcNiu 计算牌型，并使用百人牛牛倍数。
func (r *BRNNRoom) calcResults() {
	r.Dealer.CardResult = qznn.CalcNiu(r.Dealer.Cards)
	r.Dealer.CardResult.Mult = brnnMult(r.Dealer.CardResult.Niu)
	for i := 0; i < AreaCount; i++ {
		r.Areas[i].CardResult = qznn.CalcNiu(r.Areas[i].Cards)
		r.Areas[i].CardResult.Mult = brnnMult(r.Areas[i].CardResult.Niu)
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

	// 记录到房间，供 broadcastRoomState 在 SETTLING 阶段推送
	r.LastAreaWin = areaWin

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

	// 3. 复制 trend 用于推送
	trendCopy := make([]TrendRecord, len(r.Trend))
	copy(trendCopy, r.Trend)

	// 4. 给每个玩家计算输赢，收集推送消息和持久化结果
	type playerMsg struct {
		conn *ws.WsConnWrap
		msg  comm.PushData
	}
	var msgs []playerMsg
	var results []settleResult

	taxRate := r.Config.TaxRate
	var dealerWin int64 // 庄家总输赢 = 所有玩家输赢的负值
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		// 归还下注阶段扣减的余额，再按原逻辑计算输赢
		for i := 0; i < AreaCount; i++ {
			p.Balance += p.Bets[i]
		}
		var myWin int64
		for i := 0; i < AreaCount; i++ {
			bet := p.Bets[i]
			if bet <= 0 {
				continue
			}
			if areaWin[i] {
				myWin += bet * areaMult[i]
			} else {
				myWin -= bet * areaMult[i]
			}
		}
		// 单局输赢上限：最多赢/输本金
		if myWin > p.Balance {
			myWin = p.Balance
		} else if myWin < -p.Balance {
			myWin = -p.Balance
		}
		dealerWin -= myWin

		// 赢家税收
		var tax int64
		if myWin > 0 && taxRate > 0 {
			tax = myWin * taxRate / 100
		}
		netWin := myWin - tax
		p.Balance += netWin

		if p.ConnWrap != nil && p.ConnWrap.IsConnected() {
			msgs = append(msgs, playerMsg{
				conn: p.ConnWrap,
				msg: comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: PushSettlement,
					Data: PushSettlementData{
						AreaWin:   areaWin,
						AreaMult:  areaMult,
						DealerWin: dealerWin,
						MyWin:     netWin,
						MyTax:     tax,
						MyBalance: p.Balance,
						Trend:     trendCopy,
					},
				},
			})
		}

		// 收集有下注的玩家用于持久化
		var totalBet int64
		for i := 0; i < AreaCount; i++ {
			totalBet += p.Bets[i]
		}
		if totalBet > 0 {
			results = append(results, settleResult{
				userId:   p.ID,
				myWin:    myWin,
				tax:      tax,
				validBet: totalBet,
				balance:  p.Balance,
				bets:     p.Bets,
			})
		}
	}

	// 5. 锁外批量发送 + 异步持久化
	gameID := r.GameID
	roomID := r.ID
	gameCount := r.GameCount
	dealerNiu := r.Dealer.CardResult.Niu
	dealerMult := r.Dealer.CardResult.Mult
	dealerCards := make([]int, len(r.Dealer.Cards))
	copy(dealerCards, r.Dealer.Cards)
	var areaNiu [AreaCount]int64
	var areaCards [AreaCount][]int
	for i := 0; i < AreaCount; i++ {
		areaNiu[i] = r.Areas[i].CardResult.Niu
		areaCards[i] = make([]int, len(r.Areas[i].Cards))
		copy(areaCards[i], r.Areas[i].Cards)
	}

	if len(msgs) > 0 {
		go func() {
			for _, m := range msgs {
				_ = comm.WriteMsgPack(m.conn, m.msg)
			}
		}()
	}

	if len(results) > 0 {
		go r.persistSettlement(roomID, gameID, gameCount, dealerNiu, dealerMult, dealerCards, areaWin, areaMult, areaNiu, areaCards, results)
	}
}

// ---------------------------------------------------------------------------
// 持久化（异步调用，不持有锁）
// ---------------------------------------------------------------------------

type settleResult struct {
	userId   string
	myWin    int64 // 原始输赢（税前）
	tax      int64 // 税收
	validBet int64
	balance  int64
	bets     [AreaCount]int64
}

// BrnnPlayerBet 记录单个玩家的下注详情，用于 GameData 持久化和外部解析。
type BrnnPlayerBet struct {
	UserId string           `json:"UserId"`
	Bets   [AreaCount]int64 `json:"Bets"`
	Win    int64            `json:"Win"` // 原始输赢（税前）
	Tax    int64            `json:"Tax"` // 税收
}

// brnnGameData 序列化到 GameRecord.GameData
type brnnGameData struct {
	GameCount   int64              `json:"GameCount"`
	DealerNiu   int64              `json:"DealerNiu"`
	DealerMult  int64              `json:"DealerMult"`
	DealerCards []int              `json:"DealerCards,omitempty"`
	AreaWin     [AreaCount]bool    `json:"AreaWin"`
	AreaMult    [AreaCount]int64   `json:"AreaMult"`
	AreaNiu     [AreaCount]int64   `json:"AreaNiu"`
	AreaCards   [AreaCount][]int   `json:"AreaCards"`
	PlayerBets  []BrnnPlayerBet    `json:"PlayerBets,omitempty"`
}

// persistSettlement 异步写入 game_record + user_record，然后回写 DB 余额到内存。
func (r *BRNNRoom) persistSettlement(roomID, gameID string, gameCount, dealerNiu, dealerMult int64,
	dealerCards []int, areaWin [AreaCount]bool, areaMult, areaNiu [AreaCount]int64,
	areaCards [AreaCount][]int, results []settleResult) {

	if initMain.DefCtx == nil || initMain.DefCtx.IsTest {
		return
	}

	// 1. InsertGameRecord
	playerBets := make([]BrnnPlayerBet, len(results))
	for i, res := range results {
		playerBets[i] = BrnnPlayerBet{
			UserId: res.userId,
			Bets:   res.bets,
			Win:    res.myWin,
			Tax:    res.tax,
		}
	}
	gameData := brnnGameData{
		GameCount:   gameCount,
		DealerNiu:   dealerNiu,
		DealerMult:  dealerMult,
		DealerCards:  dealerCards,
		AreaWin:      areaWin,
		AreaMult:     areaMult,
		AreaNiu:      areaNiu,
		AreaCards:     areaCards,
		PlayerBets:   playerBets,
	}
	gameDataBytes, _ := json.Marshal(gameData)
	recordId, err := modelClient.InsertGameRecord(&modelClient.ModelGameRecord{
		GameId:   gameID,
		GameName: GameName,
		RoomId:   roomID,
		GameData: string(gameDataBytes),
	})
	if err != nil {
		logrus.WithField("gameId", gameID).WithError(err).Error("brnn.InsertGameRecord")
		return
	}

	// 2. 构建 GameSettletruct
	settle := modelClient.GameSettletruct{
		RoomId:       roomID,
		GameId:       gameID,
		GameRecordId: uint64(recordId),
		GameName:     GameName,
	}
	for _, res := range results {
		settle.Players = append(settle.Players, modelClient.UserSettingStruct{
			UserId:               res.userId,
			PlayerBalance:        res.balance,
			ChangeBalance:        res.myWin - res.tax, // 实际余额变化 = 输赢 - 税收
			ValidBet:             res.validBet,
			UserGameRecordInsert: true,
		})
	}

	// 3. UpdateUserSetting — 事务更新 BalanceLock + 插入 UserRecord
	modelUsers, err := modelClient.UpdateUserSetting(&settle)
	if err != nil {
		logrus.WithField("gameId", gameID).WithError(err).Error("brnn.UpdateUserSetting")
		return
	}

	// 4. 回写 DB 余额到内存（需扣除新一局已下注的金额，避免覆盖下注扣减）
	r.mu.Lock()
	for _, mu := range modelUsers {
		if p := r.Players[mu.UserId]; p != nil {
			var currentBets int64
			for i := 0; i < AreaCount; i++ {
				currentBets += p.Bets[i]
			}
			p.Balance = mu.BalanceLock - currentBets
		}
	}
	r.mu.Unlock()
}

// ---------------------------------------------------------------------------
// 重置（调用者已持有 r.mu 写锁）
// ---------------------------------------------------------------------------

// resetRound 清除本局临时数据，为下一局做准备。
func (r *BRNNRoom) resetRound() {
	r.Deck = nil
	r.LastAreaWin = [AreaCount]bool{}
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

// GetPlayerConnWrap 返回玩家的 WebSocket 连接（线程安全）。
func (r *BRNNRoom) GetPlayerConnWrap(userId string) *ws.WsConnWrap {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p := r.Players[userId]
	if p == nil {
		return nil
	}
	return p.ConnWrap
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

// CanLeave 检查玩家是否可以离开（在发牌/开牌阶段有下注则不可离开）。
func (r *BRNNRoom) CanLeave(userId string) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p := r.Players[userId]
	if p == nil {
		return false, comm.NewMyError("玩家不在房间")
	}

	if r.State != StateBetting && r.State != StateSettling {
		for i := 0; i < AreaCount; i++ {
			if p.Bets[i] > 0 {
				return false, comm.NewMyError("本局有下注，请等待结算后再离开")
			}
		}
	}
	return true, nil
}

// ---------------------------------------------------------------------------
// 下注
// ---------------------------------------------------------------------------

// placeBetLocked 在已持有 r.mu 写锁的情况下执行下注逻辑。
func (r *BRNNRoom) placeBetLocked(userId string, area int, chip int64) error {
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
	// 5. 验证余额
	if chip > p.Balance {
		return comm.NewMyError("余额不足")
	}

	// 7. 更新下注并扣减余额
	p.Bets[area] += chip
	p.Balance -= chip
	r.Areas[area].TotalBet += chip

	return nil
}

// PlaceBet 玩家下注到指定区域（用于测试和外部调用）。
func (r *BRNNRoom) PlaceBet(userId string, area int, chip int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.placeBetLocked(userId, area, chip)
}

// PlaceBetAndBroadcast 单次加锁完成下注+收集广播数据，锁外发送。
func (r *BRNNRoom) PlaceBetAndBroadcast(userId string, area int, chip int64) error {
	type playerMsg struct {
		conn *ws.WsConnWrap
		msg  comm.PushData
	}

	var msgs []playerMsg

	r.mu.Lock()
	err := r.placeBetLocked(userId, area, chip)
	if err == nil {
		// 收集广播数据
		var areaBets [AreaCount]int64
		for i := 0; i < AreaCount; i++ {
			areaBets[i] = r.Areas[i].TotalBet
		}
		for _, p := range r.Players {
			if p == nil || p.ConnWrap == nil || !p.ConnWrap.IsConnected() {
				continue
			}
			msgs = append(msgs, playerMsg{
				conn: p.ConnWrap,
				msg: comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: PushBetUpdate,
					Data: PushBetUpdateData{
						AreaBets:  areaBets,
						MyBets:    p.Bets,
						MyBalance: p.Balance,
					},
				},
			})
		}
	}
	r.mu.Unlock()

	if err != nil {
		return err
	}

	// 锁外批量发送
	go func() {
		for _, m := range msgs {
			_ = comm.WriteMsgPack(m.conn, m.msg)
		}
	}()
	return nil
}

// ---------------------------------------------------------------------------
// 广播与推送
// ---------------------------------------------------------------------------

// broadcastRoomState 向所有在线玩家推送房间状态。
// 注意：调用者已持有 r.mu 写锁（从 setState 调用）。
// 收集消息后用单个 goroutine 批量发送。
func (r *BRNNRoom) broadcastRoomState() {
	type playerMsg struct {
		conn *ws.WsConnWrap
		msg  comm.PushData
	}
	var msgs []playerMsg
	for _, p := range r.Players {
		if p == nil || p.ConnWrap == nil || !p.ConnWrap.IsConnected() {
			continue
		}
		data := r.buildRoomStateData(p)
		msgs = append(msgs, playerMsg{
			conn: p.ConnWrap,
			msg: comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: PushRoomState,
				Data:     data,
			},
		})
	}
	if len(msgs) > 0 {
		go func() {
			for _, m := range msgs {
				_ = comm.WriteMsgPack(m.conn, m.msg)
			}
		}()
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
		if r.State == StateSettling {
			win := r.LastAreaWin[i]
			ai.Win = &win
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
	var myBalance int64
	if p != nil {
		myBets = p.Bets
		myBalance = p.Balance
	}

	return PushRoomStateData{
		State:       r.State,
		LeftSec:     r.StateLeftSec,
		GameCount:   r.GameCount,
		PlayerCount: len(r.Players),
		Areas:       areas,
		Dealer:      dealer,
		MyBets:      myBets,
		MyBalance:   myBalance,
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
// 收集消息后用单个 goroutine 批量发送。
func (r *BRNNRoom) broadcastPlayerCount() {
	type playerMsg struct {
		conn *ws.WsConnWrap
		msg  comm.PushData
	}
	var msgs []playerMsg

	r.mu.RLock()
	count := len(r.Players)
	for _, p := range r.Players {
		if p == nil || p.ConnWrap == nil || !p.ConnWrap.IsConnected() {
			continue
		}
		msgs = append(msgs, playerMsg{
			conn: p.ConnWrap,
			msg: comm.PushData{
				Cmd:      comm.ServerPush,
				PushType: PushPlayerCount,
				Data:     count,
			},
		})
	}
	r.mu.RUnlock()

	if len(msgs) > 0 {
		go func() {
			for _, m := range msgs {
				_ = comm.WriteMsgPack(m.conn, m.msg)
			}
		}()
	}
}

// pushPlayer 向单个玩家同步推送消息。如果连接为空或断开则跳过。
func (r *BRNNRoom) pushPlayer(p *BRNNPlayer, msg interface{}) {
	if p == nil || p.ConnWrap == nil || !p.ConnWrap.IsConnected() {
		return
	}
	_ = comm.WriteMsgPack(p.ConnWrap, msg)
}

// ---------------------------------------------------------------------------
// 外部查询（用于玩家加入时推送完整状态）
// ---------------------------------------------------------------------------

// GetOnlinePlayers 返回在线玩家基本信息列表（线程安全）。
func (r *BRNNRoom) GetOnlinePlayers() []PlayerRankInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	players := make([]PlayerRankInfo, 0, len(r.Players))
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		players = append(players, PlayerRankInfo{
			UserId:   p.ID,
			NickName: p.NickName,
			Avatar:   p.Avatar,
			Balance:  p.Balance,
		})
	}
	return players
}

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
