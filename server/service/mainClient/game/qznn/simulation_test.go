package qznn

import (
	"fmt"
	"io"
	"math"
	"math/rand"
	"os"
	"strings"
	"testing"

	"service/mainClient/game/strategy"

	"github.com/sirupsen/logrus"
)

func init() {
	// 模拟测试时禁用 logrus 输出，避免大量日志刷屏
	logrus.SetOutput(io.Discard)
	// 如果需要调试某个特定场景，可以临时注释上面这行并设置：
	// logrus.SetOutput(os.Stdout)
	// logrus.SetLevel(logrus.DebugLevel)
	_ = os.Stdout // suppress unused import
}

// ============================================================================
// 模拟测试：不依赖数据库，纯内存模拟发牌+结算
// 用法：cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation -v -count=1
// ============================================================================

// SimConfig 模拟配置
type SimConfig struct {
	TotalRounds     int     // 模拟总局数
	RealPlayerCount int     // 真人玩家数量 (不含庄家位，庄家轮流做)
	RobotCount      int     // 机器人数量
	BaseBet         int64   // 底注
	BankerType      int     // 抢庄类型 (0=不看牌, 1=看3张, 2=看4张)
	InitBalance     int64   // 每个玩家初始余额
	TargetProfitRate float64 // 目标杀率
	MinTurnover     int64   // 最小流水阈值
	EnableNewbie    bool    // 是否开启新手光环
}

// SimStats 模拟统计
type SimStats struct {
	TotalRounds   int
	TotalTurnover int64 // 总流水 (所有ValidBet之和)
	TotalTax      int64 // 总税收

	// 系统视角：机器人的盈亏 = 系统的盈亏（反向）
	// 系统赢 = 真人输给机器人的 + 税收
	// 系统亏 = 机器人输给真人的
	RobotTotalWin  int64 // 机器人总赢 (税前)
	RobotTotalLose int64 // 机器人总输

	RealPlayerTotalWin  int64 // 真人总赢 (税前)
	RealPlayerTotalLose int64 // 真人总输

	// 换牌统计
	SwapAttempts  int
	SwapSuccesses int

	// 牌型分布
	NiuDistribution map[int64]int // 牌型出现次数

	// 庄家统计
	BankerWinCount  int
	BankerLoseCount int

	// 每个玩家的盈亏跟踪
	PlayerPnL map[string]int64 // 玩家最终盈亏

	// 杀率追踪（每1000局采样）
	KillRateSamples []float64
}

// SimPlayer 模拟玩家
type SimPlayer struct {
	ID        string
	IsRobot   bool
	Balance   int64
	GameCount int
	// 策略数据（模拟DB中的持久化字段）
	TotalProfit       int64 // 累计净盈亏
	PendingCompensate int64 // 待补偿
	WinningStreak     int
	LosingStreak      int
}

func TestSimulation_Basic(t *testing.T) {
	cfg := SimConfig{
		TotalRounds:      50000,
		RealPlayerCount:  2,
		RobotCount:       2,
		BaseBet:          1000,  // 10元底注
		BankerType:       0,     // 不看牌
		InitBalance:      100000, // 1000元初始
		TargetProfitRate: 0.05,
		MinTurnover:      5000000,
		EnableNewbie:     true,
	}

	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_HighStakes(t *testing.T) {
	cfg := SimConfig{
		TotalRounds:      100000,
		RealPlayerCount:  2,
		RobotCount:       2,
		BaseBet:          10000,  // 100元底注
		BankerType:       0,
		InitBalance:      500000, // 5000元初始
		TargetProfitRate: 0.05,
		MinTurnover:      5000000,
		EnableNewbie:     false,
	}

	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_Look3Mode(t *testing.T) {
	cfg := SimConfig{
		TotalRounds:      50000,
		RealPlayerCount:  2,
		RobotCount:       2,
		BaseBet:          1000,
		BankerType:       1, // 看3张
		InitBalance:      100000,
		TargetProfitRate: 0.05,
		MinTurnover:      5000000,
		EnableNewbie:     true,
	}

	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_AllReal(t *testing.T) {
	// 全真人测试：系统收益应该只来自税收
	cfg := SimConfig{
		TotalRounds:      50000,
		RealPlayerCount:  4,
		RobotCount:       0,
		BaseBet:          1000,
		BankerType:       0,
		InitBalance:      100000,
		TargetProfitRate: 0.05,
		MinTurnover:      5000000,
		EnableNewbie:     false,
	}

	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_StressTest(t *testing.T) {
	cfg := SimConfig{
		TotalRounds:      500000,
		RealPlayerCount:  2,
		RobotCount:       2,
		BaseBet:          1000,
		BankerType:       0,
		InitBalance:      1000000, // 大量初始余额，防止破产
		TargetProfitRate: 0.05,
		MinTurnover:      5000000,
		EnableNewbie:     false,
	}

	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

// runSimulation 执行模拟
func runSimulation(t *testing.T, cfg SimConfig) *SimStats {
	stats := &SimStats{
		NiuDistribution: make(map[int64]int),
		PlayerPnL:       make(map[string]int64),
	}

	totalPlayers := cfg.RealPlayerCount + cfg.RobotCount
	if totalPlayers < 2 || totalPlayers > 5 {
		t.Fatalf("玩家数必须在2-5之间, 当前: %d", totalPlayers)
	}

	// 初始化模拟玩家
	simPlayers := make([]*SimPlayer, totalPlayers)
	for i := 0; i < totalPlayers; i++ {
		isRobot := i >= cfg.RealPlayerCount
		prefix := "real"
		if isRobot {
			prefix = "robot"
		}
		simPlayers[i] = &SimPlayer{
			ID:      fmt.Sprintf("%s_%d", prefix, i),
			IsRobot: isRobot,
			Balance: cfg.InitBalance,
		}
		stats.PlayerPnL[simPlayers[i].ID] = 0
	}

	// 创建策略管理器（不依赖DB）
	strategyCfg := strategy.StrategyConfig{
		TargetProfitRate:  cfg.TargetProfitRate,
		BaseLucky:         50,
		HighRiskMult:      20,
		EnableNewbieBonus: cfg.EnableNewbie,
		MinTurnover:       cfg.MinTurnover,
	}
	mgr := strategy.NewStrategyManager(strategyCfg)

	// 房间级策略数据
	var systemProfit int64  // 系统累计盈利（真人输的+税收-真人赢的）
	var systemTurnover int64 // 系统累计流水
	userDataMap := make(map[string]*UserStrategyData)
	for _, sp := range simPlayers {
		userDataMap[sp.ID] = &UserStrategyData{
			BaseLucky: 50,
		}
	}

	// 开始模拟
	for round := 0; round < cfg.TotalRounds; round++ {
		// 检查是否有足够余额的玩家
		activePlayers := make([]*SimPlayer, 0, totalPlayers)
		for _, sp := range simPlayers {
			if sp.Balance >= cfg.BaseBet*2 { // 至少能下2倍底注
				activePlayers = append(activePlayers, sp)
			} else {
				// 余额不足，补充（模拟充值，确保模拟继续）
				sp.Balance = cfg.InitBalance
			}
		}
		if len(activePlayers) < 2 {
			t.Logf("第 %d 局：活跃玩家不足，跳过", round)
			continue
		}

		// 随机选庄家（轮流庄）
		bankerIdx := round % len(activePlayers)
		banker := activePlayers[bankerIdx]

		// 随机抢庄倍数和下注倍数
		bankerMults := []int64{1, 2, 3, 4}
		betMults := []int64{1, 5, 10, 15, 20}
		bankerMult := bankerMults[rand.Intn(len(bankerMults))]

		// 构建模拟 Room + Players
		players := make([]*Player, len(activePlayers))
		for i, sp := range activePlayers {
			p := NewPlayer()
			p.ID = sp.ID
			p.Balance = sp.Balance
			p.IsRobot = sp.IsRobot
			p.GameCount = sp.GameCount
			if i == bankerIdx {
				p.CallMult = bankerMult
				p.BetMult = -1
			} else {
				p.CallMult = -1
				p.BetMult = betMults[rand.Intn(len(betMults))]
			}
			players[i] = p
		}

		// 创建模拟房间
		room := &QZNNRoom{
			QZNNRoomData: QZNNRoomData{
				ID:       fmt.Sprintf("sim_room_%d", round),
				GameID:   fmt.Sprintf("game_%d", round),
				BankerID: banker.ID,
				Players:  make([]*Player, 5),
				Config: LobbyConfig{
					Level:      1,
					BaseBet:    cfg.BaseBet,
					BankerType: cfg.BankerType,
					BankerMult: bankerMults,
					BetMult:    betMults,
				},
			},
			Deck:          []int{},
			TargetResults: make(map[string]int, 5),
			AllIsRobot:    cfg.RobotCount == totalPlayers,
			Strategy: &RoomStrategy{
				Config:            strategyCfg,
				Manager:           mgr,
				TodayProfit:       systemProfit,
				TodayTurnover:     systemTurnover,
				YesterdayProfit:   0, // 模拟中只看今天
				YesterdayTurnover: 0,
				UserData:          userDataMap,
			},
		}

		// 放置玩家到座位
		for i, p := range players {
			if i < 5 {
				room.Players[i] = p
			}
		}

		// === 发牌 ===
		simPrepareDeck(room)

		// === 计算初始牌型 ===
		for _, p := range players {
			p.CardResult = CalcNiu(p.Cards)
			stats.NiuDistribution[p.CardResult.Niu]++
		}

		// === 策略干预：计算Lucky + 换牌 ===
		simCalculateAndAdjust(room, players, bankerIdx, strategyCfg, mgr, stats)

		// === 结算 ===
		simSettle(room, players, bankerIdx, cfg.BaseBet, stats)

		// === 更新模拟玩家数据 ===
		for i, p := range players {
			sp := activePlayers[i]
			sp.Balance = p.Balance
			sp.GameCount++

			// 更新策略数据（模拟DB持久化）
			if p.BalanceChange > 0 {
				sp.WinningStreak++
				sp.LosingStreak = 0
			} else if p.BalanceChange < 0 {
				sp.LosingStreak++
				sp.WinningStreak = 0
			}

			// 计算税前盈亏用于TotalProfit
			preTaxChange := p.BalanceChange
			if p.Tax > 0 {
				preTaxChange += p.Tax // 还原税前
			}
			sp.TotalProfit += preTaxChange

			// 更新待补偿
			sp.PendingCompensate += -p.BalanceChange
			if sp.PendingCompensate < 0 {
				sp.PendingCompensate = 0
			}

			// 同步到策略缓存
			if ud, ok := userDataMap[sp.ID]; ok {
				ud.TotalProfit = sp.TotalProfit
				ud.PendingCompensate = sp.PendingCompensate
				ud.WinningStreak = sp.WinningStreak
				ud.LosingStreak = sp.LosingStreak
			}

			stats.PlayerPnL[sp.ID] += p.BalanceChange
		}

		// 更新系统流水和盈利
		// 系统收入组成：
		//   1. 所有玩家的税收（不管真人还是机器人，税都归系统）
		//   2. 机器人的净盈亏（机器人赢=系统赢，机器人输=系统出钱）
		//      注意：机器人的BalanceChange是税后的，机器人赢的税也归系统
		//      所以机器人赢时，系统收入 = BalanceChange + Tax
		//      机器人输时，系统支出 = |BalanceChange|，但真人赢家的税归系统
		for _, p := range players {
			systemTurnover += p.ValidBet
			if p.IsRobot {
				// 机器人的盈亏直接计入系统（税后+税都是系统的）
				systemProfit += p.BalanceChange + p.Tax
			} else {
				// 真人的税归系统
				systemProfit += p.Tax
			}
		}

		// 每1000局采样杀率
		if (round+1)%1000 == 0 && systemTurnover > 0 {
			rate := float64(systemProfit) / float64(systemTurnover)
			stats.KillRateSamples = append(stats.KillRateSamples, rate)
		}

		stats.TotalRounds++
	}

	return stats
}

// simPrepareDeck 模拟洗牌发牌（不依赖锁）
func simPrepareDeck(room *QZNNRoom) {
	// 初始化 52 张牌
	deck := make([]int, 52)
	for i := 0; i < 52; i++ {
		deck[i] = i
	}
	rand.Shuffle(len(deck), func(i, j int) { deck[i], deck[j] = deck[j], deck[i] })

	// 发牌
	cardIdx := 0
	for _, p := range room.Players {
		if p == nil {
			continue
		}
		p.Cards = make([]int, PlayerCardMax)
		for j := 0; j < PlayerCardMax; j++ {
			p.Cards[j] = deck[cardIdx]
			cardIdx++
		}
	}

	// 剩余牌堆
	room.Deck = deck[cardIdx:]
}

// simCalculateAndAdjust 模拟策略计算和换牌
func simCalculateAndAdjust(room *QZNNRoom, players []*Player, bankerIdx int,
	strategyCfg strategy.StrategyConfig, mgr *strategy.StrategyManager, stats *SimStats) {

	banker := players[bankerIdx]

	// 为每个玩家计算Lucky值
	for _, p := range players {
		ud := room.Strategy.UserData[p.ID]
		if ud == nil {
			continue
		}

		// 计算总倍数
		var totalMult int64
		bankerMult := banker.CallMult
		if bankerMult <= 0 {
			bankerMult = 1
		}
		if p.ID == room.BankerID {
			totalMult = bankerMult * 5
		} else {
			myBet := p.BetMult
			if myBet <= 0 {
				myBet = 1
			}
			totalMult = bankerMult * myBet
		}

		// 构造策略上下文
		ctx := &strategy.StrategyContext{
			UserID:            p.ID,
			TotalProfit:       ud.TotalProfit,
			PendingCompensate: ud.PendingCompensate,
			BaseBet:           room.Config.BaseBet,
			TotalMult:         totalMult,
			IsRobot:           p.IsRobot,
			IsNewbie:          p.GameCount < 50,
			WinningStreak:     ud.WinningStreak,
			LosingStreak:      ud.LosingStreak,
			TurnoverTodayAndYesterday: room.Strategy.TodayTurnover + room.Strategy.YesterdayTurnover,
			KillRateToday:           0,
		}

		// 计算杀率
		targetRate := strategyCfg.TargetProfitRate
		totalTurnover := room.Strategy.TodayTurnover + room.Strategy.YesterdayTurnover
		if totalTurnover > 0 {
			yesterdayExpected := float64(room.Strategy.YesterdayTurnover) * targetRate
			yesterdayExcess := float64(room.Strategy.YesterdayProfit) - yesterdayExpected
			effectiveProfit := float64(room.Strategy.TodayProfit) + yesterdayExcess
			ctx.KillRateToday = effectiveProfit / float64(totalTurnover)
		}

		baseLucky, reasons1 := mgr.CalcBaseLucky(ctx)
		finalLucky, isHighRisk, reasons2 := mgr.ApplyRiskControl(baseLucky, ctx)

		ud.BaseLucky = baseLucky
		ud.FinalLucky = finalLucky
		ud.IsHighRisk = isHighRisk
		ud.LuckyReasons = append(reasons1, reasons2...)
	}

	// 预计算牌型
	for _, p := range players {
		p.CardResult = CalcNiu(p.Cards)
	}
	banker.CardResult = CalcNiu(banker.Cards)

	// 获取固定牌数
	fixedCount := 0
	if room.Config.BankerType == 1 {
		fixedCount = 3
	} else if room.Config.BankerType == 2 {
		fixedCount = 4
	}

	// 换牌逻辑
	for i, p := range players {
		if i == bankerIdx {
			continue
		}

		ud := room.Strategy.UserData[p.ID]
		if ud == nil {
			continue
		}

		targetLucky := ud.FinalLucky
		isHighRisk := ud.IsHighRisk

		shouldWin := false
		shouldLose := false

		if isHighRisk {
			shouldLose = true
		} else if !p.IsRobot {
			randVal := rand.Float64() * 100
			if targetLucky > 65 && randVal < targetLucky {
				shouldWin = true
			} else if targetLucky < 35 && randVal > targetLucky {
				shouldLose = true
			}
		}

		// 库存保护
		shouldProtect := false
		for _, reason := range ud.LuckyReasons {
			if strings.Contains(reason, "InventoryProtect") {
				shouldProtect = true
				break
			}
		}

		if shouldProtect {
			if !p.IsRobot {
				shouldWin = false
				shouldLose = true
			} else {
				if !banker.IsRobot {
					shouldWin = true
					shouldLose = false
				}
			}
		}

		// 执行换牌
		isCurrentlyWin := CompareCards(p.CardResult, banker.CardResult)

		if shouldWin && !isCurrentlyWin {
			stats.SwapAttempts++
			ok := room.swapCardsForTarget(p, fixedCount, func(newRes any) bool {
				if res, ok := newRes.(CardResult); ok {
					return CompareCards(res, banker.CardResult)
				}
				return false
			})
			if ok {
				stats.SwapSuccesses++
			}
		} else if shouldLose && isCurrentlyWin {
			stats.SwapAttempts++
			ok := room.swapCardsForTarget(p, fixedCount, func(newRes any) bool {
				if res, ok := newRes.(CardResult); ok {
					return CompareCards(banker.CardResult, res)
				}
				return false
			})
			if ok {
				stats.SwapSuccesses++
			}
		}
	}

	// 最终刷新牌型
	for _, p := range players {
		p.CardResult = CalcNiu(p.Cards)
	}
}

// simSettle 模拟结算（复刻 logic.go 的结算逻辑）
func simSettle(room *QZNNRoom, players []*Player, bankerIdx int, baseBet int64, stats *SimStats) {
	banker := players[bankerIdx]
	bankerMult := banker.CallMult
	if bankerMult <= 0 {
		bankerMult = 1
	}

	const TaxRate = 0.05

	type WinRecord struct {
		Idx    int
		Amount int64
	}

	var playerWins []WinRecord
	var playerLoses []WinRecord

	for i, p := range players {
		if i == bankerIdx {
			continue
		}
		isPlayerWin := CompareCards(p.CardResult, banker.CardResult)
		winAmount := baseBet * bankerMult * p.BetMult * p.CardResult.Mult
		loseAmount := baseBet * bankerMult * p.BetMult * banker.CardResult.Mult

		if isPlayerWin {
			if winAmount > p.Balance {
				winAmount = p.Balance
			}
			playerWins = append(playerWins, WinRecord{Idx: i, Amount: winAmount})
		} else {
			if loseAmount > p.Balance {
				loseAmount = p.Balance
			}
			playerLoses = append(playerLoses, WinRecord{Idx: i, Amount: loseAmount})
		}
	}

	// 输的闲家赔给庄家
	playerLoss2Banker := int64(0)
	for _, rec := range playerLoses {
		playerLoss2Banker += rec.Amount
	}

	if playerLoss2Banker > banker.Balance {
		for _, rec := range playerLoses {
			realLose := int64(math.Round(float64(rec.Amount) * float64(banker.Balance) / float64(playerLoss2Banker)))
			players[rec.Idx].BalanceChange -= realLose
			banker.BalanceChange += realLose
		}
	} else {
		for _, rec := range playerLoses {
			players[rec.Idx].BalanceChange -= rec.Amount
			banker.BalanceChange += rec.Amount
		}
	}

	// 庄家赔给赢的闲家
	bankerLoss2player := int64(0)
	for _, rec := range playerWins {
		bankerLoss2player += rec.Amount
	}

	bankerTotalFunds := banker.Balance + banker.BalanceChange
	if bankerLoss2player > bankerTotalFunds {
		totalDistributed := int64(0)
		for i, rec := range playerWins {
			var realWin int64
			if i == len(playerWins)-1 {
				realWin = bankerTotalFunds - totalDistributed
			} else {
				realWin = int64(math.Round(float64(rec.Amount) * float64(bankerTotalFunds) / float64(bankerLoss2player)))
			}
			players[rec.Idx].BalanceChange += realWin
			totalDistributed += realWin
		}
		banker.BalanceChange = -banker.Balance
	} else {
		for _, rec := range playerWins {
			players[rec.Idx].BalanceChange += rec.Amount
			banker.BalanceChange -= rec.Amount
		}
	}

	// 有效投注
	for _, p := range players {
		if p.BalanceChange < 0 {
			p.ValidBet = -p.BalanceChange
		} else {
			p.ValidBet = p.BalanceChange
		}
	}

	// 扣税
	for _, p := range players {
		if p.BalanceChange > 0 {
			tax := int64(math.Round(float64(p.BalanceChange) * TaxRate))
			p.Tax = tax
			p.BalanceChange -= tax
			stats.TotalTax += tax
		}
	}

	// 统计
	for _, p := range players {
		stats.TotalTurnover += p.ValidBet
		p.Balance += p.BalanceChange

		if p.IsRobot {
			if p.BalanceChange > 0 {
				stats.RobotTotalWin += p.BalanceChange
			} else {
				stats.RobotTotalLose += -p.BalanceChange
			}
		} else {
			if p.BalanceChange > 0 {
				stats.RealPlayerTotalWin += p.BalanceChange
			} else {
				stats.RealPlayerTotalLose += -p.BalanceChange
			}
		}
	}

	// 庄家统计
	if banker.BalanceChange > 0 {
		stats.BankerWinCount++
	} else if banker.BalanceChange < 0 {
		stats.BankerLoseCount++
	}
}

// printStats 输出统计结果
func printStats(t *testing.T, cfg SimConfig, stats *SimStats) {
	t.Log("========================================")
	t.Logf("模拟配置:")
	t.Logf("  总局数: %d", cfg.TotalRounds)
	t.Logf("  真人: %d, 机器人: %d", cfg.RealPlayerCount, cfg.RobotCount)
	t.Logf("  底注: %d, 抢庄类型: %d", cfg.BaseBet, cfg.BankerType)
	t.Logf("  目标杀率: %.2f%%", cfg.TargetProfitRate*100)
	t.Log("========================================")
	t.Logf("执行局数: %d", stats.TotalRounds)
	t.Logf("总流水: %d (%.2f 元)", stats.TotalTurnover, float64(stats.TotalTurnover)/100)
	t.Logf("总税收: %d (%.2f 元)", stats.TotalTax, float64(stats.TotalTax)/100)
	t.Log("----------------------------------------")

	// 系统盈亏计算
	// 系统收入 = 税收 + 机器人净赢
	robotNet := stats.RobotTotalWin - stats.RobotTotalLose
	systemProfit := stats.TotalTax + robotNet
	t.Logf("机器人净盈亏(税后): %d (%.2f 元)", robotNet, float64(robotNet)/100)
	t.Logf("系统总收入(税收+机器人净赢): %d (%.2f 元)", systemProfit, float64(systemProfit)/100)

	if stats.TotalTurnover > 0 {
		actualKillRate := float64(systemProfit) / float64(stats.TotalTurnover) * 100
		t.Logf("实际系统杀率: %.4f%%", actualKillRate)
		t.Logf("目标杀率: %.2f%%", cfg.TargetProfitRate*100)
	}

	t.Log("----------------------------------------")
	t.Logf("真人总赢(税后): %d (%.2f 元)", stats.RealPlayerTotalWin, float64(stats.RealPlayerTotalWin)/100)
	t.Logf("真人总输: %d (%.2f 元)", stats.RealPlayerTotalLose, float64(stats.RealPlayerTotalLose)/100)
	realNet := stats.RealPlayerTotalWin - stats.RealPlayerTotalLose
	t.Logf("真人净盈亏(税后): %d (%.2f 元)", realNet, float64(realNet)/100)

	t.Log("----------------------------------------")
	t.Logf("换牌尝试: %d, 成功: %d", stats.SwapAttempts, stats.SwapSuccesses)
	if stats.SwapAttempts > 0 {
		t.Logf("换牌成功率: %.2f%%", float64(stats.SwapSuccesses)/float64(stats.SwapAttempts)*100)
	}

	t.Log("----------------------------------------")
	t.Logf("庄家赢: %d, 庄家输: %d", stats.BankerWinCount, stats.BankerLoseCount)
	if stats.BankerWinCount+stats.BankerLoseCount > 0 {
		t.Logf("庄家胜率: %.2f%%", float64(stats.BankerWinCount)/float64(stats.BankerWinCount+stats.BankerLoseCount)*100)
	}

	t.Log("----------------------------------------")
	t.Log("牌型分布:")
	niuNames := map[int64]string{
		0: "无牛", 1: "牛1", 2: "牛2", 3: "牛3", 4: "牛4",
		5: "牛5", 6: "牛6", 7: "牛7", 8: "牛8", 9: "牛9",
		10: "牛牛", 11: "五花牛", 12: "炸弹牛", 13: "五小牛", 14: "四花牛",
	}
	totalCards := 0
	for _, v := range stats.NiuDistribution {
		totalCards += v
	}
	for niu := int64(0); niu <= 14; niu++ {
		count := stats.NiuDistribution[niu]
		if count > 0 {
			pct := float64(count) / float64(totalCards) * 100
			name := niuNames[niu]
			t.Logf("  %s: %d (%.2f%%)", name, count, pct)
		}
	}

	t.Log("----------------------------------------")
	t.Log("各玩家最终盈亏:")
	for id, pnl := range stats.PlayerPnL {
		t.Logf("  %s: %d (%.2f 元)", id, pnl, float64(pnl)/100)
	}

	// 杀率趋势
	if len(stats.KillRateSamples) > 0 {
		t.Log("----------------------------------------")
		t.Log("杀率趋势 (每1000局采样):")
		for i, rate := range stats.KillRateSamples {
			bar := ""
			barLen := int(math.Abs(rate) * 500)
			if barLen > 50 {
				barLen = 50
			}
			for j := 0; j < barLen; j++ {
				if rate >= 0 {
					bar += "+"
				} else {
					bar += "-"
				}
			}
			t.Logf("  [%5dk] %.4f%% %s", (i+1), rate*100, bar)
		}
	}

	t.Log("========================================")

	// 断言：系统不应该亏钱
	if systemProfit < 0 && cfg.RobotCount > 0 {
		t.Errorf("系统亏钱了! 系统净利润: %d (%.2f 元), 这是不可接受的！", systemProfit, float64(systemProfit)/100)
	}
}
