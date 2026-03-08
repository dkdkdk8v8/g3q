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
import topShape from '@/assets/lobby_green/top_shape.png';
import btnExit from '@/assets/lobby_green/exit_btn.png';
import btnHelp from '@/assets/lobby_green/help_btn.png';
import btnHistory from '@/assets/lobby_green/bet_history_btn.png';
import btnSetting from '@/assets/lobby_green/sett_btn.png';
import diamondBg from '@/assets/lobby_green/diamond_bg.png';
import eachRoomBg from '@/assets/lobby_green/each_room_bg.png';
import eachRoomEnterBtnText from '@/assets/lobby_green/each_room_enter_btn_text.png';
import roomIconTextDizhu from '@/assets/lobby_green/room_icontext_dizhu.png';
import roomIconTextXianzhi from '@/assets/lobby_green/room_icontext_xianzhi.png';
import roomTextTiyan from '@/assets/lobby_green/room_text_tiyan.png';
import roomTextChuji from '@/assets/lobby_green/room_text_chuji.png';
import roomTextZhongji from '@/assets/lobby_green/room_text_zhongji.png';
import roomTextGaoji from '@/assets/lobby_green/room_text_gaoji.png';
import roomTextDashi from '@/assets/lobby_green/room_text_dashi.png';
import roomTextDianfeng from '@/assets/lobby_green/room_text_dianfeng.png';

const {
    currentMode, userInfo, rooms, clickedRoomLevel,
    handleEnterRoomClick, matchRoomName,
    showHistory, showSettings, showHelp,
    openHistoryDebounced, openSettingsDebounced, openHelpDebounced,
    goBack, stopMusic, initLobby, onLobbyActivated,
} = useLobby();

const roomTexts = { tiyan: roomTextTiyan, chuji: roomTextChuji, zhongji: roomTextZhongji, gaoji: roomTextGaoji, dashi: roomTextDashi, dianfeng: roomTextDianfeng };
const getRoomTextImage = (name) => matchRoomName(name, roomTexts);

onMounted(() => initLobby(1));
onActivated(onLobbyActivated);
onDeactivated(stopMusic);
onUnmounted(stopMusic);
</script>

<template>
    <div class="lobby-container">
        <!-- Top Shape Area -->
        <div class="top-area">
            <div class="top-shape-wrapper">
                <img :src="topShape" class="top-shape-img" />
                <div class="top-shape-overlay">
                    <div class="top-btns-center">
                        <img :src="btnExit" class="top-icon-btn-exit" @click="goBack" />
                        <img :src="btnHistory" class="top-icon-btn-history" @click="openHistoryDebounced" />
                        <img :src="btnHelp" class="top-icon-btn-help" @click="openHelpDebounced" />
                        <img :src="btnSetting" class="top-icon-btn-setting" @click="openSettingsDebounced" />
                    </div>
                </div>
                <!-- Stage Lights -->
                <div class="stage-lights">
                    <div class="spotlight spotlight-left"></div>
                    <div class="spotlight spotlight-center"></div>
                    <div class="spotlight spotlight-right"></div>
                </div>
            </div>
            <!-- User Info -->
            <div class="user-row">
                <div class="user-info-container">
                    <div class="avatar-wrapper">
                        <img :src="userInfo.avatar" class="user-avatar" />
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

        <!-- Room List -->
        <div class="main-content">
            <div class="room-list-container">
                <TransitionGroup name="list" tag="div" class="room-list">
                    <div v-for="(room, index) in rooms" :key="room.level" class="room-row"
                        :class="{ 'room-clicked': clickedRoomLevel === room.level }"
                        :style="{ animationDelay: `${index * 0.1}s` }">
                        <div class="room-info" :style="{ backgroundImage: `url(${eachRoomBg})` }"
                            @click="handleEnterRoomClick(room.level)">
                            <div class="room-info-content">
                                <div class="room-name-area">
                                    <img v-if="getRoomTextImage(room.name)" :src="getRoomTextImage(room.name)"
                                        class="room-name-img" />
                                    <span v-else class="room-name-text">{{ room.name }}</span>
                                    <div class="room-mini-light" :style="{ animationDelay: `${index * 0.6}s` }"></div>
                                </div>
                                <div class="room-stat">
                                    <img :src="roomIconTextDizhu" class="stat-label-img" />
                                    <SpriteNumber :value="room.baseBet" type="yellow" :height="14" />
                                </div>
                                <div class="room-stat">
                                    <img :src="roomIconTextXianzhi" class="stat-label-img" />
                                    <SpriteNumber :value="room.minBalance" type="white" :height="14" />
                                </div>
                                <div class="room-enter-btn">
                                    <img :src="eachRoomEnterBtnText" class="enter-btn-img" />
                                </div>
                            </div>
                        </div>
                    </div>
                </TransitionGroup>
            </div>
        </div>

        <LobbyBackgroundAnimation :mode="1" class="green-lobby-anim" />
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
    background-image: url('../assets/lobby_green/bg.jpg');
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
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    overflow: visible;
}

.top-shape-wrapper {
    position: relative;
    width: 100%;
    overflow: visible;
}

.top-shape-img {
    width: 100%;
    display: block;
    aspect-ratio: 1125 / 350;
}

.top-shape-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 15px 15px 10px 15px;
}

.top-btns-center {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 35px;
}

.top-icon-btn-exit {
    margin-top: 10px;
    height: 30px;
    cursor: pointer;
}

.top-icon-btn-history {
    margin-left: 8px;
    height: 32px;
    cursor: pointer;
}

.top-icon-btn-help {
    height: 38px;
    cursor: pointer;
}

.top-icon-btn-setting {
    margin-top: 10px;
    height: 33px;
    cursor: pointer;
}

/* Stage Lights */
.stage-lights {
    position: absolute;
    bottom: -48vh;
    left: 0;
    width: 100%;
    height: 50vh;
    pointer-events: none;
    z-index: -1;
}

.spotlight {
    position: absolute;
    top: 0;
    height: 100%;
    clip-path: polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%);
    transform-origin: top center;
    opacity: 0;
    transform: scaleY(0);
}

.spotlight-center {
    left: 20%;
    right: 20%;
    background: linear-gradient(to bottom,
            rgba(140, 255, 200, 0.25) 0%,
            rgba(100, 220, 170, 0.10) 40%,
            transparent 100%);
    animation: spotlightEntry 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards,
        spotlightSweep 5s ease-in-out 1.2s infinite;
}

.spotlight-left {
    left: 0%;
    width: 40%;
    clip-path: polygon(55% 0%, 75% 0%, 100% 100%, 0% 100%);
    background: linear-gradient(to bottom,
            rgba(120, 240, 190, 0.18) 0%,
            rgba(80, 200, 160, 0.06) 40%,
            transparent 100%);
    animation: spotlightEntry 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.9s forwards,
        spotlightSweepLeft 4s ease-in-out 1.6s infinite;
}

.spotlight-right {
    right: 0%;
    width: 40%;
    clip-path: polygon(25% 0%, 45% 0%, 100% 100%, 0% 100%);
    background: linear-gradient(to bottom,
            rgba(120, 240, 190, 0.18) 0%,
            rgba(80, 200, 160, 0.06) 40%,
            transparent 100%);
    animation: spotlightEntry 0.7s cubic-bezier(0.16, 1, 0.3, 1) 1.3s forwards,
        spotlightSweepRight 4.5s ease-in-out 2.0s infinite;
}

@keyframes spotlightEntry {
    0% {
        opacity: 0;
        transform: scaleY(0);
    }

    60% {
        opacity: 1;
        transform: scaleY(1.08);
    }

    100% {
        opacity: 1;
        transform: scaleY(1);
    }
}

@keyframes spotlightSweep {

    0%,
    100% {
        transform: rotate(0deg);
        opacity: 1;
    }

    25% {
        transform: rotate(8deg);
        opacity: 0.7;
    }

    75% {
        transform: rotate(-8deg);
        opacity: 0.7;
    }
}

@keyframes spotlightSweepLeft {

    0%,
    100% {
        transform: rotate(0deg);
        opacity: 1;
    }

    50% {
        transform: rotate(12deg);
        opacity: 0.6;
    }
}

@keyframes spotlightSweepRight {

    0%,
    100% {
        transform: rotate(0deg);
        opacity: 1;
    }

    50% {
        transform: rotate(-12deg);
        opacity: 0.6;
    }
}

.user-row {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px 15px 0 15px;
}

/* User Info */
.user-info-container {
    display: flex;
    align-items: center;
    gap: 5px;
}

.avatar-wrapper {
    position: relative;
    width: 53px;
    height: 53px;
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
    font-size: 18px;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.user-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.coins-display {
    margin-left: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    height: 18px;
    position: relative;
    width: fit-content;
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
    padding: 6px 7px 5px 13px;
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
    padding: 0 10px 10px 10px;
}

.room-list-container::-webkit-scrollbar {
    display: none;
}

.room-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.room-row {
    display: flex;
    align-items: center;
    height: 55px;
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
    padding: 0 10px;
    cursor: pointer;
    position: relative;
    overflow: visible;
}

.room-info-content {
    margin: 6px 5px 0 5px;
    display: flex;
    align-items: center;
    width: 100%;
    justify-content: space-between;
}

.room-name-area {
    display: flex;
    align-items: center;
    padding: 0 10px;
    position: relative;
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
    position: relative;
    z-index: 1;
}

/* Room Mini Light Beam */
.room-mini-light {
    position: absolute;
    left: 50%;
    bottom: -13px;
    width: 45px;
    height: 45px;
    margin-left: -22.5px;
    transform-origin: bottom center;
    pointer-events: none;
    clip-path: polygon(0% 0%, 100% 0%, 70% 100%, 30% 100%);
    background: linear-gradient(to top,
            rgba(140, 255, 200, 0.5) 0%,
            rgba(120, 240, 190, 0.12) 50%,
            transparent 100%);
    animation: miniBeamSweep 3.5s ease-in-out infinite;
}

@keyframes miniBeamSweep {
    0% {
        opacity: 0.8;
    }

    50% {
        opacity: 0.15;
    }

    100% {
        opacity: 0.8;
    }
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

/* Enter Button (inside room card) */
.room-enter-btn {
    margin-left: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
}

.enter-btn-img {
    height: 35px;
    width: auto;
    object-fit: contain;
}

.green-lobby-anim {
    bottom: 28px !important;
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
