import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
    const userInfo = ref({
        avatar: '',
        balance: 0,
        nick_name: '',
        user_id: ''
    });

    const updateUserInfo = (data) => {
        if (data.avatar !== undefined) userInfo.value.avatar = data.avatar;
        if (data.balance !== undefined) userInfo.value.balance = data.balance;
        if (data.nick_name !== undefined) userInfo.value.nick_name = data.nick_name;
        if (data.user_id !== undefined) userInfo.value.user_id = data.user_id;
    };

    return {
        userInfo,
        updateUserInfo
    };
});
