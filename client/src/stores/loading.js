import { defineStore } from 'pinia'

export const useLoadingStore = defineStore('loading', {
  state: () => ({
    _isLoading: false,
    _loadingText: '连接中...', // Changed default text
    // _timeoutId: null, // Removed 10s auto-hide as per user request
    // _minDisplayTimeoutId: null, // Removed 500ms delay as per user request
    // _requestCount: 0, // Removed to simplify loading logic
    _showReconnectDialog: false, // New state for reconnect dialog
  }),
  getters: {
    isLoading: (state) => state._isLoading,
    loadingText: (state) => state._loadingText, 
    showReconnectDialog: (state) => state._showReconnectDialog, // Getter for dialog
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
    }
  },
});