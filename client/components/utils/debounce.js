/**
 * 前沿防抖 (leading-edge debounce)
 * 第一次调用立即执行，之后在 delay 期间内的调用被忽略。
 *
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 防抖间隔 (ms)，默认 500
 * @returns {Function}
 */
export function debounce(func, delay = 500) {
  let timeout = null;
  let lastArgs = null;
  let lastThis = null;

  return function(...args) {
    lastArgs = args;
    lastThis = this;

    if (!timeout) {
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
