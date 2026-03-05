import { defineStore } from 'pinia'

export const useLoadingStore = defineStore('loading', {
  state: () => ({
    _isLoading: false,
    _loadingText: '连接中...',
    _showReconnectDialog: false,
    _appLoading: false,
    _appLoadingError: '',
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
      this._isLoading = true;
    },
    hideLoading() {
      this._isLoading = false;
    },
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
