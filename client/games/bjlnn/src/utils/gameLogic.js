export const CARD_SIZES = {
    xxs: { w: 34, h: 48, font: '13px' },
    xs: { w: 46, h: 64, font: '16px' },
};

export const CHIP_DATA = [
    { val: 10, color: '#64748b' },
    { val: 50, color: '#16a34a' },
    { val: 100, color: '#3b82f6' },
    { val: 500, color: '#22c55e' },
    { val: 1000, color: '#ef4444' },
    { val: 5000, color: '#a855f7' },
];

export const PLAYER_CONFIG = [
    { id: 1, key: 'p1', name: '闲1-平倍', color: 'from-cyan-500/30 to-transparent', accent: 'cyan', text: 'text-cyan-400' },
    { id: 2, key: 'p2', name: '闲2-平倍', color: 'from-purple-500/30 to-transparent', accent: 'purple', text: 'text-purple-400' },
    { id: 3, key: 'p3', name: '闲3-平倍', color: 'from-amber-500/30 to-transparent', accent: 'orange', text: 'text-amber-400' },
];

export const SUITS = ['spade', 'heart', 'club', 'diamond'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_ICONS = {
    heart: "M50 85 C50 85 15 60 15 35 C15 20 30 15 40 15 C45 15 50 20 50 20 C50 20 55 15 60 15 C70 15 85 20 85 35 C85 60 50 85 50 85 Z",
    diamond: "M50 15 L80 50 L50 85 L20 50 Z",
    spade: "M50 15 C35 15 20 35 20 50 C20 65 35 75 50 75 C65 75 80 65 80 50 C80 35 65 15 50 15 Z M45 75 L55 75 L52 85 L48 85 Z",
    club: "M50 45 C58 45 65 38 65 30 C65 22 58 15 50 15 C42 15 35 22 35 30 C35 38 42 45 50 45 Z M30 75 C38 75 45 68 45 60 C45 52 38 45 30 45 C22 45 15 52 15 60 C15 68 22 75 30 75 Z M70 75 C78 75 85 68 85 60 C85 52 78 45 70 45 C62 45 55 52 55 60 C55 68 62 75 70 75 Z M46 60 L54 60 L52 85 L48 85 Z"
};

export const calculateNiu = (cards) => {
    if (!cards || cards.length < 5) return { label: '无牛', score: 0, type: 'no_niu', baseIndices: [] };
    const vals = cards.map(c => ['J', 'Q', 'K'].includes(c.rank) ? 10 : (c.rank === 'A' ? 1 : parseInt(c.rank)));
    const rawRanks = cards.map(c => c.rank);

    // 四炸 (Four of a kind)
    const rankCounts = rawRanks.reduce((a, r) => { a[r] = (a[r] || 0) + 1; return a; }, {});
    if (Object.values(rankCounts).includes(4)) {
        return { label: '四炸', score: 13, type: 'epic_bomb', baseIndices: [0, 1, 2, 3, 4] };
    }

    const totalSum = vals.reduce((a, b) => a + b, 0);

    // 五小牛 (Five small) - 5 cards sum <= 10, all cards < 5
    if (totalSum <= 10 && cards.every(c => (['J', 'Q', 'K'].includes(c.rank) ? 10 : (c.rank === 'A' ? 1 : parseInt(c.rank))) < 5)) {
        return { label: '五小牛', score: 12, type: 'epic_small', baseIndices: [0, 1, 2, 3, 4] };
    }

    // 五花牛 (Five face cards) - all J, Q, K
    if (cards.every(c => ['J', 'Q', 'K'].includes(c.rank))) {
        return { label: '五花牛', score: 11, type: 'epic_flower', baseIndices: [0, 1, 2, 3, 4] };
    }

    let maxP = -1;
    let bestB = [];

    for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
            for (let k = j + 1; k < 5; k++) {
                if ((vals[i] + vals[j] + vals[k]) % 10 === 0) {
                    const point = (totalSum - (vals[i] + vals[j] + vals[k])) % 10 === 0 ? 10 : (totalSum - (vals[i] + vals[j] + vals[k])) % 10;
                    if (point > maxP) {
                        maxP = point;
                        bestB = [i, j, k];
                    }
                }
            }
        }
    }

    const labels = ['无牛', '牛一', '牛二', '牛三', '牛四', '牛五', '牛六', '牛七', '牛八', '牛九', '牛牛'];
    if (maxP === -1) return { label: '无牛', score: 0, type: 'no_niu', baseIndices: [] };

    let type = maxP === 10 ? 'gold_niuniu' : (maxP >= 7 ? 'bronze_high' : 'niu_1_6');
    return { label: labels[maxP], score: maxP, type, baseIndices: bestB };
};

export const drawAdvancedHand = (deck, type) => {
    let hand = [];
    const pull = (r) => {
        const idx = deck.findIndex(c => c.rank === r);
        return idx !== -1 ? deck.splice(idx, 1)[0] : deck.splice(0, 1)[0];
    };

    switch (type) {
        case 'epic_bomb':
            for (let i = 0; i < 4; i++) hand.push(pull('8'));
            hand.push(deck.splice(0, 1)[0]);
            break;
        case 'epic_small':
            ['A', 'A', '2', '2', '3'].forEach(r => hand.push(pull(r)));
            break;
        case 'epic_flower':
            ['J', 'Q', 'K', 'J', 'Q'].forEach(r => hand.push(pull(r)));
            break;
        case 'gold_niuniu':
            ['10', 'J', 'Q', '10', 'K'].forEach(r => hand.push(pull(r)));
            break;
        case 'bronze_high':
            ['10', 'J', 'Q', 'A', '7'].forEach(r => hand.push(pull(r)));
            break;
        default:
            hand = deck.splice(0, 5);
    }
    return hand;
};
