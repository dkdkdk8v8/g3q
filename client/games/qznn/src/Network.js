/**
 * QZNN 网络层 — 基于公共 GameClient，注入 QZNN 特有的路由处理和 loadingStore。
 */
import { GameClient } from '@shared/Network.js';
import { useLoadingStore } from '@shared/stores/loading.js';
import router from './router';

const client = new GameClient();

// 注入 loadingStore 获取方式
client.getLoadingStore = () => useLoadingStore();

// QZNN 路由处理
client.routerHandler = (routerName) => {
    if (routerName === 'lobby') {
        router.replace('/lobby');
    } else if (routerName === 'game') {
        router.replace('/game?autoJoin=true');
    }
};

export default client;
