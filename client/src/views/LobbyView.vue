<script setup>
import { useRouter } from 'vue-router';
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';
import { debounce } from '../utils/debounce.js';
import { formatCoins } from '../utils/format.js';
import { useUserStore } from '../stores/user.js';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';
import { calculateHandType, transformServerCard } from '../utils/bullfight.js';
import { AudioUtils } from '../utils/audio.js';
import gameClient from '../socket.js';
import HistoryModal from '../components/HistoryModal.vue';
import SettingsModal from '../components/SettingsModal.vue';
import HelpModal from '../components/HelpModal.vue';

// Assets
import bgImg from '@/assets/lobby/bg.jpg';
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
import tabBgImg from '@/assets/lobby/tab_bg.png';

// Room Assets Explicit Import
import roomAreaBg from '@/assets/lobby/room_bg.jpg';
import roomTiyanBg from '@/assets/lobby/room_tiyan_bg.png';
import roomChujiBg from '@/assets/lobby/room_chuji_bg.png';
import roomZhongjiBg from '@/assets/lobby/room_zhongji_bg.png';
import roomGaojiBg from '@/assets/lobby/room_gaoji_bg.png';
import roomDashiBg from '@/assets/lobby/room_dashi_bg.png';
import roomDianfengBg from '@/assets/lobby/room_dianfeng_bg.png';

import defaultAvatar from '@/assets/common/default_avatar.png';
import lobbyBgSound from '@/assets/sounds/lobby_bg.mp3';
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import goldImg from '@/assets/common/gold.png';

const router = useRouter();
const userStore = useUserStore();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();

const playBtnSound = () => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
};

const roomAssetsMap = {
    tiyan: { bg: roomTiyanBg },
    chuji: { bg: roomChujiBg },
    zhongji: { bg: roomZhongjiBg },
    gaoji: { bg: roomGaojiBg },
    dashi: { bg: roomDashiBg },
    dianfeng: { bg: roomDianfengBg },
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
    playBtnSound();
    currentMode.value = mode;
    userStore.lastSelectedMode = mode;
    localStorage.setItem('lastSelectedMode', mode);
};

const enterGame = debounce(async (level) => {
    playBtnSound();
    try {
        await gameStore.joinRoom(level, currentMode.value);
        router.push({ path: '/game', query: { mode: currentMode.value } });
    } catch (error) {
        console.error("Failed to join room:", error);
    }
}, 500);

const rooms = computed(() => {
    const configs = userStore.roomConfigs || [];
    return configs.map((cfg, index) => {
        return {
            level: cfg.level,
            name: cfg.name,
            assets: getRoomAssets(index)
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
            <div class="coin-row">
                <img :src="goldImg" class="coin-icon" />
                <span class="coin-val">{{ userInfo.coins }}</span>
            </div>
        </div>

        <!-- 2. Logo Row -->
        <div class="logo-row">
            <img :src="logoImg" class="logo-img" alt="Logo" />
        </div>

        <!-- 3. Tabs Row -->

        <div class="tabs-container" :style="{ backgroundImage: `url(${tabBgImg})` }">

            <!-- Stacked Images (Display Only) -->
            <!-- Mode 0: Bukan (No Look) -->
            <img :src="currentMode === 0 ? tabBukanSel : tabBukan" class="tab-btn"
                :class="{ 'active': currentMode === 0 }" />

            <!-- Mode 1: San (3 cards) -->
            <img :src="currentMode === 1 ? tabSanSel : tabSan" class="tab-btn"
                :class="{ 'active': currentMode === 1 }" />

            <!-- Mode 2: Si (4 cards) -->
            <img :src="currentMode === 2 ? tabSiSel : tabSi" class="tab-btn" :class="{ 'active': currentMode === 2 }" />

            <!-- Click Layer (Interaction) -->
            <div class="tab-click-layer">
                <div class="tab-click-zone" @click="setMode(0)"></div>
                <div class="tab-click-zone" @click="setMode(1)"></div>
                <div class="tab-click-zone" @click="setMode(2)"></div>
            </div>

        </div>

        <!-- 4. Room Grid -->
        <div class="rooms-scroll-area" :style="{ backgroundImage: `url(${roomAreaBg})` }">
            <div class="rooms-grid">
                <div v-for="(room, index) in rooms" :key="room.level" class="room-item" :class="['room-idx-' + index]"
                    @click="enterGame(room.level)">

                    <!-- Background Layer -->
                    <img :src="room.assets.bg" class="room-bg" />
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

    height: 100dvh;

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

    padding: 10px 15px 20px 15px;

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

    max-width: 55%
}



.avatar-wrapper {

    width: 36px;

    height: 36px;

    border-radius: 6px;

    /* Square with slight rounding */

    border: 2px solid #fac27d;

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



    flex-direction: column;



    justify-content: center;





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



    display: inline-flex;



    align-items: center;



    /* Added background for coin row */



    background: rgba(0, 0, 0, 0.6);



    border: 1px solid rgba(255, 255, 255, 0.2);



    border-radius: 12px;



    padding: 2px 6px;
    /* Added padding */



    gap: 4px;
    /* Added gap for spacing between items */



}







.coin-icon {



    width: 18px;



    height: 18px;



    /* Removed margin-right as gap handles spacing */



}







.coin-val {



    font-size: 14px;



    color: #FFD700;



    font-weight: bold;



    /* Removed margin-right as gap handles spacing */



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

    margin-bottom: 20px;

    z-index: 5;

}



.logo-img {

    width: 60vw;

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
    z-index: 5;

    /* Container fits screen width */
    width: 100vw;
    /* Height matches the tab height */
    height: 40px;

    align-self: center;
    position: relative;
    /* Ensure background behaves correctly if needed, or remove if tabs cover it */
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center;
}

.tab-btn {
    /* Each tab takes full screen width */
    width: 100vw;
    height: 48px;
    cursor: pointer;
    transition: filter 0.2s ease-in-out;
    object-fit: fill;

    /* Overlay them */
    position: absolute;
    top: 0;
    left: 0;

    /* Default lower z-index for inactive tabs */
    z-index: 1;
    /* Opacity logic: if you want non-selected to be invisible, set opacity: 0. 
       If they are transparent PNGs designed to overlay, keep opacity: 1.
       Assuming they are full opaque bars where only one shows 'selected' state:
    */
}

.tab-btn.active {
    /* Active tab on top */
    z-index: 2;
    filter: brightness(1.1);
}

/* Specific z-index ordering for clicking if needed, 
   but since they are stacked, click handling might need explicit areas 
   if the images are full width.
   
   HOWEVER, if the images are 100vw wide, they stack on top of each other.
   Clicking anywhere will click the top-most one (z-index 2).
   This prevents clicking the other tabs if they are fully covered.
   
   CRITICAL: If the images are designed such that the visual "tab" part 
   is only a portion, but the image file is 100vw transparent, 
   we need to know where the click zones are.
   
   If the user says "images are width of screen wide", and they are stacked, 
   we can't click the ones underneath unless we use a map or invisible divs for clicks.
   
   Assumption: The user implies the visual design is a single bar where the "selected" state
   changes the whole look, but logically they are 3 buttons.
   
   If the IMAGES contain all 3 tabs visually but highlight one, then stacking them 
   works purely for display, BUT we need a way to click.
   
   Solution: Create an invisible click layer on top with 3 columns.
*/

.tab-click-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    z-index: 10;
    /* Above images */
}

.tab-click-zone {
    flex: 1;
    /* 3 equal zones */
    height: 100%;
    cursor: pointer;
}

.tab-btn:hover {
    filter: brightness(1.2);
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

    background-size: cover;

    background-position: center;

    background-repeat: no-repeat;

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



}







.room-item:active {



    transform: scale(0.98);



}


/* Internal Room Assets */

.room-bg {
    width: 100%;
    height: auto;
    object-fit: contain;
    display: block;
}
</style>
