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
			Cmd:  PlayerCallBank,
			Data: gin.H{"room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
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
			Cmd:  "nn.PlayerShowCard",
			Data: gin.H{"Room": r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID)}}
	})
	r.logicTick()

}

func CheckRobotActions(r *QZNNRoom) {
	for _, p := range r.Players {
		if p == nil {
			continue
		}
		if !p.IsRobot {
			continue
		}

		// 为每个机器人开启独立协程模拟思考
		go func(pid string) {
			// 随机延迟 1-3 秒
			time.Sleep(time.Duration(rand.Intn(2000)+1000) * time.Millisecond)

			r.Mu.Lock()
			state := r.State
			bankerID := r.BankerID
			r.Mu.Unlock()

			switch state {
			case StateBanking:
				// 随机抢庄倍数 (0-3)
				HandleCallBanker(r, pid, rand.Int63n(4))
			case StateBetting:
				if pid != bankerID {
					// 随机下注倍数 (1-5)
					HandlePlaceBet(r, pid, rand.Int63n(5)+1)
				}
			case StateDealing:
				HandleShowCards(r, pid)
			}
		}(p.ID)
	}
}
