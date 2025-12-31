import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDeck, shuffle, calculateHandType } from '../utils/bullfight.js'

export const useGameStore = defineStore('game', () => {
  const currentPhase = ref('IDLE'); // IDLE, MATCHING, ROB_BANKER, BETTING, DEALING, SHOWDOWN, SETTLEMENT
  const players = ref([]);
  const myPlayerId = ref('me'); // 模拟当前玩家ID
  const deck = ref([]);
  const countdown = ref(0);
  const bankerId = ref(null);

  // 初始化（模拟进入房间）
  const initGame = () => {
    // 模拟4个玩家
    players.value = [
      { id: 'me', name: '我 (帅气)', avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', coins: 1000, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
      { id: 'p2', name: '张三', avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', coins: 1000, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
      { id: 'p3', name: '李四', avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', coins: 800, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
      { id: 'p4', name: '王五', avatar: 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg', coins: 1200, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
    ];
    currentPhase.value = 'IDLE';
    bankerId.value = null;
  };

  // 开始游戏
  const startGame = () => {
    currentPhase.value = 'ROB_BANKER';
    deck.value = shuffle(createDeck());
    
    // 重置玩家状态
    players.value.forEach(p => {
      p.hand = [];
      p.isBanker = false;
      p.robMultiplier = -1;
      p.betMultiplier = 0;
      p.handResult = undefined;
      p.roundScore = 0;
      p.state = 'ROBBING_BANKER';
    });
    
    // 模拟发牌（每人先发4张，最后一张等亮牌）
    // 为了简化，这里一次性生成5张，但在UI上先隐藏最后一张
    players.value.forEach(p => {
      p.hand = deck.value.splice(0, 5);
    });

    startCountdown(5, () => {
       // 倒计时结束，强制不抢
       players.value.filter(p => p.robMultiplier === -1).forEach(p => p.robMultiplier = 0);
       determineBanker();
    });
  };

  // 倒计时辅助
  let timer = null;
  const startCountdown = (seconds, callback) => {
    if (timer) clearInterval(timer);
    countdown.value = seconds;
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(timer);
        if (callback) callback();
      }
    }, 1000);
  };

  // 玩家操作：抢庄
  const playerRob = (multiplier) => {
    const me = players.value.find(p => p.id === myPlayerId.value);
    if (me && currentPhase.value === 'ROB_BANKER') {
      me.robMultiplier = multiplier;
      checkAllRobbed();
    }
  };

  // 检查是否都抢庄完毕
  const checkAllRobbed = () => {
    // 简单模拟其他机器人随机抢庄
    players.value.filter(p => p.id !== myPlayerId.value && p.robMultiplier === -1).forEach(p => {
        if (Math.random() > 0.5) p.robMultiplier = 0; // 一半概率不抢
        else p.robMultiplier = Math.floor(Math.random() * 3) + 1; // 1-3倍
    });

    if (players.value.every(p => p.robMultiplier !== -1)) {
      if (timer) clearInterval(timer);
      determineBanker();
    }
  };

  // 定庄
  const determineBanker = () => {
    // 找出倍数最高的
    const maxMultiplier = Math.max(...players.value.map(p => p.robMultiplier));
    const candidates = players.value.filter(p => p.robMultiplier === maxMultiplier);
    // 随机选一个
    const winner = candidates[Math.floor(Math.random() * candidates.length)];
    
    winner.isBanker = true;
    bankerId.value = winner.id;
    currentPhase.value = 'BETTING';
    
    // 庄家不需要下注，其他人下注
    players.value.forEach(p => {
        if (p.id !== winner.id) {
            p.state = 'BETTING';
        } else {
            p.state = 'IDLE'; // 庄家等待
        }
    });

    startCountdown(5, () => {
        // 强制下注1倍
        players.value.filter(p => !p.isBanker && p.betMultiplier === 0).forEach(p => p.betMultiplier = 1);
        startShowdown();
    });
  };

  // 玩家操作：下注
  const playerBet = (multiplier) => {
     const me = players.value.find(p => p.id === myPlayerId.value);
     if (me && currentPhase.value === 'BETTING' && !me.isBanker) {
         me.betMultiplier = multiplier;
         checkAllBetted();
     }
  };

  const checkAllBetted = () => {
      // 模拟机器人下注
      players.value.filter(p => p.id !== myPlayerId.value && !p.isBanker && p.betMultiplier === 0).forEach(p => {
          p.betMultiplier = Math.floor(Math.random() * 3) + 1;
      });

      if (players.value.filter(p => !p.isBanker).every(p => p.betMultiplier > 0)) {
          if (timer) clearInterval(timer);
          startShowdown();
      }
  };

  // 阶段：摊牌
  const startShowdown = () => {
      currentPhase.value = 'SHOWDOWN';
      players.value.forEach(p => p.state = 'SHOWDOWN');
      
      // 计算每个人的牌型
      players.value.forEach(p => {
          const result = calculateHandType(p.hand);
          p.handResult = { type: result.type, typeName: result.typeName, multiplier: result.multiplier };
          p.hand = result.sortedCards; // 排序方便展示
      });

      // 自动结算倒计时
      startCountdown(5, () => {
          calculateScore();
      });
  };

  // 结算
  const calculateScore = () => {
      currentPhase.value = 'SETTLEMENT';
      const banker = players.value.find(p => p.isBanker);
      
      players.value.forEach(p => {
          if (p.isBanker) return;
          
          // 比较 p 和 banker
          const pRank = getHandRankScore(p.handResult);
          const bRank = getHandRankScore(banker.handResult);

          let win = false;
          if (pRank > bRank) win = true;
          else if (pRank === bRank) {
              // 同牌型比最大牌 (简化：庄家赢)
              win = false;
          }

          // 分数计算 = 底分 * 庄倍数 * 闲倍数 * 牌型倍数(赢家牌型)
          const baseScore = 10;
          const bankerRobM = banker.robMultiplier === 0 ? 1 : banker.robMultiplier; 
          
          let score = 0;
          if (win) {
              score = baseScore * bankerRobM * p.betMultiplier * p.handResult.multiplier;
              p.coins += score;
              p.roundScore = score;
              banker.coins -= score;
              banker.roundScore = (banker.roundScore || 0) - score;
          } else {
              score = baseScore * bankerRobM * p.betMultiplier * banker.handResult.multiplier;
              p.coins -= score;
              p.roundScore = -score;
              banker.coins += score;
              banker.roundScore = (banker.roundScore || 0) + score;
          }
      });
      
      // 3秒后回到准备状态
      setTimeout(() => {
          currentPhase.value = 'IDLE';
      }, 3000);
  };

  // 辅助：牌型大小评分
  const getHandRankScore = (res) => {
     const types = ['NO_BULL', 'BULL_1', 'BULL_2', 'BULL_3', 'BULL_4', 'BULL_5', 'BULL_6', 'BULL_7', 'BULL_8', 'BULL_9', 'BULL_BULL', 'FIVE_FLOWER', 'BOMB'];
     return types.indexOf(res.type);
  };

  return {
    currentPhase,
    players,
    myPlayerId,
    countdown,
    initGame,
    startGame,
    playerRob,
    playerBet,
    bankerId
  }
})
