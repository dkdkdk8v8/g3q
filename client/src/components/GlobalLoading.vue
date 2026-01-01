<template>
  <div v-if="loadingStore.isLoading" class="global-loading-overlay">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingStore.loadingText }}</p>
    </div>
  </div>
</template>

<script setup>
import { useLoadingStore } from '../stores/loading';

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
  background-color: rgba(0,0,0,0.3);
  align-items: center;
  z-index: 9999; /* Ensure it's on top of everything */
  pointer-events: auto; /* Allow interaction with the overlay itself */
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: rgba(255, 255, 255);
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  color: #333;
  width: 180px; /* Fixed width to prevent resizing due to dynamic dots */
}

.loading-spinner {
  border: 4px solid #cbd4da;
  border-top: 4px solid #4a4848;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  animation: spin 1s linear infinite;
  margin-top: 30px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 1.1em;
  font-weight: bold;
}


</style>