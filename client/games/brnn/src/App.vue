<script setup>
import { onMounted, onUnmounted } from 'vue';
import GlobalLoading from './components/GlobalLoading.vue';
import ReconnectDialog from './components/ReconnectDialog.vue';
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import { useSettingsStore } from './stores/settings.js';
import { useLoadingStore } from './stores/loading.js';
import { AudioUtils } from './utils/audio.js';

const settingsStore = useSettingsStore();
const loadingStore = useLoadingStore();

onMounted(() => {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, .btn, .chip-btn, .van-button, .brnn-btn-exit');
        if (target) {
            if (settingsStore.soundEnabled) {
                AudioUtils.playEffect(btnClickSound);
            }
        }
    }, true);

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
</template>

<style>
/* 全局样式覆盖，确保全屏 */
#app {
    width: 100vw;
    height: 100dvh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #1a1a2e;
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
    background-color: #1a1a2e;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 99999;
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
</style>
