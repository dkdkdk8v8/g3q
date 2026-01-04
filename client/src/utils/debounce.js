// client/src/utils/debounce.js

export function debounce(func, delay = 500) {
  let timeout = null;
  let lastArgs = null;
  let lastThis = null;

  return function(...args) {
    lastArgs = args;
    lastThis = this;

    if (!timeout) {
      // First call in the delay period, execute immediately
      func.apply(lastThis, lastArgs);
    }

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      lastArgs = null;
      lastThis = null;
    }, delay);
  };
}
