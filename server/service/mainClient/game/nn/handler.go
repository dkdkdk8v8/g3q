package nn

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
	if !r.CheckStatus(StateBanking) {
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
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayerCallBanker,
			Data: PushPlayerCallBankerStruct{
				Room:   r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID),
				UserId: userID,
				Mult:   mult}}
	})
	r.logicTick()
}

func HandlePlaceBet(r *QZNNRoom, userID string, mult int64) {
	if r == nil {
		return
	}
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
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayerPlaceBet,
			Data: PushPlayerPlaceBetStruct{
				Room:   r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID),
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
	if !r.CheckStatus(StateDealing) {
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
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayerShowCard,
			Data: PushPlayerShowCardStruct{
				Room:   r.GetClientRoom(r.Config.GetPreCard(), p.ID == r.BankerID),
				UserId: userID}}
	})
	r.logicTick()

}
