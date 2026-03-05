import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import gameClient from '../socket.js';

export const useSettingsStore = defineStore('settings', () => {
    const musicEnabled = ref(true);
    const soundEnabled = ref(true);

    let isSyncingFromServer = false;

    const updateFromServer = (data) => {
        isSyncingFromServer = true;

        if (data.Music !== undefined) musicEnabled.value = data.Music;
        else if (data.music !== undefined) musicEnabled.value = data.music;

        if (data.Effect !== undefined) soundEnabled.value = data.Effect;
        else if (data.effect !== undefined) soundEnabled.value = data.effect;

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
        gameClient.send("SaveSetting", payload);
    };

    watch(musicEnabled, () => {
        if (!isSyncingFromServer) {
            sendSettingsToServer();
        }
    });

    watch(soundEnabled, () => {
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
