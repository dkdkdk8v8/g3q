<script setup>
import { ref, onMounted, onActivated } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import LobbyDefault from './LobbyDefault.vue';
import LobbyGreen from './LobbyGreen.vue';
import LobbyPurple from './LobbyPurple.vue';

const route = useRoute();
const userStore = useUserStore();
const currentMode = ref(userStore.lastSelectedMode || 0);

const resolveMode = () => {
    if (route.query.mode !== undefined) {
        currentMode.value = Number(route.query.mode);
        userStore.lastSelectedMode = currentMode.value;
    }
};

onMounted(resolveMode);
onActivated(resolveMode);
</script>

<template>
    <LobbyDefault v-if="currentMode === 0" />
    <LobbyGreen v-else-if="currentMode === 1" />
    <LobbyPurple v-else-if="currentMode === 2" />
    <LobbyDefault v-else />
</template>
