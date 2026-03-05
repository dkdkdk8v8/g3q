import { defineStore } from 'pinia'

export const useLoadingStore = defineStore('loading', {
  state: () => ({
    _isLoading: false,
    _loadingText: '连接中...', // Changed default text
    _showReconnectDialog: false, // New state for reconnect dialog
    _appLoading: false, // 全局加载动画 (生产环境连接中)
    _appLoadingError: '', // 加载错误信息
  }),
  getters: {
    isLoading: (state) => state._isLoading,
    loadingText: (state) => state._loadingText,
    showReconnectDialog: (state) => state._showReconnectDialog,
    appLoading: (state) => state._appLoading,
    appLoadingError: (state) => state._appLoadingError,
  },
  actions: {
    startLoading() {
      // Simplifed loading: directly set isLoading to true
      // No more requestCount or minDisplayTimeoutId
      this._isLoading = true;

      // No 10s auto-hide logic here either, as reconnection loading should persist until resolved
    },
    hideLoading() {
      // Simplified loading: directly set isLoading to false
      this._isLoading = false;
    },
    // Force hide for reconnection loading
    forceHideLoading() {
      this._isLoading = false;
    },
    setLoadingText(text) {
      this._loadingText = text;
    },
    showReconnectModal() {
      this._showReconnectDialog = true;
    },
    hideReconnectModal() {
      this._showReconnectDialog = false;
    },
    startAppLoading() {
      this._appLoading = true;
      this._appLoadingError = '';
    },
    stopAppLoading() {
      this._appLoading = false;
    },
    setAppLoadingError(msg) {
      this._appLoadingError = msg;
    },
  },
});