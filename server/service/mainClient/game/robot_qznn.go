package game

import (
	"math/rand"
	"service/mainClient/game/nn"
	"service/modelClient"
	"time"
)

const (
	ProbRobotEnter1Player = 100 // 房间1人时，机器人进入概率 100%
	ProbRobotEnter2Player = 0   // 房间2人时，机器人进入概率 80%
	ProbRobotEnter3Player = 0   // 房间3人时，机器人进入概率 50%
	ProbRobotEnter4Player = 0   // 房间4人时，机器人进入概率 20%
)

// executeRobotAction 封装机器人异步延时动作执行
func executeRobotAction(minMs, maxMs int, action func()) {
	delay := time.Duration(rand.Intn(maxMs-minMs)+minMs) * time.Millisecond
	go time.AfterFunc(delay, action)
}

func processRobots(r *nn.QZNNRoom, action func(*nn.Player)) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.IsRobot {
			action(p)
		}
	}
}

// RobotEnterRoom 让机器人进入指定房间
func RobotForQZNNRoom(room *nn.QZNNRoom) {
	// 房间已关闭，退出协程
	if room == nil {
		return
	}

	switch room.State {
	case nn.StateWaiting, nn.StatePrepare:
		// 随机等待 1-3 秒
		time.Sleep(time.Duration(rand.Intn(3)+1) * time.Second)

		// 根据房间人数控制机器人进入概率
		curCount := room.GetPlayerCount()
		enterProb := 100
		switch curCount {
		case 1:
			enterProb = ProbRobotEnter1Player
		case 2:
			enterProb = ProbRobotEnter2Player
		case 3:
			enterProb = ProbRobotEnter3Player
		case 4:
			enterProb = ProbRobotEnter4Player
		}
		if rand.Intn(100) >= enterProb {
			return
		}

		// 派出一个机器人
		robots, err := modelClient.GetRandomRobots(1)
		if err != nil || len(robots) == 0 {
			return
		}
		bot := robots[0]

		// 判断等待状态且未满员才能加入
		if !room.CheckStatus(nn.StateWaiting) || room.GetPlayerCount() >= room.GetPlayerCap() {
			return
		}

		// 检查机器人是否已经在其他房间
		if GetMgr().GetPlayerRoom(bot.UserId) != nil {
			return
		}
		// 按需充值机器人余额
		minEntry := room.Config.MinBalance
		modelClient.BotRecharge(bot, minEntry)

		// 创建机器人玩家对象并加入房间，Conn 设为 nil
		p := &nn.Player{
			ID:      bot.UserId,
			IsRobot: true,
			Conn:    nil,
			Balance: bot.Balance,
		}
		room.AddPlayer(p)

		processRobots(room, func(p *nn.Player) {
			executeRobotAction(2000, 5000, func() {
				if rand.Intn(100) < 20 {
					nn.HandlerPlayerLeave(room, p.ID)
				}
			})
		})

	case nn.StateBanking:
		processRobots(room, func(p *nn.Player) {
			executeRobotAction(1000, 3000, func() {
				nn.HandleCallBanker(room, p.ID, rand.Int63n(4))
			})
		})
	case nn.StateBetting:
		processRobots(room, func(p *nn.Player) {
			if room.CheckIsBanker(p.ID) {
				return
			}
			executeRobotAction(1000, 3000, func() {
				nn.HandlePlaceBet(room, p.ID, rand.Int63n(5)+1)
			})
		})
	case nn.StateDealing:
		processRobots(room, func(p *nn.Player) {
			executeRobotAction(1000, 3000, func() {
				nn.HandleShowCards(room, p.ID)
			})
		})
	}
}
