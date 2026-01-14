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
	"service/mainClient/game/znet"
	"service/modelClient"
	"slices"
	"strings"
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
	logrus.WithFields(logrus.Fields{
		"roomId":  r.ID,
		"old":     oldState,
		"new":     newState,
		"leftSec": stateLeftSec,
	}).Info("StatuChanged")
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
	type delHolder struct {
		index int
		id    string
	}
	var delIndex []delHolder

	for i, p := range r.Players {
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
			delIndex = append(delIndex, delHolder{index: i, id: p.ID})
		}
	}

	if len(delIndex) <= 0 {
		return nil, false
	}

	var delId []string
	if slices.Contains([]RoomState{StateWaiting, StatePrepare}, r.State) {
		for _, delIndex := range delIndex {
			// 再次检查防止并发修改导致空指针或误删
			if r.Players[delIndex.index] != nil && delIndex.id == r.Players[delIndex.index].ID {
				delId = append(delId, r.Players[delIndex.index].ID)
				r.Players[delIndex.index] = nil
			}
		}
	}
	return delId, true
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
			r.Players[i] = nil
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
		// 注意：这里持有 RoomMu，然后获取 p.Mu (在 ResetGameData 内部)，符合 Room -> Player 的锁序
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
			p.Mu.Lock()
			p.Cards = foundCards
			p.Mu.Unlock()
			// 从牌堆中移除这些牌
			r.Deck = RemoveCardsFromDeck(r.Deck, foundCards)
		} else {
			// 兜底：如果找不到符合条件的牌（概率极低），直接发牌堆顶端的5张
			if len(r.Deck) >= 5 {
				p.Mu.Lock()
				p.Cards = make([]int, 5)
				copy(p.Cards, r.Deck[:5])
				p.Mu.Unlock()
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

	players := r.getPlayers()

	// 优化：每3秒检查一次用户状态，避免每200ms频繁访问数据库导致 logicTick 阻塞
	if time.Since(r.LastUserCheckTime) >= 3*time.Second {
		r.LastUserCheckTime = time.Now()
		for _, p := range players {
			//check balance_lock and game_id
			modelUser, err := modelClient.GetUserByUserId(p.ID)
			if err != nil {
				logrus.WithField("!", nil).WithField("userId", p.ID).WithError(err).Error("GetUserByUserId-Fail")
				continue // 遇到错误跳过当前用户，不要直接 return 导致其他人无法检查
			}
			bKiffOffPlayer := false
			kiffOffMsg := ""
			if modelUser.GameId != "" {
				logrus.WithField("userId", p.ID).WithField("gameId", modelUser.GameId).WithField(
					"balance", modelUser.Balance).WithField("balance_lock", modelUser.BalanceLock).Error("userGameIdInvalid")
				bKiffOffPlayer = true
				kiffOffMsg = "还有未计算游戏,稍等重新进房"
			}

			if modelUser.Balance != p.Balance {
				logrus.WithField("userId", p.ID).WithField(
					"balance", modelUser.Balance).WithField("balance_lock", modelUser.BalanceLock).Error("userBalanceInvalid")
				bKiffOffPlayer = true
				kiffOffMsg = "正在计算钱包,稍等重新进房"
			}

			if p.Balance < r.Config.MinBalance {
				logrus.WithField("userId", p.ID).WithField(
					"balance", modelUser.Balance).WithField("balance_lock", modelUser.BalanceLock).Info("userBalanceNotEnough")
				bKiffOffPlayer = true
				kiffOffMsg = "余额不足,离开房间"
			}

			if bKiffOffPlayer && r.leave(p.ID) {
				leaveIds = append(leaveIds, p.ID)
				r.PushPlayer(p, comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: znet.PushRouter,
					Data: znet.PushRouterStruct{
						Router:  znet.Lobby,
						Message: kiffOffMsg}})
			}
		}
	}
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
	if len(players) >= 2 {
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
	countExistPlayerNum := r.getPlayerCount()
	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if countExistPlayerNum < 2 {
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
	logrus.WithField("gameId", r.GameID).WithField("roomId", r.ID).Info("GameStart")

	//保底的检查，用户能不能玩，至少2个有效用户，不够要再踢回waiting
	activePlayer := r.GetActivePlayers(nil)
	var activePlayerIds []string
	for _, p := range activePlayer {
		activePlayerIds = append(activePlayerIds, p.ID)
	}
	logrus.WithField("gameId", r.GameID).WithField("roomId", r.ID).WithField("players", activePlayerIds).Info("GameStart-ActivePlayers")

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

	//锁用户的balance
	for _, p := range activePlayer {
		modelUser, err := modelClient.GameLockUserBalance(p.ID, r.GameID, r.Config.MinBalance)
		if err != nil {
			//有用户的金额不够锁住,尝试踢出用户
			logrus.WithField("!", nil).WithField("userId", p.ID).WithField("gameId", r.GameID).WithError(err).Error("InvalidPlayerLockBal")
			r.SetStatus([]RoomState{StateStartGame}, StateWaiting, 0)
			return
		}
		p.Balance = modelUser.Balance + modelUser.BalanceLock
		logrus.WithField("userId", p.ID).WithField("gameId", r.GameID).WithField(
			"balance", modelUser.Balance).WithField("balanceLock", modelUser.BalanceLock).Info("GameStart-LockBalOk")
	}

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
	logrus.WithField("gameId", r.GameID).WithField("deck_len", len(r.Deck)).WithField("players_cards", playerCardLog).Info("PrepareDeck")

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
	logrus.WithField("gameId", r.GameID).WithField("call_mults", callBankerLog).Info("CallBankerResults")

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
	logrus.WithField("gameId", r.GameID).
		WithField("candidates", candidateIds).
		WithField("is_random", bRandomBanker).
		WithField("bankerId", r.BankerID).
		Info("BankerSelection")

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
	logrus.WithField("gameId", r.GameID).WithField("bets", betLog).Info("BetResults")

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
	logrus.WithField("gameId", r.GameID).WithField("card_results", cardResultLog).Info("CardResults")

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
	logrus.WithField("gameId", r.GameID).WithField("pre_settlement", preSettleLog).Info("PreSettlement")

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

	// 4. 扣税 (只扣赢家的)
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
	logrus.WithField("gameId", r.GameID).WithField("taxes", taxLog).Info("Taxes")

	//5

	//内存预先结算
	finalBalanceChanges := logrus.Fields{}
	for _, p := range activePlayer {
		finalBalanceChanges[p.ID] = p.BalanceChange
		p.Balance += p.BalanceChange
	}
	logrus.WithField("gameId", r.GameID).WithField("final_balance_changes", finalBalanceChanges).Info("FinalBalanceChanges")

	//结算状态
	if !r.SetStatus([]RoomState{StateShowCard}, StateSettling, 0) {
		//todo:: log detail for recovery data
		logrus.WithField("gameId", r.GameID).Error("Room-StatusChange-Fail-Settling")
		return
	}

	type qznnGameData struct {
		Room *QZNNRoom
	}
	roomBytes, _ := json.Marshal(qznnGameData{Room: r})
	//产生对局记录
	nGameRecordId, err := modelClient.InsertGameRecord(&modelClient.ModelGameRecord{
		GameId:   r.GameID,
		GameName: GameName,
		GameData: string(roomBytes),
	})
	if err != nil {
		logrus.WithField("gameId", r.GameID).WithError(err).Error("InsertGameRecord-Fail")
	} else {
		logrus.WithField("gameId", r.GameID).WithField("recordId", nGameRecordId).Info("InsertGameRecord-Success")
	}

	settle := modelClient.GameSettletruct{RoomId: r.ID, GameRecordId: uint64(nGameRecordId)}
	for _, p := range activePlayer {
		insertUserRecord := true
		if p.IsRobot && !initMain.DefCtx.IsTest {
			//非测试模式下，机器人不记录对局记录
			insertUserRecord = false
		}
		settle.Players = append(settle.Players, modelClient.UserSettingStruct{
			UserId:               p.ID,
			ChangeBalance:        p.BalanceChange,
			ValidBet:             p.ValidBet,
			UserGameRecordInsert: insertUserRecord,
		})
	}
	logrus.WithField("gameId", r.GameID).WithField("settlement_data", settle).Info("PreUpdateUserSetting")

	//
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
				//检查内存player 的balance和最终数据库的差异
				if player.Balance != modelU.Balance {
					//可能外面有余额，这里和数据库有的不一样
					logrus.WithField("gameId", r.GameID).
						WithField("userId", player.ID).
						WithField("mem_balance", player.Balance).
						WithField("db_balance", modelU.Balance).
						Warn("BalanceMismatchAfterSettle")
				}
				//最终以数据库的数据为准
				player.Balance = modelU.Balance
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
				logrus.WithField("gameId", r.GameID).WithField("userId", p.ID).WithField("balance", p.Balance).Info("KickingPlayerBalanceNotEnough")
				r.PushPlayer(p, comm.PushData{
					Cmd:      comm.ServerPush,
					PushType: znet.PushRouter,
					Data: znet.PushRouterStruct{
						Router:  znet.Lobby,
						Message: "余额不足,离开房间"}})
			}
		}
	}

	logrus.WithField("gameId", r.GameID).WithField("nextState", nextState).WithField("prepareSec", prepareSec).Info("Finished")

	r.SetStatus([]RoomState{StateSettling, RoomState("")}, nextState, prepareSec)
}
