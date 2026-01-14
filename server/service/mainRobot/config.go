package mainRobot

// 服务器 Host 配置
const HOST_PROD = "127.0.0.1:8084"
const HOST_DEV = "172.20.10.5:18084"

// 路径配置
const PATH_WS = "/rpc/ws"
const PATH_RPC_DATA = "/rpc/qznn-data"

const MIN_ROBOT_ROOMS = 0           // 纯机器人房间最少保持数量
const MANAGER_LOOP_INTERVAL = 10    // 机器人管理循环间隔(秒)
const MIN_GAMES = 20                // 机器人至少玩几局
const PROB_LEAVE_5_PLAYERS = 0.2    // 5人时退出概率
const PROB_LEAVE_4_PLAYERS = 0.15   // 4人时退出概率
const PROB_LEAVE_3_PLAYERS = 0.1    // 3人时退出概率
const PROB_LEAVE_2_PLAYERS = 0.0    // 2人时退出概率
const ROBOT_BALANCE_MULT_MIN = 10.0 // 机器人进入房间携带金额最小倍数
const ROBOT_BALANCE_MULT_MAX = 30.0 // 机器人进入房间携带金额最大倍数
const ROOM_LEAVE_COOLDOWN = 60      //  房间退出冷却时间(秒)

// 机器人允许进入的房间等级配置
var ALLOWED_LEVELS = []int{1, 2, 3, 4, 5, 6}

// 机器人允许进入的玩法类型配置 (0:无看牌抢庄, 1:看三张牌抢庄, 2:看四张牌抢庄)
var ALLOWED_BANKER_TYPES = []int{0, 1, 2}
