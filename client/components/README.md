# 公共组件库 (Shared Components)

所有牛牛系列游戏共用的基础设施代码，各游戏项目通过 Vite alias `@shared` 引用。

## 接入方式

### 1. vite.config.js 添加 alias

```js
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@shared': path.resolve(__dirname, '../../components'),
  },
  dedupe: ['vue', 'pinia', 'vue-router', 'vant', 'howler', '@msgpack/msgpack'],
},
optimizeDeps: {
  include: ['howler', '@msgpack/msgpack'],
},
```

### 2. 创建游戏专属 Network.js

```js
// src/Network.js
import { GameClient } from '@shared/Network.js';
import { useLoadingStore } from '@shared/stores/loading.js';
import router from './router';

const client = new GameClient();
client.getLoadingStore = () => useLoadingStore();
client.routerHandler = (routerName) => {
    // 游戏专属路由处理
    if (routerName === 'lobby') router.replace('/lobby');
};
export default client;
```

### 3. 本地 store 文件改为 re-export

```js
// src/stores/loading.js
export { useLoadingStore } from '@shared/stores/loading.js';

// src/stores/user.js
export { useUserStore } from '@shared/stores/user.js';

// src/stores/settings.js (需要传入 gameClient)
import { createSettingsStore } from '@shared/stores/settings.js';
import gameClient from '../socket.js';
export const useSettingsStore = createSettingsStore(gameClient);
```

## 目录结构

```
components/
├── index.js                 # 统一导出入口
├── Network.js               # GameClient 基类 (WebSocket/心跳/重连/消息分发)
├── GlobalLoading.vue         # 全局加载遮罩
├── ReconnectDialog.vue       # 断线重连弹窗 (需传入 gameClient prop)
├── style.css                 # 公共 CSS (Vant dialog 主题、body 固定等)
├── stores/
│   ├── loading.js            # 加载状态 Pinia Store
│   ├── user.js               # 用户信息 Pinia Store
│   └── settings.js           # 设置 Store 工厂 (createSettingsStore)
└── utils/
    ├── audio.js              # AudioUtils (Howler.js 封装)
    ├── bullfight.js          # 牛牛牌型算法 + 牌面转换
    ├── debounce.js           # 前沿防抖
    └── format.js             # formatCoins (分转元)
```
