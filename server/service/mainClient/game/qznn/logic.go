package qznn

import (
	"compoment/ws"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"service/comm"
	"service/mainClient/game/znet"
	"service/modelClient"
	"slices"
	"time"

	errors "github.com/pkg/errors"

	"github.com/sirupsen/logrus"
)

var errorStateNotMatch = errors.New("stateNotMatch")

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
	}
	nRoom.Config = *GetConfig(level)
	nRoom.Config.BankerType = bankerType
	go nRoom.driverLogicTick()
	return nRoom
}

func (r *QZNNRoom) Destory() {
	close(r.driverGo)
}

func (r *QZNNRoom) CheckStatus(state RoomState) bool {
	r.StateMu.RLock()
	defer r.StateMu.RUnlock()
	return r.State == state
}

func (r *QZNNRoom) CheckStatusDo(state RoomState, fn func() error) error {
	r.StateMu.RLock()
	defer r.StateMu.RUnlock()
	if r.State != state {
		return errors.Wrap(errorStateNotMatch, fmt.Sprintf("%s", state))
	}
	return fn()
}

func (r *QZNNRoom) CheckInMultiStatusDo(state []RoomState, fn func() error) error {
	r.StateMu.RLock()
	defer r.StateMu.RUnlock()
	if slices.Contains(state, r.State) {
		return fn()
	} else {
		return errors.Wrap(errorStateNotMatch, fmt.Sprintf("%v", state))
	}
}

func (r *QZNNRoom) SetStatus(oldStates []RoomState, newState RoomState, stateLeftSec int) bool {
	r.StateMu.Lock()
	if r.State == newState {
		r.StateMu.Unlock()
		logrus.WithFields(logrus.Fields{
			"roomId": r.ID,
			"state":  newState,
		}).Error("QZNNStatuSame")
		return false
	}
	if !slices.Contains(oldStates, r.State) {
		r.StateMu.Unlock()
		logrus.WithFields(logrus.Fields{
			"roomId": r.ID,
			"state":  newState,
		}).Error("QZNNStatuIgnored")
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
	r.StateMu.Unlock()
	logrus.WithFields(logrus.Fields{
		"roomId":  r.ID,
		"old":     oldState,
		"new":     newState,
		"leftSec": stateLeftSec,
	}).Info("QZNNStatuChanged")

	// 倒计时逻辑现在由 drvierLogicTick 统一接管，不再单独开启 goroutine
	// 也不需要在这里处理 interuptStateLeftTicker，因为 StateLeftSec 已经被重置
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushChangeState,
			Data: PushChangeStateStruct{
				Room:         r.GetClientRoom(p.ID),
				State:        newState,
				StateLeftSec: stateLeftSec}}
	})
	return true
}

func (r *QZNNRoom) CheckGameStart() bool {
	r.StateMu.RLock()
	defer r.StateMu.RUnlock()
	if !(r.State == StateWaiting || r.State == StatePrepare) {
		return true
	}
	return false
}

func (r *QZNNRoom) CheckPlayerIsOb() bool {
	r.StateMu.RLock()
	defer r.StateMu.RUnlock()
	if !(r.State == StateWaiting || r.State == StatePrepare) {
		return true
	}
	if r.State == StatePrepare && r.StateLeftSec <= 2 {
		return true
	}

	return false
}

func (r *QZNNRoom) CheckIsBanker(bankerID string) bool {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	return r.BankerID == bankerID
}

func (r *QZNNRoom) GetPlayerCap() int {
	return cap(r.Players)
}

func (r *QZNNRoom) GetPlayers() []*Player {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	var ret []*Player
	for _, p := range r.Players {
		if p != nil {
			ret = append(ret, p)
		}
	}
	return ret
}

func (r *QZNNRoom) GetPlayerCount() int {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	currentCount := 0
	for _, p := range r.Players {
		if p != nil {
			currentCount++
		}
	}
	return currentCount
}

// todo::StateSettlingDirectPreCard 这个 也要判断kickoff
func (r *QZNNRoom) kickOffByWsDisconnect() ([]string, bool) {
	var delIndex []int
	r.PlayerMu.RLock()

	for i, p := range r.Players {
		if p == nil {
			continue
		}
		if p.IsOb {
			continue
		}
		if p.IsRobot {
			continue
		}
		// 安全地检查连接状态
		p.Mu.RLock()
		conn := p.ConnWrap
		p.Mu.RUnlock()
		if conn == nil || !conn.IsConnected() {
			delIndex = append(delIndex, i)
		}
	}

	r.PlayerMu.RUnlock()

	if len(delIndex) <= 0 {
		return nil, false
	}

	var delId []string
	r.CheckInMultiStatusDo([]RoomState{StateWaiting, StatePrepare}, func() error {
		r.PlayerMu.Lock()
		for _, delIndex := range delIndex {
			delId = append(delId, r.Players[delIndex].ID)
			r.Players[delIndex] = nil
		}
		r.PlayerMu.Unlock()
		return nil
	})
	return delId, true
}

// 包含机器人
func (r *QZNNRoom) GetStartGamePlayerCount(includeOb bool) int {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
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
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.ID == userID {
			return p, true
		}
	}
	return nil, false
}

func (r *QZNNRoom) AddPlayer(p *Player) (int, error) {
	r.PlayerMu.RLock()
	// 检查玩家是否已在房间
	for seatNum, existingPlayer := range r.Players {
		if existingPlayer != nil && existingPlayer.ID == p.ID {
			r.PlayerMu.RUnlock()
			return seatNum, nil
		}
	}
	r.PlayerMu.RUnlock()
	bIsObState := r.CheckPlayerIsOb()

	emptySeat := -1
	countExistPlayerNum := 0
	r.PlayerMu.RLock()
	for i, pl := range r.Players {
		if pl != nil {
			countExistPlayerNum++
		} else if emptySeat == -1 {
			emptySeat = i
		}
	}
	if countExistPlayerNum >= cap(r.Players) || emptySeat == -1 {
		r.PlayerMu.RUnlock()
		return 0, comm.NewMyError("房间已满")
	}
	r.PlayerMu.RUnlock()

	p.Mu.Lock()
	p.SeatNum = emptySeat
	p.IsOb = bIsObState
	p.Mu.Unlock()

	r.PlayerMu.Lock()
	r.Players[emptySeat] = p
	r.PlayerMu.Unlock()

	r.Broadcast(comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: PushPlayJoin,
		Data: PushPlayerJoinStruct{
			Room:   r,
			UserId: p.ID}})
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

func (r *QZNNRoom) Broadcast(msg interface{}) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil {
			r.PushPlayer(p, msg)
		}
	}
}

func (r *QZNNRoom) PushPlayer(p *Player, msg interface{}) {
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

func (r *QZNNRoom) BroadcastWithPlayer(getMsg func(*Player) interface{}) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		p.Mu.RLock()
		conn := p.ConnWrap
		msg := getMsg(p) // 在 player 锁保护下调用 getMsg
		p.Mu.RUnlock()

		if conn != nil && conn.IsConnected() {
			_ = conn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) BroadcastExclude(msg interface{}, excludeId string) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.ID != excludeId {
			r.PushPlayer(p, msg)
		}
	}
}

func (r *QZNNRoom) interuptStateLeftTicker(state RoomState) {
	// 倒计时由 driverLogicTick 驱动，这里只需将剩余时间置为0即可打断等待
	r.StateMu.Lock()
	defer r.StateMu.Unlock()
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
		r.StateMu.RLock()
		left := r.StateLeftSec
		r.StateMu.RUnlock()

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

	r.PlayerMu.Lock()
	for i, pl := range r.Players {
		if pl != nil && pl.ID == userId {
			r.Players[i] = nil
			r.PlayerMu.Unlock()
			return true
		}
	}
	r.PlayerMu.Unlock()
	return false
}

func (r *QZNNRoom) GetActivePlayers(filter func(*Player) bool) []*Player {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()

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
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()

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
	// 1. 洗牌
	r.Deck = rand.Perm(52)

	// 2. 发牌逻辑
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		if p.IsOb {
			continue
		}
		p.ResetGameData()
		// 决定输赢概率 (目标牛几)
		targetScore := GetArithmetic().DecideOutcome(p.ID, 0)
		r.TargetResults[p.ID] = targetScore

		// 尝试从剩余牌堆中寻找符合目标分数的牌
		foundCards := GetCardsByNiu(r.Deck, targetScore)
		rand.Shuffle(len(foundCards), func(i, j int) {
			foundCards[i], foundCards[j] = foundCards[j], foundCards[i]
		})
		if foundCards != nil {
			p.Cards = foundCards
			// 从牌堆中移除这些牌
			r.Deck = RemoveCardsFromDeck(r.Deck, foundCards)
		} else {
			// 兜底：如果找不到符合条件的牌（概率极低），直接发牌堆顶端的5张
			if len(r.Deck) >= 5 {
				p.Cards = make([]int, 5)
				copy(p.Cards, r.Deck[:5])
				r.Deck = r.Deck[5:]
			} else {
				// 极端情况：牌不够了（理论上不应发生，除非人数过多）
				//p.Cards = []int{0, 1, 2, 3, 4} // 错误保护
				panic("")
			}
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
			r.StateMu.RLock()
			hasDeadline := !r.StateDeadline.IsZero()
			r.StateMu.RUnlock()
			if hasDeadline {
				r.UpdateStateLeftSec()
				// logrus.WithFields(logrus.Fields{
				// 	"room_id":         r.ID,
				// 	"stateLeftSecNew": r.StateLeftSec,
				// }).Info("QZNNRoom-LeftSec-Changed")
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
	if leaveIds, isLeave := r.kickOffByWsDisconnect(); isLeave {
		r.Broadcast(comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayLeave,
			Data:     PushPlayerLeaveStruct{UserIds: leaveIds, Room: r}})
	}
	//reset ob data
	r.ResetOb()
	//todo::check balance >= min balance

	countExistPlayerNum := r.GetPlayerCount()
	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if countExistPlayerNum >= 2 {
		r.SetStatus([]RoomState{StateWaiting}, StatePrepare, SecStatePrepareSec)
	}
}

func (r *QZNNRoom) tickPrepare() {
	if leaveIds, isLeave := r.kickOffByWsDisconnect(); isLeave {
		r.Broadcast(comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayLeave,
			Data:     PushPlayerLeaveStruct{UserIds: leaveIds, Room: r}})
	}
	// 倒计时等待开始
	countExistPlayerNum := r.GetPlayerCount()
	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if countExistPlayerNum < 2 {
		if r.SetStatus([]RoomState{StatePrepare}, StateWaiting, 0) {
			return
		}
	}

	//make sure players Ok
	if r.GetStartGamePlayerCount(false) >= 2 {
		r.StateMu.RLock()
		if r.StateLeftSec <= 0 {
			r.StateMu.RUnlock()
			go r.StartGame()
		} else {
			r.StateMu.RUnlock()
		}
	} else {
		//还是有掉线的，再等
		if r.SetStatus([]RoomState{StatePrepare}, StateWaiting, 0) {
			return
		}
	}
}

func (r *QZNNRoom) tickBanking() {
	//查看是否都已经抢庄或者明确不抢，player.CallMult -1 是没有任何操作
	// Fix: 避免直接在 GetActivePlayers 回调中读取 p.CallMult 导致的数据竞争
	// 客户端消息协程可能正在修改 p.CallMult，需要加 p.Mu 锁
	activePlayers := r.GetActivePlayers(nil)
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
	activePlayers := r.GetActivePlayers(nil)
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
}

func (r *QZNNRoom) tickShowCard() {
	//查看是否都已经下注
	activePlayers := r.GetActivePlayers(nil)
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
	r.StateMu.RLock()
	switch r.State {
	case StateWaiting:
		r.StateMu.RUnlock()
		r.tickWaiting()
	case StatePrepare:
		r.StateMu.RUnlock()
		r.tickPrepare()
	case StatePreCard:
		r.StateMu.RUnlock()
		// 预发牌状态
	case StateBanking:
		r.StateMu.RUnlock()
		// 抢庄状态
		r.tickBanking()
	case StateBetting:
		r.StateMu.RUnlock()
		// 下注状态
		r.tickBetting()
	case StateDealing:
		r.StateMu.RUnlock()
	// 发牌补牌状态
	case StateShowCard:
		r.StateMu.RUnlock()
		r.tickShowCard()
	case StateSettling:
		r.StateMu.RUnlock()
		// 结算状态
	default:
		r.StateMu.RUnlock()
	}
}

func (r *QZNNRoom) StartGame() {
	if !r.SetStatus([]RoomState{StatePrepare}, StateStartGame, SecStateGameStart) {
		return
	}
	r.GameID = fmt.Sprintf("%d_%s", time.Now().Unix(), r.ID)

	//保底的检查，用户能不能玩，至少2个有效用户，不够要再踢回waiting
	activePlayer := r.GetActivePlayers(nil)
	if len(activePlayer) < 2 {
		logrus.WithField("!", nil).WithField("roomId", r.ID).Error("InvalidPlayerCountForGame")
		r.SetStatus([]RoomState{StateStartGame}, StateWaiting, 0)
		//不判断set status 成功与否，强行return，保护数据
		return
	}
	//检查是否有重复id在游戏内
	allPlayers := r.GetPlayers()
	playerSet := make(map[string]*Player, 5)
	for _, p := range allPlayers {
		if p != nil {
			if _, ok := playerSet[p.ID]; ok {
				//有相同id用户
				logrus.WithField("!", nil).WithField("roomId", r.ID).Error("InvalidPlayerCountForGame")
				r.SetStatus([]RoomState{StateStartGame}, StateWaiting, 0)
				return
			}
		}
	}

	//准备牌堆并发牌
	r.prepareDeck()
	r.WaitStateLeftTicker()

	if BankerTypeNoLook != r.Config.BankerType {
		//预发牌
		if !r.SetStatus([]RoomState{StateStartGame}, StatePreCard, 0) {
			logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-preGiveCards")
			return
		}
		//预先发牌动画，看3s后
		r.WaitSleep(time.Second * SecStatePrecard)

	}
	//抢庄
	if !r.SetStatus([]RoomState{StateStartGame, StatePreCard}, StateBanking, SecStateCallBanking) {
		logrus.WithField("roomId", r.ID).Error("QZNNRoom-StatusChange-Fail-callBanker")
		return
	}

	//开始抢,等倒计时
	r.WaitStateLeftTicker()

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

	// 3. 确定庄家：从候选人中随机选取 (若只有1人，结果也是确定的)
	if len(candidates) > 0 {
		banker := candidates[rand.Intn(len(candidates))]
		r.SetBankerId(banker.ID)
		if banker.CallMult <= 0 {
			banker.CallMult = r.Config.BankerMult[0]
		}
	}

	// 4. 如果是随机产生的庄家（多人同倍数 或 无人抢庄），播放定庄动画
	if bRandomBanker {
		r.SetStatus([]RoomState{StateBanking}, StateRandomBank, 0)
		r.WaitSleep(time.Second * SecStateBankingRandom)
	}

	r.SetStatus([]RoomState{StateBanking, StateRandomBank}, StateBankerConfirm, 0)

	r.WaitSleep(time.Second * SecStateConfirmBanking)

	//非庄家投注
	if !r.SetStatus([]RoomState{StateBankerConfirm}, StateBetting, SecStateBeting) {
		return
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

	//补牌到5张，不看牌发5张，看3补2，看4
	if !r.SetStatus([]RoomState{StateBetting}, StateDealing, 0) {
		return
	}

	r.WaitSleep(time.Second * SecStateDealing)

	if !r.SetStatus([]RoomState{StateDealing}, StateShowCard, SecStateShowCard) {
		return
	}
	r.WaitStateLeftTicker()

	//计算牛牛，分配balance
	//查找banker
	var bankerPlayer *Player
	for _, p := range activePlayer {
		p.CardResult = CalcNiu(p.Cards)
		if p.ID == r.BankerID {
			bankerPlayer = p
		}
	}
	if bankerPlayer == nil {
		logrus.WithField("gameId", r.GameID).WithField("bankerId", r.BankerID).Error("QZNNRoom-BankerInvalid")
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
	var totalBankerPay int64 = 0  // 庄家需要赔付的总额
	var totalBankerGain int64 = 0 // 庄家从输家那里赢来的总额

	baseBet := r.Config.BaseBet

	for _, p := range activePlayer {
		if p.ID == r.BankerID {
			continue
		}
		isPlayerWin := CompareCards(p.CardResult, bankerPlayer.CardResult)

		if isPlayerWin {
			// 闲家赢：底注 * 庄倍 * 闲倍 * 闲家牌型倍数
			winAmount := baseBet * bankerMult * p.BetMult * p.CardResult.Mult
			playerWins = append(playerWins, WinRecord{PlayerID: p.ID, Amount: winAmount})
			totalBankerPay += winAmount
		} else {
			// 庄家赢：底注 * 庄倍 * 闲倍 * 庄家牌型倍数
			loseAmount := baseBet * bankerMult * p.BetMult * bankerPlayer.CardResult.Mult
			// 输家输的钱不能超过自己的余额
			if loseAmount > p.Balance {
				loseAmount = p.Balance
			}
			p.BalanceChange -= loseAmount
			totalBankerGain += loseAmount
		}
	}

	// 2. 计算庄家赔付能力
	// 庄家现有资金 + 本局赢来的钱
	bankerCapacity := bankerPlayer.Balance + totalBankerGain

	// 3. 结算闲家赢钱（考虑庄家破产）
	if totalBankerPay > bankerCapacity {
		// 庄家不够赔，按比例赔付
		ratio := float64(bankerCapacity) / float64(totalBankerPay)
		for _, rec := range playerWins {
			p, ok := r.GetPlayerByID(rec.PlayerID)
			if ok {
				realWin := int64(math.Round(float64(rec.Amount) * ratio))
				p.BalanceChange += realWin
			}
		}
		// 庄家输光所有（余额+赢来的）
		bankerPlayer.BalanceChange = totalBankerGain - bankerCapacity
	} else {
		// 庄家够赔
		for _, rec := range playerWins {
			p, ok := r.GetPlayerByID(rec.PlayerID)
			if ok {
				p.BalanceChange += rec.Amount
			}
		}
		bankerPlayer.BalanceChange = totalBankerGain - totalBankerPay
	}

	// 4. 扣税 (只扣赢家的)
	for _, p := range activePlayer {
		if p.BalanceChange > 0 {
			tax := int64(math.Round(float64(p.BalanceChange) * TaxRate))
			p.BalanceChange -= tax
		}
	}

	//结算状态
	if !r.SetStatus([]RoomState{StateShowCard}, StateSettling, 0) {
		//todo:: log detail for recovery data
		return
	}

	type qznnGameData struct {
		Room *QZNNRoom
	}
	roomBytes, _ := json.Marshal(qznnGameData{Room: r})
	//产生对局记录
	nGameRecordId, err := modelClient.InsertGameRecord(&modelClient.ModelGameRecord{
		GameId:   r.GameID,
		GameData: string(roomBytes),
	})
	if err != nil {
		//todo:: just log do no break logic
	}

	settle := modelClient.GameSettletruct{RoomId: r.ID, GameRecordId: nGameRecordId}
	for _, p := range activePlayer {
		settle.Players = append(settle.Players, modelClient.UserSettingStruct{
			UserId:        p.ID,
			ChangeBalance: p.BalanceChange,
		})
	}
	//
	modelUsers, err := modelClient.UpdateUserSetting(&settle)
	if err != nil {
		//todo:: log very detail for recovery user data
		return
	}

	for _, modelU := range modelUsers {
		for _, player := range activePlayer {
			//用最新数据更新balance
			if player.ID == modelU.UserId {
				//检查内存player 的balance和最终数据库的差异
				if player.Balance+player.Balance != modelU.BalanceLock {
					//todo:: log
				}
				//最终以数据库的数据为准
				player.Balance = modelU.BalanceLock
				break
			}
		}
	}

	//客户端播放结算动画
	r.WaitSleep(time.Second * SecStateSetting)

	//清理数据
	r.ResetGameData()
	//检查在线用户
	playerCount := r.GetStartGamePlayerCount(true)
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
				r.PushPlayer(p, comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: znet.PushRouter,
					Data: znet.PushRouterStruct{
						Router:  znet.Lobby,
						Message: "余额不足,离开房间"}})
			}
		}
	}

	r.SetStatus([]RoomState{StateSettling, RoomState("")}, nextState, prepareSec)
}
