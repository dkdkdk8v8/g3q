/**
 * 公共组件库入口
 *
 * 各游戏项目通过 vite alias 引用:
 *   vite.config.js:
 *     resolve: { alias: { '@shared': path.resolve(__dirname, '../../components') } }
 *
 *   然后:
 *     import { GameClient } from '@shared/Network.js';
 *     import { useLoadingStore } from '@shared/stores/loading.js';
 *     import { AudioUtils } from '@shared/utils/audio.js';
 *     import GlobalLoading from '@shared/GlobalLoading.vue';
 */

// Network
export { GameClient } from './Network.js';

// Stores
export { useLoadingStore } from './stores/loading.js';
export { useUserStore } from './stores/user.js';
export { createSettingsStore } from './stores/settings.js';

// Utils
export { AudioUtils } from './utils/audio.js';
export { formatCoins } from './utils/format.js';
export { debounce } from './utils/debounce.js';
export {
  createDeck,
  shuffle,
  transformServerCard,
  cardToDisplay,
  niuLabel,
  calculateHandType,
} from './utils/bullfight.js';
