package qznn

import (
	"encoding/json"
	"time"

	"github.com/sirupsen/logrus"
)

// PlayerSnapshot captures all player state needed for hot-restart restore.
type PlayerSnapshot struct {
	PlayerData
	CardResult CardResult `json:"CardResult"`
	SeatIndex  int        `json:"SeatIndex"` // index in Players slice (0-4), preserves nil positions
}

// RoomSnapshot captures all room state at a safe checkpoint for hot-restart.
type RoomSnapshot struct {
	// Room identity and config
	ID       string      `json:"ID"`
	GameID   string      `json:"GameID"`
	Config   LobbyConfig `json:"Config"`
	CreateAt time.Time   `json:"CreateAt"`

	// Game state
	State                RoomState `json:"State"`
	StateLeftSec         int       `json:"StateLeftSec"`
	BankerID             string    `json:"BankerID"`
	StrategyApplied      bool      `json:"StrategyApplied"`
	LastRealPlayerJoinAt time.Time `json:"LastRealPlayerJoinAt"`

	// Cards and strategy
	Deck          []int          `json:"Deck"`
	TargetResults map[string]int `json:"TargetResults"`
	TotalBet      int64          `json:"TotalBet"`
	AllIsRobot    bool           `json:"AllIsRobot"`

	// Players (only non-nil seats)
	Players []PlayerSnapshot `json:"Players"`

	// Timestamp when snapshot was taken, used to recalculate StateDeadline on restore.
	SnapshotAt time.Time `json:"SnapshotAt"`
}

// isGameState returns true if the state indicates an active game round
// (anything beyond Waiting/Prepare).
func isGameState(s RoomState) bool {
	switch s {
	case StateWaiting, StatePrepare, "":
		return false
	default:
		return true
	}
}

// TakeSnapshot serializes the room state at a safe checkpoint.
// The caller must ensure this is invoked at a barrier point where no
// concurrent state mutation is in progress.
func (r *QZNNRoom) TakeSnapshot() *RoomSnapshot {
	r.RoomMu.Lock()
	defer r.RoomMu.Unlock()

	if r.getPlayerCount() == 0 {
		return nil
	}

	// Recalculate StateLeftSec from deadline.
	if !r.StateDeadline.IsZero() {
		remaining := time.Until(r.StateDeadline)
		if remaining <= 0 {
			r.StateLeftSec = 0
		} else {
			r.StateLeftSec = int((remaining + time.Second - 1) / time.Second)
		}
	}

	snap := &RoomSnapshot{
		ID:                   r.ID,
		GameID:               r.GameID,
		Config:               r.Config,
		CreateAt:             r.CreateAt,
		State:                r.State,
		StateLeftSec:         r.StateLeftSec,
		BankerID:             r.BankerID,
		StrategyApplied:      r.strategyApplied,
		LastRealPlayerJoinAt: r.LastRealPlayerJoinAt,
		TotalBet:             r.TotalBet,
		AllIsRobot:           r.AllIsRobot,
		TargetResults:   make(map[string]int, len(r.TargetResults)),
		Deck:            make([]int, len(r.Deck)),
		Players:         make([]PlayerSnapshot, 0, 5),
		SnapshotAt:      time.Now(),
	}

	copy(snap.Deck, r.Deck)
	for k, v := range r.TargetResults {
		snap.TargetResults[k] = v
	}

	// Deep-copy LobbyConfig slice fields.
	if r.Config.BankerMult != nil {
		snap.Config.BankerMult = make([]int64, len(r.Config.BankerMult))
		copy(snap.Config.BankerMult, r.Config.BankerMult)
	}
	if r.Config.BetMult != nil {
		snap.Config.BetMult = make([]int64, len(r.Config.BetMult))
		copy(snap.Config.BetMult, r.Config.BetMult)
	}

	// Snapshot each player, preserving seat indices.
	for i, p := range r.Players {
		if p == nil {
			continue
		}
		p.Mu.RLock()
		ps := PlayerSnapshot{
			PlayerData: p.PlayerData,
			CardResult: p.CardResult,
			SeatIndex:  i,
		}
		if p.Cards != nil {
			ps.Cards = make([]int, len(p.Cards))
			copy(ps.Cards, p.Cards)
		}
		p.Mu.RUnlock()
		snap.Players = append(snap.Players, ps)
	}

	return snap
}

// MarshalSnapshots serializes a slice of RoomSnapshot to JSON bytes.
func MarshalSnapshots(snaps []*RoomSnapshot) ([]byte, error) {
	return json.Marshal(snaps)
}

// UnmarshalSnapshots deserializes JSON bytes into a slice of RoomSnapshot.
func UnmarshalSnapshots(data []byte) ([]*RoomSnapshot, error) {
	var snaps []*RoomSnapshot
	if err := json.Unmarshal(data, &snaps); err != nil {
		return nil, err
	}
	return snaps, nil
}

// RestoreFromSnapshot creates a new QZNNRoom from a snapshot.
// The restored room is fully functional:
//   - driverGo channel is initialized and driverLogicTick is started
//   - StateDeadline is recalculated from StateLeftSec
//   - A fresh RoomStrategy is created
//   - ConnWrap is nil on all players (clients will reconnect)
//   - If the room was mid-game, gameLoop() is launched to continue the round
func RestoreFromSnapshot(snap *RoomSnapshot) *QZNNRoom {
	if snap == nil {
		return nil
	}

	log := logrus.WithFields(logrus.Fields{
		"roomID": snap.ID,
		"gameID": snap.GameID,
		"state":  snap.State,
	})
	log.Info("snapshot: restoring room")

	r := &QZNNRoom{
		QZNNRoomData: QZNNRoomData{
			ID:                   snap.ID,
			GameID:               snap.GameID,
			State:                snap.State,
			BankerID:             snap.BankerID,
			Players:              make([]*Player, 5),
			Config:               snap.Config,
			CreateAt:             snap.CreateAt,
			LastRealPlayerJoinAt: snap.LastRealPlayerJoinAt,
		},
		Deck:            make([]int, len(snap.Deck)),
		TargetResults:   make(map[string]int, len(snap.TargetResults)),
		TotalBet:        snap.TotalBet,
		AllIsRobot:      snap.AllIsRobot,
		strategyApplied: snap.StrategyApplied,
		driverGo:        make(chan struct{}),
		Strategy:        NewRoomStrategy(),
		snapshotReq:     make(chan struct{}, 1),
		snapshotReadyCh: make(chan struct{}, 1),
	}

	copy(r.Deck, snap.Deck)
	for k, v := range snap.TargetResults {
		r.TargetResults[k] = v
	}

	// Deep-copy LobbyConfig slice fields.
	if snap.Config.BankerMult != nil {
		r.Config.BankerMult = make([]int64, len(snap.Config.BankerMult))
		copy(r.Config.BankerMult, snap.Config.BankerMult)
	}
	if snap.Config.BetMult != nil {
		r.Config.BetMult = make([]int64, len(snap.Config.BetMult))
		copy(r.Config.BetMult, snap.Config.BetMult)
	}

	// Restore players into their original seat positions.
	for _, ps := range snap.Players {
		if ps.SeatIndex < 0 || ps.SeatIndex >= len(r.Players) {
			log.WithField("seatIndex", ps.SeatIndex).
				Warn("snapshot: invalid seat index, skipping player")
			continue
		}

		p := &Player{
			PlayerData: ps.PlayerData,
		}
		p.CardResult = ps.CardResult

		if ps.Cards != nil {
			p.Cards = make([]int, len(ps.Cards))
			copy(p.Cards, ps.Cards)
		} else {
			p.Cards = make([]int, 0, PlayerCardMax)
		}

		r.Players[ps.SeatIndex] = p
	}

	// Recalculate StateDeadline from the snapshot's StateLeftSec.
	r.StateLeftSec = snap.StateLeftSec
	if snap.StateLeftSec > 0 {
		r.StateDeadline = time.Now().Add(time.Duration(snap.StateLeftSec) * time.Second)
	}

	// Start the driver goroutine.
	go r.driverLogicTick()

	// If the room was mid-game, resume the game loop from current state.
	if isGameState(snap.State) {
		log.WithField("stateLeftSec", snap.StateLeftSec).
			Info("snapshot: resuming in-progress game")
		go r.resumeGame()
	}

	log.WithField("playerCount", r.getPlayerCount()).
		Info("snapshot: room restored")

	return r
}

// resumeGame is called after restoring a room that was mid-game.
// It enters the same gameLoop() that startGame() uses, picking up
// from the current State.
func (r *QZNNRoom) resumeGame() {
	r.inGame.Store(true)
	defer r.inGame.Store(false)

	r.UpdateStrategyParams()

	logrus.WithFields(logrus.Fields{
		"roomId": r.ID,
		"gameId": r.GameID,
		"state":  r.State,
	}).Info("resumeGame: entering gameLoop")

	r.gameLoop()
}
