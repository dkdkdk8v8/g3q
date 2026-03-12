package mainRobot

import (
	"service/modelAdmin"

	"github.com/sirupsen/logrus"
)

var (
	prevJoinDelay     [2]int
	prevRobotsPerRoom [2]int
	configInitialized bool
)

// checkConfigChanges 检测配置变化并记录日志，返回配置是否发生了变化
func checkConfigChanges() bool {
	delayMin, delayMax := getJoinDelayRange()
	robotsMin, robotsMax := getRobotsPerRoomRange()

	if !configInitialized {
		prevJoinDelay = [2]int{delayMin, delayMax}
		prevRobotsPerRoom = [2]int{robotsMin, robotsMax}
		configInitialized = true
		logrus.Infof("Robot config loaded: joinDelaySeconds=[%d,%d], RobotsPerRoom=[%d,%d]",
			delayMin, delayMax, robotsMin, robotsMax)
		return false
	}

	changed := false
	if delayMin != prevJoinDelay[0] || delayMax != prevJoinDelay[1] {
		logrus.Infof("Robot config updated: joinDelaySeconds [%d,%d] → [%d,%d]",
			prevJoinDelay[0], prevJoinDelay[1], delayMin, delayMax)
		prevJoinDelay = [2]int{delayMin, delayMax}
		changed = true
	}
	if robotsMin != prevRobotsPerRoom[0] || robotsMax != prevRobotsPerRoom[1] {
		logrus.Infof("Robot config updated: RobotsPerRoom [%d,%d] → [%d,%d]",
			prevRobotsPerRoom[0], prevRobotsPerRoom[1], robotsMin, robotsMax)
		prevRobotsPerRoom = [2]int{robotsMin, robotsMax}
		changed = true
	}
	return changed
}

// 服务器 Host 配置
const HOST_PROD = "127.0.0.1:8084"
const HOST_DEV = "127.0.0.1:18084"

// 路径配置
const PATH_WS = "/rpc/ws"
const PATH_RPC_DATA = "/rpc/qznn-data"

// Redis 持久化配置
const RedisDbRobot = 9                    // 机器人状态专用 Redis DB
const RedisKeyRobotMap = "robot:active_rooms" // Hash: userId → JSON{RoomId,Level,BankerType}
const RedisSaveInterval = 10              // 状态保存间隔(秒)

const MANAGER_LOOP_INTERVAL = 3 // 机器人管理循环间隔(秒)
const MIN_GAMES = 20                 // 机器人至少玩几局
const PROB_LEAVE_5_PLAYERS = 0.2     // 5人时退出概率
const PROB_LEAVE_4_PLAYERS = 0.15    // 4人时退出概率
const PROB_LEAVE_3_PLAYERS = 0.1     // 3人时退出概率
const PROB_LEAVE_2_PLAYERS = 0.0     // 2人时退出概率
const ROBOT_BALANCE_MULT_MIN = 30.0  // 机器人进入房间携带金额最小倍数
const ROBOT_BALANCE_MULT_MAX = 100.0 // 机器人进入房间携带金额最大倍数
const ROOM_LEAVE_COOLDOWN = 60       // 房间退出冷却时间(秒)
const WS_WRITE_TIMEOUT = 10          // WebSocket 写超时(秒)
const WS_READ_TIMEOUT = 30           // WebSocket 读超时(秒)，需大于心跳间隔

// 机器人允许进入的房间等级配置
var ALLOWED_LEVELS = []int{1, 2, 3, 4, 5, 6}

// 机器人允许进入的玩法类型配置 (0:无看牌抢庄, 1:看三张牌抢庄, 2:看四张牌抢庄)
var ALLOWED_BANKER_TYPES = []int{0, 1, 2}

// getJoinDelayRange 从 robot.joinDelaySeconds 配置获取 [min, max] 延迟秒数
const ROBOT_JOIN_DELAY_MIN = 2       // 机器人进入延迟最小秒数(等待真人)
const ROBOT_JOIN_DELAY_MAX = 5       // 机器人进入延迟最大秒数(等待真人)
func getJoinDelayRange() (min, max int) {
	arr := modelAdmin.SysParamCache.GetIntArray("robot.joinDelaySeconds", []int{ROBOT_JOIN_DELAY_MIN, ROBOT_JOIN_DELAY_MAX})
	if len(arr) >= 2 && arr[0] >= 0 && arr[1] >= arr[0] {
		return arr[0], arr[1]
	}
	return ROBOT_JOIN_DELAY_MIN, ROBOT_JOIN_DELAY_MAX
}

// getRobotsPerRoomRange 从 robot.RobotsPerRoom 配置获取 [min, max] 每房间机器人数
const MIN_ROBOTS_PER_ROOM = 1        // 每个房间最少机器人数（有真人时）
const MAX_ROBOTS_PER_ROOM = 4        // 每个房间最多机器人数（有真人时）
func getRobotsPerRoomRange() (min, max int) {
	arr := modelAdmin.SysParamCache.GetIntArray("robot.RobotsPerRoom", []int{MIN_ROBOTS_PER_ROOM, MAX_ROBOTS_PER_ROOM})
	if len(arr) >= 2 && arr[0] >= 0 && arr[1] >= arr[0] {
		return arr[0], arr[1]
	}
	return MIN_ROBOTS_PER_ROOM, MAX_ROBOTS_PER_ROOM
}
