<template>
  <div v-if="loadingStore.showReconnectDialog" class="reconnect-overlay" @click.self="handleRetry">
    <div class="dialog-content">
      <div class="message">
        <p>网络已断开</p>
        <p>正在尝试重连...</p>
      </div>
      <div class="tip">点击屏幕任意位置立即重连</div>
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
  background-color: rgba(0, 0, 0, 0.7); /* Darker overlay */
  z-index: 10000; /* Higher than loading */
  backdrop-filter: blur(3px); /* Slightly more blur */
  cursor: pointer; /* Indicate it's clickable */
}

.dialog-content {
  background: rgba(30, 41, 59, 0.95); /* Dark blue-grey, similar to game modals */
  border: 3px solid #ffcc00; /* Gold border */
  border-radius: 15px;
  padding: 20px 30px; /* Reduced padding */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px; /* Reduced gap */
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.7); /* Stronger shadow */
  min-width: 280px; /* Reduced min-width */
  text-align: center;
  color: #fff; /* White text */
  font-family: system-ui, sans-serif; /* Consistent font */
}

.message p {
  margin: 5px 0;
  font-size: 18px; /* Reduced font size */
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5); /* Text shadow for depth */
}

.tip {
  font-size: 12px; /* Reduced font size */
  color: #f0f0f0;
  margin-top: 5px; /* Adjusted margin-top */
}
</style>
