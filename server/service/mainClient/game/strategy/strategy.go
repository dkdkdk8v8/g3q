package strategy

import (
	"compoment/util"
	"math"
	"math/rand"

	"github.com/sirupsen/logrus"
)

// SessionLossTier 会话止损阶梯配置
type SessionLossTier struct {
	Threshold  float64 // 亏损比例阈值 (0~1)
	LuckyBonus float64 // 触发时的Lucky加成
}

// StrategyConfig 策略配置参数（所有可调参数集中管理）
type StrategyConfig struct {
	// --- 基础参数 ---
	TargetProfitRate  float64 // 目标利润率 (e.g., 0.025 for 2.5%)
	BaseLucky         float64 // 默认幸运值 (50)
	HighRiskMult      int64   // 高风险倍数阈值 (抢庄*下注 > 此值时触发风控)
	EnableNewbieBonus bool    // 是否开启新手光环
	MinTurnover       int64   // 最小流水阈值

	// --- 水位修正参数 ---
	WaterLevelUnitStep  float64 // 每亏损多少单位 Lucky+1 (默认5000, 即50元)
	WaterLevelMaxBonus  float64 // 亏损玩家最大Lucky加成 (默认25)
	WaterLevelMaxPenalty float64 // 盈利玩家最大Lucky扣减 (默认15)

	// --- 补偿池参数 ---
	CompensateDilutionFactor float64 // 跨桌补偿稀释因子 (默认100)
	CompensateMaxLucky       float64 // 补偿池最大Lucky (默认20)

	// --- 新手保护参数 ---
	NewbieTier1MaxGames int     // Tier1上限局数 (默认10)
	NewbieTier1Target   float64 // Tier1目标Lucky (默认68)
	NewbieTier2MaxGames int     // Tier2上限局数 (默认30)
	NewbieTier2Bonus    float64 // Tier2 Lucky加成 (默认15)
	NewbieTier3Bonus    float64 // Tier3 Lucky加成 (默认8)

	// --- 会话止损参数 ---
	SessionLossTiers []SessionLossTier // 会话止损阶梯 (按阈值从大到小排列)

	// --- 连胜连败参数 ---
	LosingStreakThreshold   int     // 连败触发阈值 (默认3)
	LosingStreakBonusPer    float64 // 每多输一局+多少Lucky (默认5)
	LosingStreakMaxBonus    float64 // 连败最大加成 (默认20)
	WinningStreakThreshold  int     // 连胜触发阈值 (默认5)
	WinningStreakPenaltyPer float64 // 每多赢一局-多少Lucky (默认3)
	WinningStreakMaxPenalty float64 // 连胜最大扣减 (默认12)

	// --- 库存风控参数 ---
	KillRateTolerance        float64 // 杀率容忍区间 (默认0.015)
	KillRateScale            float64 // 概率放大系数 (默认50)
	InventoryProtectHighRisk float64 // 高风险保护扣减 (默认8)
	InventoryProtectNormal   float64 // 普通保护扣减 (默认3)
	InventoryRelease         float64 // 放水加成 (默认8)

	// --- Lucky边界 ---
	LuckyFloor   float64 // Lucky下限 (默认20)
	LuckyCeiling float64 // Lucky上限 (默认85)

	// --- 干预阈值 ---
	LuckyWinThreshold  float64 // Lucky高于此值尝试赢 (默认58)
	LuckyLoseThreshold float64 // Lucky低于此值尝试输 (默认42)

	// --- 结算参数 ---
	TaxRate    float64 // 赢家税率 (默认0.05)
	MaxLossRate float64 // 单局最大亏损比例 (默认0.20)

	// --- 机器人参数 ---
	RobotLuckyOffset float64 // 机器人Lucky偏移 (默认+3, 补偿税收拖累使机器人趋向盈亏平衡)
}

// DefaultStrategyConfig 返回默认参数配置
func DefaultStrategyConfig() StrategyConfig {
	return StrategyConfig{
		TargetProfitRate:  0.025,
		BaseLucky:         50,
		HighRiskMult:      20,
		EnableNewbieBonus: true,
		MinTurnover:       5000000,

		WaterLevelUnitStep:   5000,
		WaterLevelMaxBonus:   15,
		WaterLevelMaxPenalty: 10,

		CompensateDilutionFactor: 100,
		CompensateMaxLucky:       20,

		NewbieTier1MaxGames: 10,
		NewbieTier1Target:   62,
		NewbieTier2MaxGames: 30,
		NewbieTier2Bonus:    8,
		NewbieTier3Bonus:    3,

		SessionLossTiers: []SessionLossTier{
			{Threshold: 0.6, LuckyBonus: 15},
			{Threshold: 0.4, LuckyBonus: 10},
			{Threshold: 0.25, LuckyBonus: 5},
			{Threshold: 0.15, LuckyBonus: 2},
		},

		LosingStreakThreshold:   3,
		LosingStreakBonusPer:    5,
		LosingStreakMaxBonus:    20,
		WinningStreakThreshold:  5,
		WinningStreakPenaltyPer: 3,
		WinningStreakMaxPenalty: 12,

		KillRateTolerance:        0.001,
		KillRateScale:            400,
		InventoryProtectHighRisk: 12,
		InventoryProtectNormal:   8,
		InventoryRelease:         8,

		LuckyFloor:   20,
		LuckyCeiling: 85,

		LuckyWinThreshold:  58,
		LuckyLoseThreshold: 42,

		TaxRate:     0.05,
		MaxLossRate: 0.20,

		RobotLuckyOffset: 3,
	}
}

func (c *StrategyConfig) Log() {
	logrus.WithFields(logrus.Fields{
		"TargetProfitRate":  c.TargetProfitRate,
		"BaseLucky":         c.BaseLucky,
		"HighRiskMult":      c.HighRiskMult,
		"EnableNewbieBonus": c.EnableNewbieBonus,
		"MinTurnover":       c.MinTurnover,
	}).Info("StrategyConfig")
}

// StrategyContext 策略上下文 (通用参数)
// 包含计算 Lucky 值所需的所有环境数据
type StrategyContext struct {
	UserID            string
	TotalProfit       int64 // 历史总盈亏 (水位)
	PendingCompensate int64 // 待补偿金额 为了跨度惩罚 (Span Penalty) / 稀释
	BaseBet           int64 // 房间底分

	// 新增系统维度数据
	KillRateToday             float64 // 今日实时杀率
	TurnoverTodayAndYesterday int64   // 今日+昨日系统流水 (48小时滚动窗口)

	// 动态参数
	TotalMult     int64 // 本局总倍数 (QZNN: 抢庄*下注)
	RiskExposure  int64 // 本局风险敞口
	IsRobot       bool  // 是否机器人
	IsNewbie      bool  // 是否新手 (例如: 局数 < 50)
	GameCount     int   // 游戏次数 (用于新手阶梯保护)
	WinningStreak int   // 连胜局数
	LosingStreak  int   // 连败局数

	// 会话级止损保护
	SessionLossRate float64 // 本次会话亏损比例 (累计亏损/进场余额, 0~1)
}

func (c *StrategyContext) Log() {
	logrus.WithFields(logrus.Fields{
		"UserID":                    c.UserID,
		"TotalProfit":               c.TotalProfit,
		"PendingCompensate":         c.PendingCompensate,
		"BaseBet":                   c.BaseBet,
		"KillRateToday":             util.Round(c.KillRateToday, 2),
		"TurnoverTodayAndYesterday": c.TurnoverTodayAndYesterday,
		"TotalMult":                 c.TotalMult,
		"RiskExposure":              c.RiskExposure,
		"IsRobot":                   c.IsRobot,
		"IsNewbie":                  c.IsNewbie,
		"GameCount":                 c.GameCount,
		"WinningStreak":             c.WinningStreak,
		"LosingStreak":              c.LosingStreak,
		"SessionLossRate":           util.Round(c.SessionLossRate, 4),
	}).Info("StrategyContext")
}

// IStrategyCore 策略核心接口
type IStrategyCore interface {
	CalcBaseLucky(ctx *StrategyContext) (float64, []string)
	ApplyRiskControl(baseLucky float64, ctx *StrategyContext) (finalLucky float64, isHighRisk bool, reasons []string)
}

// StrategyManager 通用策略管理器实现
type StrategyManager struct {
	Config StrategyConfig
}

// NewStrategyManager 创建策略管理器
func NewStrategyManager(cfg StrategyConfig) *StrategyManager {
	return &StrategyManager{Config: cfg}
}

// CalcBaseLucky 计算基础 Lucky 值
func (s *StrategyManager) CalcBaseLucky(ctx *StrategyContext) (float64, []string) {
	cfg := &s.Config
	baseLucky := cfg.BaseLucky
	var reasons []string

	// 机器人：固定 BaseLucky + RobotLuckyOffset（补偿税收拖累）
	if ctx.IsRobot {
		return baseLucky + cfg.RobotLuckyOffset, []string{"Robot_FixedLucky"}
	}

	// 1. 水位修正
	waterCorrection := 0.0
	if ctx.TotalProfit < 0 {
		loss := float64(-ctx.TotalProfit)
		waterCorrection = math.Min(cfg.WaterLevelMaxBonus, loss/cfg.WaterLevelUnitStep)
		reasons = append(reasons, "WaterLevelBonus")
	} else {
		profit := float64(ctx.TotalProfit)
		waterCorrection = math.Max(-cfg.WaterLevelMaxPenalty, -(profit / cfg.WaterLevelUnitStep))
		reasons = append(reasons, "WaterLevelPenalty")
	}

	// 2. 待补偿池修正
	compensateLucky := 0.0
	currentBaseBet := float64(ctx.BaseBet)
	if currentBaseBet <= 0 {
		currentBaseBet = 1.0
	}
	if ctx.PendingCompensate > 0 {
		compensateLucky = float64(ctx.PendingCompensate) / (currentBaseBet * cfg.CompensateDilutionFactor)
		compensateLucky = math.Min(cfg.CompensateMaxLucky, compensateLucky)
		reasons = append(reasons, "PendingCompensate")
	}

	// 3. 新手阶梯保护
	newbieBonus := 0.0
	if cfg.EnableNewbieBonus && ctx.IsNewbie {
		if ctx.GameCount < cfg.NewbieTier1MaxGames {
			newbieBonus = cfg.NewbieTier1Target - baseLucky - waterCorrection - compensateLucky
			if newbieBonus < 0 {
				newbieBonus = 0
			}
			reasons = append(reasons, "NewbieTier1_StrongProtect")
		} else if ctx.GameCount < cfg.NewbieTier2MaxGames {
			newbieBonus = cfg.NewbieTier2Bonus
			reasons = append(reasons, "NewbieTier2_MediumProtect")
		} else {
			newbieBonus = cfg.NewbieTier3Bonus
			reasons = append(reasons, "NewbieTier3_LightProtect")
		}
	}

	// 4. 会话级止损保护（从高到低匹配第一个命中的阈值）
	sessionProtection := 0.0
	if !ctx.IsRobot && ctx.SessionLossRate > 0 {
		for _, tier := range cfg.SessionLossTiers {
			if ctx.SessionLossRate > tier.Threshold {
				sessionProtection = tier.LuckyBonus
				reasons = append(reasons, "SessionLossProtect")
				break
			}
		}
	}

	// 5. 连胜/连败修正
	streakCorrection := 0.0
	if ctx.LosingStreak >= cfg.LosingStreakThreshold {
		bonus := float64(ctx.LosingStreak-cfg.LosingStreakThreshold+1) * cfg.LosingStreakBonusPer
		streakCorrection = math.Min(cfg.LosingStreakMaxBonus, bonus)
		reasons = append(reasons, "LosingStreakBonus")
	}
	if ctx.WinningStreak >= cfg.WinningStreakThreshold {
		penalty := float64(ctx.WinningStreak-cfg.WinningStreakThreshold+1) * cfg.WinningStreakPenaltyPer
		streakCorrection = -math.Min(cfg.WinningStreakMaxPenalty, penalty)
		reasons = append(reasons, "WinningStreakPenalty")
	}

	return baseLucky + waterCorrection + compensateLucky + newbieBonus + sessionProtection + streakCorrection, reasons
}

// ApplyRiskControl 应用风控修正
func (s *StrategyManager) ApplyRiskControl(baseLucky float64, ctx *StrategyContext) (float64, bool, []string) {
	cfg := &s.Config
	tempLucky := baseLucky
	isHighRisk := false
	var reasons []string

	// 1. 倍数杠杆与风控
	if ctx.TotalMult > cfg.HighRiskMult {
		isHighRisk = !ctx.IsRobot // 只标记真人为高风险
		decayFactor := float64(cfg.HighRiskMult) / float64(ctx.TotalMult)
		offset := tempLucky - 50.0
		tempLucky = 50.0 + (offset * decayFactor)
		reasons = append(reasons, "HighRiskDecay")
	}

	// 2. 库存保护与系统返还
	shouldProtect := false
	shouldRelease := false

	currentRate := ctx.KillRateToday
	targetRate := cfg.TargetProfitRate
	if ctx.TurnoverTodayAndYesterday > 0 && ctx.TurnoverTodayAndYesterday < cfg.MinTurnover {
		currentRate = targetRate
	}

	diff := currentRate - targetRate
	if diff < -cfg.KillRateTolerance {
		over := -cfg.KillRateTolerance - diff
		protectProb := over * cfg.KillRateScale
		if protectProb > 1.0 {
			protectProb = 1.0
		}
		if rand.Float64() < protectProb {
			shouldProtect = true
		}
	} else if diff > cfg.KillRateTolerance {
		over := diff - cfg.KillRateTolerance
		releaseProb := over * cfg.KillRateScale
		if releaseProb > 1.0 {
			releaseProb = 1.0
		}
		if rand.Float64() < releaseProb {
			shouldRelease = true
		}
	}

	if shouldProtect {
		if isHighRisk {
			tempLucky -= cfg.InventoryProtectHighRisk
			reasons = append(reasons, "InventoryProtect_HighRisk")
		} else {
			tempLucky -= cfg.InventoryProtectNormal
			reasons = append(reasons, "InventoryProtect_Normal")
		}
	}
	if shouldRelease {
		tempLucky += cfg.InventoryRelease
		reasons = append(reasons, "InventoryRelease")
	}

	// 3. 最终边界锁定
	finalLucky := math.Min(math.Max(tempLucky, cfg.LuckyFloor), cfg.LuckyCeiling)

	return finalLucky, isHighRisk, reasons
}
