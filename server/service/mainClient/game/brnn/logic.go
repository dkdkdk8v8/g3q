package brnn

import (
	"math/rand"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/nn"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	AreaTian  = 0
	AreaDi    = 1
	AreaXuan  = 2
	AreaHuang = 3
)

// GetAreaName 获取区域名称，用于日志或前端显示
func GetAreaName(area int) string {
	switch area {
	case AreaTian:
		return "天"
	case AreaDi:
		return "地"
	case AreaXuan:
		return "玄"
	case AreaHuang:
		return "黄"
	default:
		return "未知"
	}
}

// StartGame 百人牛牛游戏开始入口
func StartGame(r *game.Room) {
	r.Mu.Lock()
	r.State = game.StateBetting
	r.BRNNBets = make(map[int]map[string]int64)
	for i := 0; i < 4; i++ {
		r.BRNNBets[i] = make(map[string]int64)
	}
	// 初始化牌堆
	r.Deck = make([]int, 52)
	for i := 0; i < 52; i++ {
		r.Deck[i] = i
	}
	rand.Shuffle(len(r.Deck), func(i, j int) { r.Deck[i], r.Deck[j] = r.Deck[j], r.Deck[i] })
	r.Mu.Unlock()

	// 广播开始下注
	r.Broadcast(comm.Response{
		Cmd: "brnn.start_bet",
		Data: gin.H{
			"time": 15, // 15秒下注时间
		},
	})

	// 开启定时同步下注总额 (每秒广播一次，减少网络压力)
	ticker := time.NewTicker(time.Second)
	go func() {
		for {
			select {
			case <-ticker.C:
				r.Mu.Lock()
				if r.State != game.StateBetting {
					r.Mu.Unlock()
					return
				}
				summary := getBetSummary(r)
				r.Mu.Unlock()
				r.Broadcast(comm.Response{Cmd: "brnn.bet_summary", Data: summary})
			}
		}
	}()

	// 开启下注倒计时
	r.Timer = time.AfterFunc(15*time.Second, func() {
		ticker.Stop()
		Settle(r)
	})
}

// HandleBet 处理玩家下注
func HandleBet(r *game.Room, userID string, area int, amount int64) {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	if r.State != game.StateBetting {
		return
	}

	if area < AreaTian || area > AreaHuang {
		return
	}

	// TODO: 此处应检查玩家余额是否足够 (通常需要按最大赔率预扣，例如 amount * 10)
	// if player.Gold < amount * 10 { return }

	r.BRNNBets[area][userID] += amount
	r.TotalBet += amount

	// 仅给当前玩家返回下注成功响应，全场总额由上面的 Ticker 统一广播
	if p, ok := r.Players[userID]; ok {
		p.Conn.WriteJSON(comm.Response{
			Cmd:  "brnn.bet_res",
			Data: gin.H{"area": area, "amount": amount, "area_total": getAreaTotal(r, area)},
		})
	}
}

// Settle 结算逻辑
func Settle(r *game.Room) {
	r.Mu.Lock()
	r.State = game.StateSettle
	r.Mu.Unlock()

	// 1. 抽取5手牌（庄家 + 4个区域）
	hands := make([][]int, 5)
	results := make([]game.CardResult, 5)

	for i := 0; i < 5; i++ {
		hands[i] = r.Deck[i*5 : (i+1)*5]
		results[i] = nn.CalcNiu(hands[i])
	}

	bankerRes := results[4] // 假设最后一手是庄家
	areaResults := results[0:4]

	// 2. 库存干预 (参考 arithmetic.go)
	// 如果库存不足，尝试让庄家拿最大牌
	am := game.GetArithmetic()
	if am.BalanceGold < 0 {
		maxIdx := 4
		for i := 0; i < 4; i++ {
			if nn.CompareCards(results[i], results[maxIdx]) {
				maxIdx = i
			}
		}
		// 交换庄家牌
		results[4], results[maxIdx] = results[maxIdx], results[4]
		hands[4], hands[maxIdx] = hands[maxIdx], hands[4]
		bankerRes = results[4]
	}

	// 3. 计算输赢
	type AreaSettle struct {
		AreaID int             `json:"area_id"`
		Name   string          `json:"name"`
		IsWin  bool            `json:"is_win"`
		Niu    game.CardResult `json:"niu"`
		Cards  []int           `json:"cards"`
	}
	settleData := make(map[int]AreaSettle)
	var totalSystemWin int64
	playerGains := make(map[string]int64) // 记录每个玩家的本局盈亏

	for i := AreaTian; i <= AreaHuang; i++ {
		isAreaWin := nn.CompareCards(areaResults[i], bankerRes)
		settleData[i] = AreaSettle{
			AreaID: i,
			Name:   GetAreaName(i),
			IsWin:  isAreaWin,
			Niu:    areaResults[i],
			Cards:  hands[i],
		}

		// 计算该区域所有玩家的盈亏
		for uid, bet := range r.BRNNBets[i] {
			var gain int64
			if isAreaWin {
				gain = bet * int64(areaResults[i].Mult)
				totalSystemWin -= gain // 玩家赢，系统亏
			} else {
				gain = -bet * int64(bankerRes.Mult)
				totalSystemWin -= gain // 玩家输，系统赢
			}
			playerGains[uid] += gain
		}
	}

	// 4. 更新库存
	am.UpdatePools(r.TotalBet)
	am.BalanceGold += totalSystemWin

	// 4.5 更新玩家余额 (持久化到数据库/Redis)
	for uid, gain := range playerGains {
		// TODO: 调用数据库接口更新玩家金币: UpdateUserGold(uid, gain)
		_ = uid
		println(gain)
	}

	// 5. 广播结算结果
	r.Broadcast(comm.Response{
		Cmd: "brnn.settle_res",
		Data: gin.H{
			"banker": gin.H{
				"niu":   bankerRes,
				"cards": hands[4],
			},
			"areas":      settleData,
			"user_gains": playerGains, // 广播给所有玩家看大奖，或者根据 UID 私发
		},
	})

	// 6. 清理并准备下一局
	r.Mu.Lock()
	r.TotalBet = 0
	r.Mu.Unlock()

	time.AfterFunc(10*time.Second, func() {
		StartGame(r)
	})
}

// 辅助函数：获取特定区域总下注
func getAreaTotal(r *game.Room, area int) int64 {
	var total int64
	for _, amt := range r.BRNNBets[area] {
		total += amt
	}
	return total
}

// 辅助函数：获取所有区域下注汇总
func getBetSummary(r *game.Room) map[int]int64 {
	summary := make(map[int]int64)
	for i := AreaTian; i <= AreaHuang; i++ {
		summary[i] = getAreaTotal(r, i)
	}
	return summary
}
