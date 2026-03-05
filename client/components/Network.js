import { encode, decode } from '@msgpack/msgpack';

/**
 * GameClient - 游戏客户端网络层基类
 *
 * 功能：WebSocket连接、心跳保活、断线重连、消息分发
 *
 * 使用方式：
 *   import { GameClient } from '@shared/Network.js';
 *   const client = new GameClient();
 *
 * 子项目可通过配置 routerHandler 来处理 PushRouter：
 *   client.routerHandler = (routerName) => {
 *     if (routerName === 'lobby') router.push('/lobby');
 *   };
 */

import { showToast, showConfirmDialog } from 'vant';

const CONFIG = {
    RECONNECT_MAX_ATTEMPTS: 10,
    RECONNECT_DELAY: 3000,
    HEARTBEAT_INTERVAL: 5000,
    HEARTBEAT_TIMEOUT: 10000,
};

export class GameClient {
    constructor() {
        this.ws = null;
        this.url = "";
        this.handlers = new Map();
        this.pushHandlers = new Map();
        this.seq = 0;
        this.isConnected = false;

        this.heartbeatTimer = null;
        this.reconnectTimer = null;

        this.reconnectAttempts = 0;
        this.isManualClose = false;

        // 事件回调 (外部赋值)
        this.onConnect = null;
        this.onClose = null;
        this.onError = null;
        this.onLatencyChange = null;

        this.globalPushHandler = null;

        /**
         * PushRouter 处理回调 (游戏项目赋值)
         * @type {function(string): void|null}
         * 参数为 Router 字符串，例如 'lobby', 'game', 'brnn'
         */
        this.routerHandler = null;

        /**
         * loadingStore 延迟注入引用
         * 各游戏项目在初始化时设置: client.getLoadingStore = () => useLoadingStore()
         * @type {function(): object|null}
         */
        this.getLoadingStore = null;
    }

    _loadingStore() {
        if (this.getLoadingStore) {
            return this.getLoadingStore();
        }
        return null;
    }

    /**
     * 连接服务器
     * @param {string} host - 服务器地址 (e.g., "127.0.0.1:8080")
     * @param {string} appId - 应用ID
     * @param {string} uid - 用户ID
     * @param {string} token - 鉴权 Token
     */
    connect(host, appId, uid, token) {
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
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
            console.log("[Network] Connected");
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this._startHeartbeat();

            const store = this._loadingStore();
            if (store) store.forceHideLoading();

            if (this.onConnect) this.onConnect();
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = decode(new Uint8Array(event.data));
                this._handleMessage(msg);
            } catch (e) {
                console.error("[Network] MsgPack Decode Error:", e);
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
        const store = this._loadingStore();

        if (this.reconnectAttempts >= CONFIG.RECONNECT_MAX_ATTEMPTS) {
            console.log("[Network] Max reconnect attempts reached. Giving up.");
            if (store) {
                store.forceHideLoading();
                store.showReconnectModal();
            }
            return;
        }

        if (store) {
            store.setLoadingText("与服务器重连中...");
            store.startLoading();
        }

        this.reconnectAttempts++;
        console.log(`[Network] Reconnecting in ${CONFIG.RECONNECT_DELAY}ms... (${this.reconnectAttempts}/${CONFIG.RECONNECT_MAX_ATTEMPTS})`);

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this._initWebSocket();
        }, CONFIG.RECONNECT_DELAY);
    }

    retryConnection() {
        this.reconnectAttempts = 0;
        const store = this._loadingStore();
        if (store) {
            store.setLoadingText("与服务器重连中...");
            store.startLoading();
        }
        this._initWebSocket();
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this.lastPingTime = Date.now();
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
     * @param {string} cmd - 协议指令
     * @param {object} data - 业务数据
     */
    send(cmd, data = {}) {
        if (!this.isConnected) {
            console.warn("[Network] Cannot send, not connected");
            return;
        }

        this.seq++;
        const packet = {
            cmd: cmd,
            seq: this.seq,
            data: data
        };

        if (cmd !== "PingPong") {
            console.log(`✉️[发送消息] cmd:${cmd}\n`, packet, '\n\n');
        }

        this.ws.send(encode(packet));
    }

    _handleMessage(msg) {
        // 拦截心跳回包
        if (msg.cmd === "PingPong") {
            if (this.lastPingTime) {
                const latency = Date.now() - this.lastPingTime;
                if (this.onLatencyChange) {
                    this.onLatencyChange(latency);
                }
            }
            return;
        }

        // 处理 ServerPush 消息
        if (msg.cmd === "onServerPush") {
            const roomState = msg.data?.State || msg.data?.Room?.State || "N/A";
            console.log(`📣 [收到广播] 广播类型: ${msg.pushType} | RoomState: ${roomState}    \n`, msg, `\n\n`);

            // 全局监听
            if (this.globalPushHandler) {
                try {
                    this.globalPushHandler(msg.pushType, msg.data);
                } catch (err) {
                    console.error("[Network] Error in global push handler:", err);
                }
            }

            // PushOtherConnect: 被挤下线
            if (msg.pushType === "PushOtherConnect") {
                console.warn("[Network] Received PushOtherConnect, handling manual intervention.");
                this.close();

                showConfirmDialog({
                    title: '提示',
                    message: msg.data?.message || '您已在其他设备登录，请选择操作。',
                    confirmButtonText: '继续游戏',
                    showCancelButton: false,
                    className: 'game-theme-dialog',
                })
                    .then(() => {
                        this.retryConnection();
                    })
                    .catch(() => {});
                return;
            }

            // PushRouter: 由各游戏项目通过 routerHandler 处理
            if (msg.pushType === "PushRouter" && msg.data && msg.data.Router) {
                console.log("[Network] Handling PushRouter:", msg.data.Router);
                if (this.routerHandler) {
                    this.routerHandler(msg.data.Router);
                }
            }

            // 分发到具体 pushType handler
            if (this.pushHandlers.has(msg.pushType)) {
                const handler = this.pushHandlers.get(msg.pushType);
                try {
                    handler(msg.data);
                } catch (err) {
                    console.error(`[Network] Error in push handler for ${msg.pushType}:`, err);
                }
            }
            return;
        }

        console.log(`🟢[收到服务器回包] cmd:${msg.cmd}\n`, msg, '\n\n');

        // 特殊错误码处理 (code 200010: 游戏中断线重连提示)
        if (msg.code === 200010) {
            showConfirmDialog({
                title: '提示',
                message: msg.msg,
                confirmButtonText: '继续游戏',
                cancelButtonText: '关闭提示',
                className: 'game-theme-dialog',
            }).then(() => {
                if (this.routerHandler) {
                    this.routerHandler('game');
                }
            }).catch(() => {});
            return;
        }

        // 通用错误提示
        if (msg.code !== 0 && msg.msg) {
            showToast({
                message: msg.msg,
                duration: 3000,
            });
        }

        // 路由分发
        if (this.handlers.has(msg.cmd)) {
            const handler = this.handlers.get(msg.cmd);
            handler(msg);
        }
    }

    /** 注册消息监听 */
    on(cmd, callback) {
        this.handlers.set(cmd, callback);
    }

    off(cmd) {
        this.handlers.delete(cmd);
    }

    /** 注册 ServerPush 监听 */
    onServerPush(pushType, callback) {
        this.pushHandlers.set(pushType, callback);
    }

    offServerPush(pushType) {
        this.pushHandlers.delete(pushType);
    }

    /** 注册全局 ServerPush 监听 (拦截所有 pushType) */
    onGlobalServerPush(callback) {
        this.globalPushHandler = callback;
    }

    setLatencyCallback(callback) {
        this.onLatencyChange = callback;
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

export default GameClient;
