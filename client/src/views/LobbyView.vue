<script setup>
import { useRouter, useRoute } from 'vue-router';
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
import LobbyBackgroundAnimation from '../components/LobbyBackgroundAnimation.vue';

// ====== COMMON ASSETS ======
import defaultAvatar from '@/assets/common/default_avatar.png';
import avatarFrameImg from '@/assets/common/avatar_circle.png';
import lobbyBgSound from '@/assets/sounds/lobby_bg.mp3';
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import goldImg from '@/assets/common/gold.png';

// ====== DEFAULT THEME ASSETS (Mode 0: 不看牌) ======
import defaultBg from '@/assets/lobby/bg.jpg';
import bgUpImg from '@/assets/lobby/bg_up.png';
import topBgImg from '@/assets/lobby/top_bg.png';
import btnExit from '@/assets/lobby/exit_btn.png';
import btnHelp from '@/assets/lobby/help_btn.png';
import btnHistory from '@/assets/lobby/bet_history_btn.png';
import btnSetting from '@/assets/lobby/sett_btn.png';
import topBtnLine from '@/assets/lobby/top_btn_line.png';
import topLine from '@/assets/lobby/top_line.png';
import diamondBg from '@/assets/lobby/diamond_bg.png';
import eachRoomBg from '@/assets/lobby/each_room_bg.png';
import eachRoomEnterBtn from '@/assets/lobby/each_room_enter_btn.png';
import eachRoomEnterBtnText from '@/assets/lobby/each_room_enter_btn_text.png';
import roomNameBgLv from '@/assets/lobby/each_room_name_bg_lv.png';
import roomNameBgLan from '@/assets/lobby/each_room_name_bg_lan.png';
import roomNameBgLz from '@/assets/lobby/each_room_name_bg_zise.png';
import roomIconTextDizhu from '@/assets/lobby/room_icontext_dizhu.png';
import roomIconTextXianzhi from '@/assets/lobby/room_icontext_xianzhi.png';
import roomTextTiyan from '@/assets/lobby/room_text_tiyan.png';
import roomTextChuji from '@/assets/lobby/room_text_chuji.png';
import roomTextZhongji from '@/assets/lobby/room_text_zhongji.png';
import roomTextGaoji from '@/assets/lobby/room_text_gaoji.png';
import roomTextDashi from '@/assets/lobby/room_text_dashi.png';
import roomTextDianfeng from '@/assets/lobby/room_text_dianfeng.png';

// ====== GREEN THEME ASSETS (Mode 1: 看三张) ======
import greenBg from '@/assets/lobby_green/bg.jpg';
import greenTopShape from '@/assets/lobby_green/top_shape.png';
import greenBtnExit from '@/assets/lobby_green/exit_btn.png';
import greenBtnHelp from '@/assets/lobby_green/help_btn.png';
import greenBtnHistory from '@/assets/lobby_green/bet_history_btn.png';
import greenBtnSetting from '@/assets/lobby_green/sett_btn.png';
import greenDiamondBg from '@/assets/lobby_green/diamond_bg.png';
import greenEachRoomBg from '@/assets/lobby_green/each_room_bg.png';
import greenEachRoomEnterBtnText from '@/assets/lobby_green/each_room_enter_btn_text.png';
import greenRoomIconTextDizhu from '@/assets/lobby_green/room_icontext_dizhu.png';
import greenRoomIconTextXianzhi from '@/assets/lobby_green/room_icontext_xianzhi.png';
import greenRoomTextTiyan from '@/assets/lobby_green/room_text_tiyan.png';
import greenRoomTextChuji from '@/assets/lobby_green/room_text_chuji.png';
import greenRoomTextZhongji from '@/assets/lobby_green/room_text_zhongji.png';
import greenRoomTextGaoji from '@/assets/lobby_green/room_text_gaoji.png';
import greenRoomTextDashi from '@/assets/lobby_green/room_text_dashi.png';
import greenRoomTextDianfeng from '@/assets/lobby_green/room_text_dianfeng.png';

// ====== PURPLE THEME ASSETS (Mode 2: 看四张) ======
import purpleBg from '@/assets/lobby_purple/bg.jpg';
import purpleTopBg from '@/assets/lobby_purple/top_bg.png';
import purpleBtnExit from '@/assets/lobby_purple/exit_btn.png';
import purpleBtnHelp from '@/assets/lobby_purple/help_btn.png';
import purpleBtnHistory from '@/assets/lobby_purple/bet_history_btn.png';
import purpleBtnSetting from '@/assets/lobby_purple/sett_btn.png';
import purpleDiamondBg from '@/assets/lobby_purple/diamond_bg.png';
import purpleEachRoomBg from '@/assets/lobby_purple/each_room_bg.png';
import purpleEachRoomEnterBtnText from '@/assets/lobby_purple/each_room_enter_btn_text.png';
import purpleRoomIconTextDizhu from '@/assets/lobby_purple/room_icontext_dizhu.png';
import purpleRoomIconTextXianzhi from '@/assets/lobby_purple/room_icontext_xianzhi.png';
import purpleRoomTextTiyan from '@/assets/lobby_purple/room_text_t.png';
import purpleRoomTextChuji from '@/assets/lobby_purple/room_text_chuji.png';
import purpleRoomTextZhongji from '@/assets/lobby_purple/room_text_zhongji.png';
import purpleRoomTextGaoji from '@/assets/lobby_purple/room_text_gaoji.png';
import purpleRoomTextDashi from '@/assets/lobby_purple/room_text_dashi.png';
import purpleRoomTextDianfeng from '@/assets/lobby_purple/room_text_dianfeng.png';
import purpleLineIconSplice from '@/assets/lobby_purple/line_icon_splice.png';
import purpleRoomIconTiyan from '@/assets/lobby_purple/room_icon_tiyan.png';
import purpleRoomIconChuji from '@/assets/lobby_purple/room_icon_chuji.png';
import purpleRoomIconZhongji from '@/assets/lobby_purple/room_icon_zhongji.png';
import purpleRoomIconGaoji from '@/assets/lobby_purple/room_icon_gaoji.png';
import purpleRoomIconDashi from '@/assets/lobby_purple/room_icon_dashi.png';
import purpleRoomIconDianfeng from '@/assets/lobby_purple/room_icon_dianfeng.png';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();

const currentMode = ref(0);

// Theme class for CSS
const themeClass = computed(() => {
    switch (currentMode.value) {
        case 1: return 'theme-green';
        case 2: return 'theme-purple';
        default: return 'theme-default';
    }
});

// Theme asset config
const theme = computed(() => {
    switch (currentMode.value) {
        case 1: return {
            bgImg: greenBg,
            btnExit: greenBtnExit,
            btnHelp: greenBtnHelp,
            btnHistory: greenBtnHistory,
            btnSetting: greenBtnSetting,
            diamondBg: greenDiamondBg,
            eachRoomBg: greenEachRoomBg,
            eachRoomEnterBtnText: greenEachRoomEnterBtnText,
            roomIconTextDizhu: greenRoomIconTextDizhu,
            roomIconTextXianzhi: greenRoomIconTextXianzhi,
        };
        case 2: return {
            bgImg: purpleBg,
            topBg: purpleTopBg,
            btnExit: purpleBtnExit,
            btnHelp: purpleBtnHelp,
            btnHistory: purpleBtnHistory,
            btnSetting: purpleBtnSetting,
            diamondBg: purpleDiamondBg,
            eachRoomBg: purpleEachRoomBg,
            eachRoomEnterBtnText: purpleEachRoomEnterBtnText,
            roomIconTextDizhu: purpleRoomIconTextDizhu,
            roomIconTextXianzhi: purpleRoomIconTextXianzhi,
        };
        default: return {
            bgImg: defaultBg,
            topBg: topBgImg,
            btnExit: btnExit,
            btnHelp: btnHelp,
            btnHistory: btnHistory,
            btnSetting: btnSetting,
            diamondBg: diamondBg,
            eachRoomBg: eachRoomBg,
            eachRoomEnterBtnText: eachRoomEnterBtnText,
            roomIconTextDizhu: roomIconTextDizhu,
            roomIconTextXianzhi: roomIconTextXianzhi,
        };
    }
});

// Room text images per theme
const getRoomTextImage = (roomName) => {
    if (!roomName) return null;
    const texts = currentMode.value === 1
        ? { tiyan: greenRoomTextTiyan, chuji: greenRoomTextChuji, zhongji: greenRoomTextZhongji, gaoji: greenRoomTextGaoji, dashi: greenRoomTextDashi, dianfeng: greenRoomTextDianfeng }
        : currentMode.value === 2
        ? { tiyan: purpleRoomTextTiyan, chuji: purpleRoomTextChuji, zhongji: purpleRoomTextZhongji, gaoji: purpleRoomTextGaoji, dashi: purpleRoomTextDashi, dianfeng: purpleRoomTextDianfeng }
        : { tiyan: roomTextTiyan, chuji: roomTextChuji, zhongji: roomTextZhongji, gaoji: roomTextGaoji, dashi: roomTextDashi, dianfeng: roomTextDianfeng };
    if (roomName.includes('体验')) return texts.tiyan;
    if (roomName.includes('初级')) return texts.chuji;
    if (roomName.includes('中级')) return texts.zhongji;
    if (roomName.includes('高级')) return texts.gaoji;
    if (roomName.includes('大师')) return texts.dashi;
    if (roomName.includes('巅峰')) return texts.dianfeng;
    return null;
};

// Purple room card icons
const getRoomIconImage = (roomName) => {
    if (!roomName) return null;
    if (roomName.includes('体验')) return purpleRoomIconTiyan;
    if (roomName.includes('初级')) return purpleRoomIconChuji;
    if (roomName.includes('中级')) return purpleRoomIconZhongji;
    if (roomName.includes('高级')) return purpleRoomIconGaoji;
    if (roomName.includes('大师')) return purpleRoomIconDashi;
    if (roomName.includes('巅峰')) return purpleRoomIconDianfeng;
    return null;
};

// Room name bg (default theme only)
const currentRoomNameBg = computed(() => {
    switch (currentMode.value) {
        case 0: return roomNameBgLv;
        case 1: return roomNameBgLan;
        case 2: return roomNameBgLz;
        default: return roomNameBgLv;
    }
});

const playBtnSound = () => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
};

const userInfo = computed(() => {
    const rawName = userStore.userInfo.nick_name || userStore.userInfo.user_id || '---';
    let displayName = rawName;
    if (rawName.length > 11) {
        displayName = rawName.substring(0, 4) + '...' + rawName.substring(rawName.length - 4);
    }
    return {
        name: rawName,
        displayName: displayName,
        id: userStore.userInfo.user_id || '---',
        coins: formatCoins(userStore.userInfo.balance || 0),
        avatar: userStore.userInfo.avatar || defaultAvatar
    };
});

const clickedRoomLevel = ref(null);

const handleEnterRoomClick = (level) => {
    if (clickedRoomLevel.value === level) return;
    playBtnSound();
    clickedRoomLevel.value = level;
    setTimeout(() => {
        clickedRoomLevel.value = null;
        executeEnterGame(level);
    }, 150);
};

const executeEnterGame = debounce(async (level) => {
    try {
        gameStore.gameMode = currentMode.value;
        await gameStore.joinRoom(level, currentMode.value);
        router.push({ path: '/game', query: { mode: currentMode.value } });
    } catch (error) {
        console.error("Failed to join room:", error);
    }
}, 500);

const generateParticles = () => {
    return Array.from({ length: 6 }, () => {
        const left = Math.random() * 80 + 10;
        const duration = Math.random() * 2 + 3;
        const delay = Math.random() * 4;
        const size = Math.random() * 2 + 1;
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
    return configs.map((cfg) => ({
        level: cfg.level,
        name: cfg.name,
        baseBet: (cfg.base_bet || 0) / 100,
        minBalance: (cfg.min_balance || 0) / 100,
        particles: generateParticles()
    }));
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
    if (val) playMusic();
    else stopMusic();
});

onMounted(() => {
    // Read mode from route query
    if (route.query.mode !== undefined) {
        currentMode.value = Number(route.query.mode);
        userStore.lastSelectedMode = currentMode.value;
    } else {
        currentMode.value = userStore.lastSelectedMode || 0;
    }

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
    if (route.query.mode !== undefined) {
        currentMode.value = Number(route.query.mode);
        userStore.lastSelectedMode = currentMode.value;
    }
    fetchData();
    playMusic();
});

onDeactivated(stopMusic);
onUnmounted(() => { stopMusic(); });

const goBack = () => {
    playBtnSound();
    console.log("Exit clicked");
};
</script>

<template>
    <div class="lobby-container" :class="themeClass"
        :style="{ backgroundImage: `url(${theme.bgImg})` }">

        <!-- ====== Floating Background (Default only) ====== -->
        <img v-if="currentMode === 0" :src="bgUpImg" class="bg-up-anim" />

        <!-- ====== TOP AREA: DEFAULT (Mode 0) ====== -->
        <div v-if="currentMode === 0" class="top-area" :style="{ backgroundImage: `url(${theme.topBg})` }">
            <div class="top-row-1">
                <div class="top-left">
                    <img :src="theme.btnExit" class="btn-exit" @click="goBack" alt="Exit" />
                </div>
                <div class="top-right">
                    <img :src="theme.btnHistory" class="top-icon-btn" @click="openHistoryDebounced" alt="History" />
                    <img :src="topBtnLine" class="top-separator" />
                    <img :src="theme.btnHelp" class="top-icon-btn" @click="openHelpDebounced" alt="Help" />
                    <img :src="topBtnLine" class="top-separator" />
                    <img :src="theme.btnSetting" class="top-icon-btn" @click="openSettingsDebounced" alt="Settings" />
                </div>
            </div>
            <div class="top-line-container">
                <img :src="topLine" class="top-line-img" />
            </div>
            <div class="top-row-2">
                <div class="user-info-container">
                    <div class="avatar-wrapper">
                        <img :src="userInfo.avatar" class="user-avatar" alt="" />
                        <img :src="avatarFrameImg" class="avatar-border-overlay" />
                    </div>
                    <div class="user-details">
                        <span class="user-nickname">{{ userInfo.displayName }}</span>
                        <div class="coins-display" :style="{ backgroundImage: `url(${theme.diamondBg})` }">
                            <img :src="goldImg" class="coin-icon" />
                            <span class="coin-val">{{ userInfo.coins }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ====== TOP AREA: GREEN (Mode 1) ====== -->
        <div v-else-if="currentMode === 1" class="top-area-green">
            <div class="green-top-shape-wrapper">
                <img :src="greenTopShape" class="green-top-shape-img" />
                <div class="green-top-shape-overlay">
                    <div class="top-left">
                        <img :src="theme.btnExit" class="btn-exit" @click="goBack" alt="Exit" />
                    </div>
                    <div class="top-right">
                        <img :src="theme.btnHistory" class="top-icon-btn" @click="openHistoryDebounced"
                            alt="History" />
                        <img :src="theme.btnHelp" class="top-icon-btn" @click="openHelpDebounced" alt="Help" />
                        <img :src="theme.btnSetting" class="top-icon-btn" @click="openSettingsDebounced"
                            alt="Settings" />
                    </div>
                </div>
            </div>
            <div class="green-user-row">
                <div class="user-info-container">
                    <div class="avatar-wrapper">
                        <img :src="userInfo.avatar" class="user-avatar" alt="" />
                        <img :src="avatarFrameImg" class="avatar-border-overlay" />
                    </div>
                    <div class="user-details">
                        <span class="user-nickname">{{ userInfo.displayName }}</span>
                        <div class="coins-display" :style="{ backgroundImage: `url(${theme.diamondBg})` }">
                            <img :src="goldImg" class="coin-icon" />
                            <span class="coin-val">{{ userInfo.coins }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ====== TOP AREA: PURPLE (Mode 2) ====== -->
        <div v-else class="top-area-purple" :style="{ backgroundImage: `url(${theme.topBg})` }">
            <div class="purple-top-row">
                <img :src="theme.btnExit" class="btn-exit" @click="goBack" alt="Exit" />
                <div class="user-info-container">
                    <div class="avatar-wrapper avatar-wrapper-lg">
                        <img :src="userInfo.avatar" class="user-avatar" alt="" />
                        <img :src="avatarFrameImg" class="avatar-border-overlay" />
                    </div>
                    <div class="user-details">
                        <span class="user-nickname">{{ userInfo.displayName }}</span>
                        <div class="coins-display" :style="{ backgroundImage: `url(${theme.diamondBg})` }">
                            <img :src="goldImg" class="coin-icon" />
                            <span class="coin-val">{{ userInfo.coins }}</span>
                        </div>
                    </div>
                </div>
                <div class="top-right">
                    <img :src="theme.btnHistory" class="top-icon-btn" @click="openHistoryDebounced" alt="History" />
                    <img :src="theme.btnHelp" class="top-icon-btn" @click="openHelpDebounced" alt="Help" />
                    <img :src="theme.btnSetting" class="top-icon-btn" @click="openSettingsDebounced" alt="Settings" />
                </div>
            </div>
        </div>

        <!-- ====== ROOM LIST (All Themes) ====== -->
        <div class="main-content">
            <div class="room-list-container">
                <TransitionGroup name="list" tag="div" class="room-list" :key="currentMode">
                    <div v-for="(room, index) in rooms" :key="room.level" class="room-row"
                        :class="{ 'room-clicked': clickedRoomLevel === room.level }"
                        :style="{ animationDelay: `${index * 0.1}s` }">

                        <!-- Room Info Card -->
                        <div class="room-info" :style="{ backgroundImage: `url(${theme.eachRoomBg})` }"
                            @click="handleEnterRoomClick(room.level)">
                            <div class="room-info-content"
                                :class="{ 'room-info-content-purple': currentMode === 2 }">

                                <!-- Purple: Card Fan Icon -->
                                <img v-if="currentMode === 2 && getRoomIconImage(room.name)"
                                    :src="getRoomIconImage(room.name)" class="room-card-icon" />

                                <!-- Room Name (Default/Green: with bg label; Purple: plain) -->
                                <div v-if="currentMode !== 2" class="room-name-container"
                                    :style="{ backgroundImage: `url(${currentRoomNameBg})` }">
                                    <img v-if="getRoomTextImage(room.name)" :src="getRoomTextImage(room.name)"
                                        class="room-name-img" />
                                    <span v-else class="room-name-text">{{ room.name }}</span>
                                </div>
                                <div v-else class="room-name-purple">
                                    <img v-if="getRoomTextImage(room.name)" :src="getRoomTextImage(room.name)"
                                        class="room-name-img-purple" />
                                    <span v-else class="room-name-text">{{ room.name }}</span>
                                </div>

                                <!-- Stats -->
                                <div class="room-stat">
                                    <img :src="theme.roomIconTextDizhu" class="stat-label-img" />
                                    <SpriteNumber :value="room.baseBet" type="yellow" :height="14" />
                                </div>
                                <div class="room-stat">
                                    <img :src="theme.roomIconTextXianzhi" class="stat-label-img" />
                                    <SpriteNumber :value="room.minBalance" type="white" :height="14" />
                                </div>
                            </div>
                        </div>

                        <!-- Enter Button -->
                        <div class="room-enter-btn" @click="handleEnterRoomClick(room.level)">
                            <div class="enter-btn-wrapper">
                                <!-- Default: image bg + particles + text overlay -->
                                <template v-if="currentMode === 0">
                                    <img :src="eachRoomEnterBtn" class="enter-btn-bg-img" />
                                    <div class="particles-container">
                                        <i v-for="(style, i) in room.particles" :key="i" class="star-particle"
                                            :style="style"></i>
                                    </div>
                                    <img :src="theme.eachRoomEnterBtnText" class="enter-btn-text-img" />
                                </template>
                                <!-- Green/Purple: standalone button image -->
                                <template v-else>
                                    <img :src="theme.eachRoomEnterBtnText" class="enter-btn-standalone" />
                                </template>
                            </div>
                        </div>
                    </div>
                </TransitionGroup>
            </div>
        </div>

        <!-- Background Animation (Default only) -->
        <LobbyBackgroundAnimation v-if="currentMode === 0" :mode="currentMode" />

        <!-- Glass Overlay (Default only) -->
        <div v-if="currentMode === 0" class="lobby-full-glass"></div>

        <!-- Modals -->
        <HistoryModal v-model:visible="showHistory" />
        <SettingsModal v-model:visible="showSettings" />
        <HelpModal v-model:visible="showHelp" :mode="currentMode" />
    </div>
</template>

<style scoped>
/* ====== BASE CONTAINER ====== */
.lobby-container {
    width: 100vw;
    height: 100dvh;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: "Microsoft YaHei", Arial, sans-serif;
    position: relative;
}

/* ====== FLOATING BACKGROUND (Default) ====== */
.bg-up-anim {
    position: absolute;
    width: 100%;
    left: -20%;
    top: 0%;
    z-index: 0;
    opacity: 0.8;
    pointer-events: none;
    animation: floatBg 15s infinite ease-in-out alternate;
}

.lobby-full-glass {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    backdrop-filter: blur(6px);
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.4));
    pointer-events: none;
    z-index: 0;
}

@keyframes floatBg {
    0% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(25%, 30%) scale(1.02); }
    50% { transform: translate(25%, 60%) scale(1.05); }
    75% { transform: translate(50%, 55%) scale(1.02); }
    100% { transform: translate(80%, 50%) scale(1); }
}

/* ====== DEFAULT TOP AREA (Mode 0) ====== */
.top-area {
    width: 100%;
    flex-shrink: 0;
    background-size: 100% 100%;
    display: flex;
    flex-direction: column;
    padding-bottom: 5px;
    position: relative;
    z-index: 1;
}

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

.top-row-2 {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 10px 15px 15px 15px;
}

/* ====== GREEN TOP AREA (Mode 1) ====== */
.top-area-green {
    width: 100%;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
}

.green-top-shape-wrapper {
    position: relative;
    width: 100%;
}

.green-top-shape-img {
    width: 100%;
    display: block;
}

.green-top-shape-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 15px 10px 15px;
}

.green-user-row {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 8px 15px 10px 15px;
}

/* ====== PURPLE TOP AREA (Mode 2) ====== */
.top-area-purple {
    width: 100%;
    flex-shrink: 0;
    background-size: 100% 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    padding: 15px 15px 10px 15px;
}

.purple-top-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.purple-top-row .btn-exit {
    height: 21px;
    cursor: pointer;
    flex-shrink: 0;
}

.purple-top-row .user-info-container {
    flex: 1;
}

.purple-top-row .top-right {
    flex-shrink: 0;
}

/* ====== SHARED USER INFO ====== */
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

.avatar-wrapper-lg {
    width: 50px;
    height: 50px;
}

.user-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
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

/* ====== MAIN CONTENT / ROOM LIST ====== */
.main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    padding-top: 10px;
    padding-bottom: 5px;
    position: relative;
    z-index: 1;
}

.room-list-container {
    flex: 1;
    width: 100%;
    overflow-y: auto;
    padding: 0 15px 10px 15px;
}

.room-list-container::-webkit-scrollbar {
    display: none;
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
    opacity: 0;
    transform: translateX(30px);
    animation: slideIn 0.5s ease forwards;
    transition: transform 0.1s ease;
}

.room-row.room-clicked {
    transform: scale(0.96) !important;
}

@keyframes slideIn {
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Room Info Card */
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
}

/* Purple room content layout */
.room-info-content-purple {
    padding-right: 30px;
    gap: 6px;
}

.room-card-icon {
    height: 38px;
    width: auto;
    object-fit: contain;
    flex-shrink: 0;
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

.room-name-purple {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.room-name-img-purple {
    height: 16px;
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

.room-info-content-purple .room-stat {
    margin-left: 8px;
}

.stat-label-img {
    height: 10px;
    width: auto;
    object-fit: contain;
    margin-bottom: 10px;
    margin-top: 0;
}

/* Enter Button */
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
    transition: filter 0.1s ease;
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

.enter-btn-standalone {
    height: 70%;
    width: auto;
    object-fit: contain;
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
    0% { transform: translateY(0) scale(0.5); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translateY(-25px) scale(1); opacity: 0; }
}

/* ====== GREEN THEME OVERRIDES ====== */
.theme-green .room-row {
    height: 55px;
}

.theme-green .room-name-container {
    padding: 15px 12px 12px 16px;
}

/* ====== PURPLE THEME OVERRIDES ====== */
.theme-purple .room-row {
    height: 58px;
}

.theme-purple .room-list {
    gap: 10px;
}
</style>
