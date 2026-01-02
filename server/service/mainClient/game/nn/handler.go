package nn

import (
	"math/rand"
	"service/comm"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const (
	StateWaiting  = iota //房间等待中
	StatePrepare         //房间倒计时中，马上开始
	StatePreCard         //预先发牌
	StateBanking         //抢庄中
	StateBetting         //下注中
	StateDealing         //发牌或补牌
	StateShowCard        //展示牌
	StateSettling        //结算中
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
	r.logicTick()
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

func (r *QZNNRoom) drvierLogicTick() {
	for {
		select {
		case <-r.driverGo:
			return
		default:
			time.Sleep(time.Millisecond * 200)
			switch r.State {
			case StateWaiting:
				r.tickWaiting()

			case StatePrepare:
				r.tickPrepare()
			}
		}
	}
}

func (r *QZNNRoom) tickWaiting() {
	countExistPlayerNum := r.GetPlayerCount()
	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if countExistPlayerNum >= 2 {
		_ = r.SetStatus(StatePrepare)
		r.Broadcast(comm.Response{
			Cmd:  "nn.state_prepare",
			Data: gin.H{"room": r}})
	}
}

func (r *QZNNRoom) tickPrepare() {
	// 倒计时等待开始
	countExistPlayerNum := r.GetPlayerCount()
	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if countExistPlayerNum < 2 {
		//关闭房间倒计时
		r.StopTimer()
		_ = r.SetStatus(StateWaiting)
		//同步数据给客户端
		r.Broadcast(comm.Response{
			Cmd:  "nn.state_waiting",
			Data: gin.H{"room": r}})
	}

	//ok
	go r.StartGame()
}

func (r *QZNNRoom) tickBanking() {
	r.PlayerMu.RLock()
	//查看是否都已经抢庄或者明确不抢，player.CallMult -1 是没有任何操作，0是不抢，大于0是抢
	bAllPlayerMakeSure := true
	for _, p := range r.Players {
		if p.CallMult == -1 {
			bAllPlayerMakeSure = false
			break
		}
	}
	if bAllPlayerMakeSure {
		//提前结束倒计时
		r.PlayerMu.RUnlock()
		r.StopTimer()
		return
	}
	r.PlayerMu.RUnlock()
}

func (r *QZNNRoom) tickBetting() {
	r.PlayerMu.RLock()
	var bAllPlayerMakeSure = true
	//查看是否都已经抢庄或者明确不抢，player.BetMult -1 是没有任何操作，BetMult 是投注多少倍
	for _, p := range r.Players {
		if p.BetMult == -1 {
			bAllPlayerMakeSure = false
			break
		}
	}
	if bAllPlayerMakeSure {
		//提前结束倒计时
		r.PlayerMu.RUnlock()
		r.StopTimer()
		return
	}
	r.PlayerMu.RUnlock()
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
	if !(r.CheckStatus(StateWaiting) || r.CheckStatus(StatePrepare)) {
		return
	}
	go CheckRobotActions(r)
	//准备牌堆并发牌
	r.prepareDeck()

	if BankerTypeNoLook != r.Config.BankerType {
		//预发牌
		if !r.SetStatus(StatePreCard) {
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
			Cmd:  "nn.state_banking",
			Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})

	//开始抢10s
	r.WaitTimer(10)

	// 查看是否已经有人抢庄
	var allCallPlayer []*Player
	r.PlayerMu.RLock()
	for _, p := range r.Players {
		if p.CallMult >= 0 {
			allCallPlayer = append(allCallPlayer, p)
		}
	}
	r.PlayerMu.RUnlock()

	//查看抢庄的用户id，查找最大的抢庄倍数，如果抢庄倍数一样的，根据用户带入金额大的获取庄家，并且设置房间的BankerID
	if len(allCallPlayer) > 0 {
		sort.Slice(allCallPlayer, func(i, j int) bool {
			if allCallPlayer[i].CallMult == allCallPlayer[j].CallMult {
				return allCallPlayer[i].Balance > allCallPlayer[j].Balance
			}
			return allCallPlayer[i].CallMult > allCallPlayer[j].CallMult
		})

		bankerPlayer := allCallPlayer[0]
		r.BankerID = bankerPlayer.ID
	} else {
		//没人抢庄,系统随机分配庄家
		var candidates []string
		for _, p := range r.Players {
			if p.CallMult == -1 {
				candidates = append(candidates, p.ID)
			}
		}
		r.BankerID = candidates[rand.Intn(len(candidates))]
	}
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  "nn.banker_confirm",
			Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})

	//非庄家投注
	if !r.SetStatus(StateBetting) {
		logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-betting")
		return
	}
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  "nn.state_betting",
			Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})

	//开始投注10s
	r.WaitTimer(10)

	//补牌到5张，不看牌发5张，看3补2，看4
	if !r.SetStatus(StateDealing) {
		logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-setting")
		return
	}

	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  "nn.state_dealing",
			Data: gin.H{"room": r.GetClientRoom(5, p.ID == r.BankerID)}}
	})

	//等待客户端播放补牌动画
	time.Sleep(time.Second * 2)

	r.WaitTimer(5)
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  "nn.state_showcard",
			Data: gin.H{"room": r.GetClientRoom(5, !p.IsShow && p.ID == r.BankerID)}}
	})

	//结算状态
	if !r.SetStatus(StateSettling) {
		logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-setting")
		return
	}
	r.Broadcast(comm.Response{
		Cmd:  "nn.state_setting",
		Data: gin.H{"room": r}})

	//客户端播放结算动画
	time.Sleep(time.Second * 2)

	//结算状态
	if !r.SetStatus(StateWaiting) {
		logrus.WithField("room_id", r.ID).Error("QZNNRoom-StatusChange-Fail-waiting")
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
	playerBalance := make(map[string]int64)
	for _, player := range r.Players {
		playerBalance[player.ID] = 0
	}
	//todo 判断够不够balance
	const TaxRate = 0.05 // 5% 税率
	for _, p := range r.Players {
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
			playerBalance[p.ID] += realScore
			playerBalance[r.BankerID] -= balance
		} else {
			balance = baseBet * bankerMult * p.BetMult * bankerRes.Mult
			playerBalance[p.ID] -= balance
			// 庄家赢，扣税
			realScore := int64(float64(balance) * (1 - TaxRate))
			playerBalance[r.BankerID] += realScore
		}
	}

	for userId, balance := range playerBalance {
		p, ok := r.GetPlayerByID(userId)
		if !ok {
			continue
		}
		p.Mu.Lock()
		p.Balance += balance
		p.Mu.Unlock()
	}

	r.Broadcast(comm.Response{
		Cmd:  "nn.balance_change",
		Data: gin.H{"balance": playerBalance}})

	//清理数据
	r.reset()
	r.Broadcast(comm.Response{
		Cmd:  "nn.state_waiting",
		Data: gin.H{"room": r}})
}

func HandleCallBanker(r *QZNNRoom, userID string, mult int64) {
	if r.State != StateBanking {
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p.CallMult != -1 {
		return
	}
	p.Mu.Lock()
	if p.CallMult != -1 {
		p.Mu.Unlock()
		return
	}
	p.CallMult = mult
	p.Mu.Unlock()
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  "nn.call_banker",
			Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})
	r.logicTick()
}

func HandlePlaceBet(r *QZNNRoom, userID string, mult int64) {
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
	p.Mu.Lock()
	if p.BetMult != -1 {
		p.Mu.Unlock()
		return
	}
	p.BetMult = mult
	p.Mu.Unlock()
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  "nn.call_bet",
			Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})
	r.logicTick()
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
	p.Mu.Lock()
	if p.IsShow == true {
		p.Mu.Unlock()
		return
	}
	p.IsShow = true
	p.Mu.Unlock()
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  "nn.show_card",
			Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})
	r.logicTick()

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
				HandleCallBanker(r, pid, rand.Int63n(4))
			case StateBetting:
				if pid != bankerID {
					// 随机下注倍数 (1-5)
					HandlePlaceBet(r, pid, rand.Int63n(5)+1)
				}
			case StateDealing:
				HandleShowCards(r, pid)
			}
		}(p.ID)
	}
}
