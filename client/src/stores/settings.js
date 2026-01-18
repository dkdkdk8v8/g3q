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
    // Flag to indicate if we have already synced with server or user has manually set values
    let hasSyncedWithServer = false;
    // Flag to prevent logic during local load
    let isLoadingLocal = false;

    // Load from localStorage on initialization
    const loadSettings = () => {
        isLoadingLocal = true;
        const storedMusic = localStorage.getItem('g3q_music_enabled');
        if (storedMusic !== null) {
            musicEnabled.value = storedMusic === 'true';
        }

        const storedSound = localStorage.getItem('g3q_sound_enabled');
        if (storedSound !== null) {
            soundEnabled.value = storedSound === 'true';
        }
        isLoadingLocal = false;
    };

    // Update settings from server data
    const updateFromServer = (data) => {
        // If user has already interacted or we already synced once, ignore server updates to prevent reverts
        if (hasSyncedWithServer) return;

        isSyncingFromServer = true;

        // Handle both PascalCase (likely) and lowercase keys
        if (data.Music !== undefined) musicEnabled.value = data.Music;
        else if (data.music !== undefined) musicEnabled.value = data.music;

        if (data.Effect !== undefined) soundEnabled.value = data.Effect;
        else if (data.effect !== undefined) soundEnabled.value = data.effect;

        // Mark as synced so future server pushes (e.g. from laggy packets) don't overwrite user choice
        hasSyncedWithServer = true;

        // Use setTimeout to ensure watchers have fired and completed before enabling sync
        setTimeout(() => {
            isSyncingFromServer = false;
        }, 0);
    };

    const sendSettingsToServer = () => {
        if (isSyncingFromServer || isLoadingLocal) return;

        const payload = {
            Music: musicEnabled.value,
            Effect: soundEnabled.value,
        };
        // Send SaveSetting to server
        gameClient.send("SaveSetting", payload);
    };

    // Save to localStorage and Server when changed
    watch(musicEnabled, (newVal) => {
        if (isLoadingLocal) return;
        
        localStorage.setItem('g3q_music_enabled', String(newVal));
        
        if (!isSyncingFromServer) {
            hasSyncedWithServer = true; // User manual change, lock out server updates
            sendSettingsToServer();
        }
    });

    watch(soundEnabled, (newVal) => {
        if (isLoadingLocal) return;

        localStorage.setItem('g3q_sound_enabled', String(newVal));
        
        if (!isSyncingFromServer) {
            hasSyncedWithServer = true; // User manual change, lock out server updates
            sendSettingsToServer();
        }
    });

    // Initialize
    loadSettings();

    return {
        musicEnabled,
        soundEnabled,
        updateFromServer
    }
});
