<script setup>
import { useSettingsStore } from '../stores/settings.js';

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
                <h3>游戏设置</h3>
                <div class="close-icon" @click="close">×</div>
            </div>
            <div class="settings-list">
                <div class="setting-item">
                    <span>背景音乐</span>
                    <van-switch v-model="settingsStore.musicEnabled" size="24px" active-color="#13ce66"
                        inactive-color="#ff4949" />
                </div>
                <div class="setting-item">
                    <span>游戏音效</span>
                    <van-switch v-model="settingsStore.soundEnabled" size="24px" active-color="#13ce66"
                        inactive-color="#ff4949" />
                </div>
                <div class="setting-item">
                    <span>屏蔽他人发言</span>
                    <van-switch v-model="settingsStore.muteUsers" size="24px" active-color="#13ce66"
                        inactive-color="#ff4949" />
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
    background: #1e293b;
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
    align-items: center;
    color: white;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 0;
    border-bottom: 1px solid #334155;
    color: #e2e8f0;
    font-size: 16px;
}

.setting-item:last-child {
    border-bottom: none;
}
</style>
