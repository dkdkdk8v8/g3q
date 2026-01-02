package game

import (
	"math/rand"
	"service/mainClient/game/nn"
	"service/modelClient"
	"time"
)

const (
	ProbRobotEnter1Player = 100 // 房间1人时，机器人进入概率 100%
	ProbRobotEnter2Player = 80  // 房间2人时，机器人进入概率 80%
	ProbRobotEnter3Player = 50  // 房间3人时，机器人进入概率 50%
	ProbRobotEnter4Player = 20  // 房间4人时，机器人进入概率 20%
)

// RobotEnterRoom 让机器人进入指定房间
func RobotEnterRoom(room *nn.QZNNRoom) {
	go func() {
		for {
			// 房间已关闭，退出协程
			if room == nil {
				break
			}
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
				continue
			}

			// 派出一个机器人
			robots, err := modelClient.GetRandomRobots(1)
			if err != nil || len(robots) == 0 {
				break
			}
			bot := robots[0]

			// 判断等待状态且未满员才能加入
			if !room.CheckStatus(nn.StateWaiting) || room.GetPlayerCount() >= room.GetPlayerCap() {
				break
			}

			// 检查机器人是否已经在其他房间
			if GetMgr().GetPlayerRoom(bot.UserId) != nil {
				continue
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
		}
	}()
}
