package mainClient

import (
	"math/rand"
	"service/mainClient/game"
	"service/modelClient"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

type RobotManager struct {
	mu sync.Mutex
}

var (
	robotMgr  *RobotManager
	robotOnce sync.Once
)

func GetRobotMgr() *RobotManager {
	robotOnce.Do(func() {
		robotMgr = &RobotManager{}
	})
	return robotMgr
}

// InitRobots 检查并初始化机器人，并为余额不足的机器人充值
func (rm *RobotManager) InitRobots() {
	// 调用 model 层进行初始化
	modelClient.InitRobots()

	// 启动持续监控充值协程
	go modelClient.StartRechargeMonitor(func(uid string) bool {
		// 通过 RoomManager 检查机器人是否在游戏中
		return game.GetMgr().GetRoomByPlayerID(uid) != nil
	})
}

// ArrangeRobotsForRoom 安排机器人进入房间伪装真实用户
func (rm *RobotManager) ArrangeRobotsForRoom(room *game.Room) {
	// 百人场机器人逻辑通常由房间内部定时器控制，这里主要针对匹配场
	if room.Type == "brnn" {
		return
	}

	go func() {
		// 随机延迟 1-3 秒，模拟真人进入
		time.Sleep(time.Duration(rand.Intn(3)+1) * time.Second)

		room.Mu.Lock()
		currentCount := len(room.Players)
		maxCount := room.MaxPlayers
		room.Mu.Unlock()

		if currentCount >= maxCount {
			return
		}

		// 随机决定拉几个机器人 (1 到 剩余空位)
		numToJoin := rand.Intn(maxCount-currentCount) + 1

		var robots []*modelClient.ModelUser
		_, err := modelClient.GetDb().QueryTable(new(modelClient.ModelUser)).
			Filter("is_robot", true).
			Limit(numToJoin).
			All(&robots)

		if err != nil {
			return
		}

		for _, bot := range robots {
			// 检查机器人是否已经在其他房间
			if game.GetMgr().GetRoomByPlayerID(bot.UserId) != nil {
				continue
			}

			p := &game.Player{
				ID:      bot.UserId,
				IsRobot: true,
				Conn:    nil, // 机器人无真实连接
			}

			if _, err := room.AddPlayer(p); err == nil {
				game.GetMgr().SetPlayerRoom(p.ID, room.ID)

				logrus.WithFields(logrus.Fields{
					"room": room.ID,
					"bot":  bot.UserId,
				}).Info("Robot-Joined-Room")
			}
		}
	}()
}