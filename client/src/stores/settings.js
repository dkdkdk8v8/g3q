import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import gameClient from '../socket.js';

export const useSettingsStore = defineStore('settings', () => {
    // 1. 音乐 (Music) - Default on
    const musicEnabled = ref(true);
    // 2. 音效 (Sound Effects) - Default on
    const soundEnabled = ref(true);
    // 3. 屏蔽用户发言 (Mute User Speech) - Default off (meaning speech is shown/heard)
    const muteUsers = ref(false);

    // Flag to prevent sending updates to server when initializing from server
    let isSyncingFromServer = false;

    // Load from localStorage on initialization
    const loadSettings = () => {
        const storedMusic = localStorage.getItem('g3q_music_enabled');
        if (storedMusic !== null) {
            musicEnabled.value = storedMusic === 'true';
        }

        const storedSound = localStorage.getItem('g3q_sound_enabled');
        if (storedSound !== null) {
            soundEnabled.value = storedSound === 'true';
        }

        const storedMute = localStorage.getItem('g3q_mute_users');
        if (storedMute !== null) {
            muteUsers.value = storedMute === 'true';
        }
    };

    // Update settings from server data
    const updateFromServer = (data) => {
        isSyncingFromServer = true;

        // Handle both PascalCase (likely) and lowercase keys
        if (data.Music !== undefined) musicEnabled.value = data.Music;
        else if (data.music !== undefined) musicEnabled.value = data.music;

        if (data.Effect !== undefined) soundEnabled.value = data.Effect;
        else if (data.effect !== undefined) soundEnabled.value = data.effect;

        if (data.Talk !== undefined) muteUsers.value = data.Talk;
        else if (data.talk !== undefined) muteUsers.value = data.talk;

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
            Talk: muteUsers.value
        };
        // Send SaveSetting to server
        gameClient.send("SaveSetting", payload);
    };

    // Save to localStorage and Server when changed
    watch(musicEnabled, (newVal) => {
        localStorage.setItem('g3q_music_enabled', String(newVal));
        sendSettingsToServer();
    });

    watch(soundEnabled, (newVal) => {
        localStorage.setItem('g3q_sound_enabled', String(newVal));
        sendSettingsToServer();
    });

    watch(muteUsers, (newVal) => {
        localStorage.setItem('g3q_mute_users', String(newVal));
        sendSettingsToServer();
    });

    // Initialize
    loadSettings();

    return {
        musicEnabled,
        soundEnabled,
        muteUsers,
        updateFromServer
    }
});
