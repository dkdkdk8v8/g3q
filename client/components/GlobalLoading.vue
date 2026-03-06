<template>
  <div v-if="loadingStore.isLoading" class="global-loading-overlay">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingStore.loadingText }}<span class="dots">...</span></p>
    </div>
  </div>
</template>

<script setup>
import { useLoadingStore } from './stores/loading';

const loadingStore = useLoadingStore();
</script>

<style scoped>
.global-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 9999;
  pointer-events: auto;
  backdrop-filter: blur(3px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
  min-width: 200px;
  min-height: 100px;
  text-align: center;
  font-family: system-ui, sans-serif;
}

.loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #cbd7e6;
  border-radius: 50%;
  width: 25px;
  height: 25px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 1.0em;
  font-weight: bold;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

.dots {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  animation: dots 1.5s steps(3, end) infinite;
  width: 0.8em;
}

@keyframes dots {
  0%   { width: 0; }
  33%  { width: 0.2em; }
  66%  { width: 0.5em; }
  100% { width: 0.8em; }
}
</style>
