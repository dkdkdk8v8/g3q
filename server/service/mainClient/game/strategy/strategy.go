package strategy

import (
	"math"
)

// StrategyConfig 策略配置参数
type StrategyConfig struct {
	TargetProfitRate  float64 // 目标利润率 (e.g., 0.05 for 5%)
	StockLine         int64   // 库存警戒线
	BaseLucky         float64 // 默认幸运值 (50)
	HighRiskMult      int64   // 高风险倍数阈值 (抢庄*下注 > 此值时触发风控)
	OverflowThreshold int64   // 溢出返还阈值 (库存超过此值时触发全员Lucky提升)
	EnableNewbieBonus bool    // 是否开启新手光环
}

// StrategyContext 策略上下文 (通用参数)
// 包含计算 Lucky 值所需的所有环境数据
type StrategyContext struct {
	UserID            string
	TotalProfit       int64 // 历史总盈亏 (水位)
	RecentProfit      int64 // 近期盈亏
	PendingCompensate int64 // 待补偿金额
	RoomStock         int64 // 房间/系统库存 (SystemStock)
	BaseBet           int64 // 房间底分

	// 动态参数
	TotalMult    int64 // 本局总倍数 (QZNN: 抢庄*下注, DDZ: 叫分*炸弹)
	RiskExposure int64 // 本局风险敞口 (预计最大赔付额, 可选)
	IsRobot      bool  // 是否机器人
	IsNewbie     bool  // 是否新手 (例如: 局数 < 50)
	WinningStreak int  // 连胜局数
	LosingStreak  int  // 连败局数
}

// IStrategyCore 策略核心接口
type IStrategyCore interface {
	// CalcBaseLucky 计算基础 Lucky (进场时调用)
	CalcBaseLucky(ctx *StrategyContext) float64

	// ApplyRiskControl 实时风控修正 (下注/操作时调用)
	ApplyRiskControl(baseLucky float64, ctx *StrategyContext) (finalLucky float64, isHighRisk bool)

	// GetInventoryAction 获取库存干预指令 (发牌前调用)
	// 返回：0-不干预, 1-强制赢, -1-强制输
	GetInventoryAction(ctx *StrategyContext) int
}

// StrategyManager 通用策略管理器实现
type StrategyManager struct {
	Config StrategyConfig
}

// NewStrategyManager 创建策略管理器
func NewStrategyManager(cfg StrategyConfig) *StrategyManager {
	return &StrategyManager{
		Config: cfg,
	}
}

// CalcBaseLucky 默认实现：计算基础 Lucky 值
// 包含：水位修正、待补偿池修正、系统溢出返还
func (s *StrategyManager) CalcBaseLucky(ctx *StrategyContext) float64 {
	baseLucky := s.Config.BaseLucky

	// 1. 水位修正 (Water Level Correction)
	// 逻辑：输得越多，Lucky 越高；赢得越多，Lucky 越低
	const UnitStep = 10000.0
	const MaxBonus = 35.0   // 最大加成 (50+35=85)
	const MaxPenalty = 30.0 // 最大扣减 (50-30=20)

	waterCorrection := 0.0
	if ctx.TotalProfit < 0 {
		// 亏损用户：给予补偿
		loss := float64(-ctx.TotalProfit)
		waterCorrection = math.Min(MaxBonus, loss/UnitStep)
	} else {
		// 盈利用户：给予压制
		profit := float64(ctx.TotalProfit)
		waterCorrection = math.Max(-MaxPenalty, -(profit / UnitStep))
	}

	// 2. 待补偿池修正 (Pending Compensation & Span Penalty)
	// 逻辑：低分场输的钱在高分场会被底分稀释
	compensateLucky := 0.0
	currentBaseBet := float64(ctx.BaseBet)
	if currentBaseBet <= 0 {
		currentBaseBet = 1.0
	}
	const DilutionFactor = 100.0

	if ctx.PendingCompensate > 0 {
		compensateLucky = float64(ctx.PendingCompensate) / (currentBaseBet * DilutionFactor)
		compensateLucky = math.Min(20.0, compensateLucky)
	}

	// 3. 系统溢出返还 (System Overflow Bonus)
	// 逻辑：当系统库存远超警戒线时，全员加 Lucky
	overflowBonus := 0.0
	const OverflowUnit = 50000.0
	if ctx.RoomStock > s.Config.OverflowThreshold {
		overflowAmt := float64(ctx.RoomStock - s.Config.OverflowThreshold)
		overflowBonus = overflowAmt / OverflowUnit
		overflowBonus = math.Min(15.0, overflowBonus)
	}

	// 4. 新手光环 (Newbie Bonus)
	// 逻辑：如果是新手且开关开启，给予额外 Lucky 加成
	newbieBonus := 0.0
	if s.Config.EnableNewbieBonus && ctx.IsNewbie {
		newbieBonus = 10.0 // 新手固定加成 10 点
	}

	// 5. 连胜/连败修正 (Streak Correction)
	// ----------------------------------------------------------------
	// [可选项] 如果不想要连胜连败修正，可以将下面这段代码注释掉或者设置开关
	streakCorrection := 0.0

	// 连败补偿：连输3局开始补偿，每多输1局+5点，上限20点
	if ctx.LosingStreak >= 3 {
		bonus := float64(ctx.LosingStreak-2) * 5.0
		streakCorrection = math.Min(20.0, bonus)
	}

	// 连胜压制：连赢3局开始压制，每多赢1局-5点，上限-20点
	if ctx.WinningStreak >= 3 {
		penalty := float64(ctx.WinningStreak-2) * 5.0
		streakCorrection = -math.Min(20.0, penalty)
	}
	// ----------------------------------------------------------------

	return baseLucky + waterCorrection + compensateLucky + overflowBonus + newbieBonus + streakCorrection
}

// ApplyRiskControl 默认实现：应用风控修正
// 包含：倍数杠杆压制、库存保护压制
func (s *StrategyManager) ApplyRiskControl(baseLucky float64, ctx *StrategyContext) (float64, bool) {
	tempLucky := baseLucky
	isHighRisk := false

	// 1. 倍数杠杆与风控
	// 如果 TotalMult (总倍数) 超过阈值，强制 Lucky 回归 50
	highRiskThreshold := s.Config.HighRiskMult
	if ctx.TotalMult > highRiskThreshold {
		isHighRisk = true
		// 衰减因子：阈值 / 当前倍数 (越小衰减越狠)
		decayFactor := float64(highRiskThreshold) / float64(ctx.TotalMult)

		// 应用衰减：保留 (Lucky - 50) 的一部分
		offset := tempLucky - 50.0
		tempLucky = 50.0 + (offset * decayFactor)
	}

	// 2. 库存保护 (System Inventory Protection)
	// 如果系统库存不足，额外压制 Lucky
	if ctx.RoomStock < s.Config.StockLine {
		if isHighRisk {
			tempLucky -= 15.0 // 高风险且库存不足，重罚
		} else {
			tempLucky -= 5.0 // 普通情况库存不足，轻罚
		}
	}

	// 3. 最终边界锁定
	finalLucky := math.Min(math.Max(tempLucky, 20.0), 85.0)

	return finalLucky, isHighRisk
}

// GetInventoryAction 获取库存干预指令
// 返回：0-不干预, 1-强制赢, -1-强制输
func (s *StrategyManager) GetInventoryAction(ctx *StrategyContext) int {
	// 简单实现：库存低于警戒线时，真人强制输 (返回 -1)
	if ctx.RoomStock < s.Config.StockLine {
		if !ctx.IsRobot {
			return -1
		}
	}
	return 0
}
