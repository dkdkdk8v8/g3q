/**
 * Format coin amount to Yuan (divide by 100) with 2 decimal places.
 * Example: 1123 -> "11.23"
 * @param {number|string} coins - The coin amount from server (usually in cents)
 * @returns {string} Formatted string
 */
export function formatCoins(coins) {
    const num = Number(coins);
    if (isNaN(num)) return '0.00';
    // Use toFixed(2) to ensure 2 decimal places. 
    // Division by 100 converts integer cents to yuan units.
    return (num / 100).toFixed(2);
}
