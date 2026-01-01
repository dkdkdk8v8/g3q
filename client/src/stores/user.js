import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
    const userInfo = ref({
        avatar: '',
        balance: 0,
        nick_name: '',
        user_id: ''
    });
    const roomConfigs = ref([]);

    const setUserInfo = (data) => {
        userInfo.value.avatar = data.avatar;
        userInfo.value.balance = data.balance;
        userInfo.value.nick_name = data.nick_name;
        userInfo.value.user_id = data.user_id;
        roomConfigs.value = data.room_configs || [];
    };

    return {
        userInfo,
        roomConfigs,
        setUserInfo
    };
});
