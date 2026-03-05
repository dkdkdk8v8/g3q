<template>
  <div class="loading-page">
    <div class="input-group">
      <label for="ip-address">服务器IP</label>
      <input type="text" id="ip-address" v-model="ipAddress" placeholder="请输入服务器 IP 地址" />
    </div>
    <div v-if="appId" style="color:grey;display:flex;flex-direction:row;align-items:center;margin-bottom:10px;">
      <div style="margin-right:0px">APP:【 {{ appId }} 】</div>
      <div>UID: 【{{ userId }}】</div>
    </div>
    <div class="mode-selector">
      <div class="mode-title" style="color: #e74c3c;">百人牛牛 · 系统坐庄 · 天地玄黄</div>
    </div>

    <button v-if="lastUid" @click="enterGameWithLast">继续上次用户测试 ({{ lastUid }})</button>
    <button @click="enterGameRandom" class="random-btn">新用户进入测试</button>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-text-container">
        努力加载中<span class="dots">...</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import gameClient from '../socket.js';
import { useUserStore } from '../stores/user.js';
import { useSettingsStore } from '../stores/settings.js';
import { showToast } from 'vant';

export default {
  name: 'LoadingPage',
  setup() {
    onUnmounted(() => {
      gameClient.offServerPush('PushRouter');
    });

    const ipAddress = ref('');
    const appId = ref('');
    const userId = ref('');
    const lastAppId = ref('');
    const lastUid = ref('');
    const errorMessage = ref('');
    const isLoading = ref(false);
    const router = useRouter();
    const userStore = useUserStore();
    const settingsStore = useSettingsStore();

    const LOCAL_STORAGE_IP_KEY = 'game_server_ip';
    const LOCAL_STORAGE_UID_KEY = 'game_user_uid';
    const LOCAL_STORAGE_APP_KEY = 'game_app_id';

    onMounted(() => {
      const urlParams = new URLSearchParams(window.location.search);
      let urlAppId = urlParams.get('app');
      let urlUserId = urlParams.get('uid');

      const storedAppId = localStorage.getItem(LOCAL_STORAGE_APP_KEY) || '';
      const storedUid = localStorage.getItem(LOCAL_STORAGE_UID_KEY) || '';

      lastAppId.value = storedAppId;
      lastUid.value = storedUid;

      if (urlAppId) {
        appId.value = urlAppId;
      } else if (storedAppId) {
        appId.value = storedAppId;
      } else {
        appId.value = 'test';
      }

      if (urlUserId) {
        userId.value = urlUserId;
      } else if (storedUid) {
        userId.value = storedUid;
      } else {
        userId.value = '';
      }

      const savedIp = localStorage.getItem(LOCAL_STORAGE_IP_KEY);
      if (savedIp) {
        ipAddress.value = savedIp;
      } else {
        ipAddress.value = '43.198.8.247:8082';
      }
    });

    watch(ipAddress, (newValue) => {
      if (newValue) {
        localStorage.setItem(LOCAL_STORAGE_IP_KEY, newValue);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_IP_KEY);
      }
    });

    const enterGameRandom = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const length = Math.floor(Math.random() * 6) + 5;
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      appId.value = 'test';
      userId.value = result;

      localStorage.setItem(LOCAL_STORAGE_APP_KEY, appId.value);
      localStorage.setItem(LOCAL_STORAGE_UID_KEY, userId.value);
      lastAppId.value = appId.value;
      lastUid.value = userId.value;

      setTimeout(() => {
        enterGame();
      }, 0);
    };

    const enterGameWithLast = () => {
      if (lastAppId.value) appId.value = lastAppId.value;
      if (lastUid.value) userId.value = lastUid.value;
      enterGame();
    };

    const enterGame = () => {
      errorMessage.value = '';
      if (!ipAddress.value) {
        errorMessage.value = '请输入服务器 IP 地址！';
        return;
      }

      if (!appId.value) {
        errorMessage.value = 'URL 中缺少 app 参数！';
        return;
      }

      if (!userId.value) {
        errorMessage.value = 'URL 中缺少 uid 参数！';
        return;
      }

      localStorage.setItem(LOCAL_STORAGE_UID_KEY, userId.value);
      localStorage.setItem(LOCAL_STORAGE_APP_KEY, appId.value);
      lastUid.value = userId.value;
      lastAppId.value = appId.value;

      isLoading.value = true;

      let hasUserInfo = false;
      let hasLobbyConfig = true; // BRNN does not need LobbyConfig
      let targetRoute = '';

      const checkReady = () => {
        if (hasUserInfo && hasLobbyConfig && targetRoute) {
          isLoading.value = false;

          gameClient.offServerPush('PushRouter');
          gameClient.off('UserInfo');

          router.push(targetRoute);
        }
      };

      // Setup GameClient callbacks
      gameClient.onConnect = () => {
        console.log("[LoadingPage] WebSocket connected!");
        gameClient.send("UserInfo");
        gameClient.send("BRNN.PlayerJoin");
      };

      gameClient.onClose = (event) => {
        console.error("[LoadingPage] WebSocket closed:", event);
        isLoading.value = false;
        if (!gameClient.isManualClose) {
          errorMessage.value = `连接断开，请检查 IP 地址或服务器状态。`;
        }
      };

      gameClient.onError = (error) => {
        console.error("[LoadingPage] WebSocket error:", error);
        isLoading.value = false;
        errorMessage.value = `连接错误，请检查 IP 地址或服务器状态。`;
      };

      // Register handler for UserInfo
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
          isLoading.value = false;
          errorMessage.value = `获取用户数据失败: ${msg.msg}`;
        }
      });

      // Register PushRouter handler
      gameClient.onServerPush('PushRouter', (data) => {
        if (data && data.Router) {
          if (data.Router === 'brnn') {
            targetRoute = '/brnn';
          }
          checkReady();
        }
      });

      // Connect to the WebSocket server
      gameClient.connect(ipAddress.value, appId.value, userId.value, 'dummy_auth_token');
    };

    return {
      ipAddress,
      errorMessage,
      appId,
      userId,
      lastUid,
      enterGame,
      enterGameRandom,
      enterGameWithLast,
      isLoading,
    };
  },
};
</script>

<style scoped>
.loading-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #1a1a2e;
  color: #ecf0f1;
  font-family: Arial, sans-serif;
  z-index: 1;
}

.input-group {
  margin-bottom: 20px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.input-group label {
  margin-bottom: 5px;
  font-size: 1.1em;
}

.input-group input {
  width: 95%;
  padding: 10px;
  border: none;
  border-radius: 5px;
  font-size: 1em;
  background-color: #2a2a4a;
  color: #ecf0f1;
}

.input-group input::placeholder {
  color: #bdc3c7;
}

.mode-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
  background-color: rgba(0, 0, 0, 0.4);
  padding: 15px;
  border-radius: 15px;
}

.mode-title {
  color: #f1c40f;
  font-size: 1.1em;
  margin-bottom: 10px;
  font-weight: bold;
}

button {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 10px 20px;
  margin: 10px;
  border-radius: 50px;
  cursor: pointer;
  font-size: 1.1em;
  transition: background-color 0.3s ease;
}

button:hover {
  background-color: #c0392b;
}

.random-btn {
  background-color: #3498db;
}

.random-btn:hover {
  background-color: #2980b9;
}

.error-message {
  margin-top: 20px;
  font-size: 0.9em;
  color: #f1c40f;
  text-align: center;
  max-width: 80%;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.loading-text-container {
  color: white;
  font-size: 1.2em;
  font-weight: bold;
  text-align: center;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  font-family: system-ui, sans-serif;
  white-space: nowrap;
}

.dots {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  animation: dots 1.5s steps(3, end) infinite;
  width: 0.8em;
}

@keyframes dots {
  0% {
    width: 0;
  }

  33% {
    width: 0.2em;
  }

  66% {
    width: 0.5em;
  }

  100% {
    width: 0.8em;
  }
}
</style>
