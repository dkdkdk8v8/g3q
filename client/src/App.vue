<script setup>
import { onMounted } from 'vue';
import GlobalLoading from './components/GlobalLoading.vue';
import btnClickSound from '@/assets/sounds/btn_click.mp3';

const clickAudio = new Audio(btnClickSound);

onMounted(() => {
  document.addEventListener('click', (e) => {
    // Check if the clicked element or its parent is interactive
    const target = e.target.closest('button, .btn, .game-btn, .menu-btn, .van-button, .menu-item, .tab-item, .room-card, .add-btn, .chat-toggle-btn, .close-icon, .close-btn, .phrase-item, .emoji-item');
    if (target) {
      clickAudio.currentTime = 0;
      clickAudio.play().catch(() => {});
    }
  }, true); // Use capture phase to handle events before stopPropagation
});
</script>

<template>
  <router-view />
  <GlobalLoading />
</template>

<style>
/* 全局样式覆盖，确保全屏 */
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #1a1a1a;
}
</style>
