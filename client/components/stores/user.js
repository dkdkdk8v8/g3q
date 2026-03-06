import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * 基础用户 Store
 *
 * 提供所有游戏共用的用户信息管理。
 * 游戏项目如需扩展 (如 roomConfigs、lastSelectedMode)，
 * 可自行创建 game-specific store 来补充，或 fork 此 store。
 */
export const useUserStore = defineStore('user', () => {
    const userInfo = ref({
        avatar: '',
        balance: 0,
        nick_name: '',
        user_id: ''
    });
    const roomConfigs = ref([]);
    const lastSelectedMode = ref(0);

    const setUserInfo = (data) => {
        userInfo.value.avatar = data.avatar;
        userInfo.value.balance = data.balance;
        userInfo.value.nick_name = data.nick_name;
        userInfo.value.user_id = data.user_id;
        if (data.room_configs) {
            roomConfigs.value = data.room_configs;
        }
    };

    const updateUserInfo = (data) => {
        if (data.avatar !== undefined) userInfo.value.avatar = data.avatar;
        if (data.balance !== undefined) userInfo.value.balance = data.balance;
        if (data.nick_name !== undefined) userInfo.value.nick_name = data.nick_name;
        if (data.user_id !== undefined) userInfo.value.user_id = data.user_id;
    };

    const updateRoomConfigs = (configs) => {
        roomConfigs.value = configs || [];
    };

    return {
        userInfo,
        roomConfigs,
        lastSelectedMode,
        setUserInfo,
        updateUserInfo,
        updateRoomConfigs
    };
});
