<script setup>
import { onMounted, onUnmounted } from 'vue';
import GlobalLoading from './components/GlobalLoading.vue';
import ReconnectDialog from './components/ReconnectDialog.vue';
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import { useSettingsStore } from './stores/settings.js';
import { useGameStore } from './stores/game.js';
import { useLoadingStore } from './stores/loading.js';
import { AudioUtils } from './utils/audio.js';

const settingsStore = useSettingsStore();
const gameStore = useGameStore();
const loadingStore = useLoadingStore();

onMounted(() => {
    document.addEventListener('click', (e) => {
        // Check if the clicked element or its parent is interactive
        const target = e.target.closest('button, .btn, .game-btn, .menu-btn, .van-button, .menu-item, .tab-item, .room-card, .add-btn, .chat-toggle-btn, .close-icon, .close-btn, .phrase-item, .emoji-item, .retry-btn');
        if (target) {
            if (settingsStore.soundEnabled) {
                AudioUtils.playEffect(btnClickSound);
            }
        }
    }, true); // Use capture phase to handle events before stopPropagation

    // Handle visibility change to mute/unmute audio
    document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
});

const handleVisibilityChange = () => {
    if (document.hidden) {
        AudioUtils.suspend();
    } else {
        AudioUtils.resume();
    }
};
</script>

<template>
    <router-view />
    <GlobalLoading />
    <ReconnectDialog />

    <!-- App Loading Overlay (生产环境连接中显示) -->
    <Transition name="app-loading-fade">
        <div v-if="loadingStore.appLoading" class="app-loading-skeleton">
            <div class="app-loading-content">
                <template v-if="loadingStore.appLoadingError">
                    <div class="app-loading-error">{{ loadingStore.appLoadingError }}</div>
                </template>
                <template v-else>
                    <div class="app-loading-text">正在努力加载中...</div>
                    <div class="app-loading-progress-bar">
                        <div class="app-loading-progress-fill"></div>
                    </div>
                </template>
            </div>
        </div>
    </Transition>

    <!-- Global Message Alert -->
    <div v-if="gameStore.globalMessage" class="global-modal-overlay">
        <div class="global-modal-content">
            <div class="global-modal-header">
                <h3>系统提示</h3>
            </div>
            <div class="global-modal-body">
                {{ gameStore.globalMessage }}
            </div>
            <div class="global-modal-footer">
                <button class="global-confirm-btn" @click="gameStore.globalMessage = ''">
                    我知道了
                </button>
            </div>
        </div>
    </div>
</template>

<style>
/* 全局样式覆盖，确保全屏 */
#app {
    width: 100vw;
    height: 100dvh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #1a1a1a;
}

* {
    -webkit-overflow-scrolling: touch;
}

::-webkit-scrollbar {
    display: none;
}

/* === App Loading Overlay === */
.app-loading-skeleton {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #222222;
    background-image: url('./assets/lobby/bg.jpg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 99999;
}

.app-loading-skeleton::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1;
}

.app-loading-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.app-loading-text {
    margin-bottom: 5px;
    color: #ffbf58;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    font-weight: bold;
    font-family: "Microsoft YaHei", Arial, sans-serif;
    font-size: 15px;
    letter-spacing: 2px;
    animation: appLoadingPulse 1.5s ease-in-out infinite;
}

.app-loading-error {
    color: #f1c40f;
    font-size: 15px;
    font-weight: bold;
    font-family: "Microsoft YaHei", Arial, sans-serif;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    text-align: center;
    padding: 0 30px;
}

.app-loading-progress-bar {
    width: 80vw;
    max-width: 300px;
    height: 6px;
    background-color: rgba(0, 0, 0, 0.5);
    border: 2px solid rgba(255, 215, 0, 0.6);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 15px;
    position: relative;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.8);
}

.app-loading-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #FFD700, #FFA500, #FFD700);
    background-size: 200% 100%;
    width: 0%;
    border-radius: 3px;
    animation: appLoadingFill 1.5s ease-out forwards, appLoadingGradient 2s linear infinite;
}

/* Fade transition */
.app-loading-fade-leave-active {
    transition: opacity 0.4s ease;
}
.app-loading-fade-leave-to {
    opacity: 0;
}

@keyframes appLoadingFill {
    0%   { width: 0%; }
    50%  { width: 70%; }
    100% { width: 95%; }
}

@keyframes appLoadingGradient {
    0%   { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}

@keyframes appLoadingPulse {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 1; }
}

/* Global Modal Styles */
.global-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.global-modal-content {
    width: 85%;
    max-width: 320px;
    background: #1e293b;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
    overflow: hidden;
}

.global-modal-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
}

.global-modal-header h3 {
    margin: 0;
    font-size: 18px;
}

.global-modal-body {
    padding: 20px;
    color: #cbd5e1;
    font-size: 16px;
    line-height: 1.5;
}

.global-modal-footer {
    padding: 0 20px 20px;
    display: flex;
    justify-content: center;
}

.global-confirm-btn {
    background: linear-gradient(to bottom, #fbbf24, #d97706);
    border: 1px solid #f59e0b;
    color: white;
    font-weight: bold;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    width: 100px;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
    transition: transform 0.1s;
}

.global-confirm-btn:active {
    transform: translateY(4px);
    box-shadow: none;
}
</style>
