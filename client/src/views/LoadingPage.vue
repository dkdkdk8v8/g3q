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
    <p v-if="message">{{ message }}</p>
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
    const message = ref('');
    const router = useRouter();
    const userStore = useUserStore();

    const LOCAL_STORAGE_IP_KEY = 'game_server_ip';

    onMounted(() => {
      // Parse URL query parameters
      const urlParams = new URLSearchParams(window.location.search);
      appId.value = urlParams.get('app') || '';
      userId.value = urlParams.get('uid') || '';

      const savedIp = localStorage.getItem(LOCAL_STORAGE_IP_KEY);
      if (savedIp) {
        ipAddress.value = savedIp;
        message.value = `已自动加载保存的 IP: ${savedIp}`;
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
      if (!ipAddress.value) {
        message.value = '请输入服务器 IP 地址！';
        return;
      }

      if (!appId.value) {
        message.value = 'URL 中缺少 app 参数！';
        return;
      }

      if (!userId.value) {
        message.value = 'URL 中缺少 uid 参数！';
        return;
      }

      message.value = `正在连接到 ${ipAddress.value}...`;
      
      let hasUserInfo = false;
      let hasLobbyConfig = false;

      const checkReady = () => {
          if (hasUserInfo && hasLobbyConfig) {
              message.value = `获取数据成功，进入大厅...`;
              router.push('/lobby');
          }
      };
        
      // Setup GameClient callbacks
      gameClient.onConnect = () => {
        console.log("[LoadingPage] WebSocket connected!");
        message.value = `连接成功！正在获取大厅数据...`;
        
        // Send requests separately
        gameClient.send("user.info");
        gameClient.send("nn.lobby_config");
      };

      gameClient.onClose = (event) => {
        console.error("[LoadingPage] WebSocket closed:", event);
        if (!gameClient.isManualClose) { // Only show error if not manually closed
          message.value = `连接断开，请检查 IP 地址或服务器状态。`;
        }
      };

      gameClient.onError = (error) => {
        console.error("[LoadingPage] WebSocket error:", error);
        message.value = `连接错误，请检查 IP 地址或服务器状态。`;
      };
      
      // Register handler for user.info
      gameClient.on('user.info', (msg) => {
          if (msg.code === 0) {
              console.log("[LoadingPage] Received user info:", msg.data);
              userStore.updateUserInfo(msg.data);
              hasUserInfo = true;
              checkReady();
          } else {
              message.value = `获取用户数据失败: ${msg.msg}`;
          }
      });

      // Register handler for nn.lobby_config
      gameClient.on('nn.lobby_config', (msg) => {
          if (msg.code === 0) {
              console.log("[LoadingPage] Received lobby config:", msg.data);
              // Map lobby_configs from server to store
              userStore.updateRoomConfigs(msg.data.lobby_configs);
              hasLobbyConfig = true;
              checkReady();
          } else {
              message.value = `获取大厅配置失败: ${msg.msg}`;
          }
      });

      // Connect to the WebSocket server using the entered IP, app, and uid
      gameClient.connect(ipAddress.value, appId.value, userId.value, 'dummy_auth_token');
    };

    return {
      ipAddress,
      message,
      appId,
      userId,
      enterGame,
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

p {
  margin-top: 20px;
  font-size: 0.9em;
  color: #f1c40f;
}
</style>