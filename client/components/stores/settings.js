import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * 设置 Store 工厂
 *
 * 由于 settings 需要引用 gameClient 来发送 SaveSetting 指令，
 * 各游戏项目需调用 createSettingsStore(gameClient) 来创建。
 *
 * 用法:
 *   import { createSettingsStore } from '@shared/stores/settings.js';
 *   import gameClient from '../socket.js';
 *   export const useSettingsStore = createSettingsStore(gameClient);
 */
export function createSettingsStore(gameClient) {
    return defineStore('settings', () => {
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
            gameClient.send("SaveSetting", {
                Music: musicEnabled.value,
                Effect: soundEnabled.value,
            });
        };

        watch(musicEnabled, () => {
            if (!isSyncingFromServer) sendSettingsToServer();
        });

        watch(soundEnabled, () => {
            if (!isSyncingFromServer) sendSettingsToServer();
        });

        return {
            musicEnabled,
            soundEnabled,
            updateFromServer
        }
    });
}
