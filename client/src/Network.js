/**
 * Network.js
 * 游戏客户端网络层封装
 * 功能：WebSocket连接、心跳保活、断线重连、消息分发
 */

import { showToast } from 'vant';
import { useLoadingStore } from './stores/loading';

const CONFIG = {
    RECONNECT_MAX_ATTEMPTS: 10, // 最大重连次数
    RECONNECT_DELAY: 3000,      // 重连延迟 (ms)
    HEARTBEAT_INTERVAL: 5000,   // 心跳间隔 (ms)
    HEARTBEAT_TIMEOUT: 10000,   // 心跳超时时间 (ms) - 可选扩展
};

export default class GameClient {
    constructor() {
        this.ws = null;
        this.url = "";
        this.handlers = new Map(); // 消息路由表
        this.seq = 0;              // 消息序列号
        this.isConnected = false;

        // 定时器引用
        this.heartbeatTimer = null;
        this.reconnectTimer = null;

        // 状态
        this.reconnectAttempts = 0;
        this.isManualClose = false; // 是否为手动关闭

        // 事件回调 (外部赋值)
        this.onConnect = null;
        this.onClose = null;
        this.onError = null;
    }

    /**
     * 连接服务器
     * @param {string} host - 服务器地址 (e.g., "127.0.0.1:8080")
     * @param {string} token - 用户鉴权 Token
     */
    connect(host, appId, uid, token) {
        // 构造 WebSocket URL，携带 Token
        this.url = `ws://${host}/ws?app=${encodeURIComponent(appId)}&uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`;
        this.isManualClose = false;
        this._initWebSocket();
    }

    _initWebSocket() {
        if (this.ws) {
            this.ws.close();
        }

        console.log(`[Network] Connecting to ${this.url}...`);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log("[Network] Connected");
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this._startHeartbeat();

            // Reconnected successfully, hide loading
            const loadingStore = useLoadingStore();
            loadingStore.forceHideLoading();

            if (this.onConnect) this.onConnect();
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._handleMessage(msg);
            } catch (e) {
                console.error("[Network] JSON Parse Error:", e);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`[Network] Closed: Code=${event.code} Reason=${event.reason}`);
            this.isConnected = false;
            this._stopHeartbeat();

            if (!this.isManualClose) {
                this._tryReconnect();
            }
            if (this.onClose) this.onClose(event);
        };

        this.ws.onerror = (error) => {
            console.error("[Network] Error:", error);
            if (this.onError) this.onError(error);
        };
    }

    _tryReconnect() {
        const loadingStore = useLoadingStore();

        if (this.reconnectAttempts >= CONFIG.RECONNECT_MAX_ATTEMPTS) {
            console.log("[Network] Max reconnect attempts reached. Giving up.");
            loadingStore.forceHideLoading();
            loadingStore.showReconnectModal();
            return;
        }

        // Show loading during reconnection attempts
        loadingStore.setLoadingText("与服务器重连中...");
        loadingStore.startLoading();

        this.reconnectAttempts++;
        console.log(`[Network] Reconnecting in ${CONFIG.RECONNECT_DELAY}ms... (${this.reconnectAttempts}/${CONFIG.RECONNECT_MAX_ATTEMPTS})`);

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this._initWebSocket();
        }, CONFIG.RECONNECT_DELAY);
    }

    retryConnection() {
        this.reconnectAttempts = 0;
        const loadingStore = useLoadingStore();
        loadingStore.setLoadingText("与服务器重连中...");
        loadingStore.startLoading();
        this._initWebSocket();
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this.send("PingPong", {});
            }
        }, CONFIG.HEARTBEAT_INTERVAL);
    }

    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * 发送消息
     * @param {string} cmd - 协议指令 (e.g., "nn.match")
     * @param {object} data - 业务数据
     */
    send(cmd, data = {}) {
        const loadingStore = useLoadingStore();

        if (!this.isConnected) {
            console.warn("[Network] Cannot send, not connected");
            // If not connected, we don't start loading, so no need to hide it either
            return;
        }

        this.seq++;
        const packet = {
            cmd: cmd,
            seq: this.seq,
            data: data
        };

        if (cmd !== "PingPong") {

            console.log("[Network] Send:", packet);
        }

        this.ws.send(JSON.stringify(packet));
    }

    _handleMessage(msg) {
        // msg 结构: {cmd, seq, code, msg, data}

        // 拦截心跳回包，不向上层分发
        if (msg.cmd === "PingPong") {
            // No loading for ping/pong
            return;
        }

        const loadingStore = useLoadingStore();

        console.log("[Network] Recv:", msg); // Log all non-pong responses

        // 通用错误处理：如果 code != 0，弹出提示
        if (msg.code !== 0) {
            if (msg.msg) {
                showToast({
                    message: msg.msg,
                    duration: 3000,
                });
            }
        }

        // 路由分发
        if (this.handlers.has(msg.cmd)) {
            const handler = this.handlers.get(msg.cmd);
            handler(msg);
        } else {
            // console.warn(`[Network] No handler for cmd: ${msg.cmd}`);
        }
    }

    /**
     * 注册消息监听
     * @param {string} cmd 
     * @param {function} callback 
     */
    on(cmd, callback) {
        this.handlers.set(cmd, callback);
    }

    off(cmd) {
        this.handlers.delete(cmd);
    }

    close() {
        this.isManualClose = true;
        this._stopHeartbeat();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.close();
        }
    }
}

/* 使用示例:
import GameClient from './Network.js';

const client = new GameClient();

client.onConnect = () => {
    console.log("连接成功，开始匹配...");
    client.send("nn.match");
};

client.on("nn.match_res", (msg) => {
    if (msg.code === 0) {
        console.log("匹配成功，房间ID:", msg.data.room_id);
    } else {
        console.error("匹配失败:", msg.msg);
    }
});

client.connect("127.0.0.1:8080", "testId", "YOUR_TOKEN_HERE");
*/