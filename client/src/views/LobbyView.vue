<script setup>
import { useRouter } from 'vue-router';
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';
import { debounce } from '../utils/debounce.js';
import { formatCoins } from '../utils/format.js';
import { useUserStore } from '../stores/user.js';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';
import { calculateHandType, transformServerCard } from '../utils/bullfight.js';
import gameClient from '../socket.js';
import HistoryModal from '../components/HistoryModal.vue';
import SettingsModal from '../components/SettingsModal.vue';
import HelpModal from '../components/HelpModal.vue';

// Assets
import bgImg from '@/assets/lobby/bg.png';
import logoImg from '@/assets/lobby/logo.png';
import btnExit from '@/assets/lobby/exit_btn.png';
import btnHelp from '@/assets/lobby/help_btn.png';
import btnHistory from '@/assets/lobby/bet_history_btn.png';
import btnSetting from '@/assets/lobby/sett_btn.png';

// Tabs
import tabBukan from '@/assets/lobby/tab_bukan.png';
import tabBukanSel from '@/assets/lobby/tab_bukan_choose.png';
import tabSan from '@/assets/lobby/tab_kansanzhang.png';
import tabSanSel from '@/assets/lobby/tab_kansanzhang_choose.png';
import tabSi from '@/assets/lobby/tab_kansizhang.png';
import tabSiSel from '@/assets/lobby/tab_kansizhang_choose.png';
import tabLineImg from '@/assets/lobby/tab_line.png';
import tabBgImg from '@/assets/lobby/tab_bg.png';

// Room Assets Explicit Import
import roomTiyanBg from '@/assets/lobby/room_tiyan_bg.png';
import roomTiyanText from '@/assets/lobby/room_tiyan_text.png';
import roomTiyanShape from '@/assets/lobby/room_tiyan_shape.png';

import roomChujiBg from '@/assets/lobby/room_chuji_bg.png';
import roomChujiText from '@/assets/lobby/room_chuji_text.png';
import roomChujiShape from '@/assets/lobby/room_chuji_shape.png';

import roomZhongjiBg from '@/assets/lobby/room_zhongji_bg.png';
import roomZhongjiText from '@/assets/lobby/room_zhongji_text.png';
import roomZhongjiShape from '@/assets/lobby/room_zhongji_shape.png';

import roomGaojiBg from '@/assets/lobby/room_gaoji_bg.png';
import roomGaojiText from '@/assets/lobby/room_gaoji_text.png';
import roomGaojiShape from '@/assets/lobby/room_gaoji_shape.png';

import roomDashiBg from '@/assets/lobby/room_dashi_bg.png';
import roomDashiText from '@/assets/lobby/room_dashi_text.png';
import roomDashiShape from '@/assets/lobby/room_dashi_shape.png';

import roomDianfengBg from '@/assets/lobby/room_dianfeng_bg.png';
import roomDianfengText from '@/assets/lobby/room_dianfeng_text.png';
import roomDianfengShape from '@/assets/lobby/room_dianfeng_shape.png';

import defaultAvatar from '@/assets/common/default_avatar.png';
import lobbyBgSound from '@/assets/sounds/lobby_bg.mp3';
import goldImg from '@/assets/common/gold.png';

const router = useRouter();
const userStore = useUserStore();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();
const bgAudio = ref(null);

const roomAssetsMap = {
    tiyan: { bg: roomTiyanBg, text: roomTiyanText, shape: roomTiyanShape },
    chuji: { bg: roomChujiBg, text: roomChujiText, shape: roomChujiShape },
    zhongji: { bg: roomZhongjiBg, text: roomZhongjiText, shape: roomZhongjiShape },
    gaoji: { bg: roomGaojiBg, text: roomGaojiText, shape: roomGaojiShape },
    dashi: { bg: roomDashiBg, text: roomDashiText, shape: roomDashiShape },
    dianfeng: { bg: roomDianfengBg, text: roomDianfengText, shape: roomDianfengShape },
};

const getRoomAssets = (levelIndex) => {
    const types = ['tiyan', 'chuji', 'zhongji', 'gaoji', 'dashi', 'dianfeng'];
    const type = types[levelIndex] || 'dianfeng';
    return roomAssetsMap[type];
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

const currentMode = ref(0); // 0: Bukan, 1: San, 2: Si

const setMode = (mode) => {
    currentMode.value = mode;
    userStore.lastSelectedMode = mode;
    localStorage.setItem('lastSelectedMode', mode);
};

const enterGame = debounce(async (level) => {
    try {
        await gameStore.joinRoom(level, currentMode.value);
        router.push({ path: '/game', query: { mode: currentMode.value } });
    } catch (error) {
        console.error("Failed to join room:", error);
    }
}, 500);

const roomTextColors = [
    "rgb(150, 250, 230)", // Tiyan
    "rgb(148, 230, 253)", // Chuji
    "rgb(122, 188, 255)", // Zhongji (corrected 257 -> 255)
    "rgb(181, 169, 247)", // Gaoji
    "rgb(238, 171, 237)", // Dashi
    "rgb(240, 173, 222)"  // Dianfeng
];

const rooms = computed(() => {
    const configs = userStore.roomConfigs || [];
    return configs.map((cfg, index) => ({
        level: cfg.level,
        name: cfg.name,
        base: formatCoins(cfg.base_bet),
        min: formatCoins(cfg.min_balance),
        assets: getRoomAssets(index),
        limitColor: roomTextColors[index] || "rgb(255, 255, 255)"
    }));
});

// --- History, Settings, Help Logic ---
const showHistory = ref(false);
const showSettings = ref(false);
const showHelp = ref(false);

const openHistoryDebounced = debounce(() => {
    showHistory.value = true;
}, 200);

const openSettingsDebounced = debounce(() => {
    showSettings.value = true;
}, 200);

const openHelpDebounced = debounce(() => {
    showHelp.value = true;
}, 200);

const fetchData = () => {
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
    if (bgAudio.value) bgAudio.value.pause();
};

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
    bgAudio.value = null;
});

const goBack = () => {
    console.log("Exit clicked");
    // router.push('/'); // Uncomment if needed
};
</script>

<template>
    <div class="lobby-container" :style="{ backgroundImage: `url(${bgImg})` }">
        <!-- 1. Top Bar -->
        <div class="top-bar">
            <!-- Left: Functional Buttons -->
            <div class="top-left-btns">
                <img :src="btnExit" class="icon-btn" @click="goBack" alt="Exit" />
                <img :src="btnHistory" class="icon-btn" @click="openHistoryDebounced" alt="History" />
                <img :src="btnHelp" class="icon-btn" @click="openHelpDebounced" alt="Help" />
                <img :src="btnSetting" class="icon-btn" @click="openSettingsDebounced" alt="Settings" />
            </div>

            <!-- Right: User Info -->
            <div class="user-info-area">
                <div class="avatar-wrapper">
                    <img :src="userInfo.avatar" class="avatar" />
                </div>
                <div class="info-details">
                    <div class="name-row">{{ userInfo.displayName }}</div>
                    <div class="coin-row">
                        <img :src="goldImg" class="coin-icon" />
                        <span class="coin-val">{{ userInfo.coins }}</span>
                        <div class="add-btn">+</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. Logo Row -->
        <div class="logo-row">
            <img :src="logoImg" class="logo-img" alt="Logo" />
        </div>

        <!-- 3. Tabs Row -->

        <div class="tabs-container" :style="{ backgroundImage: `url(${tabBgImg})` }">

            <!-- Mode 0: Bukan (No Look) -->

            <img :src="currentMode === 0 ? tabBukanSel : tabBukan" class="tab-btn"
                :class="{ 'active': currentMode === 0 }" @click="setMode(0)" />



            <!-- Mode 1: San (3 cards) -->

            <div class="tab-separator" :style="{ visibility: currentMode === 2 ? 'visible' : 'hidden' }"></div>

            <img :src="currentMode === 1 ? tabSanSel : tabSan" class="tab-btn" :class="{ 'active': currentMode === 1 }"
                @click="setMode(1)" />







            <!-- Vertical Separator -->



            <div class="tab-separator" :style="{ visibility: currentMode === 0 ? 'visible' : 'hidden' }"></div>







            <!-- Mode 2: Si (4 cards) -->

            <img :src="currentMode === 2 ? tabSiSel : tabSi" class="tab-btn" :class="{ 'active': currentMode === 2 }"
                @click="setMode(2)" />

            <!-- Divider Line -->
            <img :src="tabLineImg" class="lobby-divider" />

        </div>

        <!-- 4. Room Grid -->
        <div class="rooms-scroll-area">
            <div class="rooms-grid">
                <div v-for="(room, index) in rooms" :key="room.level" class="room-item" :class="['room-idx-' + index]"
                    @click="enterGame(room.level)">

                    <!-- Background Layer -->
                    <img :src="room.assets.bg" class="room-bg" />

                    <!-- Content Wrapper -->
                    <div class="room-content-wrapper">
                        <!-- Info Section -->
                        <div class="room-info-section">
                            <!-- Left: Shape -->
                            <div class="room-shape-box">
                                <img :src="room.assets.shape" class="room-shape-img" />
                            </div>
                            <!-- Right: Text & Base Bet -->
                            <div class="room-details-box">
                                <img :src="room.assets.text" class="room-text-img-new" />
                                <div class="base-info-text">底注: {{ room.base }}</div>
                            </div>
                        </div>

                        <!-- Limit Section -->
                        <div class="room-limit-section" :style="{ color: room.limitColor }">
                            入场限制: {{ room.min }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- History Modal -->
        <HistoryModal v-model:visible="showHistory" />

        <!-- Settings Modal -->
        <SettingsModal v-model:visible="showSettings" />

        <!-- Help Modal -->
        <HelpModal v-model:visible="showHelp" :mode="currentMode" />
    </div>
</template>



<style scoped>
.lobby-container {

    width: 100vw;

    height: 100vh;

    background-size: cover;

    background-position: center;

    background-repeat: no-repeat;

    display: flex;

    flex-direction: column;

    overflow: hidden;

    position: relative;

    font-family: "Microsoft YaHei", Arial, sans-serif;

}



/* 1. Top Bar */

.top-bar {

    display: flex;

    justify-content: space-between;

    align-items: center;

    padding: 10px 15px;

    /* Reduced padding */

    z-index: 10;

    width: 100%;

    box-sizing: border-box;

    /* Ensure padding doesn't add to width */

}



.top-left-btns {

    display: flex;

    gap: 8px;

    /* Reduced gap */

    align-items: center;

    flex-shrink: 0;

    /* Prevent shrinking */

}



.icon-btn {

    width: 32px;

    /* Reduced from 36px */

    height: 32px;

    cursor: pointer;

    transition: transform 0.1s;

    object-fit: contain;

}



.icon-btn:active {

    transform: scale(0.9);

}



.user-info-area {

    display: flex;

    align-items: center;

    /* Removed background and border from the main container */

    background: transparent;

    border: none;

    padding: 0;

    gap: 5px;

    max-width: 55%;

}



.avatar-wrapper {

    width: 36px;

    height: 36px;

    border-radius: 6px;

    /* Square with slight rounding */

    border: 2px solid #fff;

    overflow: hidden;

    flex-shrink: 0;

    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);

}



.avatar {

    width: 100%;

    height: 100%;

    object-fit: cover;

}



.info-details {

    display: flex;

    flex-direction: column;

    justify-content: center;

    min-width: 0;

    flex: 1;

    gap: 2px;

}



.name-row {

    font-size: 13px;

    font-weight: bold;

    color: white;

    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);

    /* Added shadow for readability without bg */

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

    padding-left: 2px;

}



.coin-row {

    display: flex;

    align-items: center;

    /* Added background for coin row */

    background: rgba(0, 0, 0, 0.6);

    border: 1px solid rgba(255, 255, 255, 0.2);

    border-radius: 12px;

}



.coin-icon {

    width: 16px;

    height: 16px;

    margin-right: 4px;

}



.coin-val {

    font-size: 12px;

    color: #FFD700;

    font-weight: bold;

    margin-right: 6px;

    white-space: nowrap;

}



.add-btn {

    background: linear-gradient(to bottom, #e56f20, #fd7a00e6);

    width: 14px;

    height: 14px;

    border-radius: 50%;

    text-align: center;

    line-height: 14px;

    font-size: 12px;

    color: white;

    cursor: pointer;

    font-weight: bold;

    flex-shrink: 0;

}



/* 2. Logo Row */

.logo-row {

    display: flex;

    justify-content: center;

    margin-top: 20px;

    margin-bottom: 20px;

    z-index: 5;

}



.logo-img {

    width: 50vw;

    /* 1/2 of screen width */

    height: auto;

    object-fit: contain;

    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));

}



/* 3. Tabs Row */

.tabs-container {

    display: flex;

    justify-content: center;

    align-items: center;

    gap: 5px;

    z-index: 5;



    /* Changed from width: 100% to fit content */

    width: auto;

    align-self: center;

    /* Center in the flex column parent */



    /* Background properties */

    background-size: 100% 100%;

    /* Stretch bg to fit the container size perfectly */

    background-repeat: no-repeat;

    background-position: center;

    position: relative;

}



.tab-btn {



    width: 25vw;

    /* ~1/4 of screen width */



    max-width: 200px;



    height: auto;



    cursor: pointer;



    transition: filter 0.2s ease-in-out;



    object-fit: contain;



    /* Default state (inactive): visually smaller */



    /* Removed transform scale */



    filter: brightness(0.6);



}







.tab-btn.active {



    /* Active state: fully bright */



    /* Removed transform scale */



    filter: brightness(1.1);



    z-index: 2;

    /* Bring to front */



}







.tab-btn:hover {







    /* Hover effect (optional, maybe just scale up a bit more if active or inactive) */







    filter: brightness(1.2);







}











.tab-separator {







    width: 1px;



    border-radius: 10px;



    height: 20px;

    /* Approx 80% of typical tab height */







    background-color: #666;







    opacity: 0.6;







}











.lobby-divider {

    width: 100vw;

    height: 8px;

    object-fit: fill;

    position: absolute;

    bottom: -7.5px;

    left: 50%;

    transform: translateX(-50%);

}



/* 4. Room Grid */

.rooms-scroll-area {

    flex: 1;

    overflow-y: auto;

    width: 100%;

    padding: 10px 0 40px 0;

}



/* Hide scrollbar */

.rooms-scroll-area::-webkit-scrollbar {

    display: none;

}



.rooms-grid {

    display: grid;

    grid-template-columns: repeat(2, 1fr);

    /* Gap between columns */

    column-gap: 10px;
    row-gap: 10px;

    margin-top: 10px;

    /* 20px horizontal padding from screen edges */

    padding: 0 20px;

    width: 100%;

    box-sizing: border-box;

    justify-items: center;

}



.room-item {



    position: relative;







    /* Fill the grid column width */



    width: 100%;







    /* Auto height based on content */



    height: auto;







    cursor: pointer;



    transition: transform 0.2s;







    /* NEW FLEX LAYOUT */



    display: flex;



    flex-direction: column;







    border-radius: 10px;



    overflow: hidden;



    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);



}







.room-item:active {



    transform: scale(0.98);



}







/* Custom Grid Layout Logic */



/* Index 4: Row 3 (1 col, centered) -> Spans 2 columns */



.room-item.room-idx-4 {



    grid-column: span 2;



}







/* Index 5: Row 4 (1 col, centered) -> Spans 2 columns */



.room-item.room-idx-5 {



    grid-column: span 2;



}







/* Internal Room Assets */



.room-bg {



    position: absolute;



    top: 0;



    left: 0;



    width: 100%;



    height: 100%;



    object-fit: fill;



    z-index: 0;



}







.room-content-wrapper {







    position: relative;







    z-index: 1;







    width: 100%;







    /* Flex 1 ensures it fills the parent height (which is stretched by grid) */







    flex: 1;







    display: flex;







    flex-direction: column;







    justify-content: space-between;







}







.room-info-section {



    /* Allow it to grow with content */



    display: flex;



    flex-direction: row;



    align-items: center;



    padding: 15px 5px 15px 5px;
    /* Added vertical padding for spacing */



}







.room-shape-box {



    width: 35%;
    /* Slightly larger shape area */



    display: flex;



    justify-content: center;



    align-items: center;



}







.room-shape-img {



    width: 100%;



    height: auto;



    object-fit: contain;



}







.room-details-box {



    flex: 1;



    display: flex;



    flex-direction: column;



    justify-content: center;



    align-items: center;



    padding-left: 5px;



}







.room-text-img-new {



    width: 76%;



    height: auto;



    object-fit: contain;



    margin-bottom: 4px;



}







.base-info-text {



    font-size: 16px;



    color: #FFF;



    font-weight: bold;


    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);



}







.room-limit-section {



    height: 30px;



    /* Dark gray/black background */



    background-color: rgba(30, 41, 59, 0.72);







    /* Rounded corners handled by parent overflow:hidden, but we can keep them to be safe or specific design */



    /* If the card is rounded, the bottom bar will be clipped to round. */







    display: flex;



    justify-content: center;



    align-items: center;







    color: #cbd5e1;



    font-size: 15px;



    font-weight: bold;



    margin: 0;
    /* Flush to bottom of container */



    width: 100%;



}



@media (min-width: 600px) {

    .base-info-text {

        font-size: 16px;

    }

    .room-limit-section {
        font-size: 14px;
    }
}
</style>
