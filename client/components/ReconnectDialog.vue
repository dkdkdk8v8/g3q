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
import { useLoadingStore } from './stores/loading';

const props = defineProps({
  gameClient: {
    type: Object,
    required: true,
  }
});

const loadingStore = useLoadingStore();

const handleRetry = () => {
  loadingStore.hideReconnectModal();
  props.gameClient.retryConnection();
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
  z-index: 10000;
  backdrop-filter: blur(3px);
  cursor: pointer;
}

.dialog-content {
  border: 1px solid #aaaa;
  background: rgba(30, 41, 59, 0.95);
  border-radius: 15px;
  padding: 20px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  min-width: 180px;
  text-align: center;
  color: #fff;
  font-family: system-ui, sans-serif;
}

.message p {
  margin: 5px 0;
  font-size: 18px;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.tip {
  font-size: 12px;
  color: #aaa;
  margin-top: 15px;
}
</style>
