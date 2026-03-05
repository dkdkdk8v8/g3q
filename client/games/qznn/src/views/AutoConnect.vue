<script setup>
/**
 * AutoConnect.vue - 生产环境自动连接入口
 *
 * URL 参数:
 *   ?app=应用ID&uid=用户ID&token=鉴权Token&mode=0|1|2&host=服务器地址:端口
 *
 * 示例:
 *   不看牌: ?app=myApp&uid=user123&token=xxx&mode=0&host=192.168.1.1:8082
 *   看三张: ?app=myApp&uid=user123&token=xxx&mode=1&host=192.168.1.1:8082
 *   看四张: ?app=myApp&uid=user123&token=xxx&mode=2&host=192.168.1.1:8082
 */
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import gameClient from '../socket.js';
import { useUserStore } from '../stores/user.js';
import { useSettingsStore } from '../stores/settings.js';
import { useLoadingStore } from '../stores/loading.js';

const router = useRouter();
const userStore = useUserStore();
const settingsStore = useSettingsStore();
const loadingStore = useLoadingStore();

const DEFAULT_HOST = '43.198.8.247:8082';

onUnmounted(() => {
    gameClient.offServerPush('PushRouter');
});

onMounted(() => {
    loadingStore.startAppLoading();

    const params = new URLSearchParams(window.location.search);
    const app = params.get('app');
    const uid = params.get('uid');
    const token = params.get('token') || 'auto';
    const mode = Number(params.get('mode') || 0);
    const host = params.get('host') || DEFAULT_HOST;

    if (!app || !uid) {
        loadingStore.setAppLoadingError('缺少必要参数: app 和 uid');
        return;
    }

    userStore.lastSelectedMode = mode;

    let hasUserInfo = false;
    let hasLobbyConfig = false;
    let targetRoute = '';
    let navigated = false;
    let fallbackTimer = null;

    const doNavigate = (route) => {
        if (navigated) return;
        navigated = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        gameClient.offServerPush('PushRouter');
        gameClient.off('UserInfo');
        gameClient.off('QZNN.LobbyConfig');
        loadingStore.stopAppLoading();
        router.push(route);
    };

    const checkReady = () => {
        if (hasUserInfo && hasLobbyConfig) {
            if (targetRoute) {
                // 三个条件都满足，立即跳转
                doNavigate(targetRoute);
            } else if (!fallbackTimer) {
                // 数据已就绪但 PushRouter 还没来，等 500ms 后兜底进大厅
                fallbackTimer = setTimeout(() => {
                    doNavigate(`/lobby?mode=${mode}`);
                }, 500);
            }
        }
    };

    gameClient.onConnect = () => {
        gameClient.send("UserInfo");
        gameClient.send("QZNN.LobbyConfig");
    };

    gameClient.onClose = () => {
        loadingStore.setAppLoadingError('连接断开，请检查网络');
    };

    gameClient.onError = () => {
        loadingStore.setAppLoadingError('连接错误，请检查服务器地址');
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
            loadingStore.setAppLoadingError(`获取用户数据失败: ${msg.msg}`);
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
            loadingStore.setAppLoadingError(`获取大厅配置失败: ${msg.msg}`);
        }
    });

    gameClient.onServerPush('PushRouter', (data) => {
        if (data?.Router) {
            if (data.Router === 'lobby') {
                targetRoute = `/lobby?mode=${mode}`;
            } else if (data.Router === 'game') {
                targetRoute = '/game?autoJoin=true';
            }
            // 如果数据已就绪，直接跳转（取消兜底定时器）
            if (hasUserInfo && hasLobbyConfig && targetRoute) {
                doNavigate(targetRoute);
            }
        }
    });

    gameClient.connect(host, app, uid, token);
});
</script>

<template>
    <!-- 无自身UI，加载动画由 App.vue 统一展示 -->
    <div></div>
</template>
