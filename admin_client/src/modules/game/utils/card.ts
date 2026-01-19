export const rankMap = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const suitMap = ["♠", "♥", "♣", "♦"];
export const colorMap = [
    "var(--el-text-color-regular)",
    "var(--el-color-danger)",
    "var(--el-text-color-regular)",
    "var(--el-color-danger)",
];

export function getCardStyle(val: number) {
    if (val === undefined || val === null || val < 0 || val > 51) return { text: "", color: "" };
    const rank = Math.floor(val / 4);
    const suit = val % 4;
    return {
        text: suitMap[suit] + rankMap[rank],
        color: colorMap[suit],
    };
}

export function getCardResult(cards: number[]) {
    if (!Array.isArray(cards) || cards.length !== 5) return "";
    const ranks = cards.map((c) => Math.floor(c / 4));
    const values = ranks.map((r) => (r >= 10 ? 10 : r + 1));

    // 五小牛: 所有牌值<5 (rank < 4) 且 和 <= 10
    if (ranks.every((r) => r < 4) && values.reduce((a, b) => a + b, 0) <= 10) {
        return "五小牛";
    }
    // 炸弹: 4张牌点数相同
    const counts: Record<number, number> = {};
    ranks.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
    if (Object.values(counts).some((c) => c === 4)) {
        return "炸弹";
    }
    // 五花牛: 全是花牌 (J,Q,K -> rank >= 10)
    if (ranks.every((r) => r >= 10)) return "五花牛";
    // 四花牛: 4张花牌 + 1张10 (rank 9)
    const flowers = ranks.filter((r) => r >= 10).length;
    const tens = ranks.filter((r) => r === 9).length;
    if (flowers === 4 && tens === 1) return "四花牛";

    const sum = values.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 4; j++) {
            for (let k = j + 1; k < 5; k++) {
                if ((values[i] + values[j] + values[k]) % 10 === 0) {
                    const left = sum - (values[i] + values[j] + values[k]);
                    const niu = left % 10 === 0 ? 10 : left % 10;
                    return (
                        (niu === 10 ? "牛牛" : "牛") +
                        ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", ""][niu]
                    );
                }
            }
        }
    }
    return "无牛";
}