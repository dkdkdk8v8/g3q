import { defineStore } from 'pinia'

export const useLoadingStore = defineStore('loading', {
  state: () => ({
    _isLoading: false,
    _loadingText: '努力加载中',
    _dotCount: 0,
    _timeoutId: null, // For 10s auto-hide
    _minDisplayTimeoutId: null, // For 500ms delay
    _requestCount: 0, // To handle multiple concurrent requests
  }),
  getters: {
    isLoading: (state) => state._isLoading,
    loadingText: (state) => {
      return `${state._loadingText}${'.'.repeat(state._dotCount)}`;
    },
  },
  actions: {
    startLoading() {
      this._requestCount++;
      if (this._requestCount === 1) { // Only start a new loading sequence if it's the first request
        this._minDisplayTimeoutId = setTimeout(() => {
          this._isLoading = true;
          // Start dot animation
          this._dotCount = 0;
          if (this._animationInterval) {
            clearInterval(this._animationInterval);
          }
          this._animationInterval = setInterval(() => {
            this._dotCount = (this._dotCount + 1) % 4; // 0, 1, 2, 3 dots
          }, 500); // Change dot every 500ms

          // Set 10s auto-hide timeout
          if (this._timeoutId) {
            clearTimeout(this._timeoutId);
          }
          this._timeoutId = setTimeout(() => {
            this.forceHideLoading();
          }, 10000); // 10 seconds
        }, 500); // Show loading after 500ms
      }
    },
    hideLoading() {
      this._requestCount--;
      if (this._requestCount <= 0) {
        this._requestCount = 0; // Ensure it doesn't go below zero
        clearTimeout(this._minDisplayTimeoutId);
        if (this._animationInterval) {
          clearInterval(this._animationInterval);
          this._animationInterval = null;
        }
        if (this._timeoutId) {
          clearTimeout(this._timeoutId);
          this._timeoutId = null;
        }
        this._isLoading = false;
        this._dotCount = 0; // Reset dots
      }
    },
    // Force hide in case of 10s timeout or other unexpected issues
    forceHideLoading() {
      clearTimeout(this._minDisplayTimeoutId);
      if (this._animationInterval) {
        clearInterval(this._animationInterval);
        this._animationInterval = null;
      }
      if (this._timeoutId) {
        clearTimeout(this._timeoutId);
        this._timeoutId = null;
      }
      this._isLoading = false;
      this._requestCount = 0; // Reset request count
      this._dotCount = 0; // Reset dots
    },
    setLoadingText(text) {
      this._loadingText = text;
    },
  },
});
