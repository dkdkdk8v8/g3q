package nn

import (
	"beego/v2/client/orm"
	"math/rand"
	"service/comm"
	"service/modelClient"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const (
	StateWaiting = iota //房间等待中
	StatePrepare        //房间倒计时中，马上开始
	StatePreCard        //预先发牌
	StateBanking        //抢庄中
	StateBetting        //下注中
	StateDealing
	StateSettling
)

const (
	StateWaiting2StartSec = 6
	StateCallingSec       = 10
	StateBettingSec       = 10
	StateDealingSec       = 5
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func HandlePlayerReady(r *QZNNRoom, userID string) {
	if !r.CheckStatus(StateWaiting) {
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p.IsReady {
		return
	}
	p.IsReady = true
	r.Broadcast(comm.Response{Cmd: "nn.player_ready", Data: map[string]interface{}{"uid": userID}})
	allReady := true

	r.PlayerMu.RLock()
	for _, player := range r.Players {
		if player != nil && !player.IsReady {
			allReady = false
			break
		}
	}
	r.PlayerMu.RUnlock()
	if allReady {
		r.StartGame()
	}
}

func (r *QZNNRoom) prepareDeck() {
	// 1. 洗牌
	r.Deck = rand.Perm(52)

	// 2. 发牌逻辑
	for _, p := range r.Players {
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

// func (r *QZNNRoom) drvierLogicTick() {
// 	for {
// 		time.Sleep(200 * time.Millisecond)
// 		r.logicTick()
// 	}
// }

func (r *QZNNRoom) logicTick() {

	switch r.State {
	case StateWaiting:
		countExistPlayerNum := r.GetPlayerCount()
		//加入已经有2个人在房间，可以进行倒计时开始游戏
		if countExistPlayerNum >= 2 {
			_ = r.SetStatus(StatePrepare)
			r.Broadcast(comm.Response{
				Cmd:  "nn.state_prepare",
				Data: gin.H{"room": r}})
		}

	case StatePrepare:
		// 倒计时等待开始
		countExistPlayerNum := r.GetPlayerCount()
		//加入已经有2个人在房间，可以进行倒计时开始游戏
		if countExistPlayerNum < 2 {
			_ = r.SetStatus(StateWaiting)
			r.Broadcast(comm.Response{
				Cmd:  "nn.state_waiting",
				Data: gin.H{"room": r}})
		}

	case StatePreCard:
		// 预发牌状态，无需处理
	case StateBanking:
		// 抢庄状态，无需处理
		if r.CheckAllCallDone() {
			//
		}

	case StateBetting:
		// 下注状态，无需处理
	case StateDealing:
		// 发牌状态，无需处理
	case StateSettling:
		// 结算状态，无需处理
	}
}

func (r *QZNNRoom) StartGame() {
	if !(r.CheckStatus(StateWaiting) || r.CheckStatus(StateWaitingTimer)) {
		return
	}
	go CheckRobotActions(r)
	//准备牌堆并发牌
	r.prepareDeck()

	if BankerTypeNoLook != r.Config.BankerType {
		//预发牌
		if !r.SetStatus(StatePreCards) {
			logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-preGiveCards")
		}
		r.BroadcastWithPlayer(func(p *Player) interface{} {
			return comm.Response{
				Cmd:  "nn.precard",
				Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
		})

		//预先发牌，看3s后
		r.WaitTimer(3)
	}
	//抢庄
	if !r.SetStatus(StateBanking) {
		logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-callBanker")
		return
	}
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  "nn.callbanking",
			Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})

	//开始抢10s
	r.WaitTimer(10)

	//非庄家投注
	if !r.SetStatus(StateBetting) {
		logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-betting")
		return
	}

	//开始投注10s
	r.WaitTimer(10, nil)

	EnterBetting(r)

}

func HandleCallBanker(r *QZNNRoom, userID string, mult int) {
	if r.State != StateBanking {
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p.CallMult != -1 {
		return
	}
	p.CallMult = mult
	r.Broadcast(comm.Response{Cmd: "nn.call_banker_res", Data: map[string]interface{}{"uid": userID, "mult": mult}})
	allDone := true
	for _, player := range r.Players {
		if player.CallMult == -1 {
			allDone = false
			break
		}
	}
	if allDone {
		EnterBetting(r)
	}
}

func EnterBetting(r *QZNNRoom) {
	r.State = StateBetting

	maxMult := -1
	var candidates []string
	for _, p := range r.Players {
		if p.CallMult > maxMult {
			maxMult = p.CallMult
			candidates = []string{p.ID}
		} else if p.CallMult == maxMult {
			candidates = append(candidates, p.ID)
		}
	}
	r.BankerID = candidates[rand.Intn(len(candidates))]
	r.Broadcast(comm.Response{Cmd: "nn.banker_confirm", Data: map[string]interface{}{"banker_id": r.BankerID, "mult": maxMult}})
	BroadcastState(r, 10)
	r.StartTimer(10, func() {
		r.Mu.Lock()
		defer r.Mu.Unlock()
		if r.State == StateBetting {
			for _, p := range r.Players {
				if p.ID != r.BankerID && p.BetMult == 0 {
					p.BetMult = 1
				}
			}
			EnterDealing(r)
		}
	})
	CheckRobotActions(r)
}

func HandlePlaceBet(r *QZNNRoom, userID string, mult int) {
	if !r.CheckStatus(StateBetting) {
		logrus.WithField("room_id", r.ID).WithField("user_id", userID).Error("HandlePlaceBet_InvalidState")
		return
	}
	if r.CheckIsBanker(userID) {
		logrus.WithField("room_id", r.ID).WithField("user_id", userID).Error("HandlePlaceBet_BanerCannotBet")
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p == nil || p.BetMult != 0 {
		return
	}
	p.BetMult = mult
	r.Broadcast(comm.Response{Cmd: "nn.place_bet_res", Data: map[string]interface{}{"uid": userID, "mult": mult}})
	allDone := true
	for _, player := range r.Players {
		if player.ID != r.BankerID && player.BetMult == 0 {
			allDone = false
			break
		}
	}
	if allDone {
		EnterDealing(r)
	}
}

func EnterDealing(r *QZNNRoom) {
	r.StopTimer()
	r.State = StateDealing
	for _, p := range r.Players {
		// 发送第5张牌
		lastCard := 0
		if len(p.Cards) == 5 {
			lastCard = p.Cards[4]
		}

		if p.Conn != nil {
			_ = p.Conn.WriteJSON(comm.Response{Cmd: "nn.deal_final", Data: map[string]interface{}{"card": lastCard}})
		}
	}
	BroadcastState(r, 5)
	r.StartTimer(5, func() {
		r.Mu.Lock()
		defer r.Mu.Unlock()
		if r.State == StateDealing {
			EnterSettling(r)
		}
	})
}

func HandleShowCards(r *QZNNRoom, userID string) {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.State != StateDealing {
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p.IsShow {
		return
	}
	p.IsShow = true
	r.Broadcast(comm.Response{Cmd: "nn.show_cards_res", Data: map[string]interface{}{"uid": userID, "cards": p.Cards}})
}

func EnterSettling(r *QZNNRoom) {
	r.StopTimer()
	r.State = StateSettling
	results := make(map[string]CardResult)
	for _, p := range r.Players {
		results[p.ID] = CalcNiu(p.Cards)
	}
	bankerRes := results[r.BankerID]

	// 修复：防止庄家中途异常消失导致 Panic
	bankerMult := 1
	if banker, ok := r.GetPlayerByID(r.BankerID); ok {
		bankerMult = banker.CallMult
	}

	if bankerMult <= 0 {
		bankerMult = 1
	}
	playerScores := make(map[string]int)
	for _, player := range r.Players {
		playerScores[player.ID] = 0
	}

	const TaxRate = 0.05 // 5% 税率
	for _, p := range r.Players {
		if p.ID == r.BankerID {
			continue
		}
		playerRes := results[p.ID]
		isPlayerWin := CompareCards(playerRes, bankerRes)
		baseScore := 1
		var score int
		if isPlayerWin {
			score = baseScore * bankerMult * p.BetMult * playerRes.Mult
			// 闲家赢，扣税
			realScore := int(float64(score) * (1 - TaxRate))
			playerScores[p.ID] += realScore
			playerScores[r.BankerID] -= score
		} else {
			score = baseScore * bankerMult * p.BetMult * bankerRes.Mult
			playerScores[p.ID] -= score
			// 庄家赢，扣税
			realScore := int(float64(score) * (1 - TaxRate))
			playerScores[r.BankerID] += realScore
		}
	}
	r.Broadcast(comm.Response{Cmd: "nn.settle", Data: map[string]interface{}{"scores": playerScores, "results": results, "banker": r.BankerID}})
	r.StartTimer(5, func() {
		var leftBots []string
		var allUserIds []string
		r.Mu.Lock()

		// 仅收集真实玩家ID用于更新最后游戏时间，减轻数据库压力
		for _, p := range r.Players {
			if p.IsRobot {
				allUserIds = append(allUserIds, p.ID)
			}
		}

		// 机器人随机退出逻辑
		for seatNum, p := range r.Players {
			if p.IsRobot && rand.Intn(100) < RobotExitRate {
				leftBots = append(leftBots, p.ID)
				r.Players[seatNum] = nil
			}
		}

		if len(r.Players)-len(leftBots) < r.GetPlayerCap() {
			leftBots = nil
		}

		for _, p := range leftBots {
			r.Broadcast(comm.Response{Cmd: "nn.player_leave", Data: map[string]interface{}{"uid": p}})
		}

		r.State = StateWaiting
		for _, p := range r.Players {
			p.Cards = nil
			p.CallMult = -1
			p.BetMult = 0
			p.IsShow = false
		}
		canStart := len(r.Players) >= r.GetPlayerCap()
		r.Mu.Unlock()

		// 只有存在真实玩家时才更新数据库
		if len(allUserIds) > 0 {
			_, _ = modelClient.GetDb().QueryTable(new(modelClient.ModelUser)).
				Filter("user_id__in", allUserIds).
				Update(orm.Params{"last_played": time.Now()})
		}

		if canStart {
			r.StartGame()
		}
	})
}

func CheckRobotActions(r *QZNNRoom) {
	for _, p := range r.Players {
		if !p.IsRobot {
			continue
		}

		// 为每个机器人开启独立协程模拟思考
		go func(pid string) {
			// 随机延迟 1-3 秒
			time.Sleep(time.Duration(rand.Intn(2000)+1000) * time.Millisecond)

			r.Mu.Lock()
			state := r.State
			bankerID := r.BankerID
			r.Mu.Unlock()

			switch state {
			case StateBanking:
				// 随机抢庄倍数 (0-3)
				HandleCallBanker(r, pid, rand.Intn(4))
			case StateBetting:
				if pid != bankerID {
					// 随机下注倍数 (1-5)
					HandlePlaceBet(r, pid, rand.Intn(5)+1)
				}
			case StateDealing:
				HandleShowCards(r, pid)
			}
		}(p.ID)
	}
}

func BroadcastState(r *QZNNRoom, timeout int) {
	r.Broadcast(comm.Response{Cmd: "nn.state_change", Data: map[string]interface{}{"state": r.State, "timeout": timeout, "room_id": r.ID}})
}
