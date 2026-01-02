package nn

// RobotExitRate 机器人退出概率
var RobotExitRate = 30

var Configs = []LobbyConfig{
	{Level: 1, Name: "初级场", MinBalance: 600, BaseBet: 100},
	{Level: 2, Name: "中级场", MinBalance: 3000, BaseBet: 500},
	{Level: 3, Name: "高级场", MinBalance: 6000, BaseBet: 1000},
	{Level: 4, Name: "豪华场", MinBalance: 1200, BaseBet: 2000},
}

func GetConfig(level int) *LobbyConfig {
	for _, c := range Configs {
		if c.Level == level {
			// 返回副本以防修改原配置
			copyConfig := c
			return &copyConfig
		}
	}
	return nil
}

// CardMultipliers 牌型倍数配置
var CardMultipliers = map[int64]int64{
	NiuNone:      1,  // 无牛
	NiuOne:       1,  // 牛1
	NiuTwo:       1,  // 牛2
	NiuThree:     1,  // 牛3
	NiuFour:      1,  // 牛4
	NiuFive:      1,  // 牛5
	NiuSix:       1,  // 牛6
	NiuSeven:     2,  // 牛7
	NiuEight:     2,  // 牛8
	NiuNine:      3,  // 牛9
	NiuNiu:       4,  // 牛牛
	NiuFace:      6,  // 五花牛
	NiuBomb:      8,  // 炸弹牛
	NiuFiveSmall: 10, // 五小牛
}

// GetCardMultiplier 获取牌型倍数
func GetCardMultiplier(niuType int64) int64 {
	if mult, ok := CardMultipliers[niuType]; ok {
		return mult
	}
	return 1
}
