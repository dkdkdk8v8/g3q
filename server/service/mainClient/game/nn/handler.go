package nn

import (
	"beego/v2/client/orm"
	"math/rand"
	"service/comm"
	"service/modelClient"
	"time"

	"github.com/sirupsen/logrus"
)

const (
	StateWaiting  = iota //房间等待中
	StateWaitingTimer // 房间倒计时中，马上开始
	StateCalling  
	StateBetting  
	StateDealing  
	StateSettling 
)

const (
	StateWaiting2StartSec = 6
	StateCallingSec = 10
	StateBettingSec = 10
	StateDealingSec = 5
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
		StartGame(r)
	}
}

func StartGame(r *QZNNRoom) {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	if r.State != StateWaiting {
		return
	}

	// 1. 洗牌
	r.Deck = rand.Perm(52)

	// 2. 发牌逻辑
	for _, p := range r.Players {
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
				p.Cards = []int{0, 1, 2, 3, 4} // 错误保护
			}
		}

		p.CallMult = -1
		p.BetMult = 0
		p.IsShow = false

		// 发送前4张牌
		// 根据房间配置决定发送几张牌
		// BankerType: 0:不看牌(0张), 1:看3张, 2:看4张
		dealCount := 0
		if r.Config.BankerType == BankerTypeLook3 {
			dealCount = 3
		} else if r.Config.BankerType == BankerTypeLook4 {
			dealCount = 4
		}

		var dealCards []int
		if len(p.Cards) >= dealCount {
			dealCards = p.Cards[:dealCount]
		}

		if p.Conn != nil {
			_ = p.Conn.WriteJSON(comm.Response{
				Cmd:  "nn.deal_init",
				Data: map[string]interface{}{"cards": dealCards},
			})
		}
	}

	EnterCalling(r)
}

func EnterCalling(r *QZNNRoom) {
	r.StopTimer()
	r.State = StateCalling
	BroadcastState(r, 10)
	r.StartTimer(10, func() {
		r.Mu.Lock()
		defer r.Mu.Unlock()
		if r.State == StateCalling {
			for _, p := range r.Players {
				if p.CallMult == -1 {
					p.CallMult = 0
				}
			}
			EnterBetting(r)
		}
	})
	CheckRobotActions(r)
}

func HandleCallBanker(r *QZNNRoom, userID string, mult int) {
	if r.State != StateCalling {
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
	r.StopTimer()
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
	CheckRobotActions(r)
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
			StartGame(r)
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
			case StateCalling:
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
