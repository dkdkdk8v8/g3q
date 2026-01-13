// 扑克花色: 'spade', 'heart', 'club', 'diamond'
// 扑克点数 1-13

// 生成一副牌 (52张，无大小王)
export function createDeck() {
  const suits = ['spade', 'heart', 'club', 'diamond'];
  const deck = [];
  
  suits.forEach(suit => {
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
        id: `${suit}-${r}`
      });
    }
  });
  return deck;
}

// 将服务器牌ID (0-51) 转换为客户端牌对象
export function transformServerCard(serverCardId) {
    const id = parseInt(serverCardId);
    if (isNaN(id) || id < 0 || id > 51) {
        // Fallback for invalid ID or placeholder
        return { suit: 'unknown', rank: 0, value: 0, label: '?', id: `ph-${serverCardId}` };
    }

    const suits = ['spade', 'heart', 'club', 'diamond'];
    
    // Calculate Rank (1-13)
    // 0-3 -> 1 (A)
    // 4-7 -> 2
    // ...
    // 48-51 -> 13 (K)
    const rank = Math.floor(id / 4) + 1;
    
    // Calculate Suit Index (0-3)
    // 0 -> 0 (spade), 1 -> 1 (heart), 2 -> 2 (club), 3 -> 3 (diamond)
    const suitIndex = id % 4;
    const suit = suits[suitIndex];

    // Label
    let label = rank.toString();
    if (rank === 1) label = 'A';
    else if (rank === 11) label = 'J';
    else if (rank === 12) label = 'Q';
    else if (rank === 13) label = 'K';

    // Game Value for Bull calculation (10, J, Q, K are 10)
    let value = rank;
    if (rank >= 10) value = 10;

    return {
        suit,
        rank,
        label,
        value,
        id: `${suit}-${rank}` // Consistent with createDeck IDs
    };
}

// 洗牌
export function shuffle(deck) {
  let currentIndex = deck.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [deck[currentIndex], deck[randomIndex]] = [deck[randomIndex], deck[currentIndex]];
  }
  return deck;
}

// 计算牌型
export function calculateHandType(cards) {
  if (cards.length !== 5) {
    return { type: 'NO_BULL', typeName: '未知', multiplier: 1, sortedCards: cards };
  }

  // 0. 检查五小牛 (5张牌都小于5，且点数总和小于等于10)
  const isFiveSmall = cards.every(c => c.rank < 5);
  if (isFiveSmall) {
      const totalRank = cards.reduce((sum, c) => sum + c.rank, 0);
      if (totalRank <= 10) {
          return { type: 'FIVE_SMALL', typeName: '五小牛', multiplier: 8, sortedCards: cards };
      }
  }

  // 1. 检查五花牛 (所有牌都是 J Q K，即 rank > 10)
  // 注意：原逻辑 rank > 10 对应 J(11), Q(12), K(13)。10不算五花。
  const isFiveFlower = cards.every(c => c.rank > 10);
  if (isFiveFlower) {
    return { type: 'FIVE_FLOWER', typeName: '五花牛', multiplier: 5, sortedCards: cards };
  }

  // 2. 检查四花牛 (四张 J Q K, 一张 10)
  const jqKCards = cards.filter(c => c.rank >= 11 && c.rank <= 13); // J, Q, K
  const tenCards = cards.filter(c => c.rank === 10); // 牌面是 10 的牌
  const isFourFlower = (jqKCards.length === 4 && tenCards.length === 1);
  if (isFourFlower) {
    // 排序：四张花牌在前，10在后
    const sorted = [...jqKCards, ...tenCards];
    return { type: 'FOUR_FLOWER', typeName: '四花牛', multiplier: 4, sortedCards: sorted };
  }

  // 3. 检查炸弹 (四张点数一样)
  const rankCounts = {};
  cards.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);
  if (Object.values(rankCounts).includes(4)) {
     // 简单的排序，把炸弹放在前四位
     const bombRank = parseInt(Object.keys(rankCounts).find(key => rankCounts[key] === 4));
     const sorted = [...cards].sort((a, b) => (a.rank === bombRank ? -1 : 1));
     return { type: 'BOMB', typeName: '炸弹', multiplier: 6, sortedCards: sorted };
  }

  // 3. 计算牛牛
  // 找出任意三张牌之和为10的倍数
  let bullValue = 0;
  let hasBull = false;

  // 暴力枚举 3 张牌
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let k = j + 1; k < 5; k++) {
        const sum = cards[i].value + cards[j].value + cards[k].value;
        if (sum % 10 === 0) {
          hasBull = true;
          // 剩下的两张牌
          const remainingIndices = [0, 1, 2, 3, 4].filter(idx => idx !== i && idx !== j && idx !== k);
          const sumRemainder = cards[remainingIndices[0]].value + cards[remainingIndices[1]].value;
          bullValue = sumRemainder % 10;
          if (bullValue === 0) bullValue = 10; // 牛牛
          
          // 排序：配牛的三张在前，剩下的在后
          const sorted = [cards[i], cards[j], cards[k], cards[remainingIndices[0]], cards[remainingIndices[1]]];
          
          let type = 'NO_BULL';
          let typeName = '没牛';
          let multiplier = 1;

          if (bullValue === 10) { type = 'BULL_BULL'; typeName = '牛牛'; multiplier = 4; }
          else if (bullValue === 9) { type = 'BULL_9'; typeName = '牛九'; multiplier = 3; }
          else if (bullValue === 8) { type = 'BULL_8'; typeName = '牛八'; multiplier = 2; }
          else if (bullValue === 7) { type = 'BULL_7'; typeName = '牛七'; multiplier = 2; }
          else { type = `BULL_${bullValue}`; typeName = `牛${bullValue}`; multiplier = 1; }

          return { type, typeName, multiplier, sortedCards: sorted, bullIndices: [i, j, k] };
        }
      }
    }
  }

  // 没牛
  return { type: 'NO_BULL', typeName: '没牛', multiplier: 1, sortedCards: cards, bullIndices: [] };
}
