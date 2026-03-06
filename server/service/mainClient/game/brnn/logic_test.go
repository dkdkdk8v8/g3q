package brnn

import (
	"service/mainClient/game/qznn"
	"testing"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// newTestConfig returns a config with short timers for testing.
// We use large SecBetting so the FSM does not advance during the test.
func newTestConfig() *BRNNConfig {
	return &BRNNConfig{
		Chips:         []int64{100, 1000, 5000, 10000, 50000},
		MaxBetPerArea: 500000,
		MinBalance:    100,
		SecBetting:    300, // large so FSM stays in betting
		SecDealing:    300,
		SecShowCard:   300,
		SecSettling:   300,
	}
}

// newTestRoom creates a room and returns it. Caller must defer r.Destroy().
func newTestRoom() *BRNNRoom {
	return NewRoom("test-room", newTestConfig())
}

func addPlayer(r *BRNNRoom, id string, balance int64) *BRNNPlayer {
	p := &BRNNPlayer{ID: id, Balance: balance}
	r.AddPlayer(p)
	return p
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

func TestBRNNConfig_ValidChip(t *testing.T) {
	cfg := DefaultConfig

	// Valid chips
	for _, c := range []int64{100, 1000, 5000, 10000, 50000} {
		if !cfg.ValidChip(c) {
			t.Errorf("expected chip %d to be valid", c)
		}
	}

	// Invalid chips
	for _, c := range []int64{0, 1, 10, 50, 99, 200, 9999, -10} {
		if cfg.ValidChip(c) {
			t.Errorf("expected chip %d to be invalid", c)
		}
	}
}

// ---------------------------------------------------------------------------
// Room creation
// ---------------------------------------------------------------------------

func TestNewRoom_StartsInBettingState(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	if got := r.GetState(); got != StateBetting {
		t.Errorf("expected state %s, got %s", StateBetting, got)
	}
}

func TestNewRoom_AreasInitialized(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	for i := 0; i < AreaCount; i++ {
		if r.Areas[i] == nil {
			t.Fatalf("area %d is nil", i)
		}
		if r.Areas[i].Name != AreaNames[i] {
			t.Errorf("area %d name: got %q, want %q", i, r.Areas[i].Name, AreaNames[i])
		}
		if r.Areas[i].Index != i {
			t.Errorf("area %d index: got %d, want %d", i, r.Areas[i].Index, i)
		}
	}
}

// ---------------------------------------------------------------------------
// Player management
// ---------------------------------------------------------------------------

func TestPlayerJoinLeave(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	// Initially empty
	if got := r.GetPlayerCount(); got != 0 {
		t.Errorf("expected 0 players, got %d", got)
	}

	// Add player
	addPlayer(r, "u1", 1000)
	if got := r.GetPlayerCount(); got != 1 {
		t.Errorf("expected 1 player, got %d", got)
	}

	// GetPlayer
	p := r.GetPlayer("u1")
	if p == nil {
		t.Fatal("GetPlayer returned nil")
	}
	if p.ID != "u1" {
		t.Errorf("player ID: got %q, want %q", p.ID, "u1")
	}

	// Add another
	addPlayer(r, "u2", 2000)
	if got := r.GetPlayerCount(); got != 2 {
		t.Errorf("expected 2 players, got %d", got)
	}

	// Remove first
	r.RemovePlayer("u1")
	if got := r.GetPlayerCount(); got != 1 {
		t.Errorf("expected 1 player after removal, got %d", got)
	}
	if p := r.GetPlayer("u1"); p != nil {
		t.Error("expected nil after removal")
	}

	// Remove nonexistent — should not panic
	r.RemovePlayer("no-such-user")
}

// ---------------------------------------------------------------------------
// Bet placement — valid
// ---------------------------------------------------------------------------

func TestPlaceBet_Valid(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 10000)

	err := r.PlaceBet("u1", 0, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	p := r.GetPlayer("u1")
	if p.Bets[0] != 100 {
		t.Errorf("player bets[0]: got %d, want 100", p.Bets[0])
	}

	r.mu.RLock()
	totalBet := r.Areas[0].TotalBet
	r.mu.RUnlock()
	if totalBet != 100 {
		t.Errorf("area[0] TotalBet: got %d, want 100", totalBet)
	}
}

func TestPlaceBet_MultipleAreas(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 10000)

	for area := 0; area < AreaCount; area++ {
		if err := r.PlaceBet("u1", area, 1000); err != nil {
			t.Fatalf("bet on area %d failed: %v", area, err)
		}
	}

	p := r.GetPlayer("u1")
	for area := 0; area < AreaCount; area++ {
		if p.Bets[area] != 1000 {
			t.Errorf("bets[%d]: got %d, want 1000", area, p.Bets[area])
		}
	}
}

func TestPlaceBet_CumulativeOnSameArea(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 10000)

	if err := r.PlaceBet("u1", 0, 1000); err != nil {
		t.Fatal(err)
	}
	if err := r.PlaceBet("u1", 0, 5000); err != nil {
		t.Fatal(err)
	}

	p := r.GetPlayer("u1")
	if p.Bets[0] != 6000 {
		t.Errorf("cumulative bets[0]: got %d, want 6000", p.Bets[0])
	}

	r.mu.RLock()
	totalBet := r.Areas[0].TotalBet
	r.mu.RUnlock()
	if totalBet != 6000 {
		t.Errorf("area[0] TotalBet: got %d, want 6000", totalBet)
	}
}

// ---------------------------------------------------------------------------
// Bet placement — errors
// ---------------------------------------------------------------------------

func TestPlaceBet_InvalidArea(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 10000)

	for _, area := range []int{-1, 4, 5, 100} {
		if err := r.PlaceBet("u1", area, 100); err == nil {
			t.Errorf("expected error for area=%d, got nil", area)
		}
	}
}

func TestPlaceBet_InvalidChip(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 10000)

	for _, chip := range []int64{0, 1, 99, 200, -10} {
		if err := r.PlaceBet("u1", 0, chip); err == nil {
			t.Errorf("expected error for chip=%d, got nil", chip)
		}
	}
}

func TestPlaceBet_InsufficientBalance(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 50)

	err := r.PlaceBet("u1", 0, 100)
	if err == nil {
		t.Fatal("expected error for insufficient balance, got nil")
	}
}

func TestPlaceBet_WrongPhase(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 10000)

	// Force state to dealing
	r.mu.Lock()
	r.State = StateDealing
	r.mu.Unlock()

	if err := r.PlaceBet("u1", 0, 100); err == nil {
		t.Fatal("expected error for wrong phase, got nil")
	}
}

func TestPlaceBet_PlayerNotExist(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	if err := r.PlaceBet("ghost", 0, 100); err == nil {
		t.Fatal("expected error for nonexistent player, got nil")
	}
}

func TestPlaceBet_BalanceAcrossAreas(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 200)

	// Bet 100 on area 0 — total bets = 100 <= 200, OK
	if err := r.PlaceBet("u1", 0, 100); err != nil {
		t.Fatalf("bet area 0 failed: %v", err)
	}
	// Bet 100 on area 1 — total bets = 200 <= 200, OK
	if err := r.PlaceBet("u1", 1, 100); err != nil {
		t.Fatalf("bet area 1 failed: %v", err)
	}
	// Bet 100 on area 2 — total bets = 300 > 200, FAIL
	if err := r.PlaceBet("u1", 2, 100); err == nil {
		t.Fatal("expected error for balance exceeded across areas, got nil")
	}
}

// ---------------------------------------------------------------------------
// Deal cards
// ---------------------------------------------------------------------------

func TestDealCards(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	r.mu.Lock()
	r.dealCards()
	r.mu.Unlock()

	// Dealer should have 5 cards
	if len(r.Dealer.Cards) != PlayerCardMax {
		t.Errorf("dealer cards: got %d, want %d", len(r.Dealer.Cards), PlayerCardMax)
	}

	// Each area should have 5 cards
	for i := 0; i < AreaCount; i++ {
		if len(r.Areas[i].Cards) != PlayerCardMax {
			t.Errorf("area[%d] cards: got %d, want %d", i, len(r.Areas[i].Cards), PlayerCardMax)
		}
	}

	// Total dealt: 5 dealer + 4*5 areas = 25 cards, remaining deck = 52-25 = 27
	if len(r.Deck) != 27 {
		t.Errorf("remaining deck: got %d, want 27", len(r.Deck))
	}

	// All dealt cards should be unique
	seen := make(map[int]bool)
	allCards := append([]int{}, r.Dealer.Cards...)
	for i := 0; i < AreaCount; i++ {
		allCards = append(allCards, r.Areas[i].Cards...)
	}
	allCards = append(allCards, r.Deck...)

	for _, c := range allCards {
		if seen[c] {
			t.Errorf("duplicate card found: %d", c)
		}
		seen[c] = true
	}
	if len(seen) != 52 {
		t.Errorf("total unique cards: got %d, want 52", len(seen))
	}

	// All cards should be in [0, 51]
	for _, c := range allCards {
		if c < 0 || c > 51 {
			t.Errorf("card out of range: %d", c)
		}
	}
}

// ---------------------------------------------------------------------------
// Calc results
// ---------------------------------------------------------------------------

func TestCalcResults(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	// Set known cards on dealer and areas, then call calcResults.
	// Cards: rank = card/4, point = min(rank+1, 10)
	// Card 0 = A♦ (rank 0, point 1)
	// Card 4 = 2♦ (rank 1, point 2)
	// Card 36 = 10♦ (rank 9, point 10)
	// Card 40 = J♦ (rank 10, point 10)
	// Card 44 = Q♦ (rank 11, point 10)

	// Dealer: 牛牛 hand — need 3 cards sum%10=0 and 2 cards sum%10=0
	// Cards: 10, 10, 10, 10, 10 → J, Q, K, 10, J = all face cards won't work since
	// that would be 五花牛. Let's use: 10+10+10 = 30 (%10=0), remaining 10+10=20 (%10=0)
	// But need at least one non-face. Use: card 36 (10, point 10), 37 (10, point 10),
	// card 40 (J, point 10), card 44 (Q, point 10), card 0 (A, point 1)
	// Sum of 3: 10+10+10 = 30 (%10=0), remaining: 10+1 = 11 (%10=1) → niu 1
	// Try: card 36 (10), 37 (10), 38 (10), 39 (10), 0 (A) → ranks: 9,9,9,9,0
	// 3 of 10s: 10+10+10=30 (%10=0), remaining: 10+1=11 (%10=1) → niu 1
	// But also try: 10+1+..., no the best is still niu 1 since we can't get remainder 0 with 10+1.
	// Actually: pick 3 as 1+9+10 = 20? No rank 8 = 9 (point 9). Let me use:
	// card 0 (A, 1), card 32 (9, point 9: rank 8), card 36 (10, point 10)
	// sum = 1+9+10=20 (%10=0). remaining: need 2 cards with sum%10 = 0 for niu niu.
	// card 36+card40: but already used 36. Use: card 37 (10, point 10), card 41 (J, point 10) → 10+10=20, %10=0 → niu niu!
	// Dealer hand: [0, 32, 36, 37, 41] → niu niu (10), mult = 4

	r.mu.Lock()
	r.Dealer.Cards = []int{0, 32, 36, 37, 41}

	// Area 0: niu 7 — 3 cards sum%10=0, remaining sum%10=7
	// card 4(2,p2), card 8(3,p3), card 16(5,p5): 2+3+5=10 (%10=0)
	// remaining: card 12(4,p4), card 44(Q,p10): 4+10=14 → 14%10=4 → actually that'd be niu 4. Hmm.
	// Want remainder = 7: e.g., 7+10=17 %10=7? So card 24(7,p7) + card 44(Q,p10) = 7+10=17 %10=7.
	// 3 cards sum%10=0: card 4(p2)+8(p3)+16(p5)=10, remaining: 24(p7)+44(p10)=17, %10=7 → niu 7 ✓
	r.Areas[0].Cards = []int{4, 8, 16, 24, 44}

	// Area 1: niu 1
	// 3 cards sum%10=0: card 5(2,p2) + card 9(3,p3) + card 17(5,p5) = 10
	// remaining: card 1(A,p1) + card 45(Q,p10) = 11, %10=1 → niu 1 ✓
	r.Areas[1].Cards = []int{5, 9, 17, 1, 45}

	// Area 2: no niu (0). Hard to construct, let's pick cards where no 3-card sum is %10=0.
	// card 2(A,p1), card 6(2,p2), card 10(3,p3), card 14(4,p4), card 22(6,p6)
	// Possible sums of 3: 1+2+3=6, 1+2+4=7, 1+2+6=9, 1+3+4=8, 1+3+6=10✓ → this works for niu
	// So: 1+3+6=10 → remaining 2+4=6, niu=6. That's not no-niu.
	// Let me try: card 2(A,p1), card 6(2,p2), card 14(4,p4), card 22(6,p6), card 30(8,p8)
	// 1+2+4=7, 1+2+6=9, 1+2+8=11, 1+4+6=11, 1+4+8=13, 1+6+8=15, 2+4+6=12, 2+4+8=14, 2+6+8=16, 4+6+8=18
	// None of these are %10=0! Good. → niu 0 ✓
	r.Areas[2].Cards = []int{2, 6, 14, 22, 30}

	// Area 3: niu niu (10)
	// card 3(A,p1), card 33(9,p9), card 38(10,p10): 1+9+10=20 (%10=0)
	// remaining: card 42(J,p10) + card 46(Q,p10): 10+10=20, %10=0 → niu 10 ✓
	r.Areas[3].Cards = []int{3, 33, 38, 42, 46}

	r.calcResults()
	r.mu.Unlock()

	// Verify dealer
	if r.Dealer.CardResult.Niu != 10 {
		t.Errorf("dealer niu: got %d, want 10", r.Dealer.CardResult.Niu)
	}
	if r.Dealer.CardResult.Mult != 3 {
		t.Errorf("dealer mult: got %d, want 3", r.Dealer.CardResult.Mult)
	}

	// Verify areas
	expectedNiu := []int64{7, 1, 0, 10}
	for i, want := range expectedNiu {
		if got := r.Areas[i].CardResult.Niu; got != want {
			t.Errorf("area[%d] niu: got %d, want %d", i, got, want)
		}
	}
}

// ---------------------------------------------------------------------------
// Settlement — area wins
// ---------------------------------------------------------------------------

func TestSettlement_AreaWins(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	p := addPlayer(r, "u1", 10000)

	r.mu.Lock()

	// Set up bet on area 0
	p.Bets[0] = 100
	p.Balance -= 100
	r.Areas[0].TotalBet = 100
	r.GameCount = 1

	// Dealer: niu 1 (weak hand), mult = 1
	// Cards: card 0(A,p1)+4(2,p2)+8(3,p3)=6, no 3-sum %10=0...
	// Let me just set dealer to niu 1:
	// card 5(2,p2)+9(3,p3)+17(5,p5)=10, remaining: card 1(A,p1)+45(Q,p10)=11, %10=1 → niu 1
	r.Dealer.Cards = []int{5, 9, 17, 1, 45}
	// Area 0: niu 9 (strong hand), mult = 3
	// 3 cards: card 0(A,p1)+4(2,p2)+28(8,p8): err wait card 28 rank=7 p=8. 1+2+8=11 not %10=0.
	// Try: card 36(10,p10)+40(J,p10)+44(Q,p10)=30, remaining: card 32(9,p9)+0(A,p1)=10 %10=0 → niu 10.
	// That's niu niu. I want niu 9.
	// 3 cards sum%10=0: card 0(A,p1)+12(4,p4)+16(5,p5)=10, remaining card 32(9,p9)+36(10,p10)=19, %10=9 → niu 9 ✓
	r.Areas[0].Cards = []int{0, 12, 16, 32, 36}

	// Other areas: just set cards (not bet on, so doesn't matter for this player)
	r.Areas[1].Cards = []int{2, 6, 10, 14, 18}
	r.Areas[2].Cards = []int{3, 7, 11, 15, 19}
	r.Areas[3].Cards = []int{20, 24, 28, 33, 37}

	r.calcResults()

	// Verify area 0 beats dealer
	if !qznn.CompareCards(r.Areas[0].CardResult, r.Dealer.CardResult) {
		t.Fatal("expected area 0 to beat dealer")
	}

	r.settle()
	r.mu.Unlock()

	// Area 0 wins: player gains bet * area_mult = 100 * 2 (牛9=2倍) = 200
	expectedBalance := int64(10000 + 200)
	if p.Balance != expectedBalance {
		t.Errorf("player balance after win: got %d, want %d", p.Balance, expectedBalance)
	}
}

// ---------------------------------------------------------------------------
// Settlement — area loses
// ---------------------------------------------------------------------------

func TestSettlement_AreaLoses(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	p := addPlayer(r, "u1", 10000)

	r.mu.Lock()

	// Set up bet on area 0
	p.Bets[0] = 100
	p.Balance -= 100
	r.Areas[0].TotalBet = 100
	r.GameCount = 1

	// Dealer: niu 9 (strong hand), mult = 2
	// card 0(A,p1)+12(4,p4)+16(5,p5)=10 (%10=0), remaining card 32(9,p9)+36(10,p10)=19 %10=9 → niu 9
	r.Dealer.Cards = []int{0, 12, 16, 32, 36}
	// Area 0: niu 1 (weak hand), mult = 1
	// card 5(2,p2)+9(3,p3)+17(5,p5)=10 (%10=0), remaining card 1(A,p1)+45(Q,p10)=11 %10=1 → niu 1
	r.Areas[0].Cards = []int{5, 9, 17, 1, 45}

	// Other areas
	r.Areas[1].Cards = []int{2, 6, 10, 14, 18}
	r.Areas[2].Cards = []int{3, 7, 11, 15, 19}
	r.Areas[3].Cards = []int{20, 24, 28, 33, 37}

	r.calcResults()

	// Verify dealer beats area 0
	if qznn.CompareCards(r.Areas[0].CardResult, r.Dealer.CardResult) {
		t.Fatal("expected dealer to beat area 0")
	}

	r.settle()
	r.mu.Unlock()

	// Area 0 loses: player loses bet * dealer_mult = 100 * 2 (牛9=2倍) = 200
	expectedBalance := int64(10000 - 200)
	if p.Balance != expectedBalance {
		t.Errorf("player balance after loss: got %d, want %d", p.Balance, expectedBalance)
	}
}

// ---------------------------------------------------------------------------
// Settlement — mixed wins and losses
// ---------------------------------------------------------------------------

func TestSettlement_MixedResults(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	p := addPlayer(r, "u1", 10000)

	r.mu.Lock()

	// Bet on areas 0 and 1
	p.Bets[0] = 100
	p.Bets[1] = 200
	p.Balance -= 300
	r.Areas[0].TotalBet = 100
	r.Areas[1].TotalBet = 200
	r.GameCount = 1

	// Dealer: niu 5, mult = 1
	// 3 cards: card 0(A,p1)+12(4,p4)+16(5,p5)=10, remaining: card 8(3,p3)+6(2,p2)=5 %10=5 → niu 5
	r.Dealer.Cards = []int{0, 12, 16, 8, 6}

	// Area 0: niu 9 — beats dealer, mult = 3
	// card 4(2,p2)+20(6,p6)+21(6,p6)... wait can't reuse. Let me use unique cards.
	// card 4(2,p2)+13(4,p4)+17(5,p5)=11? No that's 2+4+5=11.
	// card 40(J,p10)+44(Q,p10)+36(10,p10)=30, remaining: card 32(9,p9)+1(A,p1)=10 %10=0 → niu 10 actually.
	// That's niu niu. Let me make niu 9 more carefully.
	// card 1(A,p1)+4(2,p2)+28(8,p8)... 1+2+8=11 not %10=0.
	// card 1(A,p1)+24(7,p7)+9(3,p3)... 1+7+3=11 no.
	// card 36(10,p10)+4(2,p2)+32(9,p9)... 10+2+9=21 no.
	// card 36(10,p10)+37(10,p10)+44(Q,p10)=30 (%10=0), rem: card 32(9,p9)+4(2,p2)=11 %10=1 → niu 1. Wrong.
	// card 36(10,p10)+37(10,p10)+44(Q,p10)=30, rem: card 24(7,p7)+5(2,p2)=9 → niu 9 ✓
	r.Areas[0].Cards = []int{36, 37, 44, 24, 5}

	// Area 1: niu 1 — loses to dealer, mult = 1
	// card 40(J,p10)+41(J,p10)+48(K,p10)=30 (%10=0), rem: card 1(A,p1)+2(A,p1)=2 %10=2 → niu 2. Want niu 1.
	// rem = 1+10 = 11 %10=1: card 3(A,p1)+45(Q,p10)=11 → niu 1 ✓
	// But wait 45 is Q♣ (rank 11, suit 1). And 40=J♦ (rank 10, suit 0).
	r.Areas[1].Cards = []int{40, 41, 48, 3, 45}

	// Area 2, 3: unused, set valid cards
	r.Areas[2].Cards = []int{2, 10, 14, 18, 22}
	r.Areas[3].Cards = []int{7, 11, 15, 19, 23}

	r.calcResults()

	// Verify area 0 wins, area 1 loses
	area0Wins := qznn.CompareCards(r.Areas[0].CardResult, r.Dealer.CardResult)
	area1Wins := qznn.CompareCards(r.Areas[1].CardResult, r.Dealer.CardResult)
	if !area0Wins {
		t.Fatalf("expected area 0 (niu %d) to beat dealer (niu %d)",
			r.Areas[0].CardResult.Niu, r.Dealer.CardResult.Niu)
	}
	if area1Wins {
		t.Fatalf("expected area 1 (niu %d) to lose to dealer (niu %d)",
			r.Areas[1].CardResult.Niu, r.Dealer.CardResult.Niu)
	}

	r.settle()
	r.mu.Unlock()

	// Area 0 wins: +100 * area0_mult(niu9=2) = +200
	// Area 1 loses: -200 * dealer_mult(niu5=1) = -200
	// Net: +200 - 200 = 0
	expectedBalance := int64(10000 + 0)
	if p.Balance != expectedBalance {
		t.Errorf("player balance after mixed: got %d, want %d (area0 niu=%d mult=%d, area1 niu=%d mult=%d, dealer niu=%d mult=%d)",
			p.Balance, expectedBalance,
			r.Areas[0].CardResult.Niu, r.Areas[0].CardResult.Mult,
			r.Areas[1].CardResult.Niu, r.Areas[1].CardResult.Mult,
			r.Dealer.CardResult.Niu, r.Dealer.CardResult.Mult)
	}
}

// ---------------------------------------------------------------------------
// Reset round
// ---------------------------------------------------------------------------

func TestResetRound(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 10000)

	// Place bets
	if err := r.PlaceBet("u1", 0, 100); err != nil {
		t.Fatal(err)
	}
	if err := r.PlaceBet("u1", 1, 1000); err != nil {
		t.Fatal(err)
	}

	r.mu.Lock()
	// Deal and calc
	r.dealCards()
	r.calcResults()

	// Verify there is data
	if r.Deck == nil {
		t.Fatal("deck should not be nil after dealing")
	}
	if len(r.Dealer.Cards) == 0 {
		t.Fatal("dealer cards should not be empty after dealing")
	}

	// Reset
	r.resetRound()
	r.mu.Unlock()

	// Verify everything cleared
	if r.Deck != nil {
		t.Error("deck should be nil after reset")
	}
	if r.Dealer.Cards != nil {
		t.Error("dealer cards should be nil after reset")
	}
	if r.Dealer.TotalBet != 0 {
		t.Error("dealer TotalBet should be 0 after reset")
	}
	for i := 0; i < AreaCount; i++ {
		if r.Areas[i].Cards != nil {
			t.Errorf("area[%d] cards should be nil after reset", i)
		}
		if r.Areas[i].TotalBet != 0 {
			t.Errorf("area[%d] TotalBet should be 0 after reset", i)
		}
	}

	p := r.GetPlayer("u1")
	for i := 0; i < AreaCount; i++ {
		if p.Bets[i] != 0 {
			t.Errorf("player bets[%d] should be 0 after reset, got %d", i, p.Bets[i])
		}
	}
}

// ---------------------------------------------------------------------------
// Trend tracking
// ---------------------------------------------------------------------------

func TestTrendTracking(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	r.mu.Lock()
	// Run more rounds than TrendMaxLen to verify truncation
	for i := 0; i < TrendMaxLen+10; i++ {
		r.GameCount = int64(i + 1)
		r.dealCards()
		r.calcResults()
		r.settle()
		r.resetRound()
	}
	trendLen := len(r.Trend)
	r.mu.Unlock()

	if trendLen != TrendMaxLen {
		t.Errorf("trend length: got %d, want %d", trendLen, TrendMaxLen)
	}
}

func TestTrendTracking_RecordContent(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	r.mu.Lock()
	r.GameCount = 1
	r.dealCards()
	r.calcResults()
	r.settle()
	trendLen := len(r.Trend)
	r.mu.Unlock()

	if trendLen != 1 {
		t.Fatalf("expected 1 trend record, got %d", trendLen)
	}

	r.mu.RLock()
	tr := r.Trend[0]
	r.mu.RUnlock()

	if tr.GameCount != 1 {
		t.Errorf("trend GameCount: got %d, want 1", tr.GameCount)
	}
	// DealerNiu should match dealer's calculated niu
	if tr.DealerNiu != r.Dealer.CardResult.Niu {
		t.Errorf("trend DealerNiu: got %d, want %d", tr.DealerNiu, r.Dealer.CardResult.Niu)
	}
}

// ---------------------------------------------------------------------------
// Multiple players
// ---------------------------------------------------------------------------

func TestMultiplePlayersSettlement(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	p1 := addPlayer(r, "u1", 10000)
	p2 := addPlayer(r, "u2", 10000)

	r.mu.Lock()

	// p1 bets on area 0, p2 bets on area 1
	p1.Bets[0] = 100
	p1.Balance -= 100
	p2.Bets[1] = 200
	p2.Balance -= 200
	r.Areas[0].TotalBet = 100
	r.Areas[1].TotalBet = 200
	r.GameCount = 1

	// Dealer: niu 5, mult = 1
	r.Dealer.Cards = []int{0, 12, 16, 8, 6}

	// Area 0: niu 9 (wins), mult = 3
	r.Areas[0].Cards = []int{36, 37, 44, 24, 5}

	// Area 1: niu 1 (loses), mult = 1
	r.Areas[1].Cards = []int{40, 41, 48, 3, 45}

	// Other areas
	r.Areas[2].Cards = []int{2, 10, 14, 18, 22}
	r.Areas[3].Cards = []int{7, 11, 15, 19, 23}

	r.calcResults()
	r.settle()
	r.mu.Unlock()

	// p1 bet 100 on area 0 (wins): +100 * 2 (牛9=2倍) = +200
	if p1.Balance != 10200 {
		t.Errorf("p1 balance: got %d, want 10200 (area0 niu=%d mult=%d)",
			p1.Balance, r.Areas[0].CardResult.Niu, r.Areas[0].CardResult.Mult)
	}

	// p2 bet 200 on area 1 (loses): -200 * dealer_mult(1) = -200
	if p2.Balance != 9800 {
		t.Errorf("p2 balance: got %d, want 9800 (area1 niu=%d mult=%d, dealer niu=%d mult=%d)",
			p2.Balance,
			r.Areas[1].CardResult.Niu, r.Areas[1].CardResult.Mult,
			r.Dealer.CardResult.Niu, r.Dealer.CardResult.Mult)
	}
}

// ---------------------------------------------------------------------------
// State transitions (verify the FSM constants)
// ---------------------------------------------------------------------------

func TestRoomStates(t *testing.T) {
	// Verify state constants are distinct
	states := []RoomState{StateBetting, StateDealing, StateShowCard, StateSettling}
	seen := make(map[RoomState]bool)
	for _, s := range states {
		if seen[s] {
			t.Errorf("duplicate state: %s", s)
		}
		seen[s] = true
	}
}

func TestAreaCount(t *testing.T) {
	if AreaCount != 4 {
		t.Errorf("AreaCount: got %d, want 4", AreaCount)
	}
}

// ---------------------------------------------------------------------------
// CanLeave
// ---------------------------------------------------------------------------

func TestCanLeave_NoBets(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	addPlayer(r, "u1", 10000)

	// During betting, no bets — can leave
	ok, err := r.CanLeave("u1")
	if err != nil || !ok {
		t.Errorf("expected CanLeave=true during betting with no bets, got %v, %v", ok, err)
	}

	// Switch to dealing, no bets — can leave
	r.mu.Lock()
	r.State = StateDealing
	r.mu.Unlock()

	ok, err = r.CanLeave("u1")
	if err != nil || !ok {
		t.Errorf("expected CanLeave=true during dealing with no bets, got %v, %v", ok, err)
	}
}

func TestCanLeave_WithBetsDuringDealing(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	p := addPlayer(r, "u1", 10000)

	// Place bet then switch to dealing
	r.mu.Lock()
	p.Bets[0] = 100
	r.State = StateDealing
	r.mu.Unlock()

	ok, err := r.CanLeave("u1")
	if ok || err == nil {
		t.Errorf("expected CanLeave=false during dealing with bets, got %v, %v", ok, err)
	}

	// Switch to settling — should be able to leave even with bets
	r.mu.Lock()
	r.State = StateSettling
	r.mu.Unlock()

	ok, err = r.CanLeave("u1")
	if err != nil || !ok {
		t.Errorf("expected CanLeave=true during settling, got %v, %v", ok, err)
	}
}

func TestCanLeave_PlayerNotExist(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	_, err := r.CanLeave("ghost")
	if err == nil {
		t.Error("expected error for nonexistent player")
	}
}

// ---------------------------------------------------------------------------
// GameID generation
// ---------------------------------------------------------------------------

func TestGameIDGenerated(t *testing.T) {
	r := newTestRoom()
	defer r.Destroy()

	if r.GameID != "" {
		t.Error("GameID should be empty initially")
	}

	r.mu.Lock()
	r.onBettingEnd()
	gameID := r.GameID
	r.mu.Unlock()

	if gameID == "" {
		t.Error("GameID should be set after onBettingEnd")
	}
	// Should contain the room ID
	if len(gameID) == 0 {
		t.Error("GameID should not be empty")
	}
}
