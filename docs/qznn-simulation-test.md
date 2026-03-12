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
cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation_Rotation -v -count=1
cd server/service && go test ./mainClient/game/qznn/ -run TestSimulation_RotationLongSession -v -count=1
```

## 测试场景

| 场景 | 说明 | 局数 | 玩家构成 | 特点 |
|------|------|------|----------|------|
| Basic | 基础场景 | 5万 | 2真人+2机器人, 不看牌 | 固定玩家，余额不足自动补充 |
| HighStakes | 高额场(100元底注) | 10万 | 2真人+2机器人, 不看牌 | 禁用新手保护 |
| Look3Mode | 看3张抢庄 | 5万 | 2真人+2机器人, 看3张 | 换牌成功率较低（固定3张） |
| AllReal | 全真人(无机器人) | 5万 | 4真人, 不看牌 | 验证纯税收杀率=2.5% |
| StressTest | 压力测试 | 50万 | 2真人+2机器人, 不看牌 | 大样本收敛验证 |
| Rotation | 玩家轮换 | 5万 | 2真人+2机器人 | 模拟真实进出场(10-100局/会话) |
| RotationLongSession | 长会话轮换 | 5万 | 2真人+2机器人 | 长session(50-500局/会话) |

## 统计输出说明

- **总流水**: 所有玩家 ValidBet 之和
- **总税收**: 赢家 5% 税收之和
- **系统总收入**: 税收 + 机器人净盈亏
- **实际系统杀率**: 系统总收入 / 总流水
- **换牌成功率**: 策略干预换牌成功次数 / 尝试次数
- **杀率趋势**: 每1000局采样一次累计杀率，观察收敛情况
- **牌型分布**: 换牌前后的牛型分布变化（验证换牌干预效果）
- **会话统计**: 轮换模式下每个玩家会话的赢率、平均盈亏、局数分布

## 核心验证点

1. **系统不亏钱**: 所有场景下系统总收入 > 0
2. **杀率约2.5%**: 全真人=2.50%（纯税收），有机器人=2.5~2.7%
3. **机器人盈亏平衡**: 机器人不应大量亏损（近似为0或小正值）
4. **换牌成功率**: 不看牌模式 > 90%，看3张模式 > 60%
5. **杀率趋势收敛**: 最后10个采样点标准差 < 1%

## 参数化策略系统

所有策略常量已提取到 `strategy.StrategyConfig`，可在测试中自定义参数跑样本：

```go
sp := strategy.DefaultStrategyConfig()
sp.TargetProfitRate = 0.03    // 修改目标杀率
sp.RobotLuckyOffset = 5      // 调整机器人Lucky偏移
sp.KillRateScale = 500       // 加大库存控制力度
cfg := SimConfig{
    TotalRounds:     100000,
    RealPlayerCount: 2,
    RobotCount:      2,
    BaseBet:         1000,
    BankerType:      0,
    InitBalance:     100000,
    StrategyParams:  &sp,    // 传入自定义参数
}
stats := runSimulation(t, cfg)
printStats(t, cfg, stats)
```

### 核心参数说明

| 参数 | 默认值 | 说明 | 调优方向 |
|------|--------|------|----------|
| `TargetProfitRate` | 0.025 | 目标杀率 | 系统盈利目标 |
| `BaseLucky` | 50 | 基础Lucky值 | 50=中性，越高越倾向玩家赢 |
| `RobotLuckyOffset` | 3 | 机器人Lucky偏移 | 补偿5%税收拖累，↑=机器人赢更多 |
| `KillRateTolerance` | 0.001 | 杀率容忍区间 | ↓=库存控制更敏感 |
| `KillRateScale` | 400 | 库存控制概率放大系数 | ↑=库存保护/释放触发更频繁 |
| `LuckyWinThreshold` | 58 | Lucky高于此值尝试赢 | ↓=更多玩家获得赢的干预 |
| `LuckyLoseThreshold` | 42 | Lucky低于此值尝试输 | ↑=更多玩家被干预输 |
| `NewbieTier1Target` | 62 | 新手前10局目标Lucky | ↑=新手体验更好但系统承压 |
| `WaterLevelMaxBonus` | 15 | 亏损玩家最大Lucky加成 | ↑=亏损玩家更容易回血 |
| `TaxRate` | 0.05 | 赢家税率 | 系统主要收入来源 |
| `MaxLossRate` | 0.20 | 单局最大亏损比例 | 保护玩家不被单局爆掉 |
| `HighRiskMult` | 20 | 高风险倍数阈值 | 超过时Lucky衰减向50靠拢 |
| `InventoryProtectNormal` | 8 | 库存保护Lucky扣减 | ↑=保护力度更大 |
| `InventoryRelease` | 8 | 库存释放Lucky加成 | ↑=杀率过高时放水更多 |

### 调参工作流

1. **修改参数** → 在测试中构造 `StrategyParams`
2. **跑样本** → `go test -run TestSimulation_Basic -v -count=1`
3. **看关键指标**:
   - 系统杀率是否在2.5%±0.3%
   - 机器人净盈亏是否接近0
   - 玩家会话胜率（轮换模式）
   - 换牌成功率是否合理
4. **确认后部署** → 修改 `DefaultStrategyConfig()` 中的默认值

## 策略系统架构

### Lucky值计算流水线

```
CalcBaseLucky (基础Lucky)
  ├── 机器人: BaseLucky + RobotLuckyOffset (固定值，不参与水位等修正)
  └── 真人:
      ├── 水位修正 (亏损加成/盈利扣减)
      ├── 补偿池修正 (跨桌补偿稀释)
      ├── 新手阶梯保护 (Tier1/2/3)
      ├── 会话止损保护 (阶梯式Lucky加成)
      └── 连胜/连败修正
          ↓
ApplyRiskControl (风控修正)
  ├── 高倍数衰减 (Lucky向50靠拢，机器人不标记isHighRisk)
  ├── 库存保护 (杀率低于目标 → Lucky扣减，reasons包含"InventoryProtect")
  └── 库存释放 (杀率高于目标 → Lucky加成，reasons包含"InventoryRelease")
          ↓
adjustCardsBasedOnLucky (换牌干预)
  ├── Lucky > WinThreshold → 概率shouldWin (对所有玩家生效)
  ├── Lucky < LoseThreshold → 概率shouldLose (对所有玩家生效)
  ├── InventoryProtect:
  │   ├── 机器人 → shouldWin=true (系统回血)
  │   └── 真人 → shouldWin=false / 高风险shouldLose
  └── InventoryRelease:
      ├── 真人 → shouldWin=true (放水)
      └── 机器人 → 不干预，保持自然
```

### 关键设计决策

1. **Lucky干预对所有玩家生效**: 包括机器人。机器人通过 `RobotLuckyOffset` 获得略高于50的Lucky，使其有概率被干预为shouldWin，补偿5%税收拖累。

2. **HighRiskDecay对机器人不标记isHighRisk**: 机器人的Lucky在高倍局仍会衰减，但不被标记为"高风险"。这意味着机器人在库存保护下不会被特殊对待（不会被强制输），保持了其在高倍局的竞争力。

3. **库存自动调控**: 通过 `KillRateTolerance` 和 `KillRateScale` 实现PID-like的杀率控制。杀率偏低时保护系统（机器人赢、真人少赢），偏高时放水（真人多赢、机器人不干预）。

4. **系统利润主要靠税收**: 5%赢家税 → 理论杀率2.5%。机器人目标是盈亏平衡（不靠机器人赢钱），库存控制是微调手段。

5. **单局亏损上限**: `MaxLossRate`(20%) 限制单局最大亏损，防止玩家被高倍局瞬间爆掉。

## 已验证的测试结果（默认参数）

| 场景 | 杀率 | 机器人净盈亏 | 收敛标准差 |
|------|------|-------------|-----------|
| Basic (5万局) | 2.63% | +13M (近似0) | 0.000067 |
| HighStakes (10万局) | 2.63% | +218M | 0.000046 |
| Look3Mode (5万局) | 2.59% | +9M | 0.000127 |
| AllReal (5万局) | **2.50%** | 0 | 0.000000 |
| Rotation (5万局) | 2.63% | +12M | 0.000111 |
| StressTest (50万局) | 2.66% | +194M | 0.000024 |

## 注意事项

1. **随机性**: 每次运行结果会有波动，关注趋势而非单次数值
2. **收敛需要样本量**: 至少5万局才能看到稳定趋势，压力测试建议50万局
3. **轮换模式的玩家胜率**: 由于2.5%税收存在，长期玩家必然是净亏损的。胜率关注点是"玩家能否有赢的体验"而非"玩家整体盈利"
4. **参数联动**: 修改一个参数可能影响其他指标。建议每次只调一个参数，对比调参前后的效果
5. **HighStakes机器人盈利较多**: 高额场机器人盈利绝对值大是因为底注大（100元），相对比例仍在合理范围
6. **生产环境与模拟的差异**:
   - 模拟中庄家轮流，生产中竞价抢庄
   - 模拟中下注倍数随机，生产中玩家有策略性选择
   - 模拟中不涉及网络延迟和断线重连

## 文件位置

- 策略引擎: `server/service/mainClient/game/strategy/strategy.go`
- 游戏逻辑: `server/service/mainClient/game/qznn/logic.go`
- 模拟测试: `server/service/mainClient/game/qznn/simulation_test.go`
