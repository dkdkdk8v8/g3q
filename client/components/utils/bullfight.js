/**
 * 牛牛 (Bull Fight) 通用牌型算法
 *
 * 扑克编码: 0-51
 *   rank = floor(id / 4) + 1   (1=A, 2-10, 11=J, 12=Q, 13=K)
 *   suit = id % 4               (0=spade, 1=heart, 2=club, 3=diamond)
 *
 * 此文件适用于所有牛牛类游戏 (抢庄牛牛、百人牛牛等)。
 */

const SUITS = ['spade', 'heart', 'club', 'diamond'];

// ─── 发牌 ──────────────────────────────────────────

/** 生成一副牌 (52 张，无大小王) */
export function createDeck() {
  const deck = [];
  SUITS.forEach(suit => {
    for (let r = 1; r <= 13; r++) {
      let label = r.toString();
      if (r === 1) label = 'A';
      if (r === 11) label = 'J';
      if (r === 12) label = 'Q';
      if (r === 13) label = 'K';

      let value = r;
      if (r >= 10) value = 10;

      deck.push({
        suit,
        rank: r,
        label,
        value,
        id: `${suit}-${r}`,
        rawId: (r - 1) * 4 + SUITS.indexOf(suit)
      });
    }
  });
  return deck;
}

/** Fisher-Yates 洗牌 */
export function shuffle(deck) {
  let currentIndex = deck.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [deck[currentIndex], deck[randomIndex]] = [deck[randomIndex], deck[currentIndex]];
  }
  return deck;
}

// ─── 服务器牌 ID 转换 ──────────────────────────────

/**
 * 将服务器牌 ID (0-51) 转换为客户端牌对象
 * @param {number|string} serverCardId
 * @returns {{ suit: string, rank: number, label: string, value: number, id: string, rawId: number }}
 */
export function transformServerCard(serverCardId) {
    const cardId = parseInt(serverCardId);
    if (isNaN(cardId) || cardId < 0 || cardId > 51) {
        return { suit: 'unknown', rank: 0, value: 0, label: '?', id: `ph-${serverCardId}` };
    }

    const rank = Math.floor(cardId / 4) + 1;
    const suitIndex = cardId % 4;
    const suit = SUITS[suitIndex];

    let label = rank.toString();
    if (rank === 1) label = 'A';
    else if (rank === 11) label = 'J';
    else if (rank === 12) label = 'Q';
    else if (rank === 13) label = 'K';

    let value = rank;
    if (rank >= 10) value = 10;

    return {
        suit,
        rank,
        label,
        value,
        id: `${suit}-${rank}`,
        rawId: cardId
    };
}

// ─── 简易牌面显示 (百人牛牛等纯文字场景) ────────────

/**
 * 将服务器牌 ID 转为显示用对象 (rank 文字 + suit 符号 + 颜色)
 * @param {number} cardId - 0~51
 * @returns {{ rank: string, suit: string, isRed: boolean }}
 */
export function cardToDisplay(cardId) {
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const suits = ['♦','♣','♥','♠'];
    const rank = Math.floor(cardId / 4);
    const suit = cardId % 4;
    return { rank: ranks[rank], suit: suits[suit], isRed: suit === 0 || suit === 2 };
}

// ─── 牌型计算 ──────────────────────────────────────

/**
 * 牛型名称
 * @param {number|string} niuType - 0=没牛, 1-9=牛N, 10=牛牛, 11=五花牛, 12=炸弹牛, 13=五小牛
 * @returns {string}
 */
export function niuLabel(niuType) {
    if (niuType === 0 || niuType === '') return '没牛';
    if (niuType >= 1 && niuType <= 9) return `牛${niuType}`;
    if (niuType === 10) return '牛牛';
    if (niuType === 11) return '五花牛';
    if (niuType === 12) return '炸弹牛';
    if (niuType === 13) return '五小牛';
    if (niuType === 14) return '四花牛';
    return '';
}

/**
 * 计算 5 张手牌的牛牛牌型
 * @param {Array<{rank:number, value:number}>} cards - 5 张牌
 * @returns {{ type: string, typeName: string, multiplier: number, sortedCards: Array, bullIndices?: number[] }}
 */
export function calculateHandType(cards) {
  if (cards.length !== 5) {
    return { type: 'NO_BULL', typeName: '未知', multiplier: 1, sortedCards: cards };
  }

  // 五小牛 (5 张牌都 < 5，且点数总和 ≤ 10)
  const isFiveSmall = cards.every(c => c.rank < 5);
  if (isFiveSmall) {
      const totalRank = cards.reduce((sum, c) => sum + c.rank, 0);
      if (totalRank <= 10) {
          return { type: 'FIVE_SMALL', typeName: '五小牛', multiplier: 8, sortedCards: cards };
      }
  }

  // 五花牛 (所有牌都是 J/Q/K)
  const isFiveFlower = cards.every(c => c.rank > 10);
  if (isFiveFlower) {
    return { type: 'FIVE_FLOWER', typeName: '五花牛', multiplier: 5, sortedCards: cards };
  }

  // 四花牛 (四张 JQK + 一张 10)
  const jqkCards = cards.filter(c => c.rank >= 11 && c.rank <= 13);
  const tenCards = cards.filter(c => c.rank === 10);
  if (jqkCards.length === 4 && tenCards.length === 1) {
    const sorted = [...jqkCards, ...tenCards];
    return { type: 'FOUR_FLOWER', typeName: '四花牛', multiplier: 4, sortedCards: sorted };
  }

  // 炸弹 (四张点数相同)
  const rankCounts = {};
  cards.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);
  if (Object.values(rankCounts).includes(4)) {
     const bombRank = parseInt(Object.keys(rankCounts).find(key => rankCounts[key] === 4));
     const sorted = [...cards].sort((a, b) => (a.rank === bombRank ? -1 : 1));
     return { type: 'BOMB', typeName: '炸弹', multiplier: 6, sortedCards: sorted };
  }

  // 普通牛型: 枚举任意 3 张牌之和为 10 的倍数
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let k = j + 1; k < 5; k++) {
        const sum = cards[i].value + cards[j].value + cards[k].value;
        if (sum % 10 === 0) {
          const remainingIndices = [0, 1, 2, 3, 4].filter(idx => idx !== i && idx !== j && idx !== k);
          const sumRemainder = cards[remainingIndices[0]].value + cards[remainingIndices[1]].value;
          let bullValue = sumRemainder % 10;
          if (bullValue === 0) bullValue = 10;

          const sorted = [cards[i], cards[j], cards[k], cards[remainingIndices[0]], cards[remainingIndices[1]]];

          let type = 'NO_BULL';
          let typeName = '没牛';
          let multiplier = 1;

          if (bullValue === 10) { type = 'BULL_BULL'; typeName = '牛牛'; multiplier = 4; }
          else if (bullValue === 9) { type = 'BULL_9'; typeName = '牛9'; multiplier = 3; }
          else if (bullValue === 8) { type = 'BULL_8'; typeName = '牛8'; multiplier = 2; }
          else if (bullValue === 7) { type = 'BULL_7'; typeName = '牛7'; multiplier = 2; }
          else { type = `BULL_${bullValue}`; typeName = `牛${bullValue}`; multiplier = 1; }

          return { type, typeName, multiplier, sortedCards: sorted, bullIndices: [i, j, k] };
        }
      }
    }
  }

  return { type: 'NO_BULL', typeName: '没牛', multiplier: 1, sortedCards: cards, bullIndices: [] };
}
