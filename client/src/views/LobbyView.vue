<script setup>
import { useRouter } from 'vue-router';
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'; // Added onDeactivated
import { debounce } from '../utils/debounce.js';
import { useUserStore } from '../stores/user.js';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';
import gameClient from '../socket.js';
import defaultAvatar from '@/assets/common/icon_avatar.png'; // Import avatar directly
import lobbyBgSound from '@/assets/sounds/lobby_bg.mp3'; // Import background music

const router = useRouter();
const userStore = useUserStore();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();
const bgAudio = ref(null); // Background audio ref

// 模拟用户信息 - map from store
const userInfo = computed(() => {
    return {
        name: userStore.userInfo.nick_name || '未知用户',
        id: userStore.userInfo.user_id || '---',
        coins: userStore.userInfo.balance || 0,
        avatar: userStore.userInfo.avatar || defaultAvatar // Use imported avatar
    }
});

// 游戏模式：kanpai (看四张抢庄-type 2), bukan (不看牌抢庄-type 0)
// type 1 (看三张)
const currentMode = ref(0); // 强制默认不看牌抢庄

const setMode0 = debounce(() => { currentMode.value = 0; }, 500);
const setMode1 = debounce(() => { currentMode.value = 1; }, 500);
const setMode2 = debounce(() => { currentMode.value = 2; }, 500);

watch(currentMode, (newVal) => {
    userStore.lastSelectedMode = newVal;
    localStorage.setItem('lastSelectedMode', newVal);
});

const _enterGame = async (level) => {
    // 传递房间等级(level)和玩法模式(mode)
    // 发送匹配协议
    try {
        await gameStore.joinRoom(level, currentMode.value); // Await the promise
        router.push({
            path: '/game',
            query: { mode: currentMode.value }
        });
    } catch (error) {
        console.error("Failed to join room:", error);
        // Optionally show a toast message to the user
        // showToast('加入房间失败，请稍后再试');
    }
};

const enterGame = debounce(_enterGame, 500);

// Map server room configs to UI
const rooms = computed(() => {
    const configs = userStore.roomConfigs || [];
    const colorClasses = ['room-cyan', 'room-blue', 'room-purple', 'room-red'];

    return configs.map((cfg, index) => {
        return {
            level: cfg.level,
            name: cfg.name,
            base: cfg.base_bet,
            min: cfg.min_balance,
            players: Math.floor(Math.random() * 100), // Mock player count for now
            colorClass: colorClasses[index % colorClasses.length]
        };
    });
});

const fetchData = () => {
    // 主动获取数据
    gameClient.send("UserInfo");
    gameClient.send("QZNN.LobbyConfig");
};

const playMusic = () => {
    if (!settingsStore.musicEnabled) return;

    if (!bgAudio.value) {
        bgAudio.value = new Audio(lobbyBgSound);
        bgAudio.value.loop = true;
        bgAudio.value.volume = 0.5;
    }
    bgAudio.value.play().catch(() => { });
};

const stopMusic = () => {
    if (bgAudio.value) {
        bgAudio.value.pause();
    }
};

onMounted(() => {
    // 注册消息监听
    gameClient.on('QZNN.UserInfo', (msg) => {
        // Update User Info
        userStore.updateUserInfo({
            avatar: msg.data.Avatar,
            balance: msg.data.Balance,
            nick_name: msg.data.NickName,
            user_id: msg.data.UserId
        });

        // Sync Settings from Server
        settingsStore.updateFromServer(msg.data);
    });

    gameClient.on('QZNN.LobbyConfig', (msg) => {
        if (msg.code === 0 && msg.data && msg.data.LobbyConfigs) {
            const mappedConfigs = msg.data.LobbyConfigs.map(cfg => ({
                level: cfg.Level,
                name: cfg.Name,
                base_bet: cfg.BaseBet,
                min_balance: cfg.MinBalance
            }));
            userStore.updateRoomConfigs(mappedConfigs);
        }
    });

    fetchData(); // Initial fetch when mounted
    playMusic();
});

onActivated(() => {
    fetchData(); // Re-fetch data when activated (e.g., returning from game)
    playMusic();
});

onDeactivated(() => {
    stopMusic();
});

onUnmounted(() => {
    // 可选：移除监听，或者保留给其他页面复用（Network.js 是单例，handle会被覆盖）
    stopMusic();
    bgAudio.value = null;
});
</script>

<template>
    <div class="lobby">
        <!-- 顶部用户信息栏 -->
        <div class="user-header">
            <div class="user-info-left">
                <div class="avatar-wrapper">
                    <img :src="userInfo.avatar" class="user-avatar" />
                </div>
                <div class="user-details">
                    <div class="user-name">{{ userInfo.name }}</div>
                    <div class="user-id">ID: {{ userInfo.id }}</div>
                </div>
            </div>
            <div class="user-assets">
                <div class="coin-display">
                    <span class="coin-icon">🟡</span>
                    <span class="coin-text">{{ userInfo.coins }}</span>
                    <div class="add-btn">+</div>
                </div>
            </div>
        </div>

        <!-- 玩法切换 Tab -->
        <div class="mode-tabs-container">
            <div class="tab-group-pill">
                <div class="tab-item" :class="{ 'active-purple': currentMode === 0 }" @click="setMode0()">不看牌抢庄
                </div>
                <div class="tab-item" :class="{ 'active-blue': currentMode === 1 }" @click="setMode1()">看三张抢庄</div>
                <div class="tab-item" :class="{ 'active-cyan': currentMode === 2 }" @click="setMode2()">看四张抢庄</div>
            </div>
        </div>

        <!-- 房间列表 -->
        <div class="room-container">
            <div v-for="room in rooms" :key="room.level" class="room-card" :class="room.colorClass"
                @click="enterGame(room.level)">
                <div class="room-title">{{ room.name }}</div>
                <div class="room-info">
                    <span class="base-badge">底分 {{ room.base }}</span>
                </div>
                <div class="room-footer">
                    <div class="entry-limit">
                        <span class="coin-icon">🟡</span> {{ room.min }}
                    </div>
                    <div class="online-count">
                        👤 {{ room.players }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.lobby {
    height: 100vh;
    background: radial-gradient(circle at center, #1e3a8a 0%, #0f172a 100%);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, sans-serif;
    color: white;
    padding-bottom: 20px;
    /* 底部留白 */
}

/* 用户信息栏 */
.user-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.user-info-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.avatar-wrapper {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid #fff;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.user-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.user-details {
    display: flex;
    flex-direction: column;
}

.user-name {
    font-size: 16px;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.user-id {
    font-size: 12px;
    color: #cbd5e1;
    margin-top: 2px;
}

.user-assets {
    display: flex;
    align-items: center;
}

.coin-display {
    background: rgba(0, 0, 0, 0.5);
    border-radius: 20px;
    padding: 4px 4px 4px 12px;
    display: flex;
    align-items: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
    gap: 6px;
}

.coin-icon {
    font-size: 14px;
}

.coin-text {
    font-weight: bold;
    font-size: 14px;
    color: #fcd34d;
    margin-right: 4px;
}

.add-btn {
    width: 24px;
    height: 24px;
    background: linear-gradient(to bottom, #22c55e, #15803d);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* 模式切换栏 */
.mode-tabs-container {
    display: flex;
    justify-content: center;
    padding: 15px 0;
}

.tab-group-pill {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 24px;
    padding: 4px;
    width: 80%;
    /* 宽度控制 */
    max-width: 300px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-item {
    flex: 1;
    text-align: center;
    padding: 8px 0;
    border-radius: 20px;
    font-size: 14px;
    font-weight: bold;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.3s ease;
}

.tab-item.active-purple {
    background: linear-gradient(135deg, #c084fc 0%, #7e22ce 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(126, 34, 206, 0.4);
}

.tab-item.active-blue {
    background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
}

.tab-item.active-cyan {
    background: linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(15, 118, 110, 0.4);
}

.room-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    /* 双列布局 */
    gap: 16px;
    flex: 1;
    overflow-y: auto;
    padding: 0 20px;
}

.room-card {
    border-radius: 12px;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
    min-height: 100px;
    transition: transform 0.1s;
}

.room-card:active {
    transform: scale(0.98);
}

/* 玻璃光泽 */
.room-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.2), transparent);
    pointer-events: none;
}

.room-cyan {
    background: linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%);
}

.room-blue {
    background: linear-gradient(135deg, #60a5fa 0%, #1e40af 100%);
}

.room-purple {
    background: linear-gradient(135deg, #c084fc 0%, #7e22ce 100%);
}

.room-red {
    background: linear-gradient(135deg, #f87171 0%, #991b1b 100%);
}

.room-title {
    font-size: 20px;
    font-weight: 900;
    /* Extra bold */
    text-shadow: 0 2px 2px rgba(0, 0, 0, 0.3);
    margin-bottom: 8px;
    letter-spacing: 1px;
}

.room-info {
    display: flex;
    margin-bottom: auto;
}

.base-badge {
    background: rgba(0, 0, 0, 0.4);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
}

.room-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    margin-top: 12px;
    opacity: 0.9;
}

.entry-limit {
    font-weight: bold;
}
</style>
