<script setup>
import GlobalLoading from './components/GlobalLoading.vue';
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
