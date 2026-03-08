<script setup>
import { onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';
import { useLobby } from '../composables/useLobby.js';
import HistoryModal from '../components/HistoryModal.vue';
import SettingsModal from '../components/SettingsModal.vue';
import HelpModal from '../components/HelpModal.vue';
import LobbyBackgroundAnimation from '../components/LobbyBackgroundAnimation.vue';

// Assets
import avatarFrameImg from '@/assets/common/avatar_circle.png';
import goldImg from '@/assets/common/gold.png';
import topBg from '@/assets/lobby_purple/top_bg.png';
import btnExit from '@/assets/lobby_purple/exit_btn.png';
import btnHelp from '@/assets/lobby_purple/help_btn.png';
import btnHistory from '@/assets/lobby_purple/bet_history_btn.png';
import btnSetting from '@/assets/lobby_purple/sett_btn.png';
import diamondBg from '@/assets/lobby_purple/diamond_bg.png';
import lineIconSplice from '@/assets/lobby_purple/line_icon_splice.png';
import eachRoomBg from '@/assets/lobby_purple/each_room_bg.png';
import eachRoomEnterBtnText from '@/assets/lobby_purple/each_room_enter_btn_text.png';
import roomIconTextDizhu from '@/assets/lobby_purple/room_icontext_dizhu.png';
import roomIconTextXianzhi from '@/assets/lobby_purple/room_icontext_xianzhi.png';
import roomTextTiyan from '@/assets/lobby_purple/room_text_t.png';
import roomTextChuji from '@/assets/lobby_purple/room_text_chuji.png';
import roomTextZhongji from '@/assets/lobby_purple/room_text_zhongji.png';
import roomTextGaoji from '@/assets/lobby_purple/room_text_gaoji.png';
import roomTextDashi from '@/assets/lobby_purple/room_text_dashi.png';
import roomTextDianfeng from '@/assets/lobby_purple/room_text_dianfeng.png';
import roomIconTiyan from '@/assets/lobby_purple/room_icon_tiyan.png';
import roomIconChuji from '@/assets/lobby_purple/room_icon_chuji.png';
import roomIconZhongji from '@/assets/lobby_purple/room_icon_zhongji.png';
import roomIconGaoji from '@/assets/lobby_purple/room_icon_gaoji.png';
import roomIconDashi from '@/assets/lobby_purple/room_icon_dashi.png';
import roomIconDianfeng from '@/assets/lobby_purple/room_icon_dianfeng.png';

const {
    currentMode, userInfo, rooms, clickedRoomLevel,
    handleEnterRoomClick, matchRoomName,
    showHistory, showSettings, showHelp,
    openHistoryDebounced, openSettingsDebounced, openHelpDebounced,
    goBack, stopMusic, initLobby, onLobbyActivated,
} = useLobby();

const roomTexts = { tiyan: roomTextTiyan, chuji: roomTextChuji, zhongji: roomTextZhongji, gaoji: roomTextGaoji, dashi: roomTextDashi, dianfeng: roomTextDianfeng };
const roomIcons = { tiyan: roomIconTiyan, chuji: roomIconChuji, zhongji: roomIconZhongji, gaoji: roomIconGaoji, dashi: roomIconDashi, dianfeng: roomIconDianfeng };
const getRoomTextImage = (name) => matchRoomName(name, roomTexts);
const getRoomIconImage = (name) => matchRoomName(name, roomIcons);

onMounted(() => initLobby(2));
onActivated(onLobbyActivated);
onDeactivated(stopMusic);
onUnmounted(stopMusic);
</script>

<template>
    <div class="lobby-container">
        <!-- Aurora Background -->
        <div class="aurora">
            <div class="aurora-layer aurora-1"></div>
            <div class="aurora-layer aurora-2"></div>
        </div>
        <!-- Floating Particles -->
        <div class="particles">
            <span v-for="i in 15" :key="i" class="particle" :style="{
                left: `${(i * 17 + 5) % 100}%`,
                animationDuration: `${6 + (i % 5) * 2}s`,
                animationDelay: `${(i * 0.7) % 5}s`,
                width: `${2 + (i % 3)}px`,
                height: `${2 + (i % 3)}px`,
                opacity: 0.3 + (i % 4) * 0.15,
            }"></span>
        </div>
        <!-- Top Area: Combined Row -->
        <div class="top-area" :style="{ backgroundImage: `url(${topBg})` }">
            <div class="top-row-exit">
                <img :src="btnExit" class="btn-exit" @click="goBack" />
            </div>
            <div class="top-row">
                <div class="user-info-container">
                    <div class="avatar-wrapper">
                        <img :src="userInfo.avatar" class="user-avatar" />
                        <img :src="avatarFrameImg" class="avatar-border-overlay" />
                    </div>
                    <div class="user-details">
                        <span class="user-nickname">{{ userInfo.displayName }}</span>
                        <div class="coins-display" :style="{ backgroundImage: `url(${diamondBg})` }">
                            <span class="coin-val">{{ userInfo.coins }}</span>
                        </div>
                    </div>
                </div>
                <div class="top-right">
                    <img :src="btnHistory" class="top-icon-btn" @click="openHistoryDebounced" />
                    <img :src="lineIconSplice" class="top-separator" />
                    <img :src="btnHelp" class="top-icon-btn" @click="openHelpDebounced" />
                    <img :src="lineIconSplice" class="top-separator" />
                    <img :src="btnSetting" class="top-icon-btn" @click="openSettingsDebounced" />
                </div>
            </div>
        </div>

        <!-- Room List -->
        <div class="main-content">
            <div class="room-list-container">
                <TransitionGroup name="list" tag="div" class="room-list">
                    <div v-for="(room, index) in rooms" :key="room.level" class="room-row"
                        :class="{ 'room-clicked': clickedRoomLevel === room.level }"
                        :style="{ animationDelay: `${index * 0.1}s` }">
                        <div class="room-info" :style="{ backgroundImage: `url(${eachRoomBg})` }"
                            @click="handleEnterRoomClick(room.level)">
                            <div class="room-shimmer" :style="{ animationDelay: `${index * 1.2}s` }"></div>
                            <div class="room-info-content">
                                <!-- Card Fan Icon + Room Name -->
                                <div class="room-icon-name">
                                    <img v-if="getRoomIconImage(room.name)" :src="getRoomIconImage(room.name)"
                                        class="room-card-icon" :style="{ animationDelay: `${index * 0.5}s` }" />
                                    <div class="room-name-area">
                                        <img v-if="getRoomTextImage(room.name)" :src="getRoomTextImage(room.name)"
                                            class="room-name-img" />
                                        <span v-else class="room-name-text">{{ room.name }}</span>
                                    </div>
                                </div>
                                <!-- Stats -->
                                <div class="room-stat">
                                    <img :src="roomIconTextDizhu" class="stat-label-img" />
                                    <SpriteNumber :value="room.baseBet" type="yellow" :height="14" />
                                </div>
                                <div class="room-stat">
                                    <img :src="roomIconTextXianzhi" class="stat-label-img" />
                                    <SpriteNumber :value="room.minBalance" type="white" :height="14" />
                                </div>
                                <!-- Enter Button -->
                                <div class="room-enter-btn">
                                    <img :src="eachRoomEnterBtnText" class="enter-btn-img" />
                                </div>
                            </div>
                        </div>
                    </div>
                </TransitionGroup>
            </div>
        </div>

        <LobbyBackgroundAnimation :mode="2" class="purple-lobby-anim" />
        <div class="lobby-full-glass"></div>

        <HistoryModal v-model:visible="showHistory" />
        <SettingsModal v-model:visible="showSettings" />
        <HelpModal v-model:visible="showHelp" :mode="currentMode" />
    </div>
</template>

<style scoped>
.lobby-container {
    width: 100vw;
    height: 100dvh;
    background-image: url('../assets/lobby_purple/bg.jpg');
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: "Microsoft YaHei", Arial, sans-serif;
    position: relative;
}

/* Top Area */
.top-area {
    width: 100%;
    flex-shrink: 0;
    background-size: 100% 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    padding: 15px 15px 10px 15px;
    box-sizing: border-box;
    overflow: hidden;
}

.top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
}

.top-row-exit {
    padding-bottom: 5px;
}

.btn-exit {
    margin-top: 10px;
    margin-bottom: 10px;
    height: 23px;
    cursor: pointer;
}

.user-info-container {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    overflow: hidden;
}

.avatar-wrapper {
    position: relative;
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
    text-align: center;
    color: white;
    font-size: 15px;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.user-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    padding-left: 5px;
    margin-bottom: 5px;
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
    padding: 3px 3px 1px 15px;
}

.top-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.top-icon-btn {
    height: 23px;
    cursor: pointer;
}

.top-separator {
    height: 14px;
    width: auto;
}

/* Main Content */
.main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    padding-top: 10px;
    padding-bottom: 5px;
    position: relative;
    z-index: 1;
    min-height: 0;
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
    gap: 10px;
}

.room-row {
    display: flex;
    align-items: center;
    height: 58px;
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

/* Room Card */
.room-info {
    width: 100%;
    height: 100%;
    background-size: 100% 100%;
    display: flex;
    align-items: center;
    padding: 0 8px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.room-info-content {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;
}

.room-icon-name {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.room-card-icon {
    height: 40px;
    width: auto;
    object-fit: contain;
    flex-shrink: 0;
}

.room-name-area {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.room-name-text {
    color: white;
    font-weight: bold;
    font-size: 14px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.room-name-img {
    height: 16px;
    width: auto;
    object-fit: contain;
}

.room-stat {
    margin-left: 8px;
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

/* Enter Button (inside room card) */
.room-enter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    margin-left: auto;
}

.enter-btn-img {
    height: 35px;
    width: auto;
    object-fit: contain;
}

/* ====== 方案4: 背景极光 ====== */
.aurora {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
}

.aurora-layer {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
}

.aurora-1 {
    width: 90vw;
    height: 30vh;
    left: -10%;
    bottom: 0;
    background: radial-gradient(ellipse, rgba(170, 70, 240, 0.55) 0%, rgba(140, 50, 200, 0.2) 35%, transparent 65%);
    animation: auroraRise1 16s ease-in-out infinite;
}

.aurora-2 {
    width: 80vw;
    height: 28vh;
    right: -5%;
    bottom: 0;
    background: radial-gradient(ellipse, rgba(220, 100, 180, 0.5) 0%, rgba(180, 70, 150, 0.18) 35%, transparent 65%);
    animation: auroraRise2 20s ease-in-out infinite;
}

@keyframes auroraRise1 {
    0% {
        transform: translateY(20%);
        opacity: 0;
    }

    10% {
        opacity: 0.8;
    }

    80% {
        opacity: 0.8;
    }

    100% {
        transform: translateY(-120vh);
        opacity: 0;
    }
}

@keyframes auroraRise2 {
    0% {
        transform: translateY(20%);
        opacity: 0;
    }

    10% {
        opacity: 0.7;
    }

    80% {
        opacity: 0.7;
    }

    100% {
        transform: translateY(-120vh);
        opacity: 0;
    }
}

/* ====== 方案2: 浮动粒子 ====== */
.particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
}

.particle {
    position: absolute;
    bottom: -5%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(200, 160, 255, 0.9) 0%, rgba(180, 120, 220, 0) 70%);
    animation: particleFloat linear infinite;
}

@keyframes particleFloat {
    0% {
        transform: translateY(0) translateX(0);
        opacity: 0;
    }

    10% {
        opacity: 1;
    }

    90% {
        opacity: 1;
    }

    100% {
        transform: translateY(-105vh) translateX(20px);
        opacity: 0;
    }
}

/* ====== 方案1: 卡片光泽呼吸 ====== */
.room-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg,
            transparent 20%,
            rgba(255, 220, 255, 0.06) 50%,
            transparent 80%);
    pointer-events: none;
    opacity: 0;
    animation: shimmerBreath 4s ease-in-out infinite;
}

@keyframes shimmerBreath {

    0%,
    100% {
        opacity: 0;
    }

    50% {
        opacity: 1;
    }
}

/* ====== 方案3: 筹码图标发光 ====== */
.room-card-icon {
    animation: chipGlow 3s ease-in-out infinite;
}

@keyframes chipGlow {

    0%,
    100% {
        filter: drop-shadow(0 0 2px rgba(255, 180, 220, 0.2));
    }

    50% {
        filter: drop-shadow(0 0 8px rgba(255, 180, 220, 0.6)) drop-shadow(0 0 15px rgba(200, 120, 255, 0.3));
    }
}

.purple-lobby-anim {
    bottom: 60px !important;
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
</style>
