<script setup>
import { useRouter } from 'vue-router';
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';
import { debounce } from '../utils/debounce.js';
import { formatCoins } from '../utils/format.js';
import { useUserStore } from '../stores/user.js';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';
import { AudioUtils } from '../utils/audio.js';
import gameClient from '../socket.js';
import HistoryModal from '../components/HistoryModal.vue';
import SettingsModal from '../components/SettingsModal.vue';
import HelpModal from '../components/HelpModal.vue';

// Assets
import bgImg from '@/assets/lobby/bg.jpg';
import topBgImg from '@/assets/lobby/top_bg.png';
import logoImg from '@/assets/lobby/logo.png';
import btnExit from '@/assets/lobby/exit_btn.png';
import btnHelp from '@/assets/lobby/help_btn.png';
import btnHistory from '@/assets/lobby/bet_history_btn.png';
import btnSetting from '@/assets/lobby/sett_btn.png';
import topBtnLine from '@/assets/lobby/top_btn_line.png';
import topLine from '@/assets/lobby/top_line.png';
import diamondBg from '@/assets/lobby/diamond_bg.png';

// Tab Assets
import tabBgImg from '@/assets/lobby/tab_bg.png';
import tabBukan from '@/assets/lobby/tab_bukanpai.jpg';
import tabBukanSel from '@/assets/lobby/tab_bukanpai_choose.jpg';
import tabSan from '@/assets/lobby/tab_kansanzhang.jpg';
import tabSanSel from '@/assets/lobby/tab_kansanzhang_choose.jpg';
import tabSi from '@/assets/lobby/tab_kansizhang.jpg';
import tabSiSel from '@/assets/lobby/tab_kansizhang_choose.jpg';

// Room Assets
import eachRoomBg from '@/assets/lobby/each_room_bg.png';
import eachRoomEnterBtn from '@/assets/lobby/each_room_enter_btn.png';
import roomNameBgLv from '@/assets/lobby/each_room_name_bg_lv.png';
import roomNameBgLan from '@/assets/lobby/each_room_name_bg_lan.png';
import roomNameBgLz from '@/assets/lobby/each_room_name_bg_zise.png';

import roomTextTiyan from '@/assets/lobby/room_text_tiyan.png';
import roomTextChuji from '@/assets/lobby/room_text_chuji.png';
import roomTextZhongji from '@/assets/lobby/room_text_zhongji.png';
import roomTextGaoji from '@/assets/lobby/room_text_gaoji.png';
import roomTextDashi from '@/assets/lobby/room_text_dashi.png';
import roomTextDianfeng from '@/assets/lobby/room_text_dianfeng.png';

import roomIconTextDizhu from '@/assets/lobby/room_icontext_dizhu.png';
import roomIconTextXianzhi from '@/assets/lobby/room_icontext_xianzhi.png';

import defaultAvatar from '@/assets/common/default_avatar.png';
import lobbyBgSound from '@/assets/sounds/lobby_bg.mp3';
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import goldImg from '@/assets/common/gold.png';

const router = useRouter();
const userStore = useUserStore();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();

const getRoomTextImage = (roomName) => {
    if (!roomName) return null;
    if (roomName.includes('体验')) return roomTextTiyan;
    if (roomName.includes('初级')) return roomTextChuji;
    if (roomName.includes('中级')) return roomTextZhongji;
    if (roomName.includes('高级')) return roomTextGaoji;
    if (roomName.includes('大师')) return roomTextDashi;
    if (roomName.includes('巅峰')) return roomTextDianfeng;
    return null;
};

const playBtnSound = () => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
};

const userInfo = computed(() => {
    const rawName = userStore.userInfo.nick_name || userStore.userInfo.user_id || '---';
    let displayName = rawName;
    if (rawName.length > 20) {
        displayName = rawName.substring(0, 3) + '...' + rawName.substring(rawName.length - 3);
    }

    return {
        name: rawName,
        displayName: displayName,
        id: userStore.userInfo.user_id || '---',
        coins: formatCoins(userStore.userInfo.balance || 0),
        avatar: userStore.userInfo.avatar || defaultAvatar
    };
});

const currentMode = ref(userStore.lastSelectedMode || 0); // 0: Bukan, 1: San, 2: Si

const setMode = (mode) => {
    if (currentMode.value === mode) return;
    playBtnSound();
    currentMode.value = mode;
    userStore.lastSelectedMode = mode;
    // Potentially re-fetch or filter rooms here if the server API supports it
};

// Get appropriate room name background based on current mode
const currentRoomNameBg = computed(() => {
    switch (currentMode.value) {
        case 0: return roomNameBgLv;  // No look (Greenish/Lv)
        case 1: return roomNameBgLan; // Look 3 (Blueish/Lan)
        case 2: return roomNameBgLz;  // Look 4 (Purpleish/Lz)
        default: return roomNameBgLv;
    }
});

const enterGame = debounce(async (level) => {
    playBtnSound();
    try {
        gameStore.gameMode = currentMode.value;
        await gameStore.joinRoom(level, currentMode.value);
        router.push({ path: '/game', query: { mode: currentMode.value } });
    } catch (error) {
        console.error("Failed to join room:", error);
    }
}, 500);

const rooms = computed(() => {
    const configs = userStore.roomConfigs || [];
    return configs.map((cfg) => {
        return {
            level: cfg.level,
            name: cfg.name,
            baseBet: (cfg.base_bet || 0) / 100,
            minBalance: (cfg.min_balance || 0) / 100,
        };
    });
});

// --- History, Settings, Help Logic ---
const showHistory = ref(false);
const showSettings = ref(false);
const showHelp = ref(false);

const openHistoryDebounced = debounce(() => {
    playBtnSound();
    showHistory.value = true;
}, 200);

const openSettingsDebounced = debounce(() => {
    playBtnSound();
    showSettings.value = true;
}, 200);

const openHelpDebounced = debounce(() => {
    playBtnSound();
    showHelp.value = true;
}, 200);

const fetchData = () => {
    gameClient.send("UserInfo");
    gameClient.send("QZNN.LobbyConfig");
};

const playMusic = () => {
    if (!settingsStore.musicEnabled) return;
    AudioUtils.playMusic(lobbyBgSound, 0.5);
};

const stopMusic = () => {
    AudioUtils.pauseMusic();
};

watch(() => settingsStore.musicEnabled, (val) => {
    if (val) {
        playMusic();
    } else {
        stopMusic();
    }
});

onMounted(() => {
    gameClient.on('QZNN.UserInfo', (msg) => {
        userStore.updateUserInfo({
            avatar: msg.data.Avatar,
            balance: msg.data.Balance,
            nick_name: msg.data.NickName,
            user_id: msg.data.UserId
        });
        settingsStore.updateFromServer(msg.data);
    });

    gameClient.on('QZNN.LobbyConfig', (msg) => {
        if (msg.code === 0 && msg.data?.LobbyConfigs) {
            userStore.updateRoomConfigs(msg.data.LobbyConfigs.map(cfg => ({
                level: cfg.Level,
                name: cfg.Name,
                base_bet: cfg.BaseBet,
                min_balance: cfg.MinBalance
            })));
        }
    });

    fetchData();
    playMusic();
});

onActivated(() => {
    fetchData();
    playMusic();
});

onDeactivated(stopMusic);
onUnmounted(() => {
    stopMusic();
});

const goBack = () => {
    playBtnSound();
    console.log("Exit clicked");
    // router.push('/'); // Uncomment if needed
};
</script>

<template>
    <div class="lobby-container" :style="{ backgroundImage: `url(${bgImg})` }">
        <!-- Top Area -->
        <div class="top-area" :style="{ backgroundImage: `url(${topBgImg})` }">
            <!-- Row 1: Exit + Buttons -->
            <div class="top-row-1">
                <div class="top-left">
                    <img :src="btnExit" class="btn-exit" @click="goBack" alt="Exit" />
                </div>
                <div class="top-right">
                    <img :src="btnHistory" class="top-icon-btn" @click="openHistoryDebounced" alt="History" />
                    <img :src="topBtnLine" class="top-separator" />
                    <img :src="btnHelp" class="top-icon-btn" @click="openHelpDebounced" alt="Help" />
                    <img :src="topBtnLine" class="top-separator" />
                    <img :src="btnSetting" class="top-icon-btn" @click="openSettingsDebounced" alt="Settings" />
                </div>
            </div>

            <!-- Separator Line -->
            <div class="top-line-container">
                <img :src="topLine" class="top-line-img" />
            </div>

            <!-- Row 2: Logo + Coins -->
            <div class="top-row-2">
                <div class="logo-container">
                    <img :src="logoImg" class="logo-img" alt="Logo" />
                </div>
                <div class="coins-container" :style="{ backgroundImage: `url(${diamondBg})` }">
                    <img :src="goldImg" class="coin-icon" />
                    <span class="coin-val">{{ userInfo.coins }}</span>
                </div>
            </div>
        </div>

        <!-- Main Content: Tabs + Room List -->
        <div class="main-content">
            <!-- Left: Vertical Tabs -->
            <div class="tabs-sidebar" :style="{ backgroundImage: `url(${tabBgImg})` }">
                <!-- Mode 0: Bukan (No Look) -->
                <div class="tab-item" @click="setMode(0)">
                    <img :src="currentMode === 0 ? tabBukanSel : tabBukan" class="tab-img" />
                </div>
                <!-- Mode 1: San (3 cards) -->
                <div class="tab-item" @click="setMode(1)">
                    <img :src="currentMode === 1 ? tabSanSel : tabSan" class="tab-img" />
                </div>
                <!-- Mode 2: Si (4 cards) -->
                <div class="tab-item" @click="setMode(2)">
                    <img :src="currentMode === 2 ? tabSiSel : tabSi" class="tab-img" />
                </div>
            </div>

            <!-- Right: Room List -->
            <div class="room-list-container">
                <TransitionGroup name="list" tag="div" class="room-list" :key="currentMode">
                    <div v-for="(room, index) in rooms" :key="room.level" class="room-row"
                        :style="{ '--i': index, animationDelay: `${index * 0.1}s` }">
                        <!-- Left: Room Info (70%) -->
                        <div class="room-info" :style="{ backgroundImage: `url(${eachRoomBg})` }"
                            @click="enterGame(room.level)">
                            <div class="room-info-content">
                                <!-- Room Name with specific bg -->
                                <div class="room-name-container"
                                    :style="{ backgroundImage: `url(${currentRoomNameBg})` }">
                                    <img v-if="getRoomTextImage(room.name)" :src="getRoomTextImage(room.name)"
                                        class="room-name-img" />
                                    <span v-else class="room-name-text">{{ room.name }}</span>
                                </div>
                                <!-- Base Score -->
                                <div class="room-stat">
                                    <img :src="roomIconTextDizhu" class="stat-label-img" />
                                    <SpriteNumber :value="room.baseBet" type="yellow" :height="14" />
                                </div>
                                <!-- Entry Limit -->
                                <div class="room-stat">
                                    <img :src="roomIconTextXianzhi" class="stat-label-img" />
                                    <SpriteNumber :value="room.minBalance" type="white" :height="14" />
                                </div>
                            </div>
                        </div>

                        <!-- Right: Enter Button -->
                        <div class="room-enter-btn" @click="enterGame(room.level)">
                            <img :src="eachRoomEnterBtn" class="enter-btn-img" />
                        </div>
                    </div>
                </TransitionGroup>
            </div>
        </div>

        <!-- Modals -->
        <HistoryModal v-model:visible="showHistory" />
        <SettingsModal v-model:visible="showSettings" />
        <HelpModal v-model:visible="showHelp" :mode="currentMode" />
    </div>
</template>

<style scoped>
.lobby-container {
    width: 100vw;
    height: 100dvh;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: "Microsoft YaHei", Arial, sans-serif;
}

/* --- Top Area --- */
.top-area {
    width: 100%;
    flex-shrink: 0;
    background-size: 100% 100%;
    display: flex;
    flex-direction: column;
    padding-bottom: 5px;
}

/* Row 1 */
.top-row-1 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px 5px 15px;
}

.top-left .btn-exit {
    height: 21px;
    cursor: pointer;
}

.top-right {
    display: flex;
    align-items: center;
    gap: 5px;
}

.top-icon-btn {
    height: 32px;
    cursor: pointer;
}

.top-separator {
    width: 2px;
    height: 13px;
    margin: 0 5px;
}

/* Separator Line */
.top-line-container {
    width: 100%;
    padding: 0 10px;
    box-sizing: border-box;
    margin: 5px 0;
    display: flex;
    justify-content: center;
}

.top-line-img {
    width: 100%;
    height: 2px;
}

/* Row 2 */
.top-row-2 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 15px 0 15px;
}

.logo-img {
    height: 70px;
    object-fit: contain;
}

.coins-container {
    margin-bottom: 30px;
    display: flex;
    align-items: center;
    padding: 3px 10px 3px 10px;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    height: 20px;
    gap: 3px;
}

.coin-icon {
    width: 13px;
    height: 13px;
    margin-bottom: 3px;
}

.coin-val {
    color: #FFD700;
    font-weight: bold;
    font-size: 12px;
}

.add-btn {
    background: linear-gradient(to bottom, #e56f20, #fd7a00e6);
    width: 16px;
    height: 16px;
    border-radius: 50%;
    text-align: center;
    line-height: 16px;
    font-size: 14px;
    color: white;
    cursor: pointer;
    font-weight: bold;
}

/* --- Main Content --- */
.main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    padding-top: 10px;
}

/* Tabs Sidebar */
.tabs-sidebar {
    width: 60px;
    background-size: 100% 100%;
    /* Adjust based on tab image width */
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1px;
    padding-left: 0;
    padding-right: 0;
    overflow-y: auto;
}

.tab-item {
    cursor: pointer;
    transition: transform 0.1s;
    width: 100%;
}

.tab-item:active {
    transform: scale(0.95);
}

.tab-img {
    width: 100%;
    height: auto;
    display: block;
}

/* Room List */
.room-list-container {
    flex: 1;
    overflow-y: auto;
    padding: 0 5px 20px 10px;
}

.room-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.room-row {
    display: flex;
    align-items: center;
    height: 50px;
    position: relative;
    /* Animation */
    opacity: 0;
    transform: translateX(30px);
    animation: slideIn 0.5s ease forwards;
}

@keyframes slideIn {
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Room Info (Left 70%) */
.room-info {
    width: 70%;
    height: 100%;
    background-size: 100% 100%;
    display: flex;
    align-items: center;
    padding: 0 10px;
    cursor: pointer;
}

.room-info-content {
    display: flex;
    align-items: center;
    width: 100%;
    justify-content: space-between;
    padding-right: 40px;
    /* Make space for the button text not to be covered if needed */
}

.room-name-container {
    background-size: 100% 100%;
    padding: 17px 15px 13px 20px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.room-name-text {
    color: white;
    font-weight: bold;
    font-size: 14px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.room-name-img {
    height: 15px;
    width: auto;
    object-fit: contain;
}

.room-stat {
    margin-left: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.stat-label-img {
    height: 10px;
    width: auto;
    object-fit: contain;
    margin-bottom: 6px;
    margin-top: 6px;
}

.stat-value {
    font-size: 12px;
    color: #FFD700;
    font-weight: bold;
    margin-top: 2px;
}

/* Enter Button (Right) */
.room-enter-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    max-width: 100px;
    /* Prevent it from getting too wide */
}

.enter-btn-img {
    width: auto;
    height: 100%;
    object-fit: contain;
}

/* Scrollbar hiding */
.tabs-sidebar::-webkit-scrollbar,
.room-list-container::-webkit-scrollbar {
    display: none;
}
</style>