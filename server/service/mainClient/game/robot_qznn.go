package game

import (
	"math/rand"
	"service/mainClient/game/qznn"
	"service/modelClient"
	"time"
)

const (
	ProbRobotEnter1Player = 100 // 房间1人时，机器人进入概率 100%
	ProbRobotEnter2Player = 50  // 房间2人时，机器人进入概率 80%
	ProbRobotEnter3Player = 0   // 房间3人时，机器人进入概率 50%
	ProbRobotEnter4Player = 0   // 房间4人时，机器人进入概率 20%
)

// executeRobotAction 封装机器人异步延时动作执行
func executeRobotAction(minMs, maxMs int, action func()) {
	delay := time.Duration(rand.Intn(maxMs-minMs)+minMs) * time.Millisecond
	go time.AfterFunc(delay, action)
}

func processRobots(r *qznn.QZNNRoom, action func(*qznn.Player)) {
	r.PlayerMu.RLock()
	defer r.PlayerMu.RUnlock()
	for _, p := range r.Players {
		if p != nil && p.IsRobot {
			action(p)
		}
	}
}

// RobotEnterRoom 让机器人进入指定房间
func RobotForQZNNRoom(room *qznn.QZNNRoom) {
	// 房间已关闭，退出协程
	if room == nil {
		return
	}

	switch room.State {
	case qznn.StateWaiting, qznn.StatePrepare:
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
		if !room.CheckStatus(qznn.StateWaiting) || room.GetPlayerCount() >= room.GetPlayerCap() {
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
		p := qznn.NewPlayer()
		p.ID = bot.UserId
		p.IsRobot = true
		p.Balance = bot.Balance
		room.AddPlayer(p)

		processRobots(room, func(p *qznn.Player) {
			executeRobotAction(2000, 5000, func() {
				if rand.Intn(100) < 90 {
					qznn.HandlerPlayerLeave(room, p.ID)
				}
			})
		})

	case qznn.StateBanking:
		processRobots(room, func(p *qznn.Player) {
			executeRobotAction(1000, 3000, func() {
				qznn.HandleCallBanker(room, p.ID, rand.Int63n(4))
			})
		})
	case qznn.StateBetting:
		processRobots(room, func(p *qznn.Player) {
			if room.CheckIsBanker(p.ID) {
				return
			}
			executeRobotAction(1000, 3000, func() {
				qznn.HandlePlaceBet(room, p.ID, rand.Int63n(5)+1)
			})
		})
	case qznn.StateDealing:
		processRobots(room, func(p *qznn.Player) {
			executeRobotAction(1000, 3000, func() {
				qznn.HandleShowCards(room, p.ID)
			})
		})
	}
}
