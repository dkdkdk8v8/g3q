/**
 * BRNN 网络层 — 基于公共 GameClient，注入 BRNN 特有的路由处理和 loadingStore。
 */
import { GameClient } from '@shared/Network.js';
import { useLoadingStore } from '@shared/stores/loading.js';
import router from './router';

const client = new GameClient();
client.apiBasePath = '/brnn/api';

client.getLoadingStore = () => useLoadingStore();

client.routerHandler = (routerName) => {
    if (routerName === 'brnn') {
        router.replace('/brnn');
    }
};

export default client;
