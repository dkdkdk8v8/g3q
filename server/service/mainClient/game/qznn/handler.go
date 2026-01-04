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

func HandlerPlayerLeave(r *QZNNRoom, userID string) error {
	if r == nil {
		return comm.NewMyError("房间不存在")
	}
	err := r.CheckInMultiStatusDo([]RoomState{StateWaiting, StatePrepare}, func() error {
		if r.Leave(userID) {
			return nil
		} else {
			return comm.NewMyError("离开房间失败")
		}
	})
	if err != nil {
		return err
	}
	r.Broadcast(comm.PushData{
		Cmd:      comm.ServerPush,
		PushType: PushPlayLeave,
		Data: PushPlayerLeaveStruct{
			Room:    r,
			UserIds: []string{userID}}})
	r.logicTick()
	return nil
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

func HandleCallBanker(r *QZNNRoom, userID string, mult int64) error {
	if r == nil {
		return comm.NewMyError("房间不存在")
	}

	err := r.CheckStatusDo(StateBanking, func() error {
		p, ok := r.GetPlayerByID(userID)
		if !ok {
			return comm.NewMyError("无效用户")
		}
		p.Mu.Lock()
		defer p.Mu.Unlock()
		if p.CallMult != -1 {
			return comm.NewMyError("已抢庄")
		}
		p.CallMult = mult
		return nil
	})

	if err != nil {
		return err
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
	return nil
}

func HandlePlaceBet(r *QZNNRoom, userID string, mult int64) error {
	if r == nil {
		return comm.NewMyError("房间不存在")

	}

	err := r.CheckStatusDo(StateBetting, func() error {
		if r.CheckIsBanker(userID) {
			logrus.WithField("roomId", r.ID).WithField("userId", userID).Error("HandlePlaceBet_BanerCannotBet")
			return comm.NewMyError("庄家无法投注")
		}
		p, ok := r.GetPlayerByID(userID)
		// 修正：这里应该是检查是否未下注(BetMult == -1)，原代码 != 0 在初始为-1时会直接返回
		if !ok || p == nil {
			return comm.NewMyError("无效用户")
		}
		p.Mu.Lock()
		defer p.Mu.Unlock()
		if p.BetMult != -1 {
			return comm.NewMyError("已下注")
		}
		p.BetMult = mult
		return nil
	})

	if err != nil {
		logrus.WithField("roomId", r.ID).WithField("userId", userID).Error("HandlePlaceBet_InvalidState")
		return err
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
	return nil
}

func HandleShowCards(r *QZNNRoom, userID string) error {
	if r == nil {
		return comm.NewMyError("房间不存在")
	}

	err := r.CheckStatusDo(StateDealing, func() error {
		p, ok := r.GetPlayerByID(userID)
		if !ok {
			return comm.NewMyError("无效用户")
		}
		p.Mu.Lock()
		defer p.Mu.Unlock()
		if p.IsShow {
			return comm.NewMyError("已展示牌")
		}
		p.IsShow = true
		return nil
	})

	if err != nil {
		return err
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
	return nil
}
