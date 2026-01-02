<template>
  <div v-if="loadingStore.showReconnectDialog" class="reconnect-overlay">
    <div class="dialog-content">
      <div class="message">网络连接失败，点击重试</div>
      <button class="retry-btn" @click="handleRetry">点击重试</button>
    </div>
  </div>
</template>

<script setup>
import { useLoadingStore } from '../stores/loading';
import gameClient from '../socket.js';

const loadingStore = useLoadingStore();

const handleRetry = () => {
    loadingStore.hideReconnectModal();
    gameClient.retryConnection();
};
</script>

<style scoped>
.reconnect-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0,0,0,0.5);
  z-index: 10000; /* Higher than loading */
  backdrop-filter: blur(2px);
}

.dialog-content {
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  min-width: 280px;
}

.message {
  color: #fff;
  font-size: 16px;
  font-weight: bold;
}

.retry-btn {
  background: linear-gradient(to bottom, #fbbf24, #d97706);
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  color: white;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  width: 100%;
  transition: transform 0.1s;
}

.retry-btn:active {
  transform: scale(0.95);
}
</style>
