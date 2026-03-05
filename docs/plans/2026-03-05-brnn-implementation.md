# 百人牛牛 (BRNN) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 百人牛牛 (Hundred-player Niu Niu) game alongside the existing 抢庄牛牛, with system banker, 4 betting areas (天/地/玄/黄), configurable chips and timing, and a simple CSS frontend.

**Architecture:** BRNN is implemented as a parallel package `game/brnn/` alongside `game/qznn/` with zero cross-contamination. The BRNN room is a singleton (one room, auto-cycling). Integration into the existing server is done by adding new `case` branches in `ctl.go` dispatch and new handler functions in a separate file `handler_brnn.go`. The client adds a new route `/brnn` with a dedicated `BRNNGameView.vue` and `stores/brnn.js`.

**Tech Stack:** Go 1.25, Vue 3 + Vant 4, msgpack WebSocket protocol, Pinia stores

**Design Doc:** `docs/plans/2026-03-05-brnn-design.md`

---

## Team Roles

| Role | Scope |
|---|---|
| **后端 A** | `game/brnn/` package: config, types, FSM logic, settlement |
| **后端 B** | Integration: `ctl.go`, `handler_brnn.go`, `router.go`, `manager.go` BRNN extension, `znet/` router types |
| **前端 A** | `BRNNGameView.vue` + all brnn components (BettingArea, ChipSelector, DealerCards, AreaCards, TrendChart, SettlementOverlay) |
| **前端 B** | `stores/brnn.js`, `LoadingPage.vue` modification, `router/index.js`, protocol integration |
| **测试** | Unit tests (Go), WebSocket integration tests, functional tests, regression tests |

---

## Task 1: BRNN Protocol & Types (后端 A)

Create the network protocol definitions and core data structures.

**Files:**
- Create: `server/service/mainClient/game/brnn/types_net.go`
- Create: `server/service/mainClient/game/brnn/types_logic.go`
- Create: `server/service/mainClient/game/brnn/config.go`

### Step 1: Create `types_net.go` — Command & Push constants

```go
package brnn

import "service/comm"

const BRNN_Prefix = "BRNN."

const (
	CmdLobbyConfig comm.CmdType = BRNN_Prefix + "LobbyConfig"
	CmdPlayerJoin  comm.CmdType = BRNN_Prefix + "PlayerJoin"
	CmdPlayerLeave comm.CmdType = BRNN_Prefix + "PlayerLeave"
	CmdPlaceBet    comm.CmdType = BRNN_Prefix + "PlaceBet"
)

const (
	PushRoomState   comm.PushType = "BRNN.PushRoomState"
	PushBetUpdate   comm.PushType = "BRNN.PushBetUpdate"
	PushDeal        comm.PushType = "BRNN.PushDeal"
	PushShowCard    comm.PushType = "BRNN.PushShowCard"
	PushSettlement  comm.PushType = "BRNN.PushSettlement"
	PushPlayerCount comm.PushType = "BRNN.PushPlayerCount"
	PushTrend       comm.PushType = "BRNN.PushTrend"
)

// --- Request structs ---

type ReqPlaceBet struct {
	Area int   `json:"Area"` // 0=天, 1=地, 2=玄, 3=黄
	Chip int64 `json:"Chip"` // 筹码面值
}

// --- Push structs ---

type PushRoomStateData struct {
	State       RoomState       `json:"State"`
	LeftSec     int             `json:"LeftSec"`
	GameCount   int64           `json:"GameCount"`
	PlayerCount int             `json:"PlayerCount"`
	Areas       [AreaCount]AreaInfo `json:"Areas"`
	Dealer      DealerInfo      `json:"Dealer"`
	MyBets      [AreaCount]int64 `json:"MyBets"`
	Config      *BRNNClientConfig `json:"Config,omitempty"`
	Trend       []TrendRecord   `json:"Trend,omitempty"`
}

type AreaInfo struct {
	Index    int    `json:"Index"`
	Name     string `json:"Name"`
	Cards    []int  `json:"Cards,omitempty"`
	NiuType  int64  `json:"NiuType"`
	NiuMult  int64  `json:"NiuMult"`
	TotalBet int64  `json:"TotalBet"`
	Win      *bool  `json:"Win,omitempty"` // nil = not settled yet
}

type DealerInfo struct {
	Cards   []int `json:"Cards,omitempty"`
	NiuType int64 `json:"NiuType"`
	NiuMult int64 `json:"NiuMult"`
}

type PushBetUpdateData struct {
	AreaBets [AreaCount]int64 `json:"AreaBets"`
	MyBets   [AreaCount]int64 `json:"MyBets"`
}

type PushSettlementData struct {
	AreaWin  [AreaCount]bool  `json:"AreaWin"`
	AreaMult [AreaCount]int64 `json:"AreaMult"`
	MyWin    int64            `json:"MyWin"`
	MyBalance int64           `json:"MyBalance"`
}

type BRNNClientConfig struct {
	Chips         []int64 `json:"Chips"`
	MaxBetPerArea int64   `json:"MaxBetPerArea"`
	MinBalance    int64   `json:"MinBalance"`
}
```

### Step 2: Create `types_logic.go` — Room, Player, Area structures

```go
package brnn

import (
	"compoment/ws"
	"service/mainClient/game/qznn"
	"sync"
	"time"
)

const (
	AreaCount    = 4
	GameName     = "brnn"
	PlayerCardMax = 5
	TrendMaxLen  = 50
)

type RoomState string

const (
	StateBetting  RoomState = "StateBetting"  // 下注中
	StateDealing  RoomState = "StateDealing"  // 发牌中
	StateShowCard RoomState = "StateShowCard" // 开牌中
	StateSettling RoomState = "StateSettling" // 结算中
)

var AreaNames = [AreaCount]string{"天", "地", "玄", "黄"}

// BettingArea represents one of the 4 betting positions
type BettingArea struct {
	Index      int
	Name       string
	Cards      []int
	CardResult qznn.CardResult
	TotalBet   int64
}

// BRNNPlayer represents a player in the room
type BRNNPlayer struct {
	ID       string
	NickName string
	Avatar   string
	Balance  int64
	ConnWrap *ws.WsConnWrap
	Bets     [AreaCount]int64 // per-area bets this round
}

// TrendRecord stores one round's result for trend chart
type TrendRecord struct {
	GameCount int64            `json:"GameCount"`
	DealerNiu int64            `json:"DealerNiu"`
	AreaNiu   [AreaCount]int64 `json:"AreaNiu"`
	AreaWin   [AreaCount]bool  `json:"AreaWin"`
}

// BRNNRoom is the singleton game room
type BRNNRoom struct {
	ID            string
	State         RoomState
	StateDeadline time.Time
	StateLeftSec  int
	GameCount     int64
	Config        *BRNNConfig

	Dealer  BettingArea          // 庄家
	Areas   [AreaCount]*BettingArea
	Players map[string]*BRNNPlayer
	Deck    []int
	Trend   []TrendRecord

	mu       sync.RWMutex
	driverGo chan struct{}
}

func (r *BRNNRoom) UpdateStateLeftSec() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.StateDeadline.IsZero() {
		return
	}
	t := time.Until(r.StateDeadline)
	if t <= 0 {
		r.StateLeftSec = 0
		r.StateDeadline = time.Time{}
		return
	}
	r.StateLeftSec = int((t + time.Second - 1) / time.Second)
}
```

### Step 3: Create `config.go` — Configurable game parameters

```go
package brnn

// BRNNConfig holds all configurable game parameters
type BRNNConfig struct {
	Chips         []int64 `json:"Chips"`         // 筹码档位
	MaxBetPerArea int64   `json:"MaxBetPerArea"` // 单区域单人最大下注
	MinBalance    int64   `json:"MinBalance"`    // 最低入场余额

	SecBetting  int `json:"SecBetting"`  // 下注阶段时长（秒）
	SecDealing  int `json:"SecDealing"`  // 发牌阶段时长
	SecShowCard int `json:"SecShowCard"` // 开牌阶段时长
	SecSettling int `json:"SecSettling"` // 结算阶段时长
}

// DefaultConfig returns the default game configuration
var DefaultConfig = &BRNNConfig{
	Chips:         []int64{10, 50, 100, 500, 1000},
	MaxBetPerArea: 50000,
	MinBalance:    100,

	SecBetting:  15,
	SecDealing:  3,
	SecShowCard: 8,
	SecSettling: 5,
}

// ValidChip checks if a chip value is in the configured list
func (c *BRNNConfig) ValidChip(chip int64) bool {
	for _, v := range c.Chips {
		if v == chip {
			return true
		}
	}
	return false
}
```

### Step 4: Verify compilation

Run: `cd /Users/just/Projects/g3q/server/service && go build ./mainClient/game/brnn/`
Expected: No errors

### Step 5: Commit

```bash
git add server/service/mainClient/game/brnn/
git commit -m "feat(brnn): add protocol definitions, data structures, and config"
```

---

## Task 2: BRNN Core Game Logic — FSM & Settlement (后端 A)

Implement the FSM loop, card dealing, and settlement logic.

**Files:**
- Create: `server/service/mainClient/game/brnn/logic.go`

### Step 1: Create `logic.go` — Room lifecycle, FSM, settlement

```go
package brnn

import (
	"fmt"
	"math/rand"
	"service/comm"
	"service/mainClient/game/qznn"
	"time"

	"github.com/sirupsen/logrus"
)

// NewRoom creates and starts the singleton BRNN room
func NewRoom(id string, cfg *BRNNConfig) *BRNNRoom {
	r := &BRNNRoom{
		ID:       id,
		Config:   cfg,
		Players:  make(map[string]*BRNNPlayer),
		Trend:    make([]TrendRecord, 0, TrendMaxLen),
		driverGo: make(chan struct{}),
	}
	for i := 0; i < AreaCount; i++ {
		r.Areas[i] = &BettingArea{Index: i, Name: AreaNames[i]}
	}
	r.Dealer = BettingArea{Index: -1, Name: "庄"}
	go r.driverLogicTick()
	// Start first round immediately
	r.setState(StateBetting, cfg.SecBetting)
	return r
}

func (r *BRNNRoom) Destroy() {
	close(r.driverGo)
}

// --- State Management ---

func (r *BRNNRoom) setState(state RoomState, sec int) {
	r.mu.Lock()
	r.State = state
	if sec > 0 {
		r.StateDeadline = time.Now().Add(time.Duration(sec) * time.Second)
		r.StateLeftSec = sec
	} else {
		r.StateDeadline = time.Time{}
		r.StateLeftSec = 0
	}
	r.mu.Unlock()

	logrus.WithField("state", state).WithField("sec", sec).WithField("game", r.GameCount).Info("BRNN-StateChange")

	// Broadcast state change to all players
	r.broadcastRoomState()
}

func (r *BRNNRoom) getState() RoomState {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.State
}

// --- FSM Driver ---

func (r *BRNNRoom) driverLogicTick() {
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.driverGo:
			return
		case <-ticker.C:
			r.UpdateStateLeftSec()
			r.logicTick()
		}
	}
}

func (r *BRNNRoom) logicTick() {
	r.mu.RLock()
	state := r.State
	leftSec := r.StateLeftSec
	r.mu.RUnlock()

	if leftSec > 0 {
		return // still counting down
	}

	switch state {
	case StateBetting:
		r.onBettingEnd()
	case StateDealing:
		r.onDealingEnd()
	case StateShowCard:
		r.onShowCardEnd()
	case StateSettling:
		r.onSettlingEnd()
	}
}

// --- Phase Transitions ---

func (r *BRNNRoom) onBettingEnd() {
	r.GameCount++
	r.dealCards()
	r.setState(StateDealing, r.Config.SecDealing)
}

func (r *BRNNRoom) onDealingEnd() {
	r.calcResults()
	r.setState(StateShowCard, r.Config.SecShowCard)
}

func (r *BRNNRoom) onShowCardEnd() {
	r.settle()
	r.setState(StateSettling, r.Config.SecSettling)
}

func (r *BRNNRoom) onSettlingEnd() {
	r.resetRound()
	r.setState(StateBetting, r.Config.SecBetting)
}

// --- Card Dealing ---

func (r *BRNNRoom) dealCards() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Create and shuffle deck (52 cards)
	r.Deck = make([]int, 52)
	for i := range r.Deck {
		r.Deck[i] = i
	}
	rand.Shuffle(len(r.Deck), func(i, j int) {
		r.Deck[i], r.Deck[j] = r.Deck[j], r.Deck[i]
	})

	// Deal 5 cards to dealer + each area = 25 cards total
	pos := 0
	r.Dealer.Cards = make([]int, PlayerCardMax)
	copy(r.Dealer.Cards, r.Deck[pos:pos+PlayerCardMax])
	pos += PlayerCardMax

	for i := 0; i < AreaCount; i++ {
		r.Areas[i].Cards = make([]int, PlayerCardMax)
		copy(r.Areas[i].Cards, r.Deck[pos:pos+PlayerCardMax])
		pos += PlayerCardMax
	}
}

func (r *BRNNRoom) calcResults() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.Dealer.CardResult = qznn.CalcNiu(r.Dealer.Cards)
	for i := 0; i < AreaCount; i++ {
		r.Areas[i].CardResult = qznn.CalcNiu(r.Areas[i].Cards)
	}
}

// --- Settlement ---

func (r *BRNNRoom) settle() {
	r.mu.Lock()

	dealerResult := r.Dealer.CardResult
	var areaWin [AreaCount]bool

	for i := 0; i < AreaCount; i++ {
		areaWin[i] = qznn.CompareCards(r.Areas[i].CardResult, dealerResult)
	}

	// Calculate per-player winnings
	for _, p := range r.Players {
		var totalWin int64
		for i := 0; i < AreaCount; i++ {
			if p.Bets[i] <= 0 {
				continue
			}
			if areaWin[i] {
				// Area beats dealer: win = bet * area multiplier
				totalWin += p.Bets[i] * r.Areas[i].CardResult.Mult
			} else {
				// Dealer beats area: lose = bet * dealer multiplier
				totalWin -= p.Bets[i] * dealerResult.Mult
			}
		}
		p.Balance += totalWin
	}

	// Record trend
	trend := TrendRecord{
		GameCount: r.GameCount,
		DealerNiu: dealerResult.Niu,
	}
	for i := 0; i < AreaCount; i++ {
		trend.AreaNiu[i] = r.Areas[i].CardResult.Niu
		trend.AreaWin[i] = areaWin[i]
	}
	r.Trend = append(r.Trend, trend)
	if len(r.Trend) > TrendMaxLen {
		r.Trend = r.Trend[len(r.Trend)-TrendMaxLen:]
	}

	r.mu.Unlock()

	// Broadcast settlement to each player with their personal results
	r.mu.RLock()
	for _, p := range r.Players {
		data := PushSettlementData{
			AreaWin:   areaWin,
			MyBalance: p.Balance,
		}
		for i := 0; i < AreaCount; i++ {
			if areaWin[i] {
				data.AreaMult[i] = r.Areas[i].CardResult.Mult
			} else {
				data.AreaMult[i] = dealerResult.Mult
			}
		}
		// Calc this player's win
		var myWin int64
		for i := 0; i < AreaCount; i++ {
			if p.Bets[i] <= 0 {
				continue
			}
			if areaWin[i] {
				myWin += p.Bets[i] * r.Areas[i].CardResult.Mult
			} else {
				myWin -= p.Bets[i] * dealerResult.Mult
			}
		}
		data.MyWin = myWin
		r.pushPlayer(p, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushSettlement,
			Data:     data,
		})
	}
	r.mu.RUnlock()

	// TODO: Persist game records to DB (Task 5)
}

// --- Round Reset ---

func (r *BRNNRoom) resetRound() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.Deck = nil
	r.Dealer.Cards = nil
	r.Dealer.CardResult = qznn.CardResult{}
	for i := 0; i < AreaCount; i++ {
		r.Areas[i].Cards = nil
		r.Areas[i].CardResult = qznn.CardResult{}
		r.Areas[i].TotalBet = 0
	}
	for _, p := range r.Players {
		p.Bets = [AreaCount]int64{}
	}
}

// --- Player Management ---

func (r *BRNNRoom) AddPlayer(p *BRNNPlayer) {
	r.mu.Lock()
	r.Players[p.ID] = p
	count := len(r.Players)
	r.mu.Unlock()

	logrus.WithField("uid", p.ID).WithField("count", count).Info("BRNN-PlayerJoin")

	// Broadcast player count
	r.broadcastPlayerCount()
}

func (r *BRNNRoom) RemovePlayer(userId string) {
	r.mu.Lock()
	delete(r.Players, userId)
	count := len(r.Players)
	r.mu.Unlock()

	logrus.WithField("uid", userId).WithField("count", count).Info("BRNN-PlayerLeave")
	r.broadcastPlayerCount()
}

func (r *BRNNRoom) GetPlayer(userId string) *BRNNPlayer {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Players[userId]
}

func (r *BRNNRoom) GetPlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players)
}

func (r *BRNNRoom) SetWsWrap(userId string, connWrap *ws.WsConnWrap) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, ok := r.Players[userId]; ok {
		p.ConnWrap = connWrap
	}
}

// --- Betting ---

func (r *BRNNRoom) PlaceBet(userId string, area int, chip int64) error {
	if area < 0 || area >= AreaCount {
		return comm.NewMyError("无效的下注区域")
	}
	if !r.Config.ValidChip(chip) {
		return comm.NewMyError("无效的筹码面值")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if r.State != StateBetting {
		return comm.NewMyError("当前不在下注阶段")
	}

	p, ok := r.Players[userId]
	if !ok {
		return comm.NewMyError("玩家不在房间")
	}

	// Check total bets don't exceed balance
	var totalBets int64
	for i := 0; i < AreaCount; i++ {
		totalBets += p.Bets[i]
	}
	if totalBets+chip > p.Balance {
		return comm.NewMyError("余额不足")
	}

	// Check per-area limit
	if p.Bets[area]+chip > r.Config.MaxBetPerArea {
		return comm.NewMyError("超过单区域下注上限")
	}

	p.Bets[area] += chip
	r.Areas[area].TotalBet += chip
	return nil
}

// --- Broadcasting ---

func (r *BRNNRoom) broadcastRoomState() {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, p := range r.Players {
		data := r.buildRoomStateData(p)
		r.pushPlayer(p, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushRoomState,
			Data:     data,
		})
	}
}

func (r *BRNNRoom) buildRoomStateData(p *BRNNPlayer) PushRoomStateData {
	data := PushRoomStateData{
		State:       r.State,
		LeftSec:     r.StateLeftSec,
		GameCount:   r.GameCount,
		PlayerCount: len(r.Players),
	}

	// Areas
	for i := 0; i < AreaCount; i++ {
		a := r.Areas[i]
		info := AreaInfo{
			Index:    i,
			Name:     a.Name,
			TotalBet: a.TotalBet,
		}
		// Only send cards after dealing
		if r.State == StateShowCard || r.State == StateSettling {
			info.Cards = a.Cards
			info.NiuType = a.CardResult.Niu
			info.NiuMult = a.CardResult.Mult
		}
		data.Areas[i] = info
	}

	// Dealer
	if r.State == StateShowCard || r.State == StateSettling {
		data.Dealer = DealerInfo{
			Cards:   r.Dealer.Cards,
			NiuType: r.Dealer.CardResult.Niu,
			NiuMult: r.Dealer.CardResult.Mult,
		}
	}

	// Personal bets
	if p != nil {
		data.MyBets = p.Bets
	}

	return data
}

func (r *BRNNRoom) BroadcastBetUpdate() {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, p := range r.Players {
		data := PushBetUpdateData{}
		for i := 0; i < AreaCount; i++ {
			data.AreaBets[i] = r.Areas[i].TotalBet
		}
		data.MyBets = p.Bets
		r.pushPlayer(p, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushBetUpdate,
			Data:     data,
		})
	}
}

func (r *BRNNRoom) broadcastPlayerCount() {
	r.mu.RLock()
	defer r.mu.RUnlock()

	count := len(r.Players)
	for _, p := range r.Players {
		r.pushPlayer(p, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayerCount,
			Data:     map[string]int{"Count": count},
		})
	}
}

func (r *BRNNRoom) pushPlayer(p *BRNNPlayer, msg any) {
	if p.ConnWrap == nil {
		return
	}
	_ = comm.WriteMsgPack(p.ConnWrap, msg)
}

// GetRoomStateForPlayer builds the full room state for a specific player (used on join)
func (r *BRNNRoom) GetRoomStateForPlayer(userId string) PushRoomStateData {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p := r.Players[userId]
	data := r.buildRoomStateData(p)
	data.Config = &BRNNClientConfig{
		Chips:         r.Config.Chips,
		MaxBetPerArea: r.Config.MaxBetPerArea,
		MinBalance:    r.Config.MinBalance,
	}
	data.Trend = r.Trend
	return data
}
```

### Step 2: Verify compilation

Run: `cd /Users/just/Projects/g3q/server/service && go build ./mainClient/game/brnn/`
Expected: No errors

### Step 3: Commit

```bash
git add server/service/mainClient/game/brnn/logic.go
git commit -m "feat(brnn): implement FSM game loop, card dealing, and settlement logic"
```

---

## Task 3: Server Integration — Handlers, Dispatch, Router (后端 B)

Wire BRNN into the existing server without touching QZNN code.

**Files:**
- Create: `server/service/mainClient/handler_brnn.go`
- Modify: `server/service/mainClient/ctl.go:242-269` — add BRNN cases to switch
- Modify: `server/service/mainClient/router.go:28-35` — add route
- Modify: `server/service/mainClient/game/manager.go` — add BRNN room management
- Modify: `server/service/mainClient/game/znet/game_net.go:17-20` — add Brnn router type

### Step 1: Add BRNN router type to `znet/game_net.go`

Add after line 19 (`Game RouterType = "game"`):

```go
Brnn RouterType = "brnn"
```

### Step 2: Add BRNN room to manager — extend `manager.go`

Add to `managerState` struct (line 17-20) a new field:

```go
type managerState struct {
	rooms      map[string]*qznn.QZNNRoom
	brnnRoom   *brnn.BRNNRoom // singleton BRNN room
	isDraining bool
}
```

Add import `"service/mainClient/game/brnn"` to imports.

Add new methods at the end of `manager.go`:

```go
// GetBRNNRoom returns the singleton BRNN room, creating it if needed
func (rm *RoomManager) GetBRNNRoom() *brnn.BRNNRoom {
	return syncOp(rm, func(s *managerState) *brnn.BRNNRoom {
		if s.brnnRoom == nil {
			s.brnnRoom = brnn.NewRoom("brnn_main", brnn.DefaultConfig)
		}
		return s.brnnRoom
	})
}

// CheckPlayerInBRNN checks if player is in the BRNN room
func (rm *RoomManager) CheckPlayerInBRNN(userId string) *brnn.BRNNPlayer {
	return syncOp(rm, func(s *managerState) *brnn.BRNNPlayer {
		if s.brnnRoom == nil {
			return nil
		}
		return s.brnnRoom.GetPlayer(userId)
	})
}
```

### Step 3: Create `handler_brnn.go` — all BRNN handler functions

```go
package mainClient

import (
	"compoment/ws"
	"encoding/json"
	"service/comm"
	"service/mainClient/game"
	"service/mainClient/game/brnn"
	"service/mainClient/game/znet"
	"service/modelClient"

	"github.com/sirupsen/logrus"
)

func handleBRNNPlayerJoin(connWrap *ws.WsConnWrap, appId, appUserId string) error {
	userId := appId + appUserId

	user, err := modelClient.GetOrCreateUser(appId, appUserId)
	if err != nil {
		return comm.NewMyError("获取用户信息失败")
	}

	room := game.GetMgr().GetBRNNRoom()

	// Check if already in QZNN room
	qznnRoom, _ := game.GetMgr().CheckPlayerInRoom(userId)
	if qznnRoom != nil {
		return comm.NewMyError("请先退出抢庄牛牛房间")
	}

	// Check if already in BRNN
	existing := room.GetPlayer(userId)
	if existing != nil {
		// Reconnect: update ws connection
		existing.ConnWrap = connWrap
		// Push current room state
		_ = comm.WriteMsgPack(connWrap, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: znet.PushRouter,
			Data: znet.PushRouterStruct{
				Router: znet.Brnn,
				SelfId: userId,
			},
		})
		return nil
	}

	// Check minimum balance
	if user.Balance < room.Config.MinBalance {
		return comm.NewMyError("余额不足")
	}

	p := &brnn.BRNNPlayer{
		ID:       userId,
		NickName: user.NickName,
		Avatar:   user.Avatar,
		Balance:  user.Balance,
		ConnWrap: connWrap,
	}
	if p.NickName == "" {
		p.NickName = user.UserId
	}

	room.AddPlayer(p)

	// Push router to BRNN game view
	_ = comm.WriteMsgPack(connWrap, comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: znet.PushRouter,
		Data: znet.PushRouterStruct{
			Router: znet.Brnn,
			SelfId: userId,
		},
	})

	// Push full room state with config and trend
	roomState := room.GetRoomStateForPlayer(userId)
	_ = comm.WriteMsgPack(connWrap, comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: brnn.PushRoomState,
		Data:     roomState,
	})

	return nil
}

func handleBRNNPlayerLeave(userId string) error {
	room := game.GetMgr().GetBRNNRoom()
	p := room.GetPlayer(userId)
	if p == nil {
		return comm.NewMyError("玩家不在房间")
	}

	// Cannot leave during settling if has active bets
	state := room.GetState()
	if state != brnn.StateBetting && state != brnn.StateSettling {
		// Check if player has bets this round
		hasBets := false
		for i := 0; i < brnn.AreaCount; i++ {
			if p.Bets[i] > 0 {
				hasBets = true
				break
			}
		}
		if hasBets {
			return comm.NewMyError("本局有下注，请等待结算后再离开")
		}
	}

	// TODO: Unlock balance back to user model (when balance locking is implemented)

	room.RemovePlayer(userId)

	// Push router back to lobby
	if p.ConnWrap != nil {
		_ = comm.WriteMsgPack(p.ConnWrap, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: znet.PushRouter,
			Data:     znet.PushRouterStruct{Router: znet.Lobby},
		})
	}

	return nil
}

func handleBRNNPlaceBet(userId string, data []byte) error {
	var req brnn.ReqPlaceBet
	if err := json.Unmarshal(data, &req); err != nil {
		return comm.ErrClientParam
	}

	room := game.GetMgr().GetBRNNRoom()
	if err := room.PlaceBet(userId, req.Area, req.Chip); err != nil {
		return err
	}

	// Broadcast updated bet totals
	room.BroadcastBetUpdate()
	return nil
}

func handleBRNNLobbyConfig() *BRNNLobbyConfigRsp {
	room := game.GetMgr().GetBRNNRoom()
	return &BRNNLobbyConfigRsp{
		Config: &brnn.BRNNClientConfig{
			Chips:         room.Config.Chips,
			MaxBetPerArea: room.Config.MaxBetPerArea,
			MinBalance:    room.Config.MinBalance,
		},
	}
}

type BRNNLobbyConfigRsp struct {
	Config *brnn.BRNNClientConfig `json:"Config"`
}
```

### Step 4: Add BRNN cases to `ctl.go` dispatch

In `ctl.go`, add import for `"service/mainClient/game/brnn"` and add cases before `default:` (line 267):

```go
	// --- BRNN ---
	case brnn.CmdPlayerJoin:
		errRsp = handleBRNNPlayerJoin(connWrap, appId, appUserId)
	case brnn.CmdPlayerLeave:
		errRsp = handleBRNNPlayerLeave(userId)
	case brnn.CmdPlaceBet:
		errRsp = handleBRNNPlaceBet(userId, msg.Data)
	case brnn.CmdLobbyConfig:
		rsp.Data = handleBRNNLobbyConfig()
```

### Step 5: Update `handleConnection` in `ctl.go` to check BRNN room on reconnect

In `ctl.go` line 117-138, inside `doOnce.Do`, after checking QZNN room, add BRNN check:

```go
doOnce.Do(func() {
	// Check QZNN room first
	room := game.GetMgr().GetPlayerRoom(userId)
	if room != nil {
		room.SetWsWrap(userId, connWrap)
		_ = comm.WriteMsgPack(connWrap, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: znet.PushRouter,
			Data: znet.PushRouterStruct{
				Router: znet.Game,
				Room:   room,
				SelfId: userId}})
	} else if brnnPlayer := game.GetMgr().CheckPlayerInBRNN(userId); brnnPlayer != nil {
		// In BRNN room - reconnect
		brnnRoom := game.GetMgr().GetBRNNRoom()
		brnnRoom.SetWsWrap(userId, connWrap)
		_ = comm.WriteMsgPack(connWrap, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: znet.PushRouter,
			Data: znet.PushRouterStruct{
				Router: znet.Brnn,
				SelfId: userId}})
	} else {
		_ = comm.WriteMsgPack(connWrap, comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: znet.PushRouter,
			Data: znet.PushRouterStruct{
				Router: znet.Lobby}})
	}
})
```

### Step 6: Verify compilation

Run: `cd /Users/just/Projects/g3q/server/service && go build ./mainClient/...`
Expected: No errors

### Step 7: Commit

```bash
git add server/service/mainClient/handler_brnn.go server/service/mainClient/ctl.go server/service/mainClient/router.go server/service/mainClient/game/manager.go server/service/mainClient/game/znet/game_net.go
git commit -m "feat(brnn): integrate BRNN handlers, dispatch, router, and manager"
```

---

## Task 4: Client — Route, Store, LoadingPage (前端 B)

Set up the client infrastructure for BRNN.

**Files:**
- Modify: `client/src/router/index.js` — add `/brnn` route
- Create: `client/src/stores/brnn.js` — BRNN Pinia store
- Modify: `client/src/views/LoadingPage.vue` — add BRNN game selector

### Step 1: Add `/brnn` route to `router/index.js`

Add import and route:

```js
import { createRouter, createWebHashHistory } from 'vue-router'
import LobbyView from '../views/LobbyView.vue'
import GameView from '../views/GameView.vue'
import LoadingPage from '../views/LoadingPage.vue'
import BRNNGameView from '../views/BRNNGameView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'loading',
      component: LoadingPage
    },
    {
      path: '/lobby',
      name: 'lobby',
      component: LobbyView
    },
    {
      path: '/game',
      name: 'game',
      component: GameView
    },
    {
      path: '/brnn',
      name: 'brnn',
      component: BRNNGameView
    }
  ]
})

router.beforeEach((to, from, next) => {
  next();
});

export default router
```

### Step 2: Create `stores/brnn.js`

```js
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import gameClient from '../socket.js'

export const useBrnnStore = defineStore('brnn', () => {
  // Room state
  const currentPhase = ref('IDLE')
  const countdown = ref(0)
  const gameCount = ref(0)
  const playerCount = ref(0)

  // Config (received from server on join)
  const chips = ref([10, 50, 100, 500, 1000])
  const maxBetPerArea = ref(50000)
  const selectedChip = ref(0) // index into chips array

  // Areas: [{name, totalBet, myBet, cards, niuType, niuMult, win}]
  const areas = ref([
    { name: '天', totalBet: 0, myBet: 0, cards: [], niuType: 0, niuMult: 0, win: null },
    { name: '地', totalBet: 0, myBet: 0, cards: [], niuType: 0, niuMult: 0, win: null },
    { name: '玄', totalBet: 0, myBet: 0, cards: [], niuType: 0, niuMult: 0, win: null },
    { name: '黄', totalBet: 0, myBet: 0, cards: [], niuType: 0, niuMult: 0, win: null },
  ])

  // Dealer
  const dealer = ref({ cards: [], niuType: 0, niuMult: 0 })

  // Settlement
  const lastWin = ref(0)

  // Trend history
  const trend = ref([])

  // State mapping
  const stateMap = {
    'StateBetting': 'BETTING',
    'StateDealing': 'DEALING',
    'StateShowCard': 'SHOW_CARD',
    'StateSettling': 'SETTLEMENT',
  }

  // --- Actions ---

  function handleRoomState(data) {
    currentPhase.value = stateMap[data.State] || data.State
    countdown.value = data.LeftSec || 0
    gameCount.value = data.GameCount || 0
    playerCount.value = data.PlayerCount || 0

    // Config (only sent on join)
    if (data.Config) {
      chips.value = data.Config.Chips || chips.value
      maxBetPerArea.value = data.Config.MaxBetPerArea || maxBetPerArea.value
      if (selectedChip.value === 0 && chips.value.length > 0) {
        selectedChip.value = chips.value[0]
      }
    }

    // Trend (only sent on join)
    if (data.Trend) {
      trend.value = data.Trend
    }

    // Areas
    if (data.Areas) {
      for (let i = 0; i < 4; i++) {
        const a = data.Areas[i]
        if (a) {
          areas.value[i].totalBet = a.TotalBet || 0
          areas.value[i].cards = a.Cards || []
          areas.value[i].niuType = a.NiuType || 0
          areas.value[i].niuMult = a.NiuMult || 0
          areas.value[i].win = a.Win
        }
      }
    }

    // My bets
    if (data.MyBets) {
      for (let i = 0; i < 4; i++) {
        areas.value[i].myBet = data.MyBets[i] || 0
      }
    }

    // Dealer
    if (data.Dealer) {
      dealer.value.cards = data.Dealer.Cards || []
      dealer.value.niuType = data.Dealer.NiuType || 0
      dealer.value.niuMult = data.Dealer.NiuMult || 0
    }
  }

  function handleBetUpdate(data) {
    if (data.AreaBets) {
      for (let i = 0; i < 4; i++) {
        areas.value[i].totalBet = data.AreaBets[i] || 0
      }
    }
    if (data.MyBets) {
      for (let i = 0; i < 4; i++) {
        areas.value[i].myBet = data.MyBets[i] || 0
      }
    }
  }

  function handleSettlement(data) {
    lastWin.value = data.MyWin || 0
    for (let i = 0; i < 4; i++) {
      areas.value[i].win = data.AreaWin ? data.AreaWin[i] : null
    }
    // Add to trend
    if (data.AreaWin) {
      trend.value.push({
        GameCount: gameCount.value,
        AreaWin: data.AreaWin,
        AreaMult: data.AreaMult,
      })
      if (trend.value.length > 50) {
        trend.value = trend.value.slice(-50)
      }
    }
  }

  function handlePlayerCount(data) {
    playerCount.value = data.Count || 0
  }

  // --- Network Actions ---

  function joinRoom() {
    gameClient.send('BRNN.PlayerJoin', {})
  }

  function leaveRoom() {
    gameClient.send('BRNN.PlayerLeave', {})
  }

  function placeBet(areaIndex) {
    if (selectedChip.value <= 0) return
    gameClient.send('BRNN.PlaceBet', {
      Area: areaIndex,
      Chip: selectedChip.value,
    })
  }

  function selectChipValue(chipValue) {
    selectedChip.value = chipValue
  }

  // --- Push Registration ---

  function registerPushHandlers() {
    gameClient.onServerPush('BRNN.PushRoomState', handleRoomState)
    gameClient.onServerPush('BRNN.PushBetUpdate', handleBetUpdate)
    gameClient.onServerPush('BRNN.PushSettlement', handleSettlement)
    gameClient.onServerPush('BRNN.PushPlayerCount', handlePlayerCount)
  }

  function unregisterPushHandlers() {
    gameClient.offServerPush('BRNN.PushRoomState')
    gameClient.offServerPush('BRNN.PushBetUpdate')
    gameClient.offServerPush('BRNN.PushSettlement')
    gameClient.offServerPush('BRNN.PushPlayerCount')
  }

  function resetState() {
    currentPhase.value = 'IDLE'
    countdown.value = 0
    gameCount.value = 0
    for (let i = 0; i < 4; i++) {
      areas.value[i] = { name: ['天','地','玄','黄'][i], totalBet: 0, myBet: 0, cards: [], niuType: 0, niuMult: 0, win: null }
    }
    dealer.value = { cards: [], niuType: 0, niuMult: 0 }
    lastWin.value = 0
  }

  return {
    // State
    currentPhase, countdown, gameCount, playerCount,
    chips, maxBetPerArea, selectedChip,
    areas, dealer, lastWin, trend,
    // Actions
    handleRoomState, handleBetUpdate, handleSettlement, handlePlayerCount,
    joinRoom, leaveRoom, placeBet, selectChipValue,
    registerPushHandlers, unregisterPushHandlers, resetState,
  }
})
```

### Step 3: Modify `LoadingPage.vue` — add game type selector

Replace the mode-selector section (lines 11-17) with:

```vue
<div class="mode-selector">
  <div class="mode-title">选择游戏：</div>
  <div class="mode-buttons-container" style="margin-bottom: 12px;">
    <button @click="selectGameType('qznn')" :class="['mode-btn', { active: gameType === 'qznn' }]" style="background-color: #e67e22 !important;">抢庄牛牛</button>
    <button @click="selectGameType('brnn')" :class="['mode-btn', { active: gameType === 'brnn' }]" style="background-color: #e74c3c !important;">百人牛牛</button>
  </div>
  <template v-if="gameType === 'qznn'">
    <div class="mode-title">选择玩法：</div>
    <div class="mode-buttons-container">
      <button @click="selectMode(0)" :class="['mode-btn', 'mode-0', { active: currentMode === 0 }]">不看牌</button>
      <button @click="selectMode(1)" :class="['mode-btn', 'mode-1', { active: currentMode === 1 }]">看三张</button>
      <button @click="selectMode(2)" :class="['mode-btn', 'mode-2', { active: currentMode === 2 }]">看四张</button>
    </div>
  </template>
  <template v-if="gameType === 'brnn'">
    <div class="mode-title" style="color: #e74c3c;">系统坐庄 · 天地玄黄</div>
  </template>
</div>
```

In `setup()`, add:

```js
const gameType = ref('qznn'); // 'qznn' or 'brnn'
const selectGameType = (type) => {
  gameType.value = type;
};
```

Modify the `PushRouter` handler (line 277-286) to handle `brnn` router:

```js
gameClient.onServerPush('PushRouter', (data) => {
  if (data && data.Router) {
    if (data.Router === 'lobby') {
      targetRoute = '/lobby';
    } else if (data.Router === 'game') {
      targetRoute = '/game?autoJoin=true';
    } else if (data.Router === 'brnn') {
      targetRoute = '/brnn';
    }
    checkReady();
  }
});
```

For BRNN game type, modify `onConnect` to send BRNN.PlayerJoin directly (since no lobby):

```js
gameClient.onConnect = () => {
  gameClient.send("UserInfo");
  if (gameType.value === 'brnn') {
    gameClient.send("BRNN.PlayerJoin");
  } else {
    gameClient.send("QZNN.LobbyConfig");
  }
};
```

For BRNN, the QZNN.LobbyConfig response isn't needed, so mark `hasLobbyConfig = true` immediately:

```js
if (gameType.value === 'brnn') {
  hasLobbyConfig = true; // BRNN doesn't need lobby config
}
```

Export `gameType` and `selectGameType` in the return statement.

### Step 4: Commit

```bash
git add client/src/router/index.js client/src/stores/brnn.js client/src/views/LoadingPage.vue
git commit -m "feat(brnn): add client route, store, and loading page game selector"
```

---

## Task 5: Client — BRNN Game View (前端 A)

Build the main game interface with pure CSS.

**Files:**
- Create: `client/src/views/BRNNGameView.vue`
- Create: `client/src/components/brnn/BettingArea.vue`
- Create: `client/src/components/brnn/ChipSelector.vue`
- Create: `client/src/components/brnn/DealerCards.vue`
- Create: `client/src/components/brnn/AreaCards.vue`
- Create: `client/src/components/brnn/TrendChart.vue`
- Create: `client/src/components/brnn/SettlementOverlay.vue`

### Step 1: Create `BRNNGameView.vue` — main game page

This is the primary layout. Use simple CSS grid/flexbox. Reuse `PokerCard.vue` from QZNN for card rendering.

Layout structure:
```
┌─────────────────────────────────────┐
│ Header: [退出] 余额:xxx  在线:xx人  │
├─────────────────────────────────────┤
│ DealerCards: 庄家 牌+牌型           │
├────────┬────────┬────────┬─────────┤
│ Area 0 │ Area 1 │ Area 2 │ Area 3  │
│ 天     │ 地     │ 玄     │ 黄      │
├────────┴────────┴────────┴─────────┤
│ ChipSelector + countdown            │
│ TrendChart (collapsible)            │
└─────────────────────────────────────┘
```

Key behaviors:
- During `BETTING`: areas are clickable (places selected chip), countdown shows
- During `DEALING`: cards animate into positions (can be simple fade-in)
- During `SHOW_CARD`: cards flip to show values, niu type badges appear
- During `SETTLEMENT`: win/lose overlay per area, balance updates

### Step 2: Create component files

Each component receives props from the store and emits events. Keep styling minimal (borders, background colors, flexbox).

**BettingArea.vue** — shows one area (name, cards, totalBet, myBet, win/lose state), clickable during betting phase.

**ChipSelector.vue** — row of chip buttons, highlights selected.

**DealerCards.vue** — displays dealer's 5 cards and niu type.

**AreaCards.vue** — displays an area's 5 cards and niu type badge.

**TrendChart.vue** — simple table showing last N rounds' results (area win/lose as colored dots).

**SettlementOverlay.vue** — brief overlay showing round result and balance change.

### Step 3: Wire up push handlers in `BRNNGameView.vue`

```js
import { useBrnnStore } from '../stores/brnn.js'
import { useUserStore } from '../stores/user.js'

// In setup():
const brnnStore = useBrnnStore()
const userStore = useUserStore()

onMounted(() => {
  brnnStore.registerPushHandlers()
})

onUnmounted(() => {
  brnnStore.unregisterPushHandlers()
  brnnStore.resetState()
})
```

### Step 4: Commit

```bash
git add client/src/views/BRNNGameView.vue client/src/components/brnn/
git commit -m "feat(brnn): add BRNN game view and all UI components"
```

---

## Task 6: Unit Tests (测试)

Write tests for core game logic.

**Files:**
- Create: `server/service/mainClient/game/brnn/logic_test.go`

### Step 1: Write tests

```go
package brnn

import (
	"service/mainClient/game/qznn"
	"testing"
)

func TestBRNNConfig_ValidChip(t *testing.T) {
	cfg := DefaultConfig
	if !cfg.ValidChip(100) {
		t.Error("100 should be valid chip")
	}
	if cfg.ValidChip(99) {
		t.Error("99 should not be valid chip")
	}
}

func TestNewRoom_StartsInBettingState(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()
	if room.getState() != StateBetting {
		t.Errorf("expected StateBetting, got %s", room.getState())
	}
}

func TestPlaceBet_ValidBet(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 10000}
	room.AddPlayer(p)

	err := room.PlaceBet("user1", 0, 100)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	room.mu.RLock()
	if p.Bets[0] != 100 {
		t.Errorf("expected bet 100, got %d", p.Bets[0])
	}
	if room.Areas[0].TotalBet != 100 {
		t.Errorf("expected area total 100, got %d", room.Areas[0].TotalBet)
	}
	room.mu.RUnlock()
}

func TestPlaceBet_InvalidArea(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 10000}
	room.AddPlayer(p)

	err := room.PlaceBet("user1", 5, 100)
	if err == nil {
		t.Error("expected error for invalid area")
	}
}

func TestPlaceBet_InsufficientBalance(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 50}
	room.AddPlayer(p)

	err := room.PlaceBet("user1", 0, 100)
	if err == nil {
		t.Error("expected error for insufficient balance")
	}
}

func TestPlaceBet_InvalidChip(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 10000}
	room.AddPlayer(p)

	err := room.PlaceBet("user1", 0, 99) // 99 is not a valid chip
	if err == nil {
		t.Error("expected error for invalid chip")
	}
}

func TestPlaceBet_ExceedMaxBetPerArea(t *testing.T) {
	cfg := *DefaultConfig
	cfg.MaxBetPerArea = 200
	room := NewRoom("test_room", &cfg)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 100000}
	room.AddPlayer(p)

	room.PlaceBet("user1", 0, 100)
	room.PlaceBet("user1", 0, 100)
	err := room.PlaceBet("user1", 0, 100)
	if err == nil {
		t.Error("expected error for exceeding max bet per area")
	}
}

func TestPlaceBet_MultipleBetsMultipleAreas(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 10000}
	room.AddPlayer(p)

	room.PlaceBet("user1", 0, 100) // 天 100
	room.PlaceBet("user1", 1, 50)  // 地 50
	room.PlaceBet("user1", 0, 100) // 天 200

	room.mu.RLock()
	if p.Bets[0] != 200 {
		t.Errorf("天 expected 200, got %d", p.Bets[0])
	}
	if p.Bets[1] != 50 {
		t.Errorf("地 expected 50, got %d", p.Bets[1])
	}
	room.mu.RUnlock()
}

func TestDealCards(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	room.dealCards()

	room.mu.RLock()
	defer room.mu.RUnlock()

	if len(room.Dealer.Cards) != 5 {
		t.Errorf("dealer should have 5 cards, got %d", len(room.Dealer.Cards))
	}
	for i := 0; i < AreaCount; i++ {
		if len(room.Areas[i].Cards) != 5 {
			t.Errorf("area %d should have 5 cards, got %d", i, len(room.Areas[i].Cards))
		}
	}

	// Verify no duplicate cards
	seen := make(map[int]bool)
	for _, c := range room.Dealer.Cards {
		if seen[c] {
			t.Errorf("duplicate card %d in dealer", c)
		}
		seen[c] = true
	}
	for i := 0; i < AreaCount; i++ {
		for _, c := range room.Areas[i].Cards {
			if seen[c] {
				t.Errorf("duplicate card %d in area %d", c, i)
			}
			seen[c] = true
		}
	}
}

func TestSettlement_AreaWins(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 10000}
	room.AddPlayer(p)

	room.mu.Lock()
	p.Bets[0] = 100 // bet on 天
	room.Areas[0].TotalBet = 100

	// Force cards: area 0 gets 牛牛 (mult=4), dealer gets 无牛 (mult=1)
	room.Dealer.Cards = []int{0, 5, 9, 13, 18}  // mixed low cards
	room.Areas[0].Cards = []int{36, 40, 44, 48, 8} // J,Q,K cards + high
	room.Areas[1].Cards = []int{1, 6, 10, 14, 19}
	room.Areas[2].Cards = []int{2, 7, 11, 15, 20}
	room.Areas[3].Cards = []int{3, 8, 12, 16, 21}
	room.mu.Unlock()

	room.calcResults()
	// Settlement modifies balance
	initialBalance := p.Balance
	room.settle()

	room.mu.RLock()
	areaResult := room.Areas[0].CardResult
	dealerResult := room.Dealer.CardResult
	room.mu.RUnlock()

	if qznn.CompareCards(areaResult, dealerResult) {
		// Area wins: player should gain bet * area mult
		expectedWin := int64(100) * areaResult.Mult
		if p.Balance != initialBalance+expectedWin {
			t.Errorf("expected balance %d, got %d (area mult=%d)", initialBalance+expectedWin, p.Balance, areaResult.Mult)
		}
	}
}

func TestResetRound(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 10000}
	room.AddPlayer(p)

	room.mu.Lock()
	p.Bets[0] = 100
	room.Areas[0].TotalBet = 100
	room.mu.Unlock()

	room.dealCards()
	room.resetRound()

	room.mu.RLock()
	defer room.mu.RUnlock()

	if room.Deck != nil {
		t.Error("deck should be nil after reset")
	}
	for i := 0; i < AreaCount; i++ {
		if room.Areas[i].TotalBet != 0 {
			t.Errorf("area %d totalBet should be 0", i)
		}
	}
	if p.Bets[0] != 0 {
		t.Error("player bets should be reset")
	}
}

func TestPlayerJoinLeave(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	p := &BRNNPlayer{ID: "user1", Balance: 10000}
	room.AddPlayer(p)
	if room.GetPlayerCount() != 1 {
		t.Errorf("expected 1 player, got %d", room.GetPlayerCount())
	}

	room.RemovePlayer("user1")
	if room.GetPlayerCount() != 0 {
		t.Errorf("expected 0 players, got %d", room.GetPlayerCount())
	}
}

func TestTrendTracking(t *testing.T) {
	room := NewRoom("test_room", DefaultConfig)
	defer room.Destroy()

	// Simulate multiple rounds
	for i := 0; i < 55; i++ {
		room.dealCards()
		room.calcResults()
		room.settle()
		room.resetRound()
		room.mu.Lock()
		room.GameCount++
		room.mu.Unlock()
	}

	room.mu.RLock()
	defer room.mu.RUnlock()

	if len(room.Trend) > TrendMaxLen {
		t.Errorf("trend should be capped at %d, got %d", TrendMaxLen, len(room.Trend))
	}
}
```

### Step 2: Run tests

Run: `cd /Users/just/Projects/g3q/server/service && go test ./mainClient/game/brnn/ -v`
Expected: All tests PASS

### Step 3: Commit

```bash
git add server/service/mainClient/game/brnn/logic_test.go
git commit -m "test(brnn): add unit tests for BRNN game logic"
```

---

## Task 7: Add `getState` export to logic.go (后端 A)

The `handleBRNNPlayerLeave` in `handler_brnn.go` calls `room.GetState()` but `getState` is lowercase (unexported).

**Files:**
- Modify: `server/service/mainClient/game/brnn/logic.go`

### Step 1: Rename `getState` to `GetState`

Change the method name from lowercase to uppercase to export it.

### Step 2: Commit

```bash
git add server/service/mainClient/game/brnn/logic.go
git commit -m "fix(brnn): export GetState method for handler access"
```

---

## Task 8: Integration Test — Full Game Cycle (测试)

Test the full WebSocket protocol flow manually or with a test client.

**Test Plan:**

| Test Case | Steps | Expected |
|---|---|---|
| Join BRNN | Send `BRNN.PlayerJoin` | Receive PushRouter{Router:"brnn"} + PushRoomState with Config |
| Place bet | Send `BRNN.PlaceBet{Area:0, Chip:100}` during betting | Receive PushBetUpdate with updated totals |
| Invalid bet | Send `BRNN.PlaceBet{Area:5, Chip:100}` | Response code != 0, error message |
| Insufficient balance | Place bets exceeding balance | Response code != 0 |
| Full round | Wait through Betting→Dealing→ShowCard→Settlement | Receive PushRoomState for each transition |
| Settlement | After ShowCard, verify PushSettlement with correct AreaWin/MyWin | Balance updated correctly |
| Leave | Send `BRNN.PlayerLeave` | Receive PushRouter{Router:"lobby"} |
| Leave with bets | Try leaving during dealing/showcard with active bets | Error: "本局有下注，请等待结算后再离开" |
| Reconnect | Disconnect and reconnect during game | Receive PushRouter{Router:"brnn"} with current state |
| QZNN unaffected | Join QZNN room, play normally | All QZNN features work as before |

### Step 1: Run regression tests

Run: `cd /Users/just/Projects/g3q/server/service && go test ./...`
Expected: All existing tests still PASS

---

## Task 9: Regression — Verify QZNN Unaffected (测试)

Critical: ensure no QZNN behavior changes.

**Checklist:**
- [ ] QZNN LobbyConfig still returns correct configs
- [ ] QZNN PlayerJoin still works for all 6 levels × 3 banker types
- [ ] QZNN full game cycle works (join → rob banker → bet → show card → settle)
- [ ] QZNN player leave works
- [ ] QZNN change room works
- [ ] QZNN game record works
- [ ] QZNN robot data endpoint `/rpc/qznn-data` works
- [ ] Switching between QZNN and BRNN on LoadingPage works
- [ ] Cannot be in both QZNN and BRNN simultaneously

---

## Dependency Graph

```
Task 1 (Types/Config)
  ├──→ Task 2 (FSM/Logic) ──→ Task 6 (Unit Tests)
  ├──→ Task 3 (Integration) ──→ Task 7 (Export fix) ──→ Task 8 (Integration Test)
  └──→ Task 4 (Client Infra) ──→ Task 5 (Game View)
                                                         └──→ Task 9 (Regression)
```

**Parallel Tracks:**
- 后端 A: Task 1 → Task 2 → Task 7
- 后端 B: (waits for Task 1) → Task 3
- 前端 B: Task 4 (can start in parallel with Task 1 using protocol from design doc)
- 前端 A: (waits for Task 4) → Task 5
- 测试: Task 6 (after Task 2), Task 8 (after Task 3+5), Task 9 (after Task 8)
