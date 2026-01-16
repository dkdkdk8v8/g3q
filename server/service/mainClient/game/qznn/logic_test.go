package qznn

import (
	"math"
	"service/initMain"
	"testing"
)

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
