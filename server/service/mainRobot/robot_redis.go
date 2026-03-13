package mainRobot

import (
	"compoment/rds"
	"encoding/json"
	"service/modelClient"
	"time"

	"github.com/sirupsen/logrus"
)

// RobotStateEntry Redis 中保存的机器人房间分配
type RobotStateEntry struct {
	RoomId     string `json:"r"`
	Level      int    `json:"l"`
	BankerType int    `json:"b"`
}

// redisSaveLoop 定期将活跃机器人的房间分配保存到 Redis
func redisSaveLoop() {
	for {
		time.Sleep(RedisSaveInterval * time.Second)
		saveRobotsToRedis()
	}
}

// saveRobotsToRedis 将当前活跃机器人的房间分配写入 Redis Hash（原子操作）
func saveRobotsToRedis() {
	activeRobotsMu.Lock()
	snapshot := make(map[string]RobotAction, len(activeRobots))
	for uid, rt := range activeRobots {
		snapshot[uid] = rt.Action
	}
	activeRobotsMu.Unlock()

	pool := rds.DefConnPool
	if pool == nil {
		return
	}

	// 使用 Pipeline 将 Del+HSet 放在同一批次，避免中间崩溃导致数据丢失
	p := pool.PipeLine()
	defer p.Close()
	p.Select(RedisDbRobot)
	p.Del(RedisKeyRobotMap)
	for uid, action := range snapshot {
		if action.RoomId == "" {
			continue // 跳过尚未分配房间的
		}
		entry := RobotStateEntry{
			RoomId:     action.RoomId,
			Level:      action.Level,
			BankerType: action.BankerType,
		}
		b, err := json.Marshal(entry)
		if err != nil {
			logrus.WithField("uid", uid).WithError(err).Error("Robot - Failed to marshal state entry")
			continue
		}
		p.HSet(RedisKeyRobotMap, uid, string(b))
	}
	if err := p.Do(); err != nil {
		logrus.WithError(err).Error("Robot - Failed to save state to Redis")
	}
}

// restoreRobotsFromRedis 从 Redis 恢复机器人房间分配，立即派发（delay=0）
func restoreRobotsFromRedis() {
	pool := rds.DefConnPool
	if pool == nil {
		logrus.Warn("Robot - Redis not available, skip restore")
		return
	}

	all, err := pool.HGetAll(RedisDbRobot, RedisKeyRobotMap)
	if err != nil {
		logrus.WithError(err).Error("Robot - Failed to load state from Redis")
		return
	}
	if len(all) == 0 {
		logrus.Info("Robot - No saved state in Redis, starting fresh")
		return
	}

	// 清空 Redis 中的旧状态（避免下次重启再次恢复已失效的数据）
	pool.Del(RedisDbRobot, RedisKeyRobotMap)

	var restored int
	for uid, result := range all {
		valStr, err := result.AsString()
		if err != nil {
			continue
		}
		var entry RobotStateEntry
		if err := json.Unmarshal([]byte(valStr), &entry); err != nil {
			continue
		}
		if entry.RoomId == "" {
			continue
		}

		// 从 DB 加载机器人用户
		user, err := modelClient.GetUserByUserId(uid)
		if err != nil || user == nil {
			logrus.WithField("uid", uid).Warn("Robot - Restore: user not found, skip")
			continue
		}

		action := RobotAction{
			Level:      entry.Level,
			BankerType: entry.BankerType,
			RoomId:     entry.RoomId,
			DelaySec:   0, // 恢复时不延迟，立即进入
		}
		go launchRobot(user, action)
		restored++
	}

	if restored > 0 {
		logrus.Infof("Robot - Restored %d robots from Redis", restored)
	}
}
