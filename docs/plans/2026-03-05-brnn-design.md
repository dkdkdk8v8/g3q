# 百人牛牛 (BRNN) 设计文档

**日期:** 2026-03-05
**状态:** 已批准

---

## 需求汇总

| 项目 | 决定 |
|---|---|
| 庄家 | 系统坐庄 |
| 下注区域 | 天/地/玄/黄 4区 |
| 多区下注 | 支持，同时押多个区域 |
| 筹码 | 固定档位，可配置（如 [10, 50, 100, 500, 1000]） |
| 阶段时间 | 各阶段等待时间可配置 |
| 机器人 | 不需要 |
| 前端风格 | 纯 CSS 简洁样式，后期换美术 |
| 房间等级 | 无，选择百人牛牛直接进入唯一房间 |
| 抽水 | 暂不做，后期加 |
| QZNN 影响 | 不影响现有逻辑 |

---

## 游戏流程 FSM

```
StateBetting(下注) → StateDealing(发牌) → StateShowCard(开牌) → StateSettling(结算) → StateBetting(循环)
```

- **StateBetting** — 玩家选择筹码点击区域下注，可累加，倒计时可配置（默认15秒）
- **StateDealing** — 系统发牌：庄家5张 + 天/地/玄/黄各5张，动画展示
- **StateShowCard** — 依次翻牌，显示牌型，可配置等待时间（默认8秒）
- **StateSettling** — 各区域 vs 庄家比牌，赢的区域：玩家获得 `下注 × 牌型倍率`，输的区域：扣除下注

百人牛牛没有"等人"和"抢庄"阶段，服务启动即自动循环。

---

## 服务端架构

### 新建目录 `server/service/mainClient/game/brnn/`

与 `qznn/` 平行，零交叉：

```
game/brnn/
├── config.go        — 可配置项：筹码档位、各阶段时间、下注限额
├── types_logic.go   — Room/BettingArea/PlayerBet 结构体
├── types_net.go     — BRNN.* Cmd/Push 常量 + 网络数据结构
├── logic.go         — FSM 状态机 + 结算逻辑
├── handler.go       — PlaceBet/Join/Leave 处理
└── util.go          — 复用 qznn 的牌型计算
```

### 集成点（仅追加代码，不改 QZNN 逻辑）

- `ctl.go` — dispatch switch 加 `case brnn.CmdXxx` 分支
- `handler.go` — 新增 `handleBRNNXxx()` 函数
- `router.go` — 新增 `/rpc/brnn-data` 路由（如需要）

### 可配置项

```go
type BRNNConfig struct {
    Chips          []int64  // 筹码档位 [10, 50, 100, 500, 1000]
    MaxBetPerArea  int64    // 单区域单人最大下注
    MinBalance     int64    // 最低入场余额

    SecBetting     int      // 下注阶段时长（秒），默认15
    SecDealing     int      // 发牌阶段时长，默认3
    SecShowCard    int      // 开牌阶段时长，默认8
    SecSettling    int      // 结算阶段时长，默认5
}
```

### BRNN Room 特点

- 只有一个房间（singleton），服务启动即创建，自动循环
- 支持 100+ 玩家同时在线
- 玩家加入/离开不影响游戏进程
- 下注广播优化：汇总各区域总金额推送，不推送每个人的下注细节

### 核心数据结构

```go
type BRNNRoom struct {
    ID            string
    State         int
    StateDeadline time.Time
    Config        *BRNNConfig
    Areas         [4]*BettingArea  // 天/地/玄/黄
    DealerCards   []int            // 庄家5张牌
    Players       map[string]*BRNNPlayer
    GameCount     int64            // 局数
    TrendHistory  []TrendRecord    // 走势记录
    mu            sync.RWMutex
}

type BettingArea struct {
    Index      int       // 0天/1地/2玄/3黄
    Cards      []int     // 5张牌
    CardResult CardResult // 牌型结果
    TotalBet   int64     // 该区域总下注额
}

type BRNNPlayer struct {
    ID        string
    NickName  string
    Avatar    string
    Balance   int64
    ConnWrap  *ws.WsConnWrap
    Bets      [4]int64   // 四个区域的下注额
    WinAmount int64      // 本局赢输
}

type TrendRecord struct {
    GameID     int64
    DealerNiu  int       // 庄家牛型
    AreaNiu    [4]int    // 各区域牛型
    AreaWin    [4]bool   // 各区域是否赢庄
}
```

### 结算逻辑

```
对每个区域 i (天/地/玄/黄):
    比牌: Areas[i].CardResult vs DealerCards.CardResult
    if 区域赢:
        对该区域每个下注玩家: 赢 = 下注 × 区域牌型倍率
    else:
        对该区域每个下注玩家: 输 = 下注 × 庄家牌型倍率
```

牌型倍率复用 QZNN 规则：无牛~牛6=1x, 牛7-8=2x, 牛9=3x, 牛牛=4x, 五花=6x, 炸弹=8x, 五小=10x

---

## 客户端架构

### 修改 LoadingPage.vue

游戏选择增加"百人牛牛"入口。选择后直接发送 `BRNN.PlayerJoin`，无房间等级选择。

### 新增路由

`/brnn` → `BRNNGameView.vue`

### 新增文件

```
client/src/
├── views/BRNNGameView.vue     — 百人牛牛主界面
├── stores/brnn.js             — BRNN 状态管理
└── components/brnn/
    ├── BettingArea.vue        — 四个下注区域
    ├── ChipSelector.vue       — 筹码选择栏
    ├── DealerCards.vue        — 庄家牌展示
    ├── AreaCards.vue           — 区域牌展示
    ├── TrendChart.vue         — 走势图
    └── SettlementOverlay.vue  — 结算弹层
```

### UI 布局（纯 CSS）

```
┌─────────────────────────────────────┐
│ [退出]  余额:1000   在线:58人       │
├─────────────────────────────────────┤
│         [庄家: 牛牛 ×4]             │
│          5张牌展示区                │
├────────┬────────┬────────┬─────────┤
│ 天区   │ 地区    │ 玄区   │ 黄区    │
│ 牛7×2  │ 牛3×1  │ 没牛×1 │ 牛牛×4  │
│ 总:5000│ 总:3200│ 总:1800│ 总:4100 │
│ 我:100 │ 我:200 │ 我:0   │ 我:50   │
├────────┴────────┴────────┴─────────┤
│ 筹码: [10] [50] [100] [500] [1000] │
│ [走势图]            [倒计时: 12s]   │
└─────────────────────────────────────┘
```

---

## WebSocket 协议

### Client → Server

| Cmd | Data | 说明 |
|---|---|---|
| `BRNN.PlayerJoin` | `{}` | 加入百人牛牛 |
| `BRNN.PlayerLeave` | `{}` | 离开 |
| `BRNN.PlaceBet` | `{Area: int, Chip: int64}` | 下注（Area=0天/1地/2玄/3黄，Chip=筹码面值） |
| `BRNN.LobbyConfig` | `{}` | 获取配置（筹码档位、限额等） |

### Server → Client Push

| PushType | Data | 说明 |
|---|---|---|
| `BRNN.PushRoomState` | `{State, LeftSec, Areas[], Dealer{}, GameCount}` | 完整房间状态（加入时/状态变化时） |
| `BRNN.PushBetUpdate` | `{AreaBets: [4]int64, MyBets: [4]int64}` | 下注汇总更新 |
| `BRNN.PushDeal` | `{Dealer: {Cards}, Areas: [{Cards}]}` | 发牌数据 |
| `BRNN.PushShowCard` | `{Dealer: {CardResult}, Areas: [{CardResult}]}` | 开牌结果 |
| `BRNN.PushSettlement` | `{AreaWin: [4]bool, AreaMult: [4]int, MyWin: int64, MyBalance: int64}` | 结算结果 |
| `BRNN.PushPlayerCount` | `{Count: int}` | 在线人数变化 |
| `BRNN.PushTrend` | `{History: []TrendRecord}` | 走势数据 |

---

## Team 分工（4开发 + 1测试）

| 角色 | 负责范围 | 关键产出 |
|---|---|---|
| **后端 A** | `game/brnn/` 全部：FSM、下注、结算、config | 核心游戏逻辑 |
| **后端 B** | `ctl.go`/`handler.go`/`router.go` 集成 + DB模型 + 策略系统 | 服务端集成 |
| **前端 A** | `BRNNGameView.vue` + 所有 brnn 组件 + 动画 | 游戏界面 |
| **前端 B** | `stores/brnn.js` + `LoadingPage.vue` 改造 + 路由 + 协议对接 | 基础框架 |
| **测试** | 测试用例编写 + 功能/接口/并发/回归测试 | 质量保证 |

### 开发顺序

```
Week 1:  [后端A] 协议定义 + 数据结构 + 配置 ────────┐
         [前端B] 路由 + Store 骨架 + LoadingPage改造  │
                                                      ▼
Week 2:  [后端A] FSM + 下注系统 + 结算    [前端A] 主界面 + 下注面板
         [后端B] 集成 ctl/handler/router   [前端B] 协议对接 + 推送处理
         [测试] 编写测试用例 + 单元测试

Week 3:  [后端A] 策略系统(如需要)          [前端A] 发牌/开牌动画 + 结算
         [后端B] DB模型 + 游戏记录          [前端B] 走势图 + 历史记录
         [测试] 接口测试 + 功能测试

Week 4:  [全员] 联调 + Bug修复
         [测试] 并发测试 + 回归测试(QZNN) + 配置测试
```

### 测试人员职责

| 测试阶段 | 内容 |
|---|---|
| 单元测试 | 牌型计算、比牌逻辑、结算金额计算（Go test） |
| 接口测试 | WebSocket 协议各 Cmd 的请求/响应验证 |
| 功能测试 | 下注流程、结算正确性、余额变动、边界（余额不足/超限/下注超时） |
| 并发测试 | 多人同时下注、进出房间不影响游戏循环 |
| 回归测试 | 确认 QZNN 所有功能不受影响 |
| 配置测试 | 修改筹码/时间配置后游戏行为正确 |
