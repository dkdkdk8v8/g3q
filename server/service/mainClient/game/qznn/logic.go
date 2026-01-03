package qznn

import (
	"math/rand"
	"service/comm"
	"sort"
	"time"

	"github.com/sirupsen/logrus"
)

func NewRoom(id string) *QZNNRoom {
	nRoom := &QZNNRoom{
		ID:            id,
		Players:       make([]*Player, 5),
		State:         StateWaiting,
		TargetResults: make(map[string]int, 5),
		BankerID:      "",
		Deck:          []int{},
		driverGo:      make(chan struct{}),
		CreateAt:      time.Now(),
	}
	go nRoom.drvierLogicTick()
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

func (r *QZNNRoom) SetStatus(state RoomState, stateLeftSec int) bool {
	r.StateMu.Lock()
	if r.State == state {
		r.StateMu.Unlock()
		logrus.WithFields(logrus.Fields{
			"room_id": r.ID,
			"state":   state,
		}).Info("QZNNRoom-SetStatus-Ignored-SameState")
		return false
	}
	oldState := r.State
	r.State = state
	r.StateLeftSec = stateLeftSec
	r.StateMu.Unlock()
	logrus.WithFields(logrus.Fields{
		"room_id":        r.ID,
		"old_state":      oldState,
		"new_state":      state,
		"state_left_sec": stateLeftSec,
	}).Info("QZNNRoom-SetStatus-Changed")
	if stateLeftSec > 0 {
		go r.leftSecDecrease(stateLeftSec)
	}
	if stateLeftSec == 0 {
		r.interuptStateLeftTicker(true)
	}
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushChangeState,
			Data: PushChangeStateStruct{
				Room:         r.GetClientRoom(p.ID == r.BankerID),
				State:        state,
				StateLeftSec: stateLeftSec}}
	})
	return true
}

func (r *QZNNRoom) leftSecDecrease(leftSec int) {
	r.interuptStateLeftTicker(false)
	r.StateLeftSecTicker = time.NewTicker(time.Second)
	defer r.StateLeftSecTicker.Stop()

	for i := 0; i < leftSec; i++ {
		<-r.StateLeftSecTicker.C
		r.StateMu.Lock()
		oldLeft := r.StateLeftSec
		r.StateLeftSec--
		if r.StateLeftSec < 0 {
			r.StateLeftSec = 0
		}
		r.StateMu.Unlock()

		logrus.WithFields(logrus.Fields{
			"room_id":         r.ID,
			"stateLeftSecOld": oldLeft,
			"stateLeftSecNew": r.StateLeftSec,
		}).Info("QZNNRoom-LeftSec-Changed")
	}
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
func (r *QZNNRoom) KickOffByWsDisconnect() ([]string, bool) {
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
		if p.ConnWrap.WsConn == nil {
			delIndex = append(delIndex, i)
		}
	}
	r.PlayerMu.RUnlock()

	if len(delIndex) <= 0 {
		return nil, false
	}

	var delId []string
	r.PlayerMu.Lock()
	for _, delIndex := range delIndex {
		delId = append(delId, r.Players[delIndex].ID)
		r.Players[delIndex] = nil
	}
	r.PlayerMu.Unlock()
	return delId, true
}

// 包含机器人
func (r *QZNNRoom) GetWsOkPlayerCount() int {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	count := 0
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		if p.IsOb {
			continue
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

	if r.CheckPlayerIsOb() {
		p.Mu.Lock()
		p.IsOb = true
		p.Mu.Unlock()
	}

	r.PlayerMu.Lock()

	// 检查玩家是否已在房间
	for seatNum, existingPlayer := range r.Players {
		if existingPlayer != nil && existingPlayer.ID == p.ID {
			r.PlayerMu.Unlock()
			return seatNum, nil
		}
	}

	// 寻找空位
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
		r.PlayerMu.Unlock()
		return 0, comm.NewMyError(500001, "房间已满")
	}
	p.SeatNum = emptySeat
	r.Players[emptySeat] = p
	countExistPlayerNum++
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

func (r *QZNNRoom) Broadcast(msg interface{}) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.ConnWrap != nil && p.ConnWrap.WsConn != nil {
			_ = p.ConnWrap.WsConn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) BroadcastWithPlayer(getMsg func(*Player) interface{}) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.ConnWrap != nil && p.ConnWrap.WsConn != nil {
			msg := getMsg(p)
			_ = p.ConnWrap.WsConn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) BroadcastExclude(msg interface{}, excludeId string) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p == nil || p.ID == excludeId {
			continue
		}
		if p.ConnWrap != nil && p.ConnWrap.WsConn != nil {
			_ = p.ConnWrap.WsConn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) interuptStateLeftTicker(bResetLeft bool) {
	r.StateMu.Lock()
	defer r.StateMu.Unlock()
	if bResetLeft {
		r.StateLeftSec = 0
	}
	if r.StateLeftSecTicker != nil {
		r.StateLeftSecTicker.Stop()
		r.StateLeftSecTicker = nil
	}
}

func (r *QZNNRoom) WaitSleep(wait time.Duration) {
	time.Sleep(wait)
}

func (r *QZNNRoom) WaitStateLeftTicker() {
	<-r.StateLeftSecTicker.C
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

func (r *QZNNRoom) ReconnectEnterRoom(userId string) {
	p, ok := r.GetPlayerByID(userId)
	if ok {
		if p != nil && p.ConnWrap != nil && p.ConnWrap.WsConn != nil {
			_ = p.ConnWrap.WsConn.WriteJSON(comm.PushData{
				Cmd: PushNewConnectEnterRoom,
				Data: PushNewConnectEnterRoomStruct{
					Room: r.GetClientRoom(p.ID == r.BankerID)}})
		}
	}
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
		p.reset()
		// 决定输赢概率 (目标牛几)
		targetScore := GetArithmetic().DecideOutcome(p.ID, 0)
		r.TargetResults[p.ID] = targetScore

		// 尝试从剩余牌堆中寻找符合目标分数的牌
		foundCards := GetCardsByNiu(r.Deck, targetScore)

		if foundCards != nil {
			p.Cards = foundCards
			// 从牌堆中移除这些牌
			RemoveCardsFromDeck(r.Deck, foundCards)
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

func (r *QZNNRoom) drvierLogicTick() {
	driverTicker := time.NewTicker(time.Millisecond * 200)
	defer driverTicker.Stop()
	for {
		select {
		case <-r.driverGo:
			return
		case <-driverTicker.C:
			switch r.State {
			case StateWaiting:
				if r.OnBotAction != nil {
					r.OnBotAction(r)
				}
				r.tickWaiting()

			case StatePrepare:
				if r.OnBotAction != nil {
					r.OnBotAction(r)
				}
				r.tickPrepare()
			}
		}
	}
}

func (r *QZNNRoom) tickWaiting() {
	if leaveIds, isLeave := r.KickOffByWsDisconnect(); isLeave {
		r.Broadcast(comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayLeave,
			Data:     PushPlayerLeaveStruct{UserIds: leaveIds, Room: r}})
	}

	countExistPlayerNum := r.GetPlayerCount()
	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if countExistPlayerNum >= 2 {
		r.SetStatus(StatePrepare, StateWaiting2StartSec)
	}
}

func (r *QZNNRoom) tickPrepare() {
	if leaveIds, isLeave := r.KickOffByWsDisconnect(); isLeave {
		r.Broadcast(comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayLeave,
			Data:     PushPlayerLeaveStruct{UserIds: leaveIds, Room: r}})
	}
	// 倒计时等待开始
	countExistPlayerNum := r.GetPlayerCount()
	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if countExistPlayerNum < 2 {
		if r.SetStatus(StateWaiting, 0) {
			return
		}
	}

	//make sure players Ok
	if r.GetWsOkPlayerCount() >= 2 {
		if r.StateLeftSec <= 0 {
			go r.StartGame()
		}
	} else {
		//还是有掉线的，再等
		if r.SetStatus(StateWaiting, 0) {
			return
		}
	}
}

func (r *QZNNRoom) tickBanking() {
	//查看是否都已经抢庄或者明确不抢，player.CallMult -1 是没有任何操作
	unconfirmed := r.GetActivePlayers(func(p *Player) bool {
		return p.CallMult == -1
	})
	if len(unconfirmed) == 0 {
		r.interuptStateLeftTicker(true)
	}
}

func (r *QZNNRoom) tickBetting() {
	//查看是否都已经下注
	unconfirmed := r.GetActivePlayers(func(p *Player) bool {
		return p.BetMult == -1
	})
	if len(unconfirmed) == 0 {
		r.interuptStateLeftTicker(true)
	}
}

func (r *QZNNRoom) logicTick() {

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
	case StateDealing:
		// 发牌补牌状态
	case StateSettling:
		// 结算状态
	}
}

func (r *QZNNRoom) StartGame() {
	//protect status check
	if !(r.CheckStatus(StateWaiting) || r.CheckStatus(StatePrepare)) {
		return
	}

	//准备牌堆并发牌
	r.prepareDeck()

	if BankerTypeNoLook != r.Config.BankerType {
		//预发牌
		if !r.SetStatus(StatePreCard, 0) {
			logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-preGiveCards")
			return
		}

		//预先发牌动画，看3s后
		r.WaitSleep(3 * time.Second)
	}

	//抢庄
	if !r.SetStatus(StateBanking, 10) {
		logrus.WithField("roomId", r.ID).Error("QZNNRoom-StatusChange-Fail-callBanker")
		return
	}

	//开始抢,等倒计时
	r.WaitStateLeftTicker()

	// 查看是否已经有人抢庄
	allCallPlayer := r.GetActivePlayers(func(p *Player) bool {
		return p.CallMult >= 0
	})

	//查看抢庄的用户id，查找最大的抢庄倍数，如果抢庄倍数一样的，根据用户带入金额大的获取庄家，并且设置房间的BankerID
	if len(allCallPlayer) > 0 {

		sort.Slice(allCallPlayer, func(i, j int) bool {
			if allCallPlayer[i].CallMult == allCallPlayer[j].CallMult {
				return allCallPlayer[i].Balance > allCallPlayer[j].Balance
			}
			return allCallPlayer[i].CallMult > allCallPlayer[j].CallMult
		})

		bankerPlayer := allCallPlayer[0]
		r.SetBankerId(bankerPlayer.ID)

	} else {
		//没人抢庄,系统随机分配庄家
		r.SetStatus(StateRandomBank, 2)

		candidates := r.GetActivePlayers(func(p *Player) bool {
			return p.CallMult == -1
		})
		bankderId := candidates[rand.Intn(len(candidates))].ID
		r.SetBankerId(bankderId)
		r.WaitStateLeftTicker()
	}

	r.SetStatus(StateBankerConfirm, 0)

	//非庄家投注
	if !r.SetStatus(StateBetting, 10) {
		logrus.WithField("roomId", r.ID).Error("QZNNRoom-StatusChange-Fail-betting")
		return
	}

	//开始投注10s
	r.WaitSleep(10 * time.Second)

	//补牌到5张，不看牌发5张，看3补2，看4
	if !r.SetStatus(StateDealing, 10) {
		logrus.WithField("roomId", r.ID).Error("QZNNRoom-StatusChange-Fail-setting")
		return
	}

	//等待客户端播放补牌动画
	time.Sleep(time.Second * 2)

	r.WaitSleep(5 * time.Second)
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushChangeState,
			Data: PushChangeStateStruct{
				Room:  r.GetClientRoom(!p.IsShow && p.ID == r.BankerID),
				State: StateShowCard}}
	})

	//结算状态
	if !r.SetStatus(StateSettling, 0) {
		logrus.WithField("roomId", r.ID).Error("QZNNRoom-StatusChange-Fail-setting")
		return
	}

	//客户端播放结算动画
	time.Sleep(time.Second * 2)

	//结算状态
	if !r.SetStatus(StateWaiting, 0) {
		logrus.WithField("roomId", r.ID).Error("QZNNRoom-StatusChange-Fail-waiting")
		return
	}

	//计算牛牛，分配balance
	results := make(map[string]CardResult)
	for _, p := range r.Players {
		results[p.ID] = CalcNiu(p.Cards)
	}
	bankerRes := results[r.BankerID]

	// 修复：防止庄家中途异常消失导致 Panic
	bankerMult := int64(1)
	if banker, ok := r.GetPlayerByID(r.BankerID); ok {
		bankerMult = int64(banker.CallMult)
	}

	if bankerMult <= 0 {
		bankerMult = 1
	}
	activePlayer := r.GetActivePlayers(nil)
	bankerPlayer, ok := r.GetPlayerByID(r.BankerID)
	if !ok {
		logrus.WithField("roomId", r.ID).WithField("bankerId", r.BankerID).Error("QZNNRoom-BankerInvalid")
		return
	}

	//todo 判断够不够balance
	const TaxRate = 0.05 // 5% 税率
	for _, p := range activePlayer {
		if p.ID == r.BankerID {
			continue
		}
		playerRes := results[p.ID]
		isPlayerWin := CompareCards(playerRes, bankerRes)
		baseBet := r.Config.BaseBet
		var balance int64
		if isPlayerWin {
			balance = baseBet * bankerMult * p.BetMult * playerRes.Mult
			// 闲家赢，扣税
			realScore := int64(float64(balance) * (1 - TaxRate))
			p.BalanceChange += realScore
			bankerPlayer.BalanceChange -= balance
		} else {
			balance = baseBet * bankerMult * p.BetMult * bankerRes.Mult
			p.BalanceChange -= balance
			// 庄家赢，扣税
			realScore := int64(float64(balance) * (1 - TaxRate))
			bankerPlayer.BalanceChange += realScore
		}
	}

	for _, p := range activePlayer {
		p.Mu.Lock()
		p.Balance += p.BalanceChange
		p.Mu.Unlock()
	}

	r.Broadcast(comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: PushChangeState,
		Data: PushChangeStateStruct{
			Room:  r,
			State: StateSettling}})

	time.Sleep(time.Second * 2)
	//清理数据
	r.reset()

	//

	r.Broadcast(comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: PushChangeState,
		Data: PushChangeStateStruct{
			Room:  r,
			State: StateWaiting}})
}
