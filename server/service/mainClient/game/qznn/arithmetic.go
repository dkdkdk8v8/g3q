package qznn

import (
	"math/rand"
	"sync"
)

// ArithmeticManager 负责全局的输赢控制、库存管理和发牌策略
// 参考 Node.js 的 arithmetic.js 实现逻辑
type ArithmeticManager struct {
	mu sync.RWMutex

	// --- 财务层 (Financial Layer) ---
	WaterLevel  int   // 水位线 (例如 98 代表 98% 返还，2% 抽水)
	BalanceGold int64 // 系统库存：用于平衡日常输赢，防止系统亏损
	WinPool     int64 // 奖池：专门用于发放高倍率大奖的储备金

	// --- 概率层 (Probability Layer) ---
	// 命中序列：预先生成的 0/1 数组，确保长期胜率符合设定
	// 对应 Node.js 中的 proCount 逻辑
	HitSequence []int
	HitIndex    int

	// --- 结果层 (Result Layer) ---
	// 结果池：key 是牌型得分(如牛牛=10, 无牛=0)，value 是对应的牌组列表
	// 对应 Node.js 中的 scoreArr 逻辑
	// 例如：ResultPool[10] 存储了 500 组预先生成的“牛牛”牌组
	ResultPool map[int][][]int
}

var (
	arithmeticOnce sync.Once
	arithmeticInst *ArithmeticManager
)

// GetArithmetic 获取控制引擎单例
func GetArithmetic() *ArithmeticManager {
	arithmeticOnce.Do(func() {
		arithmeticInst = &ArithmeticManager{
			ResultPool:  make(map[int][][]int),
			HitSequence: make([]int, 10000),
		}
	})
	return arithmeticInst
}

// Init 初始化控制参数，通常在服务器启动时调用
func (a *ArithmeticManager) Init(waterLevel int, balance int64, winPool int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.WaterLevel = waterLevel
	a.BalanceGold = balance
	a.WinPool = winPool

	// TODO: 1. 从数据库/Redis 加载实际数值
	// TODO: 2. 调用生成命中序列的逻辑 (对应 initBetArr)
	// TODO: 3. 调用预生成牌组池的逻辑 (对应 createArr)
	// 模拟一个const hardcoded的结果池
	a.ResultPool[0] = [][]int{
		{0, 1, 2, 3, 4},
		{5, 6, 7, 8, 9},
	}
	a.ResultPool[10] = [][]int{
		{10, 11, 12, 13, 14},
		{15, 16, 17, 18, 19},
	}
}

// UpdatePools 下注时分配资金 (对应 luck_tree.js 的逻辑)
func (a *ArithmeticManager) UpdatePools(betAmount int64) {
	a.mu.Lock()
	defer a.mu.Unlock()

	// 计算进入库存和奖池的比例
	toBalance := betAmount * int64(a.WaterLevel) / 100
	toWinPool := betAmount - toBalance

	a.BalanceGold += toBalance
	a.WinPool += toWinPool

	// TODO: 同步更新到 Redis 或数据库
}

// DecideOutcome 核心决策逻辑 (对应 hit 函数)
// 根据当前库存、奖池和命中序列，决定本次发牌的目标结果等级
func (a *ArithmeticManager) DecideOutcome(playerID string, betAmount int64) int {
	a.mu.Lock()
	defer a.mu.Unlock()

	// 1. 库存保护 (Inventory Protection)
	// 如果系统总库存低于警戒线（例如 0），强制进入“收分模式”，只给低分牌
	if a.BalanceGold < 0 {
		return rand.Intn(7) // 返回 0-6 分（无牛到牛六）
	}

	// 2. 推进命中序列索引
	a.HitIndex = (a.HitIndex + 1) % len(a.HitSequence)
	isHit := a.HitSequence[a.HitIndex] == 1

	// 3. 根据命中情况分配分值
	if isHit {
		// 命中模式：尝试分配高分牌 (7-10)
		roll := rand.Intn(100)
		var targetScore int

		switch {
		case roll < 10: // 10% 概率尝试牛牛
			targetScore = 10
		case roll < 40: // 30% 概率尝试牛七-牛九
			targetScore = 7 + rand.Intn(3)
		default:
			targetScore = rand.Intn(7)
		}

		// 4. 奖池支付能力检查 (Payout Capability)
		// 检查奖池是否够赔付该分值的最大倍数
		multiplier := a.getMultiplier(targetScore)
		potentialWin := betAmount * multiplier

		if targetScore >= 7 && a.WinPool < potentialWin {
			// 奖池不足以支付大奖，降级为普通牌型
			return rand.Intn(7)
		}

		return targetScore
	}

	// 非命中模式：分配低分牌
	return rand.Intn(7)
}

// getMultiplier 根据牛牛得分获取赔率 (对应 logic.go 中的倍数定义)
func (a *ArithmeticManager) getMultiplier(score int) int64 {
	switch score {
	case 10: // 牛牛
		return 3
	case 7, 8, 9: // 牛七-牛九
		return 2
	case 12, 13, 14: // 特殊牌型 (金牛、炸弹、五小牛)
		return 5 // 假设最高5倍
	default:
		return 1
	}
}

// GetCardsByScore 从结果池中获取一组牌 (对应 getArray 逻辑)
func (a *ArithmeticManager) GetCardsByScore(score int) []int {
	a.mu.RLock()
	defer a.mu.RUnlock()

	pool, ok := a.ResultPool[score]
	if !ok || len(pool) == 0 {
		return nil // 降级处理：实时生成一组随机牌
	}

	return pool[rand.Intn(len(pool))]
}
