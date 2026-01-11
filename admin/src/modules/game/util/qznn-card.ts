export enum QznnCardType {
    NiuNone = 'NiuNone',
    NiuOne = 'NiuOne',
    NiuTwo = 'NiuTwo',
    NiuThree = 'NiuThree',
    NiuFour = 'NiuFour',
    NiuFive = 'NiuFive',
    NiuSix = 'NiuSix',
    NiuSeven = 'NiuSeven',
    NiuEight = 'NiuEight',
    NiuNine = 'NiuNine',
    NiuNiu = 'NiuNiu',
    NiuFace = 'NiuFace',
    NiuBomb = 'NiuBomb',
    NiuFiveSmall = 'NiuFiveSmall',
}

export const QZNN_CARD_NAMES: Record<string, string> = {
    [QznnCardType.NiuNone]: '无牛',
    [QznnCardType.NiuOne]: '牛一',
    [QznnCardType.NiuTwo]: '牛二',
    [QznnCardType.NiuThree]: '牛三',
    [QznnCardType.NiuFour]: '牛四',
    [QznnCardType.NiuFive]: '牛五',
    [QznnCardType.NiuSix]: '牛六',
    [QznnCardType.NiuSeven]: '牛七',
    [QznnCardType.NiuEight]: '牛八',
    [QznnCardType.NiuNine]: '牛九',
    [QznnCardType.NiuNiu]: '牛牛',
    [QznnCardType.NiuFace]: '五花牛',
    [QznnCardType.NiuBomb]: '炸弹牛',
    [QznnCardType.NiuFiveSmall]: '五小牛',
};

const TYPE_INDEX_MAP: Record<number, QznnCardType> = {
    0: QznnCardType.NiuNone,
    1: QznnCardType.NiuOne,
    2: QznnCardType.NiuTwo,
    3: QznnCardType.NiuThree,
    4: QznnCardType.NiuFour,
    5: QznnCardType.NiuFive,
    6: QznnCardType.NiuSix,
    7: QznnCardType.NiuSeven,
    8: QznnCardType.NiuEight,
    9: QznnCardType.NiuNine,
    10: QznnCardType.NiuNiu,
    11: QznnCardType.NiuFace,
    12: QznnCardType.NiuBomb,
    13: QznnCardType.NiuFiveSmall,
};

export class QznnCardUtil {
    static GameNameQZNN = 'qznn'
    /**
     * 计算牌型
     * @param cards 牌数据数组 (0-51)
     */
    static calculateCardResult(cards: number[]): string {
        if (!cards || cards.length < 5) {
            return 'Unknown';
        }

        const ranks = cards.map(c => Math.floor(c / 4));
        // 逻辑点数：Rank 0-8 -> 1-9, Rank 9-12 -> 10
        const points = ranks.map(r => (r + 1 > 10 ? 10 : r + 1));
        const sumPoints = points.reduce((a, b) => a + b, 0);

        // 五花牛 (All J, Q, K -> ranks >= 10)
        // J(10), Q(11), K(12)
        const isFiveFlower = ranks.every(r => r >= 10);
        if (isFiveFlower) return TYPE_INDEX_MAP[11];

        // 五小牛 (All ranks < 4 and sumPoints <= 10)
        // Rank 0(A), 1(2), 2(3), 3(4)
        const isFiveSmall = ranks.every(r => r < 4) && sumPoints <= 10;
        if (isFiveSmall) return TYPE_INDEX_MAP[13];

        // 炸弹牛 (4 cards same rank)
        const rankCounts: Record<number, number> = {};
        for (const r of ranks) {
            rankCounts[r] = (rankCounts[r] || 0) + 1;
        }
        if (Object.values(rankCounts).some(count => count === 4)) {
            return TYPE_INDEX_MAP[12];
        }

        // 计算牛牛点数
        let maxNiu = 0; // 默认为无牛
        let found = false;

        // 寻找3张牌凑成10的倍数
        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 4; j++) {
                for (let k = j + 1; k < 5; k++) {
                    if ((points[i] + points[j] + points[k]) % 10 === 0) {
                        const remainingSum = sumPoints - (points[i] + points[j] + points[k]);
                        let currentNiu = remainingSum % 10;
                        if (currentNiu === 0) currentNiu = 10; // 牛牛

                        if (currentNiu > maxNiu) {
                            maxNiu = currentNiu;
                        }
                        found = true;
                    }
                }
            }
        }

        if (!found) return TYPE_INDEX_MAP[0];

        return TYPE_INDEX_MAP[maxNiu] || 'Unknown';
    }
}
