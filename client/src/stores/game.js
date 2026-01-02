import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDeck, shuffle, calculateHandType } from '../utils/bullfight.js'
import gameClient from '../socket.js'
import defaultAvatar from '@/assets/common/icon_avatar.png'; // Use import for asset
import { useUserStore } from './user.js';

const DEFAULT_AVATAR = defaultAvatar;

/**
 * 根据当前用户的座位号，计算其他玩家在客户端的显示座位索引。
 * 客户端显示座位索引 (0-4) 约定：
 * 0: 底部 (当前用户)
 * 1: 左侧中间
 * 2: 左侧顶部
 * 3: 右侧顶部
 * 4: 右侧中间
 *
 * 服务器座位号 (SeatNum: 0-4) 约定：逆时针顺序
 *
 * @param {number} myServerSeatNum 当前用户在服务器的座位号 (0-4)
 * @param {number} playerServerSeatNum 目标玩家在服务器的座位号 (0-4)
 * @returns {number} 客户端显示座位索引 (0-4)
 */
function getClientSeatIndex(myServerSeatNum, playerServerSeatNum) {
    const numSeats = 5;
    // 计算从当前用户座位到目标玩家座位的顺时针偏移量
    // 例如：如果 myServerSeatNum = 3, playerServerSeatNum = 4
    // (4 - 3 + 5) % 5 = 1 (1个顺时针位移)
    // 例如：如果 myServerSeatNum = 3, playerServerSeatNum = 2
    // (2 - 3 + 5) % 5 = 4 (4个顺时针位移, 相当于1个逆时针位移)
    const clockwiseOffset = (playerServerSeatNum - myServerSeatNum + numSeats) % numSeats;

    switch (clockwiseOffset) {
        case 0: return 0; // 当前用户
        case 1: return 4; // 1个顺时针位移 -> 右侧中间
        case 2: return 3; // 2个顺时针位移 -> 右侧顶部
        case 3: return 2; // 2个逆时针位移 (即3个顺时针位移) -> 左侧顶部
        case 4: return 1; // 1个逆时针位移 (即4个顺时针位移) -> 左侧中间
        default: return -1; // 不应该发生
    }
}

export const useGameStore = defineStore('game', () => {
    const userStore = useUserStore();
    const currentPhase = ref('IDLE'); // IDLE, WAITING_FOR_PLAYERS, READY_COUNTDOWN, MATCHING, ROB_BANKER, BANKER_SELECTION_ANIMATION, BETTING, DEALING, SHOWDOWN, SETTLEMENT, PRE_DEAL, GAME_OVER
    const players = ref([]);
    const myPlayerId = ref('me'); // 模拟当前玩家ID
    const deck = ref([]);
    const countdown = ref(0);
    const bankerId = ref(null);
    const roomId = ref('');
    const roomName = ref('');
    const baseBet = ref(0);
    const gameMode = ref(0); // 0: Bukan, 1: Kan3, 2: Kan4
    const history = ref([]); // 游戏记录
    const bankerCandidates = ref([]); // Store IDs of players who are candidates for banker
    const roomJoinedPromise = ref(null); // Added for async join completion
    let roomJoinedResolve = null;
    let roomJoinedReject = null;

    // Timers
    let timer = null;
    let transitionTimeout = null;

    const stopTimer = () => {
        if (timer) clearInterval(timer);
        timer = null;
        countdown.value = 0;
    };

    const clearTransitionTimeout = () => {
        if (transitionTimeout) clearTimeout(transitionTimeout);
        transitionTimeout = null;
    };

    const stopAllTimers = () => {
        stopTimer();
        clearTransitionTimeout();
    };



    // Capture RoomId from Join response (MOVED TO TOP LEVEL)
    gameClient.on('QZNN.PlayerJoin', (msg) => {
        if (msg.code === 0 && msg.data && msg.data.Room) {
            const room = msg.data.Room;
            if (room.ID) { // Ensure Room ID exists
                roomId.value = room.ID;

                if (room.Config) {
                    roomName.value = room.Config.Name;
                    baseBet.value = room.Config.BaseBet;
                    gameMode.value = room.Config.BankerType;
                }

                // Update My Player ID from User Store
                myPlayerId.value = userStore.userInfo.user_id || 'me';

                // Parse Players from Server
                const serverPlayers = room.Players || [];
                const newPlayers = [];

                // 1. Find myServerSeatNum
                let myServerSeatNum = -1;
                // Ensure myPlayerId.value is set before searching for my seat
                // It's set a few lines above, so it should be fine here.
                const meInServer = serverPlayers.find(p => p && p.ID === myPlayerId.value);
                if (meInServer) {
                    myServerSeatNum = meInServer.SeatNum;
                } else {
                    console.warn("[GameStore] Current user's ID not found in serverPlayers, cannot determine myServerSeatNum.");
                    // Fallback: if user is not in players list, assume a default or handle error.
                    // For now, will proceed with -1, meaning clientSeatNum might be incorrect for all.
                    // This situation should ideally not happen if user successfully joined.
                }

                serverPlayers.forEach(p => {
                    if (!p) return; // Skip null entries

                    // 2. Calculate clientSeatNum
                    const clientSeatNum = (myServerSeatNum !== -1) ? getClientSeatIndex(myServerSeatNum, p.SeatNum) : -1;

                    // Map Cards
                    let hand = [];
                    if (p.Cards && Array.isArray(p.Cards)) {
                        hand = p.Cards.map(c => convertCard(c));
                    }

                    newPlayers.push({
                        id: p.ID,
                        name: p.NickName && p.NickName.trim() !== '' ? p.NickName : p.ID,
                        avatar: DEFAULT_AVATAR, // Server doesn't provide avatar yet
                        coins: p.Balance,
                        isBanker: room.BankerID === p.ID,
                        hand: hand,
                        state: 'IDLE',
                        robMultiplier: p.CallMult,
                        betMultiplier: p.BetMult,

                        isShowHand: p.IsShow || false, // Map Show to isShowHand
                        serverSeatNum: p.SeatNum,      // Store server seat number for debugging/reference
                        clientSeatNum: clientSeatNum,  // Add client seat number
                        // Persist local data if needed?
                    });
                });

                players.value = newPlayers;

                // Sync Phase
                if (room.State === 'QZNN.StateWaiting') {
                    currentPhase.value = 'WAITING_FOR_PLAYERS';
                }
                // Handle other states if reconnecting...

                if (roomJoinedResolve) {
                    roomJoinedResolve(true); // Resolve the promise on successful join
                }
            } else {
                const errorMsg = 'QZNN.PlayerJoin response is missing Room ID.';
                console.error("[GameStore] Join Room Error:", errorMsg, msg);
                if (roomJoinedReject) {
                    roomJoinedReject(new Error(errorMsg));
                }
            }
        } else {
            const errorMsg = msg.msg || 'Failed to join room: Invalid response data.';
            console.error("[GameStore] Join Room Error:", errorMsg, msg);
            if (roomJoinedReject) {
                roomJoinedReject(new Error(errorMsg));
            }
        }
    });

    // 加入房间
    const joinRoom = (level, banker_type) => {
        // Reset state before joining to ensure clean slate
        stopAllTimers();
        players.value = [];
        roomId.value = '';
        roomName.value = '';
        baseBet.value = 0;
        currentPhase.value = 'WAITING_FOR_PLAYERS';
        bankerId.value = null;

        // Create a new promise for this join attempt
        roomJoinedPromise.value = new Promise((resolve, reject) => {
            roomJoinedResolve = resolve;
            roomJoinedReject = reject;
        });

        gameClient.send('QZNN.PlayerJoin', { Level: level, BankerType: banker_type });
        return roomJoinedPromise.value; // Return the promise
    };

    const convertCard = (cardValue) => {
        if (cardValue === -1) return null; // Back of card

        const suits = ['spade', 'heart', 'club', 'diamond'];
        const rankIndex = Math.floor(cardValue / 4);
        const suitIndex = cardValue % 4;

        const rank = rankIndex + 1;
        const suit = suits[suitIndex];

        let label = rank.toString();
        if (rank === 1) label = 'A';
        if (rank === 11) label = 'J';
        if (rank === 12) label = 'Q';
        if (rank === 13) label = 'K';

        let value = rank;
        if (rank >= 10) value = 10;

        return {
            suit,
            rank,
            label,
            value,
            id: `${suit}-${rank}`
        };
    };

    // 初始化（模拟进入房间）
    const initGame = (mode = 0) => {
        // If we already have a room ID (e.g. from joinRoom response arriving before this call), do not wipe state
        // Check if roomId has a non-empty value
        if (roomId.value !== '') {
            return;
        }

        stopAllTimers();
        gameMode.value = parseInt(mode); // Ensure number

        // Temporarily set to 'me' until actual join
        players.value = [];

        currentPhase.value = 'WAITING_FOR_PLAYERS';
        bankerId.value = null;
        roomId.value = ''; // Reset roomId
        roomName.value = '';
        baseBet.value = 0;
    };

    // 玩家操作：准备

    // ...





    // 新的游戏开始入口：进入准备倒计时阶段
    const startGame = () => {
        stopAllTimers();
        // 重置玩家状态 (清理上一局的数据，以便在READY_COUNTDOWN阶段显示干净的状态)
        players.value.forEach(p => {
            p.isBanker = false;
            p.robMultiplier = -1; // -1表示未操作
            p.betMultiplier = 0;
            p.handResult = undefined; // 清理牛几结果
            p.roundScore = 0;
            p.isShowHand = false;
            p.state = 'IDLE'; // Reset state to IDLE for the ready phase
            p.hand = []; // Clear hand
        });

        currentPhase.value = 'READY_COUNTDOWN'; // Keep READY_COUNTDOWN phase for display
        bankerId.value = null; // 重置庄家ID

        // Start countdown for the 'prepare' phase. After countdown, automatically move to ROB_BANKER.
        startCountdown(5, () => {
            // After prepare countdown, automatically proceed to rob banker phase
            currentPhase.value = 'ROB_BANKER';
            // Now start the countdown for robbing, which will eventually call checkAllRobbed.
            startCountdown(5, () => {
                checkAllRobbed();
            });
        });
    };

    // 倒计时辅助
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
            stopTimer();
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

        if (candidates.length > 1) { // If there's a tie, trigger animation
            bankerCandidates.value = candidates.map(p => p.id); // Store IDs for animation
            currentPhase.value = 'BANKER_SELECTION_ANIMATION';

            // Animate selection for 2 seconds, then pick a winner
            transitionTimeout = setTimeout(() => {
                finalizeBanker(candidates);
            }, 2000); // 2 second animation delay
        } else { // No tie, directly select the banker
            finalizeBanker(candidates);
        }
    };

    const finalizeBanker = (candidates) => {
        const winner = candidates[Math.floor(Math.random() * candidates.length)];
        winner.isBanker = true;
        bankerId.value = winner.id;
        currentPhase.value = 'BETTING'; // Transition to betting phase

        bankerCandidates.value = []; // Clear candidates after selection

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
    }

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
            stopTimer();
            startShowdown();
        }
    };

    // Split: Perform Supplemental Deal
    const performSupplementalDeal = () => {
        // 注意：这里需要配合 View 层的动画。View 层可能监听 SHOWDOWN 或 DEALING
        // 为了支持 Manual Dealing 阶段，我们引入 DEALING 状态
        currentPhase.value = 'DEALING';

        players.value.forEach(p => {
            p.state = 'SHOWDOWN'; // Update state label
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
    };

    // Split: Start Showdown Timer
    const startShowdownTimer = () => {
        currentPhase.value = 'SHOWDOWN';
        countdown.value = 0;

        // 模拟其他玩家陆续摊牌 (在倒计时开始后才行动)
        players.value.forEach(p => {
            if (p.id !== myPlayerId.value) {
                // 随机延迟 1-4秒 摊牌
                setTimeout(() => {
                    playerShowHand(p.id);
                }, 1000 + Math.random() * 3000);
            }
        });

        // 摊牌倒计时 5秒
        startCountdown(5, () => {
            // 倒计时结束，强制所有未摊牌的玩家摊牌，并结算
            players.value.forEach(p => {
                if (!p.isShowHand) p.isShowHand = true;
            });
            calculateScore();
        });
    };

    // 阶段：摊牌 (Original Auto Flow)
    const startShowdown = () => {
        stopAllTimers();
        performSupplementalDeal();

        // 等待发牌开始 2.5秒 后，启动摊牌倒计时
        transitionTimeout = setTimeout(() => {
            // 如果动画期间已经全部摊牌结算，不再启动倒计时
            if (currentPhase.value !== 'DEALING' && currentPhase.value !== 'SHOWDOWN') return;
            startShowdownTimer();
        }, 2000);
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
            stopTimer();
            // 稍微停顿一下再结算，让最后一个摊牌动画播完
            transitionTimeout = setTimeout(() => {
                calculateScore();
            }, 500);
        }
    };

    // 结算
    const calculateScore = () => {
        stopAllTimers();
        currentPhase.value = 'SETTLEMENT';
        const banker = players.value.find(p => p.isBanker);

        if (!banker) return; // Safety check

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
            const baseScore = 50;
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
        transitionTimeout = setTimeout(() => {
            currentPhase.value = 'GAME_OVER';
        }, 4000);
    };

    // 辅助：牌型大小评分
    const getHandRankScore = (res) => {
        if (!res) return 0;
        const types = ['NO_BULL', 'BULL_1', 'BULL_2', 'BULL_3', 'BULL_4', 'BULL_5', 'BULL_6', 'BULL_7', 'BULL_8', 'BULL_9', 'BULL_BULL', 'FIVE_FLOWER', 'BOMB'];
        return types.indexOf(res.type);
    };

    // --- MANUAL CONTROL FUNCTIONS ---

    const enterStateWaiting = () => {
        stopAllTimers();
        initGame(gameMode.value);
    };

    const enterStatePrepare = () => {
        stopAllTimers();
        startGame(); // This has internal timer for auto-progression. User can interrupt.
    };

    const enterStatePreCard = () => {
        stopAllTimers();
        performPreDeal();
        // Do not auto-start banking timer
    };

    const enterStateBanking = () => {
        stopAllTimers();
        currentPhase.value = 'ROB_BANKER';
        startRobTimer();
    };

    const enterStateRandomBank = () => {
        stopAllTimers();
        // Force everyone's robMultiplier to 0 (or random equality)
        players.value.forEach(p => p.robMultiplier = 0);

        // Set all players as candidates for the infinite animation
        bankerCandidates.value = players.value.map(p => p.id);
        currentPhase.value = 'BANKER_SELECTION_ANIMATION';
        // No timeout here - animation loops until state change
    };

    const enterStateBankerConfirm = () => {
        stopAllTimers();

        // 1. Pick a winner
        let candidates = bankerCandidates.value;
        if (!candidates || candidates.length === 0) {
            candidates = players.value.map(p => p.id);
        }

        const winnerId = candidates[Math.floor(Math.random() * candidates.length)];
        const winner = players.value.find(p => p.id === winnerId);

        // 2. Set Banker
        players.value.forEach(p => p.isBanker = false);
        if (winner) {
            winner.isBanker = true;
            bankerId.value = winner.id;
        }

        // 3. Clear candidates to stop animation highlighting in View (although phase change does it too)
        bankerCandidates.value = [];

        // 4. Enter Confirmed State
        currentPhase.value = 'BANKER_CONFIRMED';

        // Update states for next phase readiness
        players.value.forEach(p => {
            if (p.id !== winnerId) {
                p.state = 'BETTING';
            } else {
                p.state = 'IDLE';
            }
        });
    };

    const enterStateBetting = () => {
        stopAllTimers();
        // Force Banker if not set?
        if (!bankerId.value) {
            // Randomly pick one if none
            const winner = players.value[0];
            winner.isBanker = true;
            bankerId.value = winner.id;
        }
        currentPhase.value = 'BETTING';
        startCountdown(5, () => {
            // Force bets
            players.value.filter(p => !p.isBanker && p.betMultiplier === 0).forEach(p => p.betMultiplier = 1);
            startShowdown();
        });
    };

    const enterStateDealing = () => {
        stopAllTimers();
        performSupplementalDeal();
        // Do not auto-start showdown timer
    };

    const enterStateShowCard = () => {
        stopAllTimers();
        startShowdownTimer();
    };

    const enterStateSettling = () => {
        stopAllTimers();
        calculateScore();
    };

    const resetState = () => {
        stopAllTimers();
        currentPhase.value = 'IDLE';
        players.value = [];
        bankerId.value = null;
        roomId.value = null;
        deck.value = [];
        bankerCandidates.value = [];
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
        history,
        joinRoom,
        bankerCandidates,
        gameMode,
        roomId,
        roomName,
        baseBet,
        roomJoinedPromise, // Export roomJoinedPromise
        resetState, // Export resetState
        // Manual Controls
        enterStateWaiting,
        enterStatePrepare,
        enterStatePreCard,
        enterStateBanking,
        enterStateRandomBank,
        enterStateBankerConfirm,
        enterStateBetting,
        enterStateDealing,
        enterStateShowCard,
        enterStateSettling
    }
})