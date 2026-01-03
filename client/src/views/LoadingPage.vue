<template>
  <div class="loading-page">
    <h1>抢庄牛牛</h1>
    <div class="input-group">
      <label for="ip-address">服务器 IP:</label>
      <input type="text" id="ip-address" v-model="ipAddress" placeholder="请输入服务器 IP 地址" />
    </div>
    <p v-if="appId">App ID: {{ appId }}</p>
    <p v-if="userId">User ID: {{ userId }}</p>
    <button @click="enterGame">进入游戏</button>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-text-container">
        努力加载中...
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import gameClient from '../socket.js'; // Use singleton
import { useUserStore } from '../stores/user.js';

export default {
  name: 'LoadingPage',
  setup() {
    const ipAddress = ref('');
    const appId = ref('');
    const userId = ref('');
    const errorMessage = ref(''); // Use errorMessage for persistent error messages
    const isLoading = ref(false); // New loading state
    const router = useRouter();
    const userStore = useUserStore();

    const LOCAL_STORAGE_IP_KEY = 'game_server_ip';

    onMounted(() => {
      const urlParams = new URLSearchParams(window.location.search);
      let currentAppId = urlParams.get('app');
      let currentUserId = urlParams.get('uid');

      if (!currentAppId) {
        currentAppId = '91xj';
      }
      if (!currentUserId) {
        currentUserId = 'dk6';
      }

      appId.value = currentAppId;
      userId.value = currentUserId;

      const savedIp = localStorage.getItem(LOCAL_STORAGE_IP_KEY);
      if (savedIp) {
        ipAddress.value = savedIp;
        // No persistent message for loaded IP, just set it
      } else {
        ipAddress.value = '127.0.0.1:18082'; // Set default IP
      }
    });

    // Watch for IP Address changes
    watch(ipAddress, (newValue) => {
      if (newValue) {
        localStorage.setItem(LOCAL_STORAGE_IP_KEY, newValue);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_IP_KEY);
      }
    });

    const enterGame = () => {
      errorMessage.value = ''; // Clear previous errors
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

      isLoading.value = true; // Start loading

      let hasUserInfo = false;
      let hasLobbyConfig = false;

      const checkReady = () => {
          if (hasUserInfo && hasLobbyConfig) {
              isLoading.value = false; // Stop loading
              router.push('/lobby');
          }
      };
        
      // Setup GameClient callbacks
      gameClient.onConnect = () => {
        console.log("[LoadingPage] WebSocket connected!");
        // message.value = `连接成功！正在获取大厅数据...`; // Remove dynamic message
        
        // Send requests separately
        gameClient.send("QZNN.UserInfo");
        gameClient.send("QZNN.LobbyConfig");
      };

      gameClient.onClose = (event) => {
        console.error("[LoadingPage] WebSocket closed:", event);
        isLoading.value = false; // Stop loading on close
        if (!gameClient.isManualClose) { // Only show error if not manually closed
          errorMessage.value = `连接断开，请检查 IP 地址或服务器状态。`;
        }
      };

      gameClient.onError = (error) => {
        console.error("[LoadingPage] WebSocket error:", error);
        isLoading.value = false; // Stop loading on error
        errorMessage.value = `连接错误，请检查 IP 地址或服务器状态。`;
      };
      
      // Register handler for QZNN.UserInfo
      gameClient.on('QZNN.UserInfo', (msg) => {
          if (msg.code === 0 && msg.data) {
              console.log("[LoadingPage] Received user info:", msg.data);
              userStore.updateUserInfo({
                  user_id: msg.data.UserId,
                  balance: msg.data.Balance,
                  nick_name: msg.data.NickName,
                  avatar: msg.data.Avatar
              });
              hasUserInfo = true;
              checkReady();
          } else {
              isLoading.value = false; // Stop loading on user info fetch error
              errorMessage.value = `获取用户数据失败: ${msg.msg}`;
          }
      });

      // Register handler for QZNN.LobbyConfig
      gameClient.on('QZNN.LobbyConfig', (msg) => {
          if (msg.code === 0 && msg.data && msg.data.LobbyConfigs) {
              console.log("[LoadingPage] Received lobby config:", msg.data);
              // Map lobby_configs from server to store
              const mappedConfigs = msg.data.LobbyConfigs.map(cfg => ({
                  level: cfg.Level,
                  name: cfg.Name,
                  base_bet: cfg.BaseBet,
                  min_balance: cfg.MinBalance
              }));
              userStore.updateRoomConfigs(mappedConfigs);
              hasLobbyConfig = true;
              checkReady();
          } else {
              isLoading.value = false; // Stop loading on lobby config fetch error
              errorMessage.value = `获取大厅配置失败: ${msg.msg}`;
          }
      });

      // Connect to the WebSocket server using the entered IP, app, and uid
      gameClient.connect(ipAddress.value, appId.value, userId.value, 'dummy_auth_token');
    };

    return {
      ipAddress,
      errorMessage, // Renamed message to errorMessage
      appId,
      userId,
      enterGame,
      isLoading, // Return isLoading
    };
  },
};
</script>

<style scoped>
.loading-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #2c3e50;
  color: #ecf0f1;
  font-family: Arial, sans-serif;
  padding: 20px;
}

h1 {
  margin-bottom: 30px;
  color: #42b983;
}

.input-group {
  margin-bottom: 20px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.input-group label {
  margin-bottom: 5px;
  font-size: 1.1em;
}

.input-group input {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 5px;
  font-size: 1em;
  background-color: #34495e;
  color: #ecf0f1;
}

.input-group input::placeholder {
  color: #bdc3c7;
}

button {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 10px 20px;
  margin: 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1.1em;
  transition: background-color 0.3s ease;
}

button:hover {
  background-color: #368a68;
}

.error-message { /* Style for error messages */
  margin-top: 20px;
  font-size: 0.9em;
  color: #f1c40f;
  text-align: center;
  max-width: 80%;
}

/* New styles for loading overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3); /* Black transparent background */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-text-container {
  background-color: rgba(255, 255, 255, 1); /* Black transparent background */
  color: black;
  padding: 15px 10px;
  border-radius: 10px;
  font-size: 1.0em;
  font-weight: bold;
  text-align: center;
  min-width: 180px; /* Fixed width to prevent jumping */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.6);
}
</style>