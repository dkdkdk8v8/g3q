# QZNN 策略系统模拟测试

纯内存模拟发牌+结算，不依赖数据库，用于验证策略系统（Lucky/换牌/杀率控制）是否符合预期。

## 运行命令

```bash
# 运行全部模拟测试
cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation -v -count=1

# 运行单个场景
cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation_Basic -v -count=1
cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation_HighStakes -v -count=1
cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation_Look3Mode -v -count=1
cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation_AllReal -v -count=1
cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation_StressTest -v -count=1
```

## 测试场景

| 场景 | 说明 | 局数 | 玩家构成 |
|------|------|------|----------|
| Basic | 基础场景 | 5万 | 2真人+2机器人, 不看牌 |
| HighStakes | 高额场(100元底注) | 10万 | 2真人+2机器人, 不看牌 |
| Look3Mode | 看3张抢庄 | 5万 | 2真人+2机器人, 看3张 |
| AllReal | 全真人(无机器人) | 5万 | 4真人, 不看牌 |
| StressTest | 压力测试 | 50万 | 2真人+2机器人, 不看牌 |

## 统计输出说明

- **总流水**: 所有玩家 ValidBet 之和
- **总税收**: 赢家 5% 税收之和
- **系统总收入**: 税收 + 机器人净盈亏
- **实际系统杀率**: 系统总收入 / 总流水
- **换牌成功率**: 策略干预换牌成功次数 / 尝试次数
- **杀率趋势**: 每1000局采样一次累计杀率，观察收敛情况

## 核心验证点

1. **系统不亏钱**: 所有场景下系统总收入 > 0
2. **全真人场景杀率约2.5%**: 仅靠5%税收(赢家交税)，理论杀率 = 税率/2
3. **换牌成功率**: 不看牌模式 > 95%，看3张模式约80%
4. **杀率趋势收敛**: 随局数增加杀率应趋于稳定

## 文件位置

`server/service/mainClient/game/qznn/simulation_test.go`
