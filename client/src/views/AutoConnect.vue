<script setup>
/**
 * AutoConnect.vue - 生产环境自动连接入口
 *
 * URL 参数说明:
 *   ?app=应用ID&uid=用户ID&token=鉴权Token&mode=0|1|2&host=服务器地址:端口
 *
 * 示例:
 *   不看牌: ?app=myApp&uid=user123&token=xxx&mode=0&host=192.168.1.1:8082
 *   看三张: ?app=myApp&uid=user123&token=xxx&mode=1&host=192.168.1.1:8082
 *   看四张: ?app=myApp&uid=user123&token=xxx&mode=2&host=192.168.1.1:8082
 *
 *   mode 不传默认为 0 (不看牌)
 *   host 不传则使用默认服务器地址
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import gameClient from '../socket.js';
import { useUserStore } from '../stores/user.js';
import { useSettingsStore } from '../stores/settings.js';

const router = useRouter();
const userStore = useUserStore();
const settingsStore = useSettingsStore();

const errorMessage = ref('');
const DEFAULT_HOST = '43.198.8.247:8082';

onUnmounted(() => {
    gameClient.offServerPush('PushRouter');
});

onMounted(() => {
    const params = new URLSearchParams(window.location.search);
    const app = params.get('app');
    const uid = params.get('uid');
    const token = params.get('token') || 'auto';
    const mode = Number(params.get('mode') || 0);
    const host = params.get('host') || DEFAULT_HOST;

    if (!app || !uid) {
        errorMessage.value = '缺少必要参数: app 和 uid';
        return;
    }

    userStore.lastSelectedMode = mode;

    let hasUserInfo = false;
    let hasLobbyConfig = false;
    let targetRoute = '';

    const checkReady = () => {
        if (hasUserInfo && hasLobbyConfig && targetRoute) {
            gameClient.offServerPush('PushRouter');
            gameClient.off('UserInfo');
            gameClient.off('QZNN.LobbyConfig');
            router.push(targetRoute);
        }
    };

    gameClient.onConnect = () => {
        gameClient.send("UserInfo");
        gameClient.send("QZNN.LobbyConfig");
    };

    gameClient.onClose = () => {
        errorMessage.value = '连接断开';
    };

    gameClient.onError = () => {
        errorMessage.value = '连接错误';
    };

    gameClient.on('UserInfo', (msg) => {
        if (msg.code === 0 && msg.data) {
            userStore.updateUserInfo({
                user_id: msg.data.UserId,
                balance: msg.data.Balance,
                nick_name: msg.data.NickName,
                avatar: msg.data.Avatar
            });
            settingsStore.updateFromServer(msg.data);
            hasUserInfo = true;
            checkReady();
        } else {
            errorMessage.value = `获取用户数据失败: ${msg.msg}`;
        }
    });

    gameClient.on('QZNN.LobbyConfig', (msg) => {
        if (msg.code === 0 && msg.data?.LobbyConfigs) {
            userStore.updateRoomConfigs(msg.data.LobbyConfigs.map(cfg => ({
                level: cfg.Level,
                name: cfg.Name,
                base_bet: cfg.BaseBet,
                min_balance: cfg.MinBalance
            })));
            hasLobbyConfig = true;
            checkReady();
        } else {
            errorMessage.value = `获取大厅配置失败: ${msg.msg}`;
        }
    });

    gameClient.onServerPush('PushRouter', (data) => {
        if (data?.Router) {
            if (data.Router === 'lobby') {
                targetRoute = `/lobby?mode=${mode}`;
            } else if (data.Router === 'game') {
                targetRoute = '/game?autoJoin=true';
            }
            checkReady();
        }
    });

    gameClient.connect(host, app, uid, token);
});
</script>

<template>
    <div class="auto-connect">
        <div v-if="errorMessage" class="error">{{ errorMessage }}</div>
        <div v-else class="loading-text">
            连接中<span class="dots">...</span>
        </div>
    </div>
</template>

<style scoped>
.auto-connect {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a2e;
    color: white;
    font-family: "Microsoft YaHei", Arial, sans-serif;
}

.error {
    color: #f1c40f;
    font-size: 16px;
    text-align: center;
    padding: 0 20px;
}

.loading-text {
    font-size: 18px;
    font-weight: bold;
}

.dots {
    display: inline-block;
    overflow: hidden;
    vertical-align: bottom;
    animation: dots 1.5s steps(3, end) infinite;
    width: 0.8em;
}

@keyframes dots {
    0% { width: 0; }
    33% { width: 0.2em; }
    66% { width: 0.5em; }
    100% { width: 0.8em; }
}
</style>
