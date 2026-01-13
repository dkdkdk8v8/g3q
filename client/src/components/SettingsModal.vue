<script setup>
import { useSettingsStore } from '../stores/settings.js';

import menuSetImg from '@/assets/common/menu_set.png';
import gameSetMusicImg from '@/assets/common/game_set_music.png';
import gameSetEffectImg from '@/assets/common/game_set_effect.png';
import gameSetTalkImg from '@/assets/common/game_set_talk.png';

const props = defineProps({
    visible: Boolean
});

const emit = defineEmits(['update:visible', 'close']);

const settingsStore = useSettingsStore();

const close = () => {
    emit('update:visible', false);
    emit('close');
};
</script>

<template>
    <div v-if="visible" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-header-left-spacer"></div>

                <img :src="menuSetImg" alt="游戏设置" class="modal-title-img" />

                <div class="modal-header-right">
                    <div class="close-icon" @click="close">×</div>
                </div>
            </div>
            <div class="settings-list">
                <div class="setting-item">
                    <div class="setting-label">
                        <img :src="gameSetMusicImg" class="setting-icon" />
                        <span>背景音乐</span>
                    </div>
                    <van-switch v-model="settingsStore.musicEnabled" size="24px" active-color="#13ce66"
                        inactive-color="grey" />
                </div>
                <div class="setting-item">
                    <div class="setting-label">
                        <img :src="gameSetEffectImg" class="setting-icon" />
                        <span>游戏音效</span>
                    </div>
                    <van-switch v-model="settingsStore.soundEnabled" size="24px" active-color="#13ce66"
                        inactive-color="grey" />
                </div>
                <div class="setting-item">
                    <div class="setting-label">
                        <img :src="gameSetTalkImg" class="setting-icon" />
                        <span>屏蔽他人发言</span>
                    </div>
                    <van-switch v-model="settingsStore.muteUsers" size="24px" active-color="#13ce66"
                        inactive-color="grey" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 弹窗样式 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 8000;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.modal-content {
    width: 85%;
    max-width: 400px;
    max-height: 70vh;
    background: rgba(32, 35, 45, 1);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    /* To push title image to center and close button to right */
    align-items: center;
    color: white;
}

/* New styles for the modal header title image and layout */
.modal-header-left-spacer,
.modal-header-right {
    flex: 1;
    /* Take up available space to push title image to center */
    display: flex;
    align-items: center;
}

.modal-header-left-spacer {
    /* For alignment, can be empty or used for other left-aligned elements */
}

.modal-header-right {
    justify-content: flex-end;
    /* Push content to the right */
    gap: 10px;
    /* Space between close button and potential other elements */
}

.modal-title-img {
    width: 70%;
    /* 50% of the modal's width */
    height: auto;
    object-fit: contain;
    flex-shrink: 0;
    /* Prevent image from shrinking */
}

.close-icon {
    font-size: 24px;
    cursor: pointer;
    color: #94a3b8;
}

.settings-list {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
}

.setting-item {
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 10px;
    margin-bottom: 6px;
    color: #e2e8f0;
    background-color: rgba(37, 43, 58, 1);
    font-size: 16px;
}

.setting-item:last-child {
    border-bottom: none;
}

.setting-label {
    display: flex;
    align-items: center;
    gap: 8px;
}

.setting-icon {
    width: 22px;
    height: 22px;
    object-fit: contain;
}
</style>
