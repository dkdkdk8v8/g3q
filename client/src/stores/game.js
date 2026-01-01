import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDeck, shuffle, calculateHandType } from '../utils/bullfight.js'

const DEFAULT_AVATAR = new URL('../assets/icon_avatar.png', import.meta.url).href;

export const useGameStore = defineStore('game', () => {
  const currentPhase = ref('IDLE'); // IDLE, MATCHING, ROB_BANKER, BETTING, DEALING, SHOWDOWN, SETTLEMENT
  const players = ref([]);
  const myPlayerId = ref('me'); // 模拟当前玩家ID
  const deck = ref([]);
  const countdown = ref(0);
  const bankerId = ref(null);
  const gameMode = ref(0); // 0: Bukan, 1: Kan3, 2: Kan4
  const history = ref([]); // 游戏记录

  // 初始化（模拟进入房间）
  const initGame = (mode = 0) => {
    gameMode.value = parseInt(mode); // Ensure number
    // 模拟5个玩家 (5人局)
    players.value = [
      { id: 'me', name: '我 (帅气)', avatar: DEFAULT_AVATAR, coins: 1000, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
      { id: 'p2', name: '张三', avatar: DEFAULT_AVATAR, coins: 1000, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
      { id: 'p3', name: '李四', avatar: DEFAULT_AVATAR, coins: 800, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
      { id: 'p4', name: '王五', avatar: DEFAULT_AVATAR, coins: 1200, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
      { id: 'p5', name: '赵六', avatar: DEFAULT_AVATAR, coins: 2000, isBanker: false, hand: [], state: 'IDLE', robMultiplier: -1, betMultiplier: 0 },
    ];
    currentPhase.value = 'IDLE';
    bankerId.value = null;
  };

  // 开始游戏
  const startGame = () => {
    currentPhase.value = 'ROB_BANKER';
    bankerId.value = null; // 重置庄家ID
    deck.value = shuffle(createDeck());
    
    // 重置玩家状态 (清理上一局的数据：牌型、倍数、分数等)
    players.value.forEach(p => {
      p.hand = [];
      p.isBanker = false;
      p.robMultiplier = -1; // -1表示未操作
      p.betMultiplier = 0;
      p.handResult = undefined; // 清理牛几结果
      p.roundScore = 0;
      p.isShowHand = false; 
      p.state = 'ROBBING_BANKER';
    });
    
    // 发牌逻辑差异
    if (gameMode.value === 2) {
        // 看四张抢庄：先发4张
        players.value.forEach(p => {
            p.hand = deck.value.splice(0, 4);
        });
    } else if (gameMode.value === 1) {
        // 看三张抢庄：先发3张
        players.value.forEach(p => {
            p.hand = deck.value.splice(0, 3);
        });
    } else {
        // 不看牌抢庄 (mode 0)：暂时不发牌
        players.value.forEach(p => {
            p.hand = [];
        });
    }

    // 等待发牌动画(约1秒)结束后，再开始倒计时
    setTimeout(() => {
        // 如果在动画期间已经完成了抢庄(比如用户极速操作)，则不再启动倒计时
        if (currentPhase.value !== 'ROB_BANKER') return;

        startCountdown(5, () => {
           // 倒计时结束，强制不抢
           players.value.filter(p => p.robMultiplier === -1).forEach(p => p.robMultiplier = 0);
           determineBanker();
        });
    }, 1200);
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
    // 安全清理：确保没有多余的庄家
    players.value.forEach(p => p.isBanker = false);

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
      players.value.forEach(p => {
          p.state = 'SHOWDOWN';
          p.isShowHand = false;
      });
      
      // 补齐手牌
      players.value.forEach(p => {
          const currentHandSize = p.hand.length;
          const need = 5 - currentHandSize;
          if (need > 0) {
              p.hand.push(...deck.value.splice(0, need));
          }
      });

      // 计算每个人的牌型 (数据先算好，展示由 isShowHand 控制)
      players.value.forEach(p => {
          const result = calculateHandType(p.hand);
          p.handResult = { type: result.type, typeName: result.typeName, multiplier: result.multiplier };
          p.hand = result.sortedCards; // 排序
      });

      // 模拟其他玩家陆续摊牌
      players.value.forEach(p => {
          if (p.id !== myPlayerId.value) {
              // 随机延迟 1-8秒 摊牌
              setTimeout(() => {
                  playerShowHand(p.id);
              }, 1000 + Math.random() * 7000);
          }
      });

      // 等待补牌动画结束后，再开始倒计时
      setTimeout(() => {
          // 如果动画期间已经全部摊牌结算，不再启动倒计时
          if (currentPhase.value !== 'SHOWDOWN') return;

          // 摊牌倒计时 5秒
          startCountdown(5, () => {
              // 倒计时结束，强制所有未摊牌的玩家摊牌，并结算
              players.value.forEach(p => {
                  if (!p.isShowHand) p.isShowHand = true;
              });
              calculateScore();
          });
      }, 1200);
  };

  // 玩家摊牌动作
  const playerShowHand = (playerId) => {
      const p = players.value.find(pl => pl.id === playerId);
      if (p && !p.isShowHand) {
          p.isShowHand = true;
          checkAllShowed();
      }
  };

  // 检查是否都摊牌了
  const checkAllShowed = () => {
      if (players.value.every(p => p.isShowHand)) {
          if (timer) clearInterval(timer);
          // 稍微停顿一下再结算，让最后一个摊牌动画播完
          setTimeout(() => {
              calculateScore();
          }, 500);
      }
  };

  // 结算

  // 结算
  const calculateScore = () => {
      currentPhase.value = 'SETTLEMENT';
      countdown.value = 0; // 强制清除倒计时
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
      
      // 记录本次对局历史 (针对自己)
      const me = players.value.find(p => p.id === myPlayerId.value);
      if (me) {
          let modeName = '不看牌';
          if (gameMode.value === 1) modeName = '看三张';
          if (gameMode.value === 2) modeName = '看四张';

          history.value.unshift({
              timestamp: Date.now(),
              mode: modeName,
              isBanker: me.isBanker,
              handType: me.handResult ? me.handResult.typeName : '未知',
              multiplier: me.handResult ? me.handResult.multiplier : 1,
              score: me.roundScore,
              balance: me.coins
          });
      }

      // 4秒后进入结束状态，等待用户操作下一局
      setTimeout(() => {
          currentPhase.value = 'GAME_OVER';
      }, 4000);
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
    playerShowHand,
    bankerId,
    history
  }
})
