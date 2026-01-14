<template>
  <div v-if="loadingStore.showReconnectDialog" class="reconnect-overlay" @click.self="handleRetry">
    <div class="dialog-content">
      <div class="message">
        <p style="font-size: 18px;">温馨提醒</p>
        <p style="font-size: 13px;margin-top:20px;">与服务器断开连接了</p>
      </div>
    </div>
    <div class="tip">点击屏幕任意位置立即重连</div>
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
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.7);
  /* Darker overlay */
  z-index: 10000;
  /* Higher than loading */
  backdrop-filter: blur(3px);
  /* Slightly more blur */
  cursor: pointer;
  /* Indicate it's clickable */
}

.dialog-content {
  border: 1px solid #aaaa;
  background: rgba(30, 41, 59, 0.95);
  /* Dark blue-grey, similar to game modals */
  /* Gold border */
  border-radius: 15px;
  padding: 20px 30px;
  /* Reduced padding */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  /* Stronger shadow */
  min-width: 180px;
  /* Reduced min-width */
  text-align: center;
  color: #fff;
  /* White text */
  font-family: system-ui, sans-serif;
  /* Consistent font */
}

.message p {
  margin: 5px 0;
  font-size: 18px;
  /* Reduced font size */
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  /* Text shadow for depth */
}

.tip {
  font-size: 12px;
  /* Reduced font size */
  color: #aaa;
  margin-top: 15px;
  /* Adjusted margin-top */
}
</style>
