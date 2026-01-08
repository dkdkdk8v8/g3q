package mainRobot

// WebSocket 服务器地址
const SERVER_URL = "ws://127.0.0.1:8084/rpc/ws"        // 正式服地址
const SERVER_URL_DEV = "ws://172.20.10.3:18084/rpc/ws" // 测试服地址

const MINUTE_WAIT_MAX = 10       // 进入房间前等待的最长分钟数
const MIN_GAMES = 10             // 机器人至少玩几局
const PROB_LEAVE_5_PLAYERS = 0.8 // 5人时退出概率
const PROB_LEAVE_4_PLAYERS = 0.6 // 4人时退出概率
const PROB_LEAVE_3_PLAYERS = 0.4 // 3人时退出概率
const PROB_LEAVE_2_PLAYERS = 0.0 // 2人时退出概率
