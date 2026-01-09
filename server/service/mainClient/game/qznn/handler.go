package qznn

import (
	"service/comm"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

func HandlerPlayerLeave(r *QZNNRoom, userID string) error {
	if r == nil {
		return nil
	}

	//先看用户是不是ob
	p, ok := r.GetPlayerByID(userID)
	if !ok {
		return nil
	}

	if p.IsOb {
		if !r.Leave(userID) {
			//todo log
			return comm.NewMyError("离开房间失败")
		}
	} else {
		err := r.CheckInMultiStatusDoLock([]RoomState{StateWaiting, StatePrepare}, func() error {
			if !r.leave(userID) {
				//todo log
				return comm.NewMyError("离开房间失败")
			}
			return nil
		})

		if err != nil {
			if errors.As(err, &errorStateNotMatch) {
				return comm.NewMyError("游戏已开始,无法离开房间")
			}
			return err
		}
	}

	r.BroadcastWithPlayer(func(p *Player) interface{} {
		return comm.PushData{
			Cmd:      comm.ServerPush,
			PushType: PushPlayLeave,
			Data: PushPlayerLeaveStruct{
				Room:    r.GetClientRoom(p.ID),
				UserIds: []string{userID}}}
	})
	r.logicTick()
	return nil
}

func HandleCallBanker(r *QZNNRoom, userID string, mult int64) error {
	if r == nil {
		return comm.NewMyError("房间不存在")
	}

	err := r.CheckStatusDo(StateBanking, func() error {
		p, ok := r.getPlayerByID(userID)
		if !ok {
			return comm.NewMyError("无效用户")
		}
		if p.IsOb {
			return comm.NewMyError("观战中")
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
		if errors.As(err, &errorStateNotMatch) {
			return comm.NewMyError("抢庄已结束")
		}
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
		if r.checkIsBanker(userID) {
			logrus.WithField("roomId", r.ID).WithField("userId", userID).Error("HandlePlaceBet_BanerCannotBet")
			return comm.NewMyError("庄家无法投注")
		}
		p, ok := r.getPlayerByID(userID)
		// 修正：这里应该是检查是否未下注(BetMult == -1)，原代码 != 0 在初始为-1时会直接返回
		if !ok || p == nil {
			return comm.NewMyError("无效用户")
		}
		if p.IsOb {
			return comm.NewMyError("观战中")
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
		if errors.As(err, &errorStateNotMatch) {
			return comm.NewMyError("投注已结束")
		}
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

	err := r.CheckStatusDo(StateShowCard, func() error {
		p, ok := r.getPlayerByID(userID)
		if !ok {
			return comm.NewMyError("无效用户")
		}
		if p.IsOb {
			return comm.NewMyError("观战中")
		}
		p.Mu.Lock()
		defer p.Mu.Unlock()
		if p.IsShow {
			return comm.NewMyError("已明牌")
		}
		p.IsShow = true
		return nil
	})

	if err != nil {
		if errors.As(err, &errorStateNotMatch) {
			return comm.NewMyError("已经明牌")
		}
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
