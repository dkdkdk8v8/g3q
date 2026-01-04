package qznn

import (
	"math/rand"
	"service/comm"
	"time"

	"github.com/sirupsen/logrus"
)

func init() {
	//todo 放到main client里面
	rand.Seed(time.Now().UnixNano())
}

func HandlerPlayerLeave(r *QZNNRoom, userID string) {
	if r == nil {
		return
	}

	if r.CheckGameStart() {
		//can not leave room
		return
	}

	if r.Leave(userID) {
		r.Broadcast(comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayLeave,
			Data: PushPlayerLeaveStruct{
				Room:    r,
				UserIds: []string{userID}}})
	}
	r.logicTick()
}

// func HandlePlayerReady(r *QZNNRoom, userID string) {
// 	if r == nil {
// 		return
// 	}
// 	if !r.CheckStatus(StateWaiting) {
// 		return
// 	}
// 	p, ok := r.GetPlayerByID(userID)
// 	if !ok || p.IsReady {
// 		return
// 	}
// 	p.IsReady = true
// 	r.Broadcast(comm.Response{
// 		Cmd: CmdPlayerReady,
// 		Data: gin.H{
// 			"Room":   r,
// 			"UserId": userID}})
// 	r.logicTick()
// }

func HandleCallBanker(r *QZNNRoom, userID string, mult int64) {
	if r == nil {
		return
	}

	var success bool
	err := r.CheckStatusDo(StateBanking, func() {
		p, ok := r.GetPlayerByID(userID)
		if !ok {
			return
		}
		p.Mu.Lock()
		defer p.Mu.Unlock()
		if p.CallMult != -1 {
			return
		}
		p.CallMult = mult
		success = true
	})

	if err != nil || !success {
		return
	}

	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayerCallBanker,
			Data: PushPlayerCallBankerStruct{
				Room:   r.GetClientRoom(p.ID),
				UserId: userID,
				Mult:   mult}}
	})
	r.logicTick()
}

func HandlePlaceBet(r *QZNNRoom, userID string, mult int64) {
	if r == nil {
		return
	}

	var success bool
	err := r.CheckStatusDo(StateBetting, func() {
		if r.CheckIsBanker(userID) {
			logrus.WithField("roomId", r.ID).WithField("userId", userID).Error("HandlePlaceBet_BanerCannotBet")
			return
		}
		p, ok := r.GetPlayerByID(userID)
		// 修正：这里应该是检查是否未下注(BetMult == -1)，原代码 != 0 在初始为-1时会直接返回
		if !ok || p == nil {
			return
		}
		p.Mu.Lock()
		defer p.Mu.Unlock()
		if p.BetMult != -1 {
			return
		}
		p.BetMult = mult
		success = true
	})

	if err != nil {
		logrus.WithField("roomId", r.ID).WithField("userId", userID).Error("HandlePlaceBet_InvalidState")
		return
	}

	if !success {
		return
	}

	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayerPlaceBet,
			Data: PushPlayerPlaceBetStruct{
				Room:   r.GetClientRoom(p.ID),
				UserId: userID,
				Mult:   mult},
		}
	})
	r.logicTick()
}

func HandleShowCards(r *QZNNRoom, userID string) {
	if r == nil {
		return
	}

	var success bool
	err := r.CheckStatusDo(StateDealing, func() {
		p, ok := r.GetPlayerByID(userID)
		if !ok {
			return
		}
		p.Mu.Lock()
		defer p.Mu.Unlock()
		if p.IsShow {
			return
		}
		p.IsShow = true
		success = true
	})

	if err != nil || !success {
		return
	}
	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayerShowCard,
			Data: PushPlayerShowCardStruct{
				Room:   r.GetClientRoom(p.ID),
				UserId: userID}}
	})
	r.logicTick()

}
