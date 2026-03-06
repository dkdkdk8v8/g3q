import { createSettingsStore } from '@shared/stores/settings.js';
import gameClient from '../socket.js';

export const useSettingsStore = createSettingsStore(() => gameClient);
