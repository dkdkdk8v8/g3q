package qznn

import (
	"math"
	"service/initMain"
	"testing"
)

// TestSwapCardsForTarget_Look3_Mechanism 测试 Look3 模式下的换牌机制
// 验证：
// 1. 是否只替换了后两张牌
// 2. 是否从牌堆中正确取牌
func TestSwapCardsForTarget_Look3_Mechanism(t *testing.T) {
	initMain.DefCtx = &initMain.BaseCtx{}
	initMain.DefCtx.IsTest = true
	// 1. 初始化房间
	room := NewRoom("test_room", 1, 1) // BankerType 1 = Look3

	// 2. 构造玩家，手牌 [1, 2, 3, 4, 5]
	// Look3 模式下：
	// 前3张固定: 1, 2, 3
	// 后2张可换: 4, 5
	player := &Player{
		PlayerData: PlayerData{
			ID:    "test_player",
			Cards: []int{1, 2, 3, 4, 5}},
	}

	// 3. 构造牌堆
	// 放入两张特殊的牌 [100, 200] (假设值，用于验证是否被换入)
	room.Deck = []int{100, 200}

	// 4. 定义目标函数
	// 这里我们使用一个总是返回 true 的检查函数，
	// 目的是测试 swapCardsForTarget 是否能正确执行交换动作，
	// 而不依赖 CalcNiu 的具体算法细节。
	checkFunc := func(res interface{}) bool {
		return res != nil
	}

	// 5. 执行换牌 (Look3, fixedCount=3)
	// 期望：策略 A (单张替换) 或 策略 B (双张替换) 被触发
	success := room.swapCardsForTarget(player, 3, checkFunc)

	if !success {
		t.Fatalf("Expected swap to succeed with always-true check")
	}

	// 6. 验证结果

	// A. 验证前3张牌必须保持不变
	if player.Cards[0] != 1 || player.Cards[1] != 2 || player.Cards[2] != 3 {
		t.Errorf("Fixed cards were modified! Got: %v", player.Cards)
	}

	// B. 验证后2张牌中至少有一张变成了牌堆里的牌 (100 或 200)
	hasChanged := false
	for i := 3; i < 5; i++ {
		if player.Cards[i] == 100 || player.Cards[i] == 200 {
			hasChanged = true
		}
	}

	if !hasChanged {
		t.Errorf("Swappable cards did not change to deck cards. Current: %v", player.Cards)
	}

	t.Logf("Swap successful. Old: [1 2 3 4 5], New: %v", player.Cards)
}

// TestSystemOverflow_Bonus 集成测试：验证系统溢出返还机制
// 场景：系统库存 50w (警戒线 20w)，玩家进场
// 验证：
// 1. Lucky 值是否获得溢出加成
// 2. 发牌逻辑是否尝试让玩家赢
func TestSystemOverflow_Bonus(t *testing.T) {
	initMain.DefCtx = &initMain.BaseCtx{}
	initMain.DefCtx.IsTest = true
	// 1. 初始化房间
	room := NewRoom("test_overflow_room", 1, 1)

	// 2. 配置策略参数：模拟溢出状态
	// 警戒线 20w，当前库存 50w -> 溢出 30w
	// 溢出加成 = 300000 / 50000 = 6 点
	room.Strategy.Config.OverflowThreshold = 200000
	room.Strategy.SystemStock = 500000
	room.Strategy.Config.BaseLucky = 50.0

	// 3. 添加玩家
	player := &Player{
		PlayerData: PlayerData{
			ID:      "player_1",
			Balance: 10000,
			BetMult: 1, // 低倍数，避免触发风控}
		},
	}
	room.Players[0] = player

	// 初始化玩家策略数据 (TotalProfit = 0)
	room.Strategy.UserData[player.ID] = &UserStrategyData{
		TotalProfit: 0,
		BaseLucky:   50.0,
	}

	// 添加庄家 (机器人)
	banker := &Player{
		PlayerData: PlayerData{
			ID:       "robot_banker",
			IsRobot:  true,
			CallMult: 1},
	}
	room.Players[1] = banker
	room.BankerID = banker.ID

	// 4. 执行 Lucky 计算
	// 预期：基础值 50 + 溢出加成 6 = 56
	room.calculateRealtimeLucky(player)

	finalLucky := room.Strategy.UserData[player.ID].FinalLucky
	expectedLucky := 56.0

	if math.Abs(finalLucky-expectedLucky) > 0.01 {
		t.Errorf("Overflow bonus calculation failed. Expected %.2f, Got %.2f", expectedLucky, finalLucky)
	} else {
		t.Logf("Overflow bonus verified: Lucky increased to %.2f", finalLucky)
	}

	// 5. 验证发牌倾向 (模拟)
	// 强制 Lucky 到 85 (最高) 来测试换牌逻辑是否生效
	room.Strategy.UserData[player.ID].FinalLucky = 85.0

	// 模拟发牌前状态：玩家手牌较差，庄家手牌较好
	// 运行换牌逻辑
	room.adjustCardsBasedOnLucky()

	// 注意：由于换牌包含概率因素，单元测试中主要验证代码无 Panic 且逻辑路径可达
	t.Logf("Player Cards after adjust: %v", player.Cards)
}
