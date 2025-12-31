package nn

import (
	"math/rand"
	"service/comm"
	"service/mainClient/game"
	"time"
)

const (
	StateCalling  = 1
	StateBetting  = 2
	StateDealing  = 3
	StateSettling = 4
)

func StartGame(r *game.Room) {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	if r.State != game.StateWaiting {
		return
	}

	// 1. 洗牌
	r.Deck = rand.Perm(52)

	// 2. 发牌逻辑
	for _, p := range r.Players {
		// 决定输赢概率 (目标牛几)
		targetScore := game.GetArithmetic().DecideOutcome(p.ID, 0)
		r.TargetResults[p.ID] = targetScore

		// 尝试从剩余牌堆中寻找符合目标分数的牌
		foundCards := GetCardsByNiu(r.Deck, targetScore)

		if foundCards != nil {
			p.Cards = foundCards
			// 从牌堆中移除这些牌
			r.RemoveCardsFromDeck(foundCards)
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
		var dealCards []int
		if len(p.Cards) >= 4 {
			dealCards = p.Cards[:4]
		} else {
			dealCards = p.Cards // Should not happen
		}

		_ = p.Conn.WriteJSON(comm.Response{
			Cmd:  "nn.deal_init",
			Data: map[string]interface{}{"cards": dealCards},
		})
	}

	EnterCalling(r)
}

func EnterCalling(r *game.Room) {
	r.StopTimer()
	r.State = StateCalling
	BroadcastState(r, 10)
	r.Timer = time.AfterFunc(10*time.Second, func() {
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
}

func HandleCallBanker(r *game.Room, userID string, mult int) {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.State != StateCalling {
		return
	}
	p, ok := r.Players[userID]
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

func EnterBetting(r *game.Room) {
	r.StopTimer()
	r.State = StateBetting
	maxMult := -1
	var candidates []string
	for id, p := range r.Players {
		if p.CallMult > maxMult {
			maxMult = p.CallMult
			candidates = []string{id}
		} else if p.CallMult == maxMult {
			candidates = append(candidates, id)
		}
	}
	r.BankerID = candidates[rand.Intn(len(candidates))]
	r.Broadcast(comm.Response{Cmd: "nn.banker_confirm", Data: map[string]interface{}{"banker_id": r.BankerID, "mult": maxMult}})
	BroadcastState(r, 10)
	r.Timer = time.AfterFunc(10*time.Second, func() {
		r.Mu.Lock()
		defer r.Mu.Unlock()
		if r.State == StateBetting {
			for id, p := range r.Players {
				if id != r.BankerID && p.BetMult == 0 {
					p.BetMult = 1
				}
			}
			EnterDealing(r)
		}
	})
}

func HandlePlaceBet(r *game.Room, userID string, mult int) {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.State != StateBetting || userID == r.BankerID {
		return
	}
	p, ok := r.Players[userID]
	if !ok || p.BetMult != 0 {
		return
	}
	p.BetMult = mult
	r.Broadcast(comm.Response{Cmd: "nn.place_bet_res", Data: map[string]interface{}{"uid": userID, "mult": mult}})
	allDone := true
	for id, player := range r.Players {
		if id != r.BankerID && player.BetMult == 0 {
			allDone = false
			break
		}
	}
	if allDone {
		EnterDealing(r)
	}
}

func EnterDealing(r *game.Room) {
	r.StopTimer()
	r.State = StateDealing
	for _, p := range r.Players {
		// 发送第5张牌
		lastCard := 0
		if len(p.Cards) == 5 {
			lastCard = p.Cards[4]
		}

		_ = p.Conn.WriteJSON(comm.Response{Cmd: "nn.deal_final", Data: map[string]interface{}{"card": lastCard}})
	}
	BroadcastState(r, 5)
	r.Timer = time.AfterFunc(5*time.Second, func() {
		r.Mu.Lock()
		defer r.Mu.Unlock()
		if r.State == StateDealing {
			EnterSettling(r)
		}
	})
}

func HandleShowCards(r *game.Room, userID string) {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.State != StateDealing {
		return
	}
	p, ok := r.Players[userID]
	if !ok || p.IsShow {
		return
	}
	p.IsShow = true
	r.Broadcast(comm.Response{Cmd: "nn.show_cards_res", Data: map[string]interface{}{"uid": userID, "cards": p.Cards}})
}

func EnterSettling(r *game.Room) {
	r.StopTimer()
	r.State = StateSettling
	results := make(map[string]game.CardResult)
	for id, p := range r.Players {
		results[id] = CalcNiu(p.Cards)
	}
	bankerRes := results[r.BankerID]
	bankerMult := r.Players[r.BankerID].CallMult
	if bankerMult <= 0 {
		bankerMult = 1
	}
	playerScores := make(map[string]int)
	for id := range r.Players {
		playerScores[id] = 0
	}

	const TaxRate = 0.05 // 5% 税率
	for id, p := range r.Players {
		if id == r.BankerID {
			continue
		}
		playerRes := results[id]
		isPlayerWin := CompareCards(playerRes, bankerRes)
		baseScore := 1
		var score int
		if isPlayerWin {
			score = baseScore * bankerMult * p.BetMult * playerRes.Mult
			// 闲家赢，扣税
			realScore := int(float64(score) * (1 - TaxRate))
			playerScores[id] += realScore
			playerScores[r.BankerID] -= score
		} else {
			score = baseScore * bankerMult * p.BetMult * bankerRes.Mult
			playerScores[id] -= score
			// 庄家赢，扣税
			realScore := int(float64(score) * (1 - TaxRate))
			playerScores[r.BankerID] += realScore
		}
	}
	r.Broadcast(comm.Response{Cmd: "nn.settle", Data: map[string]interface{}{"scores": playerScores, "results": results, "banker": r.BankerID}})
	r.Timer = time.AfterFunc(5*time.Second, func() {
		r.Mu.Lock()
		defer r.Mu.Unlock()
		r.State = game.StateWaiting
		for _, p := range r.Players {
			p.Cards = nil
			p.CallMult = -1
			p.BetMult = 0
			p.IsShow = false
		}
		if len(r.Players) >= r.MaxPlayers {
			StartGame(r)
		}
	})
}

func BroadcastState(r *game.Room, timeout int) {
	r.Broadcast(comm.Response{Cmd: "nn.state_change", Data: map[string]interface{}{"state": r.State, "timeout": timeout, "room_id": r.ID}})
}
