import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
    // 1. 音乐 (Music) - Default on
    const musicEnabled = ref(true);
    // 2. 音效 (Sound Effects) - Default on
    const soundEnabled = ref(true);
    // 3. 屏蔽用户发言 (Mute User Speech) - Default off (meaning speech is shown/heard)
    const muteUsers = ref(false);

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

    // Save to localStorage when changed
    watch(musicEnabled, (newVal) => {
        localStorage.setItem('g3q_music_enabled', String(newVal));
    });

    watch(soundEnabled, (newVal) => {
        localStorage.setItem('g3q_sound_enabled', String(newVal));
    });

    watch(muteUsers, (newVal) => {
        localStorage.setItem('g3q_mute_users', String(newVal));
    });

    // Initialize
    loadSettings();

    return {
        musicEnabled,
        soundEnabled,
        muteUsers
    }
});
