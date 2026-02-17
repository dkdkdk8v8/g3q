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
import bgUpImg from '@/assets/lobby/bg_up.png';
import topBgImg from '@/assets/lobby/top_bg.png';
import btnExit from '@/assets/lobby/exit_btn.png';
import btnHelp from '@/assets/lobby/help_btn.png';
import btnHistory from '@/assets/lobby/bet_history_btn.png';
import btnSetting from '@/assets/lobby/sett_btn.png';
import topBtnLine from '@/assets/lobby/top_btn_line.png';
import topLine from '@/assets/lobby/top_line.png';
import diamondBg from '@/assets/lobby/diamond_bg.png';

// Tab Assets
import tabBgImg from '@/assets/lobby/tab_bg.png';
import tabBukanBg from '@/assets/lobby/tab_bukanpai_bg.png';
import tabBukanSelBg from '@/assets/lobby/tab_bukanpai_choose_bg.png';
import tabSansiBg from '@/assets/lobby/tab_sansi_bg.png';
import tabSansiSelBg from '@/assets/lobby/tab_sansi_choose_bg.png';

// Tab Text Images (Keep existing if they are text overlays, otherwise remove if replaced by bg)
// Assuming previous tab images were text/icon overlays, we keep them or replace if new bgs contain text.
// Based on filenames, these seem to be the full buttons. Let's assume the new ones are backgrounds 
// and we might need to overlay text, OR the new ones are the complete button images including text.
// Checking filenames: tab_bukanpai.png vs tab_bukanpai_bg.png. 
// "bg" implies background. Let's assume we still need the text/icon on top if available, 
// OR the new images are self-contained. 
// User instruction says "background image". Let's check if we still have text images.
// The previous imports were:
import tabBukan from '@/assets/lobby/tab_bukanpai.png';
import tabBukanSel from '@/assets/lobby/tab_bukanpai_choose.png';
import tabSan from '@/assets/lobby/tab_kansanzhang.png';
import tabSanSel from '@/assets/lobby/tab_kansanzhang_choose.png';
import tabSi from '@/assets/lobby/tab_kansizhang.png';
import tabSiSel from '@/assets/lobby/tab_kansizhang_choose.png';

// Room Assets
import eachRoomBg from '@/assets/lobby/each_room_bg.png';
import eachRoomEnterBtn from '@/assets/lobby/each_room_enter_btn.png';
import eachRoomEnterBtnText from '@/assets/lobby/each_room_enter_btn_text.png';
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
import avatarFrameImg from '@/assets/common/avatar_circle.png';
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

// Helper to generate random particles
const generateParticles = () => {
    return Array.from({ length: 6 }, () => {
        const left = Math.random() * 80 + 10; // 10% - 90%
        const duration = Math.random() * 2 + 3; // 3s - 5s (slower)
        const delay = Math.random() * 4; // 0s - 4s (spread out)
        const size = Math.random() * 2 + 1; // 1px - 3px (smaller)
        return {
            left: `${left}%`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
            width: `${size}px`,
            height: `${size}px`
        };
    });
};

const rooms = computed(() => {
    const configs = userStore.roomConfigs || [];
    return configs.map((cfg) => {
        return {
            level: cfg.level,
            name: cfg.name,
            baseBet: (cfg.base_bet || 0) / 100,
            minBalance: (cfg.min_balance || 0) / 100,
            particles: generateParticles()
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
        <!-- Floating Background Layer -->
        <img :src="bgUpImg" class="bg-up-anim" />

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

            <!-- Row 2: User Info -->
            <div class="top-row-2">
                <div class="user-info-container">
                    <div class="avatar-wrapper">
                        <img :src="userInfo.avatar" class="user-avatar" alt="" />
                        <img :src="avatarFrameImg" class="avatar-border-overlay" />
                    </div>
                    <div class="user-details">
                        <span class="user-nickname">{{ userInfo.displayName }}</span>
                        <div class="coins-display" :style="{ backgroundImage: `url(${diamondBg})` }">
                            <img :src="goldImg" class="coin-icon" />
                            <span class="coin-val">{{ userInfo.coins }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content: Room List (Full Width) -->
        <div class="main-content">
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
                            <div class="enter-btn-wrapper">
                                <img :src="eachRoomEnterBtn" class="enter-btn-bg-img" />
                                <div class="particles-container">
                                    <i v-for="(style, i) in room.particles" :key="i" class="star-particle"
                                        :style="style"></i>
                                </div>
                                <img :src="eachRoomEnterBtnText" class="enter-btn-text-img" />
                            </div>
                        </div>
                    </div>
                </TransitionGroup>
            </div>
        </div>

        <!-- Bottom Tabs Area -->
        <div class="bottom-area-container">
            <!-- Tabs -->
            <div class="bottom-tabs">
                <!-- Mode 0: Bukan (No Look) -->
                <div class="tab-item" @click="setMode(0)"
                    :style="{ backgroundImage: `url(${currentMode === 0 ? tabBukanSelBg : tabBukanBg})` }">
                    <img :src="currentMode === 0 ? tabBukanSel : tabBukan" class="tab-content-img" />
                </div>
                <!-- Mode 1: San (3 cards) -->
                <div class="tab-item2" @click="setMode(1)"
                    :style="{ backgroundImage: `url(${currentMode === 1 ? tabSansiSelBg : tabSansiBg})` }">
                    <img :src="currentMode === 1 ? tabSanSel : tabSan" class="tab-content-img" />
                </div>
                <!-- Mode 2: Si (4 cards) -->
                <div class="tab-item3" @click="setMode(2)"
                    :style="{ backgroundImage: `url(${currentMode === 2 ? tabSansiSelBg : tabSansiBg})` }">
                    <img :src="currentMode === 2 ? tabSiSel : tabSi" class="tab-content-img" />
                </div>
            </div>
            <!-- Bottom Decoration Bar -->
            <div class="bottom-bar-bg" :style="{ backgroundImage: `url(${tabBgImg})` }"></div>
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
    position: relative;
    /* Ensure relative positioning context for children */
}

/* Floating Background */
.bg-up-anim {
    position: absolute;
    width: 100%;
    /* Start position */
    left: -20%;
    top: 0%;
    z-index: 0;
    /* Above main bg, below content */
    opacity: 0.8;
    /* Optional: adjust opacity if needed to blend */
    pointer-events: none;
    /* Let clicks pass through */
    animation: floatBg 15s infinite ease-in-out alternate;
}

@keyframes floatBg {
    0% {
        transform: translate(0, 0) scale(1);
    }

    25% {
        transform: translate(25%, 30%) scale(1.02);
    }

    50% {
        transform: translate(25%, 60%) scale(1.05);
        /* Close to 40% top total */
    }

    75% {
        transform: translate(50%, 55%) scale(1.02);
    }

    100% {
        transform: translate(80%, 50%) scale(1);
        /* Close to 50% top total */
    }
}

/* --- Top Area --- */
.top-area {
    width: 100%;
    flex-shrink: 0;
    background-size: 100% 100%;
    display: flex;
    flex-direction: column;
    padding-bottom: 5px;
    position: relative;
    z-index: 1;
    /* Ensure content is above floating bg */
}

/* Row 1 */
.top-row-1 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 15px 5px 15px;
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
    justify-content: flex-start;
    align-items: center;
    padding: 10px 15px 15px 15px;
}

.user-info-container {
    display: flex;
    align-items: center;
    gap: 10px;
}

.avatar-wrapper {
    position: relative;
    width: 43px;
    height: 43px;
}

.user-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    /* border: 2px solid #e0e0e0; */
    object-fit: cover;
}

.avatar-border-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
}

.user-nickname {
    color: white;
    font-size: 14px;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.user-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    padding-left: 5px;
}

.coins-display {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 4px 0 10px;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    height: 18px;
    position: relative;
}

.coin-icon {
    width: auto;
    height: 16px;
    position: absolute;
    left: -10px;
    top: 40%;
    transform: translateY(-50%);
}

.coin-val {
    color: #FFD700;
    font-weight: bold;
    font-size: 14px;
    line-height: 1;
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
    padding-bottom: 5px;
    position: relative;
    z-index: 1;
    /* Ensure content is above floating bg */
}

/* Room List */
.room-list-container {
    flex: 1;
    width: 100%;
    overflow-y: auto;
    padding: 0 15px 10px 15px;
    /* Added side padding to center rooms if needed */
}

.room-list {
    display: flex;
    flex-direction: column;
    gap: 13px;
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
    width: 80%;
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
    margin-bottom: 10px;
    margin-top: 0;
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
}

.enter-btn-wrapper {
    position: relative;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.enter-btn-bg-img {
    height: 100%;
    width: auto;
    object-fit: contain;
}

.enter-btn-text-img {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    height: 28%;
    width: auto;
    z-index: 2;
    pointer-events: none;
}

.particles-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 1;
    pointer-events: none;
}

.star-particle {
    position: absolute;
    bottom: 10px;
    width: 3px;
    height: 3px;
    background-color: #ffd700;
    border-radius: 50%;
    box-shadow: 0 0 3px #fff;
    opacity: 0;
    animation: particleMove 2s infinite linear;
}

@keyframes particleMove {
    0% {
        transform: translateY(0) scale(0.5);
        opacity: 0;
    }

    20% {
        opacity: 1;
    }

    100% {
        transform: translateY(-25px) scale(1);
        opacity: 0;
    }
}

/* --- Bottom Area --- */
.bottom-area-container {
    flex-shrink: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
}

.bottom-bar-bg {
    width: 100%;
    height: 32px;
    /* Adjust based on tab_bg.png height */
    background-size: 100% 100%;
    background-repeat: no-repeat;
}

/* Bottom Tabs */
.bottom-tabs {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    /* Right aligned */
    align-items: flex-end;
    padding-right: 10px;
    gap: 0;
    /* No gap if backgrounds are meant to touch or overlap slightly */
    margin-bottom: -2px;
    /* Pull down slightly to touch the bottom bar */
}

.tab-item {
    cursor: pointer;
    transition: transform 0.1s;
    width: 105px;
    padding-left: 18px;
    /* Adjust based on bg image width */
    height: 45px;
    /* Adjust based on bg image height */
    background-size: 100% 100%;
    background-repeat: no-repeat;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
}

.tab-item2 {
    cursor: pointer;
    transition: transform 0.1s;
    width: 95px;
    /* Adjust based on bg image width */
    height: 45px;
    /* Adjust based on bg image height */
    background-size: 100% 100%;
    background-repeat: no-repeat;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
}

.tab-item3 {
    cursor: pointer;
    transition: transform 0.1s;
    width: 95px;
    /* Adjust based on bg image width */
    height: 45px;
    /* Adjust based on bg image height */
    background-size: 100% 100%;
    background-repeat: no-repeat;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
}

.tab-content-img {
    height: 50%;
    /* Adjust size of text/icon inside */
    width: auto;
    object-fit: contain;
}

/* Scrollbar hiding */
.room-list-container::-webkit-scrollbar {
    display: none;
}
</style>