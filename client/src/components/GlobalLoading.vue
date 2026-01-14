<template>
  <div v-if="loadingStore.isLoading" class="global-loading-overlay">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingStore.loadingText }}<span class="dots">...</span></p>
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
  align-items: center;
  background-color: rgba(0, 0, 0, 0.7);
  /* Darker overlay */
  z-index: 9999;
  /* Ensure it's on top of everything */
  pointer-events: auto;
  /* Block interaction with elements beneath */
  backdrop-filter: blur(3px);
  /* Subtle blur effect */
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Stronger shadow */
  color: #fff;
  /* White text */
  min-width: 200px;
  /* Reduced min-width */
  min-height: 100px;
  /* Reduced min-height */
  text-align: center;
  font-family: system-ui, sans-serif;
  /* Consistent font */
}

.loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  /* White, semi-transparent */
  border-top: 4px solid #cbd7e6;
  /* Vibrant blue from game buttons */
  border-radius: 50%;
  width: 25px;
  /* Reduced spinner size */
  height: 25px;
  /* Reduced spinner size */
  animation: spin 0.8s linear infinite;
  /* Reduced space between spinner and text */
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 1.0em;
  /* Reduced font size */
  font-weight: bold;
  color: #fff;
  /* White text */
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  /* Text shadow for depth */
  white-space: nowrap;
  /* Prevent text wrapping */
}

.dots {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  animation: dots 1.5s steps(3, end) infinite;
  width: 0.8em;
  /* Ensure space for dots */
}

@keyframes dots {
  0% {
    width: 0;
  }

  33% {
    width: 0.2em;
  }

  66% {
    width: 0.5em;
  }

  100% {
    width: 0.8em;
  }
}
</style>