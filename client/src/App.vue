<script setup>
import { onMounted } from 'vue';
import GlobalLoading from './components/GlobalLoading.vue';
import ReconnectDialog from './components/ReconnectDialog.vue';
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import { useSettingsStore } from './stores/settings.js';
import { useGameStore } from './stores/game.js';
import { AudioUtils } from './utils/audio.js';

const settingsStore = useSettingsStore();
const gameStore = useGameStore();

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
});
</script>

<template>
    <router-view />
    <GlobalLoading />
    <ReconnectDialog />

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
    /* 优化滑动体验 */
}

::-webkit-scrollbar {
    display: none;
    /* 彻底隐藏所有滚动条 */
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
