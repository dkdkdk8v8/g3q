package nn

import (
	"service/comm"
	"time"

	"github.com/gin-gonic/gin"
)

func NewRoom(id string, gameType string, max int) *QZNNRoom {
	return &QZNNRoom{
		ID:      id,
		Type:    gameType,
		Players: make([]*Player, max),
		State:   StateWaiting,
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

func (r *QZNNRoom) CheckIsBanker(bankerID string) bool {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	return r.BankerID == bankerID
}

func (r *QZNNRoom) GetPlayerCap() int {
	return cap(r.Players)
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
	defer r.PlayerMu.Unlock()

	// 检查玩家是否已在房间
	for seatNum, existingPlayer := range r.Players {
		if existingPlayer != nil && existingPlayer.ID == p.ID {
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
		return 0, comm.NewMyError(500001, "房间已满")
	}

	r.Players[emptySeat] = p
	countExistPlayerNum++

	r.Broadcast(comm.Response{Cmd: "nn.player_join", Data: gin.H{"players": r.Players}})

	//加入已经有2个人在房间，可以进行倒计时开始游戏
	if countExistPlayerNum >= 2 && r.CheckStatus(StateWaiting) {
		go func() {
			time.Sleep(5 * time.Second)
			if !r.CheckStatus(StateWaiting) {
				return
			}
			if r.SetStatus(StateWaitingTimer) {
				r.StartTimer(6, func() {
					r.OnStart(r)
				})
				r.Broadcast(comm.Response{Cmd: "nn.room", Data: gin.H{"room": r}})
			}
		}()
	}

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
	if r.Timer != nil {
		r.Timer.Stop()
		r.Timer = nil
	}
	if r.Ticker != nil {
		r.Ticker.Stop()
		r.Ticker = nil
	}
}

func (r *QZNNRoom) StartTimer(seconds int, onFinish func()) {
	r.StopTimer()

	r.StateMu.Lock()
	r.StateLeftSec = seconds
	r.Ticker = time.NewTicker(1 * time.Second)
	currentTicker := r.Ticker
	r.StateMu.Unlock()

	go func() {
		defer currentTicker.Stop()
		for range currentTicker.C {
			r.StateMu.Lock()
			if r.Ticker != currentTicker {
				r.StateMu.Unlock()
				return
			}
			r.StateLeftSec--
			left := r.StateLeftSec
			r.StateMu.Unlock()

			if left <= 0 {
				r.StopTimer()
				if onFinish != nil {
					onFinish()
				}
				return
			}
		}
	}()
}
