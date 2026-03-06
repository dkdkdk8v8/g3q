/**
 * 将服务器金额 (分) 格式化为元
 * 例: 1123 -> "11.23"
 * @param {number|string} coins - 金额 (分)
 * @param {number} decimalPlaces - 小数位数 (默认 2)
 * @returns {string}
 */
export function formatCoins(coins, decimalPlaces = 2) {
    const num = Number(coins);
    if (isNaN(num)) return (0).toFixed(decimalPlaces);
    return (num / 100).toFixed(decimalPlaces);
}
