import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import gameClient from '../socket.js';

export const useSettingsStore = defineStore('settings', () => {
    // 1. 音乐 (Music) - Default on
    const musicEnabled = ref(true);
    // 2. 音效 (Sound Effects) - Default on
    const soundEnabled = ref(true);

    // Flag to prevent sending updates to server when initializing from server
    let isSyncingFromServer = false;

    // Update settings from server data
    const updateFromServer = (data) => {
        isSyncingFromServer = true;

        // Handle both PascalCase (likely) and lowercase keys
        if (data.Music !== undefined) musicEnabled.value = data.Music;
        else if (data.music !== undefined) musicEnabled.value = data.music;

        if (data.Effect !== undefined) soundEnabled.value = data.Effect;
        else if (data.effect !== undefined) soundEnabled.value = data.effect;

        // Use setTimeout to ensure watchers have fired and completed before enabling sync
        setTimeout(() => {
            isSyncingFromServer = false;
        }, 0);
    };

    const sendSettingsToServer = () => {
        if (isSyncingFromServer) return;

        const payload = {
            Music: musicEnabled.value,
            Effect: soundEnabled.value,
        };
        // Send SaveSetting to server
        gameClient.send("SaveSetting", payload);
    };

    // Save to Server when changed
    watch(musicEnabled, (newVal) => {
        if (!isSyncingFromServer) {
            sendSettingsToServer();
        }
    });

    watch(soundEnabled, (newVal) => {
        if (!isSyncingFromServer) {
            sendSettingsToServer();
        }
    });

    return {
        musicEnabled,
        soundEnabled,
        updateFromServer
    }
});
