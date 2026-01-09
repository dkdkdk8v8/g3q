package mainRobot

// WebSocket 服务器地址
const SERVER_URL = "ws://127.0.0.1:8084/rpc/ws"        // 正式服地址
const SERVER_URL_DEV = "ws://43.198.8.247:8084/rpc/ws" // 测试服地址

const SECONDS_WAIT_MAX = 30      // 进入房间前等待的最长秒数
const MIN_GAMES = 100            // 机器人至少玩几局
const PROB_LEAVE_5_PLAYERS = 0.8 // 5人时退出概率
const PROB_LEAVE_4_PLAYERS = 0.6 // 4人时退出概率
const PROB_LEAVE_3_PLAYERS = 0.4 // 3人时退出概率
const PROB_LEAVE_2_PLAYERS = 0.0 // 2人时退出概率
