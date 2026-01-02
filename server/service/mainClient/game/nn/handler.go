package nn

import (
	"math/rand"
	"service/comm"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func HandlePlayerReady(r *QZNNRoom, userID string) {
	if !r.CheckStatus(StateWaiting) {
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p.IsReady {
		return
	}
	p.IsReady = true
	r.Broadcast(comm.Response{Cmd: "nn.player_ready", Data: map[string]interface{}{"uid": userID}})
	r.logicTick()
}

func HandleCallBanker(r *QZNNRoom, userID string, mult int64) {
	if r.State != StateBanking {
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p.CallMult != -1 {
		return
	}
	p.Mu.Lock()
	if p.CallMult != -1 {
		p.Mu.Unlock()
		return
	}
	p.CallMult = mult
	p.Mu.Unlock()
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  CmdPlayerCallBank,
			Data: gin.H{"Room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})
	r.logicTick()
}

func HandlePlaceBet(r *QZNNRoom, userID string, mult int64) {
	if !r.CheckStatus(StateBetting) {
		logrus.WithField("room_id", r.ID).WithField("user_id", userID).Error("HandlePlaceBet_InvalidState")
		return
	}
	if r.CheckIsBanker(userID) {
		logrus.WithField("room_id", r.ID).WithField("user_id", userID).Error("HandlePlaceBet_BanerCannotBet")
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p == nil || p.BetMult != 0 {
		return
	}
	p.Mu.Lock()
	if p.BetMult != -1 {
		p.Mu.Unlock()
		return
	}
	p.BetMult = mult
	p.Mu.Unlock()
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd: "nn.PlayerPlaceBet",
			Data: gin.H{
				"Room":     r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID),
				"PlayerId": userID,
				"Mult":     mult},
		}
	})
	r.logicTick()
}

func HandleShowCards(r *QZNNRoom, userID string) {
	r.Mu.Lock()
	defer r.Mu.Unlock()
	if r.State != StateDealing {
		return
	}
	p, ok := r.GetPlayerByID(userID)
	if !ok || p.IsShow {
		return
	}
	p.Mu.Lock()
	if p.IsShow == true {
		p.Mu.Unlock()
		return
	}
	p.IsShow = true
	p.Mu.Unlock()
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.Response{
			Cmd:  CmdPlayerShowCard,
			Data: gin.H{"Room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})
	r.logicTick()

}

func CheckRobotActions(r *QZNNRoom) {
	go func() {
		var lastState = StateWaiting
		var hasGameStarted = false
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-r.driverGo:
				return
			case <-ticker.C:
				r.StateMu.RLock()
				curState := r.State
				r.StateMu.RUnlock()

				if curState == lastState {
					continue
				}

				if curState != StateWaiting && curState != StatePrepare {
					hasGameStarted = true
				}

				switch curState {
				case StateBanking:
					processRobots(r, func(p *Player) {
						executeRobotAction(r, 1000, 3000, func() {
							HandleCallBanker(r, p.ID, rand.Int63n(4))
						})
					})
				case StateBetting:
					processRobots(r, func(p *Player) {
						if r.CheckIsBanker(p.ID) {
							return
						}
						executeRobotAction(r, 1000, 3000, func() {
							HandlePlaceBet(r, p.ID, rand.Int63n(5)+1)
						})
					})
				case StateDealing:
					processRobots(r, func(p *Player) {
						executeRobotAction(r, 1000, 3000, func() {
							HandleShowCards(r, p.ID)
						})
					})
				case StateWaiting:
					if hasGameStarted {
						processRobots(r, func(p *Player) {
							executeRobotAction(r, 2000, 5000, func() {
								if rand.Intn(100) < 20 {
									r.Leave(p)
								} else {
									HandlePlayerReady(r, p.ID)
								}
							})
						})
						return
					}
				}
				lastState = curState
			}
		}
	}()
}

// executeRobotAction 封装机器人异步延时动作执行
func executeRobotAction(r *QZNNRoom, minMs, maxMs int, action func()) {
	go func() {
		// 随机延迟
		delay := time.Duration(rand.Intn(maxMs-minMs)+minMs) * time.Millisecond
		select {
		case <-r.driverGo:
			// 房间销毁，停止执行
			return
		case <-time.After(delay):
			// 延迟结束，执行动作
			action()
		}
	}()
}

func processRobots(r *QZNNRoom, action func(*Player)) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.IsRobot {
			action(p)
		}
	}
}
