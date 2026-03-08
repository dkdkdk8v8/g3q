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
import roomIconTextDizhu from '@/assets/lobby/room_icontext_dizhu.png';
import roomIconTextXianzhi from '@/assets/lobby/room_icontext_xianzhi.png';
import roomTextTiyan from '@/assets/lobby/room_text_tiyan.png';
import roomTextChuji from '@/assets/lobby/room_text_chuji.png';
import roomTextZhongji from '@/assets/lobby/room_text_zhongji.png';
import roomTextGaoji from '@/assets/lobby/room_text_gaoji.png';
import roomTextDashi from '@/assets/lobby/room_text_dashi.png';
import roomTextDianfeng from '@/assets/lobby/room_text_dianfeng.png';

const {
    currentMode, userInfo, rooms, clickedRoomLevel,
    handleEnterRoomClick, matchRoomName,
    showHistory, showSettings, showHelp,
    openHistoryDebounced, openSettingsDebounced, openHelpDebounced,
    goBack, stopMusic, initLobby, onLobbyActivated,
} = useLobby();

const roomTexts = { tiyan: roomTextTiyan, chuji: roomTextChuji, zhongji: roomTextZhongji, gaoji: roomTextGaoji, dashi: roomTextDashi, dianfeng: roomTextDianfeng };
const getRoomTextImage = (name) => matchRoomName(name, roomTexts);

onMounted(() => initLobby(0));
onActivated(onLobbyActivated);
onDeactivated(stopMusic);
onUnmounted(stopMusic);
</script>

<template>
    <div class="lobby-container">
        <!-- Floating Background -->
        <img :src="bgUpImg" class="bg-up-anim" />

        <!-- Top Area -->
        <div class="top-area" :style="{ backgroundImage: `url(${topBgImg})` }">
            <div class="top-row-1">
                <div class="top-left">
                    <img :src="btnExit" class="btn-exit" @click="goBack" />
                </div>
                <div class="top-right">
                    <img :src="btnHistory" class="top-icon-btn" @click="openHistoryDebounced" />
                    <img :src="topBtnLine" class="top-separator" />
                    <img :src="btnHelp" class="top-icon-btn" @click="openHelpDebounced" />
                    <img :src="topBtnLine" class="top-separator" />
                    <img :src="btnSetting" class="top-icon-btn" @click="openSettingsDebounced" />
                </div>
            </div>
            <div class="top-line-container">
                <img :src="topLine" class="top-line-img" />
            </div>
            <div class="top-row-2">
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
                                <div class="room-name-container" :style="{ backgroundImage: `url(${roomNameBgLv})` }">
                                    <img v-if="getRoomTextImage(room.name)" :src="getRoomTextImage(room.name)"
                                        class="room-name-img" />
                                    <span v-else class="room-name-text">{{ room.name }}</span>
                                </div>
                                <div class="room-stat">
                                    <img :src="roomIconTextDizhu" class="stat-label-img" />
                                    <SpriteNumber :value="room.baseBet" type="yellow" :height="14" />
                                </div>
                                <div class="room-stat">
                                    <img :src="roomIconTextXianzhi" class="stat-label-img" />
                                    <SpriteNumber :value="room.minBalance" type="white" :height="14" />
                                </div>
                            </div>
                        </div>
                        <div class="room-enter-btn" @click="handleEnterRoomClick(room.level)">
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

        <LobbyBackgroundAnimation :mode="0" />
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
    background-image: url('../assets/lobby/bg.jpg');
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: "Microsoft YaHei", Arial, sans-serif;
    position: relative;
}

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
    0% {
        transform: translate(0, 0) scale(1);
    }

    25% {
        transform: translate(25%, 30%) scale(1.02);
    }

    50% {
        transform: translate(25%, 60%) scale(1.05);
    }

    75% {
        transform: translate(50%, 55%) scale(1.02);
    }

    100% {
        transform: translate(80%, 50%) scale(1);
    }
}

/* Top Area */
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

/* User Info */
.user-info-container {
    display: flex;
    align-items: center;
    gap: 5px;
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
    padding: 0 6px 0 11px;
    color: #FFD700;
    font-weight: bold;
    font-size: 14px;
    line-height: 1;
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
</style>
