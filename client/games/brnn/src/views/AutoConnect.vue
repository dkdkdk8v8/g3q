<template>
  <div class="auto-connect-page">
    <div v-if="errorMessage" class="error-text">{{ errorMessage }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import gameClient from '../socket.js';
import { useUserStore } from '../stores/user.js';
import { useSettingsStore } from '../stores/settings.js';
import { useLoadingStore } from '../stores/loading.js';

const router = useRouter();
const userStore = useUserStore();
const settingsStore = useSettingsStore();
const loadingStore = useLoadingStore();
const errorMessage = ref('');

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const host = urlParams.get('host');
  const appId = urlParams.get('app');
  const uid = urlParams.get('uid');
  const token = urlParams.get('token') || 'dummy_auth_token';

  if (!host || !appId || !uid) {
    errorMessage.value = '缺少必要参数: host, app, uid';
    loadingStore.setAppLoadingError('缺少必要参数');
    return;
  }

  loadingStore.startAppLoading();

  let hasUserInfo = false;
  let targetRoute = '';

  const checkReady = () => {
    if (hasUserInfo && targetRoute) {
      loadingStore.stopAppLoading();
      gameClient.offServerPush('PushRouter');
      gameClient.off('UserInfo');
      router.push(targetRoute);
    }
  };

  gameClient.onConnect = () => {
    gameClient.send("UserInfo");
    gameClient.send("BRNN.PlayerJoin");
  };

  gameClient.onClose = () => {
    loadingStore.setAppLoadingError('连接断开');
  };

  gameClient.onError = () => {
    loadingStore.setAppLoadingError('连接错误');
  };

  gameClient.on('UserInfo', (msg) => {
    if (msg.code === 0 && msg.data) {
      userStore.updateUserInfo({
        user_id: msg.data.UserId,
        balance: msg.data.Balance,
        nick_name: msg.data.NickName,
        avatar: msg.data.Avatar
      });
      settingsStore.updateFromServer(msg.data);
      hasUserInfo = true;
      checkReady();
    } else {
      loadingStore.setAppLoadingError(`获取用户数据失败: ${msg.msg}`);
    }
  });

  gameClient.onServerPush('PushRouter', (data) => {
    if (data && data.Router) {
      if (data.Router === 'brnn') {
        targetRoute = '/brnn';
      }
      checkReady();
    }
  });

  gameClient.connect(host, appId, uid, token);
});

onUnmounted(() => {
  gameClient.offServerPush('PushRouter');
  gameClient.off('UserInfo');
});
</script>

<style scoped>
.auto-connect-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1a1a2e;
}

.error-text {
  color: #f1c40f;
  font-size: 14px;
  text-align: center;
  padding: 20px;
}
</style>
