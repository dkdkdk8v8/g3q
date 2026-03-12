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
	TotalRounds     int   // 模拟总局数
	RealPlayerCount int   // 真人玩家数量
	RobotCount      int   // 机器人数量
	BaseBet         int64 // 底注
	BankerType      int   // 抢庄类型 (0=不看牌, 1=看3张, 2=看4张)
	InitBalance     int64 // 每个玩家初始余额
	// 玩家轮换配置
	EnableRotation   bool // 是否开启玩家轮换
	MinSessionRounds int  // 每个玩家最少玩几局
	MaxSessionRounds int  // 每个玩家最多玩几局
	// 策略参数（nil则使用默认值，可自定义任意参数跑样本）
	StrategyParams *strategy.StrategyConfig
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

	// 牌型分布（换牌前/后对比）
	NiuDistribution      map[int64]int // 换牌前自然牌型
	NiuDistributionAfter map[int64]int // 换牌后实际牌型

	// 庄家统计
	BankerWinCount  int
	BankerLoseCount int

	// 每个玩家的盈亏跟踪
	PlayerPnL map[string]int64 // 玩家最终盈亏

	// 杀率追踪（每1000局采样）
	KillRateSamples []float64

	// 单局详细日志采样
	DetailedLogs []string

	// 玩家轮换统计（每个玩家离场时记录一个session）
	SessionResults []SessionResult
}

// SessionResult 单个玩家的一次游戏会话结果
type SessionResult struct {
	PlayerID   string
	Rounds     int   // 玩了几局
	PnL        int64 // 税后盈亏
	IsNewbie   bool  // 是否新手（首次进入）
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
	// 轮换相关
	SessionRoundsLeft int   // 本次会话剩余局数（0=需要轮换）
	SessionPnL        int64 // 本次会话盈亏
	SessionRounds     int   // 本次会话已玩局数
	TotalSessions     int   // 历史会话次数（用于生成唯一ID）
}

func TestSimulation_Basic(t *testing.T) {
	cfg := SimConfig{
		TotalRounds:     50000,
		RealPlayerCount: 2,
		RobotCount:      2,
		BaseBet:         1000,
		BankerType:      0,
		InitBalance:     100000,
	}
	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_HighStakes(t *testing.T) {
	sp := strategy.DefaultStrategyConfig()
	sp.EnableNewbieBonus = false
	cfg := SimConfig{
		TotalRounds:     100000,
		RealPlayerCount: 2,
		RobotCount:      2,
		BaseBet:         10000,
		BankerType:      0,
		InitBalance:     500000,
		StrategyParams:  &sp,
	}
	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_Look3Mode(t *testing.T) {
	cfg := SimConfig{
		TotalRounds:     50000,
		RealPlayerCount: 2,
		RobotCount:      2,
		BaseBet:         1000,
		BankerType:      1,
		InitBalance:     100000,
	}
	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_AllReal(t *testing.T) {
	sp := strategy.DefaultStrategyConfig()
	sp.EnableNewbieBonus = false
	cfg := SimConfig{
		TotalRounds:     50000,
		RealPlayerCount: 4,
		RobotCount:      0,
		BaseBet:         1000,
		BankerType:      0,
		InitBalance:     100000,
		StrategyParams:  &sp,
	}
	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_Rotation(t *testing.T) {
	cfg := SimConfig{
		TotalRounds:      50000,
		RealPlayerCount:  2,
		RobotCount:       2,
		BaseBet:          1000,
		BankerType:       0,
		InitBalance:      100000,
		EnableRotation:   true,
		MinSessionRounds: 10,
		MaxSessionRounds: 100,
	}
	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_RotationLongSession(t *testing.T) {
	cfg := SimConfig{
		TotalRounds:      50000,
		RealPlayerCount:  2,
		RobotCount:       2,
		BaseBet:          1000,
		BankerType:       0,
		InitBalance:      100000,
		EnableRotation:   true,
		MinSessionRounds: 50,
		MaxSessionRounds: 500,
	}
	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

func TestSimulation_StressTest(t *testing.T) {
	sp := strategy.DefaultStrategyConfig()
	sp.EnableNewbieBonus = false
	cfg := SimConfig{
		TotalRounds:     500000,
		RealPlayerCount: 2,
		RobotCount:      2,
		BaseBet:         1000,
		BankerType:      0,
		InitBalance:     1000000,
		StrategyParams:  &sp,
	}
	stats := runSimulation(t, cfg)
	printStats(t, cfg, stats)
}

// runSimulation 执行模拟
func runSimulation(t *testing.T, cfg SimConfig) *SimStats {
	stats := &SimStats{
		NiuDistribution:      make(map[int64]int),
		NiuDistributionAfter: make(map[int64]int),
		PlayerPnL:            make(map[string]int64),
	}

	totalPlayers := cfg.RealPlayerCount + cfg.RobotCount
	if totalPlayers < 2 || totalPlayers > 5 {
		t.Fatalf("玩家数必须在2-5之间, 当前: %d", totalPlayers)
	}

	// 玩家ID计数器（轮换时生成新ID）
	realPlayerSeq := 0
	robotPlayerSeq := 0

	// 创建新真人玩家的辅助函数
	newRealPlayer := func() *SimPlayer {
		realPlayerSeq++
		id := fmt.Sprintf("real_%d", realPlayerSeq)
		sp := &SimPlayer{
			ID:      id,
			IsRobot: false,
			Balance: cfg.InitBalance,
		}
		if cfg.EnableRotation {
			sp.SessionRoundsLeft = cfg.MinSessionRounds + rand.Intn(cfg.MaxSessionRounds-cfg.MinSessionRounds+1)
		}
		stats.PlayerPnL[id] = 0
		return sp
	}
	// 创建新机器人的辅助函数
	newRobotPlayer := func() *SimPlayer {
		robotPlayerSeq++
		id := fmt.Sprintf("robot_%d", robotPlayerSeq)
		sp := &SimPlayer{
			ID:      id,
			IsRobot: true,
			Balance: cfg.InitBalance,
		}
		stats.PlayerPnL[id] = 0
		return sp
	}

	// 初始化模拟玩家
	simPlayers := make([]*SimPlayer, totalPlayers)
	for i := 0; i < totalPlayers; i++ {
		if i < cfg.RealPlayerCount {
			simPlayers[i] = newRealPlayer()
		} else {
			simPlayers[i] = newRobotPlayer()
		}
	}

	// 策略参数：优先使用自定义配置，否则使用默认值
	strategyCfg := strategy.DefaultStrategyConfig()
	if cfg.StrategyParams != nil {
		strategyCfg = *cfg.StrategyParams
	}
	mgr := strategy.NewStrategyManager(strategyCfg)

	// 房间级策略数据
	var systemProfit int64  // 系统累计盈利（真人输的+税收-真人赢的）
	var systemTurnover int64 // 系统累计流水
	userDataMap := make(map[string]*UserStrategyData)
	for _, sp := range simPlayers {
		userDataMap[sp.ID] = &UserStrategyData{
			BaseLucky:           50,
			SessionStartBalance: sp.Balance,
		}
	}

	// 开始模拟
	for round := 0; round < cfg.TotalRounds; round++ {
		// 检查是否有足够余额的玩家
		activePlayers := make([]*SimPlayer, 0, totalPlayers)
		for i, sp := range simPlayers {
			if sp.Balance >= cfg.BaseBet*2 { // 至少能下2倍底注
				activePlayers = append(activePlayers, sp)
			} else if cfg.EnableRotation && !sp.IsRobot {
				// 轮换模式：余额不足 = 输光离场，记录会话并换新人
				stats.SessionResults = append(stats.SessionResults, SessionResult{
					PlayerID: sp.ID,
					Rounds:   sp.SessionRounds,
					PnL:      sp.SessionPnL,
					IsNewbie: sp.TotalSessions == 0,
				})
				delete(userDataMap, sp.ID)
				newSp := newRealPlayer()
				simPlayers[i] = newSp
				userDataMap[newSp.ID] = &UserStrategyData{BaseLucky: 50, SessionStartBalance: newSp.Balance}
				activePlayers = append(activePlayers, newSp)
			} else {
				// 非轮换模式：补充余额（模拟充值，确保模拟继续）
				sp.Balance = cfg.InitBalance
				activePlayers = append(activePlayers, sp)
			}
		}
		if len(activePlayers) < 2 {
			t.Logf("第 %d 局：活跃玩家不足，跳过", round)
			continue
		}

		// 随机选庄家（轮流庄）
		bankerIdx := round % len(activePlayers)
		banker := activePlayers[bankerIdx]

		// 抢庄倍数：加权分布，偏向高倍（模拟竞价抢庄取最高）
		bankerMults := []int64{1, 2, 3, 4}
		betMults := []int64{1, 5, 10, 15, 20}
		// 权重: 1x=10%, 2x=20%, 3x=30%, 4x=40%（竞价取最高，实际偏高倍）
		bankerMultWeights := []int{10, 20, 30, 40}
		bankerMult := weightedChoice(bankerMults, bankerMultWeights)

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

		// === 换牌后牌型分布统计 ===
		for _, p := range players {
			stats.NiuDistributionAfter[p.CardResult.Niu]++
		}

		// === 单局详细日志采样（前3局 + 每10000局采样1局）===
		if round < 3 || (round > 0 && round%10000 == 0) {
			if len(stats.DetailedLogs) < 20 { // 最多保留20条
				log := fmt.Sprintf("--- 第%d局 ---\n", round+1)
				log += fmt.Sprintf("  庄家: %s (倍数:%d)\n", banker.ID, bankerMult)
				for i, p := range players {
					role := "闲"
					if i == bankerIdx {
						role = "庄"
					}
					ud := userDataMap[p.ID]
					luckyInfo := ""
					if ud != nil {
						luckyInfo = fmt.Sprintf(" Lucky:%.0f→%.0f", ud.BaseLucky, ud.FinalLucky)
						if ud.IsHighRisk {
							luckyInfo += "(高风险)"
						}
					}
					log += fmt.Sprintf("  [%s] %s 牌型:牛%d(倍率%d) 下注倍数:%d%s\n",
						role, p.ID, p.CardResult.Niu, p.CardResult.Mult, p.BetMult, luckyInfo)
				}
				stats.DetailedLogs = append(stats.DetailedLogs, log)
			}
		}

		// === 结算 ===
		simSettle(room, players, bankerIdx, cfg.BaseBet, stats, strategyCfg)

		// === 补充详细日志的结算结果 ===
		if round < 3 || (round > 0 && round%10000 == 0) {
			if len(stats.DetailedLogs) > 0 {
				idx := len(stats.DetailedLogs) - 1
				settle := "  结算:"
				for _, p := range players {
					settle += fmt.Sprintf(" %s:%+d(税%d)", p.ID, p.BalanceChange, p.Tax)
				}
				stats.DetailedLogs[idx] += settle + "\n"
			}
		}

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
				// 更新会话亏损比例
				if ud.SessionStartBalance > 0 && p.Balance < ud.SessionStartBalance {
					ud.SessionLossRate = float64(ud.SessionStartBalance-p.Balance) / float64(ud.SessionStartBalance)
				} else {
					ud.SessionLossRate = 0
				}
			}

			stats.PlayerPnL[sp.ID] += p.BalanceChange

			// 轮换：更新会话统计
			if cfg.EnableRotation && !sp.IsRobot {
				sp.SessionPnL += p.BalanceChange
				sp.SessionRounds++
				sp.SessionRoundsLeft--
			}
		}

		// === 玩家轮换检查 ===
		if cfg.EnableRotation {
			for i, sp := range simPlayers {
				if sp.IsRobot || sp.SessionRoundsLeft > 0 {
					continue
				}
				// 会话结束，记录结果
				stats.SessionResults = append(stats.SessionResults, SessionResult{
					PlayerID: sp.ID,
					Rounds:   sp.SessionRounds,
					PnL:      sp.SessionPnL,
					IsNewbie: sp.TotalSessions == 0,
				})
				// 清理旧玩家的策略缓存
				delete(userDataMap, sp.ID)
				// 新玩家入座（全新的人，策略数据重置）
				newSp := newRealPlayer()
				simPlayers[i] = newSp
				userDataMap[newSp.ID] = &UserStrategyData{
					BaseLucky:           50,
					SessionStartBalance: newSp.Balance,
				}
			}
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

// weightedChoice 加权随机选择
func weightedChoice(choices []int64, weights []int) int64 {
	total := 0
	for _, w := range weights {
		total += w
	}
	r := rand.Intn(total)
	cumulative := 0
	for i, w := range weights {
		cumulative += w
		if r < cumulative {
			return choices[i]
		}
	}
	return choices[len(choices)-1]
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
			IsNewbie:          p.GameCount < strategyCfg.NewbieTier2MaxGames+20,
			GameCount:         p.GameCount,
			WinningStreak:     ud.WinningStreak,
			LosingStreak:      ud.LosingStreak,
			SessionLossRate:   ud.SessionLossRate,
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
		} else {
			// Lucky干预对所有玩家生效（包括机器人）
			randVal := rand.Float64() * 100
			if targetLucky > strategyCfg.LuckyWinThreshold && randVal < targetLucky {
				shouldWin = true
			} else if targetLucky < strategyCfg.LuckyLoseThreshold && randVal > targetLucky {
				shouldLose = true
			}
		}

		// 库存保护 & 库存释放
		shouldProtect := false
		shouldRelease := false
		for _, reason := range ud.LuckyReasons {
			if strings.Contains(reason, "InventoryProtect") {
				shouldProtect = true
			}
			if strings.Contains(reason, "InventoryRelease") {
				shouldRelease = true
			}
		}

		if shouldProtect {
			if p.IsRobot {
				// 库存保护时机器人尝试赢：系统回血
				shouldWin = true
				shouldLose = false
			} else {
				// 真人：高风险强制输，普通情况取消赢的干预
				if isHighRisk {
					shouldWin = false
					shouldLose = true
				} else {
					shouldWin = false
				}
			}
		}

		if shouldRelease {
			if !p.IsRobot {
				// 库存释放（杀率过高）：给真人更多赢的机会
				shouldWin = true
				shouldLose = false
			} else {
				// 库存释放时机器人不干预，保持自然
				shouldWin = false
				shouldLose = false
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
func simSettle(room *QZNNRoom, players []*Player, bankerIdx int, baseBet int64, stats *SimStats, strategyCfg strategy.StrategyConfig) {
	banker := players[bankerIdx]
	bankerMult := banker.CallMult
	if bankerMult <= 0 {
		bankerMult = 1
	}

	TaxRate := strategyCfg.TaxRate

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
			// 单局亏损封顶
			maxLoss := int64(math.Round(float64(p.Balance) * strategyCfg.MaxLossRate))
			if maxLoss < baseBet {
				maxLoss = baseBet
			}
			if loseAmount > maxLoss {
				loseAmount = maxLoss
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
func printStats(t *testing.T, cfg SimConfig, stats *SimStats, strategyCfg ...strategy.StrategyConfig) {
	// 获取策略参数（优先传入，否则从cfg.StrategyParams，最后用默认值）
	sCfg := strategy.DefaultStrategyConfig()
	if len(strategyCfg) > 0 {
		sCfg = strategyCfg[0]
	} else if cfg.StrategyParams != nil {
		sCfg = *cfg.StrategyParams
	}
	t.Log("========================================")
	t.Logf("模拟配置:")
	t.Logf("  总局数: %d", cfg.TotalRounds)
	t.Logf("  真人: %d, 机器人: %d", cfg.RealPlayerCount, cfg.RobotCount)
	t.Logf("  底注: %d, 抢庄类型: %d", cfg.BaseBet, cfg.BankerType)
	t.Logf("  目标杀率: %.2f%%", sCfg.TargetProfitRate*100)
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
		t.Logf("目标杀率: %.2f%%", sCfg.TargetProfitRate*100)
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
	niuNames := map[int64]string{
		0: "无牛", 1: "牛1", 2: "牛2", 3: "牛3", 4: "牛4",
		5: "牛5", 6: "牛6", 7: "牛7", 8: "牛8", 9: "牛9",
		10: "牛牛", 11: "五花牛", 12: "炸弹牛", 13: "五小牛", 14: "四花牛",
	}

	// 换牌前后牌型对比
	totalCardsBefore := 0
	for _, v := range stats.NiuDistribution {
		totalCardsBefore += v
	}
	totalCardsAfter := 0
	for _, v := range stats.NiuDistributionAfter {
		totalCardsAfter += v
	}

	t.Log("牌型分布 (换牌前 → 换牌后):")
	for niu := int64(0); niu <= 14; niu++ {
		before := stats.NiuDistribution[niu]
		after := stats.NiuDistributionAfter[niu]
		if before > 0 || after > 0 {
			pctBefore := float64(before) / float64(totalCardsBefore) * 100
			pctAfter := float64(0)
			if totalCardsAfter > 0 {
				pctAfter = float64(after) / float64(totalCardsAfter) * 100
			}
			diff := pctAfter - pctBefore
			sign := "+"
			if diff < 0 {
				sign = ""
			}
			name := niuNames[niu]
			t.Logf("  %s: %.2f%% → %.2f%% (%s%.2f%%)", name, pctBefore, pctAfter, sign, diff)
		}
	}

	t.Log("----------------------------------------")
	t.Log("各玩家最终盈亏:")
	for id, pnl := range stats.PlayerPnL {
		t.Logf("  %s: %d (%.2f 元)", id, pnl, float64(pnl)/100)
	}

	// 杀率趋势（只显示首尾和关键节点，避免刷屏）
	if len(stats.KillRateSamples) > 0 {
		t.Log("----------------------------------------")
		t.Log("杀率趋势 (每1000局采样, 显示关键节点):")
		for i, rate := range stats.KillRateSamples {
			// 显示前5个、后5个、每10个采样点
			showIdx := i < 5 || i >= len(stats.KillRateSamples)-5 || i%10 == 0
			if !showIdx {
				continue
			}
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

	// 单局详细日志
	if len(stats.DetailedLogs) > 0 {
		t.Log("----------------------------------------")
		t.Log("单局详细日志采样:")
		for _, log := range stats.DetailedLogs {
			t.Log(log)
		}
	}

	// 玩家会话统计（轮换模式）
	if len(stats.SessionResults) > 0 {
		t.Log("----------------------------------------")
		t.Log("玩家会话统计（轮换模式）:")
		totalSessions := len(stats.SessionResults)
		winSessions := 0
		loseSessions := 0
		evenSessions := 0
		var winTotalPnL, loseTotalPnL int64
		var winTotalRounds, loseTotalRounds int
		// 按局数分组统计
		type bracket struct {
			label    string
			minR     int
			maxR     int
			total    int
			wins     int
		}
		brackets := []bracket{
			{"10-20局", 10, 20, 0, 0},
			{"21-50局", 21, 50, 0, 0},
			{"51-100局", 51, 100, 0, 0},
			{"101+局", 101, 99999, 0, 0},
		}
		for _, sr := range stats.SessionResults {
			if sr.PnL > 0 {
				winSessions++
				winTotalPnL += sr.PnL
				winTotalRounds += sr.Rounds
			} else if sr.PnL < 0 {
				loseSessions++
				loseTotalPnL += sr.PnL
				loseTotalRounds += sr.Rounds
			} else {
				evenSessions++
			}
			for i := range brackets {
				if sr.Rounds >= brackets[i].minR && sr.Rounds <= brackets[i].maxR {
					brackets[i].total++
					if sr.PnL > 0 {
						brackets[i].wins++
					}
					break
				}
			}
		}
		winRate := float64(winSessions) / float64(totalSessions) * 100
		t.Logf("  总会话数: %d", totalSessions)
		t.Logf("  赢的会话: %d (%.1f%%), 平均赢: %.2f元, 平均局数: %d",
			winSessions, winRate,
			func() float64 {
				if winSessions == 0 {
					return 0
				}
				return float64(winTotalPnL) / float64(winSessions) / 100
			}(),
			func() int {
				if winSessions == 0 {
					return 0
				}
				return winTotalRounds / winSessions
			}())
		t.Logf("  输的会话: %d (%.1f%%), 平均输: %.2f元, 平均局数: %d",
			loseSessions, float64(loseSessions)/float64(totalSessions)*100,
			func() float64 {
				if loseSessions == 0 {
					return 0
				}
				return float64(loseTotalPnL) / float64(loseSessions) / 100
			}(),
			func() int {
				if loseSessions == 0 {
					return 0
				}
				return loseTotalRounds / loseSessions
			}())
		t.Logf("  持平会话: %d (%.1f%%)", evenSessions, float64(evenSessions)/float64(totalSessions)*100)
		t.Log("  按局数分组胜率:")
		for _, b := range brackets {
			if b.total > 0 {
				t.Logf("    %s: %d个会话, 赢 %d (%.1f%%)",
					b.label, b.total, b.wins, float64(b.wins)/float64(b.total)*100)
			}
		}
	}

	t.Log("========================================")

	// ===== 断言 =====

	// 1. 系统不应该亏钱（有机器人时）
	if systemProfit < 0 && cfg.RobotCount > 0 {
		t.Errorf("系统亏钱了! 系统净利润: %d (%.2f 元)", systemProfit, float64(systemProfit)/100)
	}

	// 2. 杀率范围验证
	if stats.TotalTurnover > 0 {
		actualKillRate := float64(systemProfit) / float64(stats.TotalTurnover)
		if cfg.RobotCount == 0 {
			// 全真人场景：杀率应在 1.5%~3.5%（理论值 2.5% = 税率5%/2）
			if actualKillRate < 0.015 || actualKillRate > 0.035 {
				t.Errorf("全真人杀率异常: %.4f%%, 预期范围 1.5%%~3.5%%", actualKillRate*100)
			}
		} else {
			// 有机器人：杀率应为正，且不超过目标的3倍（留足容差）
			maxRate := sCfg.TargetProfitRate * 3
			if actualKillRate < 0 {
				t.Errorf("杀率为负: %.4f%%", actualKillRate*100)
			} else if actualKillRate > maxRate {
				t.Errorf("杀率过高: %.4f%%, 超过目标 %.2f%% 的3倍", actualKillRate*100, sCfg.TargetProfitRate*100)
			}
		}
	}

	// 3. 换牌成功率验证
	if stats.SwapAttempts > 0 {
		swapRate := float64(stats.SwapSuccesses) / float64(stats.SwapAttempts)
		if cfg.BankerType == 0 && swapRate < 0.90 {
			t.Errorf("不看牌模式换牌成功率过低: %.2f%%, 预期 > 90%%", swapRate*100)
		}
		if cfg.BankerType == 1 && swapRate < 0.60 {
			t.Errorf("看3张模式换牌成功率过低: %.2f%%, 预期 > 60%%", swapRate*100)
		}
	}

	// 4. 杀率收敛性验证（最后10个采样点标准差 < 1%）
	if len(stats.KillRateSamples) >= 20 {
		tail := stats.KillRateSamples[len(stats.KillRateSamples)-10:]
		mean := 0.0
		for _, v := range tail {
			mean += v
		}
		mean /= float64(len(tail))
		variance := 0.0
		for _, v := range tail {
			d := v - mean
			variance += d * d
		}
		variance /= float64(len(tail))
		stddev := math.Sqrt(variance)
		if stddev > 0.01 {
			t.Errorf("杀率未收敛: 最后10个采样点标准差 %.6f > 1%%", stddev)
		} else {
			t.Logf("杀率收敛验证通过: 标准差 %.6f", stddev)
		}
	}
}
