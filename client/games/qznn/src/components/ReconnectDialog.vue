<template>
  <SharedReconnectDialog :gameClient="gameClient" />
</template>

<script setup>
import SharedReconnectDialog from '@shared/ReconnectDialog.vue';
import gameClient from '../socket.js';
</script>
