package nn

import (
	"service/comm"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func NewRoom(id string) *QZNNRoom {
	return &QZNNRoom{
		ID:            id,
		Players:       make([]*Player, 5),
		State:         StateWaiting,
		TargetResults: make(map[string]int, 5),
		BankerID:      "",
		Deck:          []int{},
	}
}
func (r *QZNNRoom) CheckStatus(state int) bool {
	r.StateMu.RLock()
	defer r.StateMu.RUnlock()
	return r.State == state
}
func (r *QZNNRoom) SetStatus(state int) bool {
	r.StateMu.Lock()
	defer r.StateMu.Unlock()
	if r.State == state {
		return false
	}
	r.State = state
	return true
}

// func (r *QZNNRoom) IsSecretByStatus(state int) bool {
// 	r.StateMu.RLock()
// 	defer r.StateMu.RUnlock()
// 	switch state {
// 	case StateWaiting, StateWaitingTimer:
// 		return false
// 	case StateBanking, StateBetting, StateDealing:
// 		return true
// 	case StateSettling:
// 		return false
// 	default:
// 		//防止未知状态，全部给数据，避免前端出错
// 		return true
// 	}
// }

func (r *QZNNRoom) CheckIsBanker(bankerID string) bool {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	return r.BankerID == bankerID
}

func (r *QZNNRoom) GetPlayerCap() int {
	return cap(r.Players)
}

func (r *QZNNRoom) GetPlayerCount() int {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	currentCount := 0
	for _, p := range r.Players {
		if p != nil {
			currentCount++
		}
	}
	return currentCount
}

func (r *QZNNRoom) IsWaiting() bool {
	return r.State == StateWaiting
}

func (r *QZNNRoom) GetPlayerByID(userID string) (*Player, bool) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.ID == userID {
			return p, true
		}
	}
	return nil, false
}

func (r *QZNNRoom) AddPlayer(p *Player) (int, error) {
	r.StateMu.RLock()
	defer r.StateMu.RUnlock()
	if r.State != StateWaiting {
		return 0, comm.NewMyError(500003, "游戏进行中，无法加入")
	}

	r.PlayerMu.Lock()

	// 检查玩家是否已在房间
	for seatNum, existingPlayer := range r.Players {
		if existingPlayer != nil && existingPlayer.ID == p.ID {
			r.PlayerMu.Unlock()
			return seatNum, nil
		}
	}

	// 寻找空位
	emptySeat := -1
	countExistPlayerNum := 0
	for i, pl := range r.Players {
		if pl != nil {
			countExistPlayerNum++
		} else if emptySeat == -1 {
			emptySeat = i
		}
	}

	if countExistPlayerNum >= cap(r.Players) || emptySeat == -1 {
		r.PlayerMu.Unlock()
		return 0, comm.NewMyError(500001, "房间已满")
	}

	r.Players[emptySeat] = p
	countExistPlayerNum++
	r.PlayerMu.Unlock()

	r.Broadcast(comm.Response{Cmd: "nn.player_join", Data: gin.H{"players": r.Players}})

	return emptySeat, nil
}

func (r *QZNNRoom) Broadcast(msg interface{}) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.Conn != nil {
			_ = p.Conn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) BroadcastWithPlayer(getMsg func(*Player) interface{}) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.Conn != nil {
			msg := getMsg(p)
			_ = p.Conn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) BroadcastExclude(msg interface{}, excludeId string) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p == nil || p.ID == excludeId {
			continue
		}
		if p.Conn != nil {
			_ = p.Conn.WriteJSON(msg)
		}
	}
}

func (r *QZNNRoom) StopTimer() {
	r.StateMu.Lock()
	defer r.StateMu.Unlock()
	r.StateLeftSec = 0
	if r.Ticker != nil {
		r.Ticker.Stop()
		r.Ticker = nil
	}
}

func (r *QZNNRoom) WaitTimer(seconds int) {
	r.StopTimer()
	r.StateMu.Lock()
	r.StateLeftSec = seconds
	r.StateMu.Unlock()

	r.Ticker = time.NewTicker(time.Second)
	defer r.Ticker.Stop()

	for i := 0; i < seconds; i++ {
		//外部关闭ticker，提前退出loop
		<-r.Ticker.C
		r.StateMu.Lock()
		r.StateLeftSec--
		r.StateMu.Unlock()
	}
	if r.Ticker != nil {
		r.logicTick()
	}
}

// Leave 玩家离开房间
func (r *QZNNRoom) Leave(p *Player) {
	if p == nil {
		return
	}
	r.PlayerMu.Lock()
	found := false
	count := 0
	for i, pl := range r.Players {
		if pl != nil {
			if pl.ID == p.ID {
				r.Players[i] = nil
				found = true
			} else {
				count++
			}
		}
	}
	r.PlayerMu.Unlock()

	if found {
		r.Broadcast(comm.Response{Cmd: "nn.player_leave", Data: gin.H{"uid": p.ID}})

		if count < 2 && r.CheckStatus(StatePrepare) {
			r.StopTimer()
			if !r.SetStatus(StateWaiting) {
				logrus.Error("QZNNRoom-Leave-SetStatus-Fail")
			}
		}
	}
}
