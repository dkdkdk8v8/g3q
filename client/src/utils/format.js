/**
 * Format coin amount to Yuan (divide by 100) with 2 decimal places.
 * Example: 1123 -> "11.23"
 * @param {number|string} coins - The coin amount from server (usually in cents)
 * @returns {string} Formatted string
 */
export function formatCoins(coins, decimalPlaces = 2) {
    const num = Number(coins);
    if (isNaN(num)) return (0).toFixed(decimalPlaces);
    return (num / 100).toFixed(decimalPlaces);
}
