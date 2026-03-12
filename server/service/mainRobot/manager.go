package mainRobot

import (
	"context"
	"encoding/json"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"service/initMain"
	"service/mainClient/game/qznn"
	"service/modelClient"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

var targetHost = HOST_PROD

// StartRobot 启动机器人管理服务
func StartRobot() {
	if initMain.DefCtx.IsTerm {
		targetHost = HOST_DEV
	}
	// 从 Redis 恢复上次的机器人房间分配
	restoreRobotsFromRedis()
	go managerLoop()
	go redisSaveLoop()
}

// RobotRuntime 机器人运行时状态
type RobotRuntime struct {
	Cancel    context.CancelFunc
	Action    RobotAction
	UserId    string
	StartedAt time.Time // 启动时间，用于僵尸检测
}

var (
	activeRobots   = make(map[string]*RobotRuntime)
	activeRobotsMu sync.Mutex
	robotOffset    = 0 // 用于轮询数据库中的机器人

	roomLeaveMu       sync.Mutex
	roomLeaveCooldown = make(map[string]time.Time)
)

// PlayerSimple 用于解析 HTTP 接口返回的玩家数据
type PlayerSimple struct {
	ID       string
	IsRobot  bool
	Nickname string
	Avatar   string
}

// RoomDataSimple 用于解析 HTTP 接口返回的房间数据
type RoomDataSimple struct {
	ID                   string
	Players              []*PlayerSimple
	Config               qznn.LobbyConfig
	BankerType           int
	LastRealPlayerJoinAt time.Time
}

// RobotAction 机器人调度动作
type RobotAction struct {
	Level      int
	BankerType int
	RoomId     string // 如果为空则创建新房间
	DelaySec   int    // 进入房间前等待秒数(等待真人进入)
}

// managerLoop 管理器主循环
func managerLoop() {
	for {
		managerRound()
		cleanupRoomLeaveCooldown()
		time.Sleep(time.Second * MANAGER_LOOP_INTERVAL)
	}
}

// cleanupRoomLeaveCooldown 清理过期的房间退出记录
func cleanupRoomLeaveCooldown() {
	roomLeaveMu.Lock()
	defer roomLeaveMu.Unlock()

	if len(roomLeaveCooldown) == 0 {
		return
	}

	for roomId, lastTime := range roomLeaveCooldown {
		if time.Since(lastTime) > ROOM_LEAVE_COOLDOWN*time.Second {
			delete(roomLeaveCooldown, roomId)
		}
	}
}

func isRobotCompatible(user *modelClient.ModelUser, room *RoomDataSimple) bool {
	for _, p := range room.Players {
		if p != nil && p.IsRobot {
			if p.Nickname == user.NickName || p.Avatar == user.Avatar {
				return false
			}
		}
	}
	return true
}

// cleanupAllRobotRooms 清理纯机器人房间(没有真人时让机器人退出)
// 通过房间内玩家ID直接匹配 activeRobots，而非 Action.RoomId，
// 避免机器人被服务端分配到非目标房间后无法被清理的问题。
func cleanupAllRobotRooms(rooms []*RoomDataSimple) {
	for _, room := range rooms {
		realCount := 0
		var robotPlayerIds []string
		for _, p := range room.Players {
			if p != nil {
				if p.IsRobot {
					robotPlayerIds = append(robotPlayerIds, p.ID)
				} else {
					realCount++
				}
			}
		}
		if realCount == 0 && len(robotPlayerIds) > 0 {
			activeRobotsMu.Lock()
			var toCancel []*RobotRuntime
			for _, pid := range robotPlayerIds {
				if rt, ok := activeRobots[pid]; ok {
					toCancel = append(toCancel, rt)
				}
			}
			activeRobotsMu.Unlock()
			for _, rt := range toCancel {
				rt.Cancel()
			}
		}
	}
}

// cleanupZombieRobots 通过 RPC 房间数据交叉校验 activeRobots，清理僵尸机器人。
// 如果一个机器人已分配房间且启动超过 60 秒，但不在任何房间的玩家列表中，
// 说明它已经掉线/卡死但 activeRobots 未清理，主动取消。
func cleanupZombieRobots(rooms []*RoomDataSimple) {
	// RPC 返回空列表时跳过，避免误杀全部机器人
	if len(rooms) == 0 {
		return
	}

	// 构建所有房间内玩家ID集合
	inRoom := make(map[string]bool)
	for _, room := range rooms {
		for _, p := range room.Players {
			if p != nil {
				inRoom[p.ID] = true
			}
		}
	}

	activeRobotsMu.Lock()
	var toCancel []*RobotRuntime
	for uid, rt := range activeRobots {
		// 只检查已分配房间且启动超过 60 秒的机器人
		if rt.Action.RoomId != "" && time.Since(rt.StartedAt) > 60*time.Second && !inRoom[uid] {
			toCancel = append(toCancel, rt)
		}
	}
	activeRobotsMu.Unlock()

	for _, rt := range toCancel {
		logrus.WithFields(logrus.Fields{
			"uid":    rt.UserId,
			"roomId": rt.Action.RoomId,
			"age":    time.Since(rt.StartedAt).Round(time.Second),
		}).Warn("Robot - Zombie detected (not in any room), cancelling")
		rt.Cancel()
	}
}

// managerRound 执行一轮调度
func managerRound() {
	// 1. 读取全部房间数据
	rooms, err := fetchRooms()
	if err != nil {
		logrus.Errorf("Failed to fetch room list: %v", err)
		return
	}

	// 清理纯机器人房间(真人全部离开后机器人也退出)
	cleanupAllRobotRooms(rooms)

	// 清理僵尸机器人(在 activeRobots 中但不在任何房间)
	cleanupZombieRobots(rooms)

	// 2. 统计每个房间已派发但尚未进入的"在途"机器人数
	pendingPerRoom := make(map[string]int)
	activeRobotsMu.Lock()
	for _, rt := range activeRobots {
		if rt.Action.RoomId != "" {
			pendingPerRoom[rt.Action.RoomId]++
		}
	}
	activeRobotsMu.Unlock()

	// 3. 根据优先级生成行动计划（扣除在途机器人）
	actions := planActions(rooms, pendingPerRoom)
	if len(actions) == 0 {
		return
	}

	// 3. 获取闲置机器人 (固定200个)
	robots := fetchIdleRobots(200)
	if len(robots) == 0 {
		return
	}

	// 4. 执行调度
	roomMap := make(map[string]*RoomDataSimple)
	for _, r := range rooms {
		roomMap[r.ID] = r
	}

	usedRobotIndices := make(map[int]bool)
	for _, action := range actions {
		for i, robot := range robots {
			if usedRobotIndices[i] {
				continue
			}

			if action.RoomId != "" {
				if room, ok := roomMap[action.RoomId]; ok {
					if !isRobotCompatible(robot, room) {
						logrus.WithFields(logrus.Fields{
							"roomId": action.RoomId,
							"uid":    robot.UserId,
							"nick":   robot.NickName,
						}).Info("Robot - Compatibility check failed (duplicate nickname or avatar), skipping room")
						continue
					}
					// 虚拟加入，防止本轮后续机器人冲突
					room.Players = append(room.Players, &PlayerSimple{
						IsRobot:  true,
						Nickname: robot.NickName,
						Avatar:   robot.Avatar,
					})
				}
			}

			usedRobotIndices[i] = true
			go launchRobot(robot, action)
			break
		}
	}
}

// planActions 根据房间状态生成调度计划
// pendingPerRoom: 每个房间已派发但尚未进入的"在途"机器人数（从 activeRobots 统计）
func planActions(rooms []*RoomDataSimple, pendingPerRoom map[string]int) []RobotAction {
	var actions []RobotAction
	_, maxRobots := getRobotsPerRoomRange()
	delayMin, delayMax := getJoinDelayRange()

	for _, room := range rooms {
		playerCount := 0
		robotCount := 0
		realCount := 0

		for _, p := range room.Players {
			if p != nil {
				playerCount++
				if p.IsRobot {
					robotCount++
				} else {
					realCount++
				}
			}
		}

		// 加上在途机器人数（已派发但尚未进入房间的）
		// pendingPerRoom 包含该房间所有活跃机器人（含已在房间内的），减去房间内已有的才是在途数
		inTransit := pendingPerRoom[room.ID] - robotCount
		if inTransit < 0 {
			inTransit = 0
		}
		playerCount += inTransit
		robotCount += inTransit

		// 跳过满员房间
		if playerCount >= 5 {
			continue
		}
		// 跳过已达机器人上限的房间
		if robotCount >= maxRobots {
			continue
		}
		// 跳过没有真人的房间
		if realCount == 0 {
			continue
		}
		// 跳过 LastRealPlayerJoinAt 为零值的房间
		if room.LastRealPlayerJoinAt.IsZero() {
			continue
		}
		// 真人加入后至少等 delayMin 秒
		if time.Since(room.LastRealPlayerJoinAt) < time.Duration(delayMin)*time.Second {
			continue
		}

		// 计算还需要多少个机器人（不超过空位数）
		emptySeats := 5 - playerCount
		needRobots := maxRobots - robotCount
		if needRobots > emptySeats {
			needRobots = emptySeats
		}

		for i := 0; i < needRobots; i++ {
			delay := delayMin
			if delayMax > delayMin {
				delay = (i + 1) * (delayMin + rand.Intn(delayMax-delayMin+1))
			}
			actions = append(actions, RobotAction{
				Level:      room.Config.Level,
				BankerType: room.Config.BankerType,
				RoomId:     room.ID,
				DelaySec:   delay,
			})
		}
	}

	return actions
}

// fetchIdleRobots 获取指定数量的闲置机器人
func fetchIdleRobots(count int) []*modelClient.ModelUser {
	var result []*modelClient.ModelUser
	// 尝试获取更多以过滤掉忙碌的机器人
	limit := count * 2
	if limit < 200 {
		limit = 200
	}

	attempts := 0
	// 简单的重试机制，防止刚好读到末尾
	for len(result) < count && attempts < 3 {
		users, err := modelClient.GetRobots(limit, robotOffset)
		if err != nil || len(users) == 0 {
			robotOffset = 0 // 重置到开头
			attempts++
			continue
		}

		activeRobotsMu.Lock()
		for _, u := range users {
			if _, ok := activeRobots[u.UserId]; !ok {
				result = append(result, u)
				if len(result) >= count {
					break
				}
			}
		}
		activeRobotsMu.Unlock()

		robotOffset += len(users)
		if len(users) < limit {
			robotOffset = 0 // 读完一轮，重置
		}
	}
	return result
}

// fetchRooms 获取房间列表
func fetchRooms() ([]*RoomDataSimple, error) {
	u := url.URL{
		Scheme: "http",
		Host:   targetHost,
		Path:   PATH_RPC_DATA,
	}
	resp, err := http.Get(u.String())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data string `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	var roomMap map[string]*RoomDataSimple
	if err := json.Unmarshal([]byte(result.Data), &roomMap); err != nil {
		return nil, err
	}

	var rooms []*RoomDataSimple
	for _, r := range roomMap {
		rooms = append(rooms, r)
	}
	return rooms, nil
}
