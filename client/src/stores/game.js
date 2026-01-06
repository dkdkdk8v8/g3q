import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDeck, shuffle, calculateHandType, transformServerCard } from '../utils/bullfight.js'
import gameClient from '../socket.js'
import defaultAvatar from '@/assets/common/default_avatar.png'; // Use import for asset
import { useUserStore } from './user.js';
import router from '../router/index.js';

const QZNN_Prefix = "QZNN."; // 定义QZNN游戏协议前缀
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
    const bankerMult = ref([]); // Store banker multiplier options
    const betMult = ref([]); // Store betting multiplier options
    const playerSpeechQueue = ref([]); // Queue for incoming speech/emoji events
    const roomJoinedPromise = ref(null); // Added for async join completion
    const globalMessage = ref(''); // Global alert message
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
        if (msg.code === 0) {
            // Room data is not returned here anymore. It comes via PushPlayJoin.
            // Just resolve the promise to indicate the request was successful.
            if (roomJoinedResolve) {
                roomJoinedResolve(true); // Resolve the promise on successful join
            }
        } else {
            const errorMsg = msg.msg || 'Failed to join room: Invalid response data.';
            console.error("[GameStore] Join Room Error:", errorMsg, msg);
            if (roomJoinedReject) {
                roomJoinedReject(new Error(errorMsg));
            }
        }
    });

    const updatePlayersList = (serverPlayers, bankerID, currentUserId) => {
        const newPlayers = [];

        // 1. Determine My Server Seat Number based on my permanent ID
        let myServerSeatNum = -1;
        const myPermanentUserId = userStore.userInfo.user_id; // My actual user ID from UserStore

        // Determine my ID for this update cycle. Prioritize:
        // 1. myPermanentUserId (from UserStore - most stable)
        // 2. currentUserId (from push data - e.g., SelfId from PushRouter)
        // 3. existing myPlayerId.value
        let effectiveMyId = myPermanentUserId;
        if (!effectiveMyId) { // If userStore hasn't provided it yet
            effectiveMyId = currentUserId; // Try to use currentUserId from push data
        }
        // If effectiveMyId is still not set or is 'me', and myPlayerId.value holds a valid ID, use it.
        if (effectiveMyId === 'me' || !effectiveMyId) {
            if (myPlayerId.value && myPlayerId.value !== 'me') {
                effectiveMyId = myPlayerId.value;
            }
        }

        // Update the global myPlayerId ref if a new effectiveMyId is found and it's not 'me'
        if (effectiveMyId && effectiveMyId !== 'me' && myPlayerId.value !== effectiveMyId) {
            myPlayerId.value = effectiveMyId;
        }

        // Now, use the established myPlayerId.value to find *me* in serverPlayers
        const meInServer = serverPlayers.find(p => p && p.ID === myPlayerId.value);
        if (meInServer) {
            myServerSeatNum = meInServer.SeatNum;
        } else {
            // If current user (myPlayerId.value) is not in serverPlayers, they are not seated (e.g., observer).
            // Let myServerSeatNum remain -1 (invalid value) for relative seat calculation.
            myServerSeatNum = -1;
        }

        const newPlayersData = [];

        serverPlayers.forEach(p => {
            if (!p) return;

            const clientSeatNum = getClientSeatIndex(myServerSeatNum, p.SeatNum);

            // Map Cards
            let hand = [];
            if (p.Cards && Array.isArray(p.Cards)) {
                hand = p.Cards.map(c => transformServerCard(c));
            }

            // Calculate Hand Result (client-side util)
            let handResult = undefined;
            if (hand.length > 0) {
                const res = calculateHandType(hand);
                // Respect server if it sends result? Assuming local calc for now.
                handResult = { type: res.type, typeName: res.typeName, multiplier: res.multiplier, bullIndices: res.bullIndices };
            }

            newPlayersData.push({
                id: p.ID,
                name: p.NickName && p.NickName.trim() !== '' ? p.NickName : p.ID,
                avatar: DEFAULT_AVATAR,
                coins: p.Balance,
                isBanker: bankerID === p.ID,
                hand: hand,
                handResult: handResult,
                state: 'IDLE', // Default
                robMultiplier: (p.CallMult !== undefined && p.CallMult !== null) ? parseInt(p.CallMult) : -1,
                betMultiplier: (p.BetMult !== undefined && p.BetMult !== null && parseInt(p.BetMult) > 0) ? parseInt(p.BetMult) : 0,
                isShowHand: p.IsShow || false,
                serverSeatNum: p.SeatNum,
                clientSeatNum: clientSeatNum,
                isReady: p.IsReady,
                balanceChange: p.BalanceChange, // Map BalanceChange from server
                roundScore: (p.BalanceChange !== undefined) ? Number(p.BalanceChange) : 0, // Initialize roundScore
                isObserver: p.IsOb || false // Map IsOb from server
            });
        });

        // Merge Strategy: Update existing players to preserve object identity and prevent UI flickers
        const finalPlayers = [];

        newPlayersData.forEach(newData => {
            const existing = players.value.find(p => p.id === newData.id);
            if (existing) {
                // Update simple fields
                existing.name = newData.name;
                existing.coins = newData.coins;
                existing.isBanker = newData.isBanker;
                existing.state = newData.state;
                existing.robMultiplier = newData.robMultiplier;
                existing.betMultiplier = newData.betMultiplier;
                existing.isShowHand = newData.isShowHand;
                existing.serverSeatNum = newData.serverSeatNum;
                existing.clientSeatNum = newData.clientSeatNum;
                existing.isReady = newData.isReady;
                existing.handResult = newData.handResult; // Replace result object
                existing.isObserver = newData.isObserver; // Update isObserver

                // Update roundScore if BalanceChange is provided by server
                if (newData.balanceChange !== undefined) {
                    existing.roundScore = Number(newData.balanceChange);
                }

                // Smart update hand to prevent reactivity trigger if same
                const isHandDifferent = existing.hand.length !== newData.hand.length ||
                    existing.hand.some((c, i) => c.id !== newData.hand[i].id);

                if (isHandDifferent) {
                    existing.hand = newData.hand;
                }

                finalPlayers.push(existing);
            } else {
                // New player
                finalPlayers.push(newData);
            }
        });

        players.value = finalPlayers;
    };
    const handleStateEntry = (phase) => {
        // Specific logic when ENTERING a phase (from a different one)
        if (phase === 'READY_COUNTDOWN') {
            // Reset Round Data
            players.value.forEach(p => {
                p.isBanker = false;
                p.robMultiplier = -1;
                p.betMultiplier = 0;
                p.handResult = undefined;
                p.roundScore = 0;
                p.isShowHand = false;
                p.state = 'IDLE';
                p.hand = [];
            });
            bankerId.value = null;
        } else if (phase === 'BANKER_SELECTION_ANIMATION') {
            // 收到随机抢庄状态，播放全员随机动画
            // 为了保证动画效果（一直播放随机动画），这里直接将所有玩家视为候选人
            // 这样视觉上会在所有人之间跳动，直到 StateBankerConfirm 定格
            let candidates = players.value.filter(p => !p.isObserver);

            bankerCandidates.value = candidates.map(p => p.id);

            // 在随机动画阶段，强制隐藏所有人的庄家标识
            players.value.forEach(p => p.isBanker = false);
        } else if (phase === 'BANKER_CONFIRMED') {
            // 确认庄家阶段，确保庄家标识正确显示
            if (bankerId.value) {
                players.value.forEach(p => {
                    p.isBanker = (p.id === bankerId.value);
                });
            }
        }
    };

    // Universal Push Handler (Replacing specific handlers)
    const handleUniversalPush = (pushType, data) => {
        // console.log(`[GameStore] Universal Push: ${pushType}`, data);

        if (!data) return;

        // Handle Global Message Alert
        if (data.Message && typeof data.Message === 'string' && data.Message.trim() !== '') {
            globalMessage.value = data.Message;
        }

        // Handle PushRouter
        if (pushType === 'PushRouter') {
            if (data.Router) {
                if (data.Router === 'lobby') {
                    // Use replace to avoid back-history issues
                    router.replace('/lobby');
                } else if (data.Router === 'game') {
                    router.replace('/game?autoJoin=true');
                }
            }
            return;
        }

        // Handle PushTalk specifically
        if (pushType === 'PushTalk') {
            if (data.UserId && data.Type !== undefined && data.Index !== undefined) {
                playerSpeechQueue.value.push({
                    userId: data.UserId,
                    type: data.Type,
                    index: data.Index
                });
            }
            return; // PushTalk is self-contained, no need to process general room data further for this pushType
        }
        
        const room = data.Room;

        // 1. Update Room Config & Info
        if (room) {
            if (room.ID) roomId.value = room.ID;
            if (room.BankerID) bankerId.value = room.BankerID; // Sync global bankerId
            if (room.Config) {
                if (room.Config.Name) roomName.value = room.Config.Name;
                if (room.Config.BaseBet !== undefined) baseBet.value = room.Config.BaseBet;
                if (room.Config.BankerType !== undefined) gameMode.value = room.Config.BankerType;
                if (room.Config.BankerMult) bankerMult.value = room.Config.BankerMult;
                if (room.Config.BetMult) betMult.value = room.Config.BetMult;
            }

            // 2. Update Players
            if (room.Players) {
                updatePlayersList(room.Players, room.BankerID, data.SelfId || data.UserId);
            }
        }

        // 3. State Management
        // Priority: top-level data.State > room.State
        let serverState = data.State;
        if (!serverState && room) serverState = room.State;

        // Priority: top-level data.StateLeftSec > room.StateLeftSec
        let leftSec = data.StateLeftSec;
        if (leftSec === undefined && room) leftSec = room.StateLeftSec;
        leftSec = parseInt(leftSec || 0);

        if (serverState) {
            // Normalize "QZNN." prefix
            const normalizedState = serverState.replace('QZNN.', '');

            let targetPhase = null;
            if (normalizedState === 'StateWaiting') targetPhase = 'WAITING_FOR_PLAYERS';
            else if (normalizedState === 'StatePrepare') targetPhase = 'READY_COUNTDOWN';
            else if (normalizedState === 'StateStartGame') targetPhase = 'GAME_START_ANIMATION';
            else if (normalizedState === 'StatePreCard') targetPhase = 'PRE_DEAL';
            else if (normalizedState === 'StateBanking') targetPhase = 'ROB_BANKER';
            else if (normalizedState === 'StateRandomBank') targetPhase = 'BANKER_SELECTION_ANIMATION';
            else if (normalizedState === 'StateBankerConfirm') targetPhase = 'BANKER_CONFIRMED';
            else if (normalizedState === 'StateBetting') targetPhase = 'BETTING';
            else if (normalizedState === 'StateDealing') targetPhase = 'DEALING';
            else if (normalizedState === 'StateShowCard') targetPhase = 'SHOWDOWN';
            else if (normalizedState === 'StateSettling') targetPhase = 'SETTLEMENT';

            if (targetPhase) {
                // 强制修正逻辑：在随机选庄阶段，无论是否多次收到推送，都必须隐藏庄家标识
                if (targetPhase === 'BANKER_SELECTION_ANIMATION') {
                    players.value.forEach(p => p.isBanker = false);
                }

                // 强制修正逻辑：在发牌阶段，如果服务器未发送对手的手牌（为了防作弊），本地需填充占位牌以播放发牌动画
                // 扩展到 SHOWDOWN 阶段，因为可能会瞬间切换到 SHOWDOWN，此时服务器发来的对手牌依然可能是空的（未摊牌）
                if (['DEALING', 'SHOWDOWN'].includes(targetPhase)) {
                    const targetCount = 5;
                    players.value.forEach(p => {
                        if (p.isObserver) return; // Skip observers for placeholder filling

                        if (!p.hand) p.hand = [];
                        if (p.hand.length < targetCount) {
                            const currentLen = p.hand.length;
                            const missing = targetCount - currentLen;
                            for (let i = 0; i < missing; i++) {
                                p.hand.push({
                                    suit: 'unknown',
                                    rank: 0,
                                    value: 0,
                                    label: '?',
                                    id: `ph-${p.id}-${currentLen + i}`
                                });
                            }
                        }
                    });
                }

                // Check if different
                if (currentPhase.value !== targetPhase) {

                    stopAllTimers(); // Stop previous timers
                    currentPhase.value = targetPhase;

                    handleStateEntry(targetPhase);

                    // Start timer for new phase immediately if sec > 0
                    if (['READY_COUNTDOWN', 'ROB_BANKER', 'BETTING', 'SHOWDOWN'].includes(targetPhase)) {
                        if (leftSec > 0) startCountdown(leftSec);
                    }
                } else {
                    // Same Phase: Check if we need to update timer
                    // "StateLeftSec 这个倒计时则就看客户端当前的状态是否有倒计时"
                    if (['READY_COUNTDOWN', 'ROB_BANKER', 'BETTING', 'SHOWDOWN'].includes(targetPhase)) {
                        // Sync timer if needed (e.g. drift > 1s or not running)
                        if (leftSec > 0) {
                            if (!timer || Math.abs(countdown.value - leftSec) > 1) {
                                // console.log(`[GameStore] Sync Timer: ${countdown.value} -> ${leftSec}`);
                                startCountdown(leftSec);
                            }
                        }
                    }
                }
            }
        }
    };

    // Register Global Handler
    gameClient.onGlobalServerPush(handleUniversalPush);

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

        // Start countdown for the 'prepare' phase. After countdown, it will stop at 0.
        startCountdown(5);
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
        if (me && currentPhase.value === 'ROB_BANKER' && !me.isObserver) {
            // me.robMultiplier = multiplier; // Local state update will happen via server push
            // checkAllRobbed(); // Local logic will be replaced by server
            gameClient.send(QZNN_Prefix + "PlayerCallBanker", { RoomId: roomId.value, Mult: multiplier });
        }
    };





    // 玩家操作：下注
    const playerBet = (multiplier) => {
        const me = players.value.find(p => p.id === myPlayerId.value);
        if (me && currentPhase.value === 'BETTING' && !me.isBanker && !me.isObserver) {
            // me.betMultiplier = multiplier; // Local state update will happen via server push
            // checkAllBetted(); // Local logic will be replaced by server
            gameClient.send(QZNN_Prefix + "PlayerPlaceBet", { RoomId: roomId.value, Mult: multiplier });
        }
    };





    // 玩家摊牌动作
    const playerShowHand = (playerId) => {
        const p = players.value.find(pl => pl.id === playerId);
        // Only send if it's my player and they haven't shown hand yet, and it's the SHOWDOWN phase
        if (p && p.id === myPlayerId.value && !p.isShowHand && currentPhase.value === 'SHOWDOWN') {
            gameClient.send(QZNN_Prefix + "PlayerShowCard", { RoomId: roomId.value, IsShow: true });
        }
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





    const enterStateBanking = () => {
        stopAllTimers();
        currentPhase.value = 'ROB_BANKER';
        startCountdown(5);
    };

    const enterStateRandomBank = () => {
        stopAllTimers();
        // Force everyone's robMultiplier to 0 (or random equality)
        players.value.forEach(p => p.robMultiplier = 0);

        // Set all players as candidates for the infinite animation
        bankerCandidates.value = players.value.filter(p => !p.isObserver).map(p => p.id);
        currentPhase.value = 'BANKER_SELECTION_ANIMATION';
        // No timeout here - animation loops until state change
    };

    const enterStateBankerConfirm = () => {
        stopAllTimers();

        // 1. Pick a winner
        let candidates = bankerCandidates.value;
        if (!candidates || candidates.length === 0) {
            candidates = players.value.filter(p => !p.isObserver).map(p => p.id);
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
        startCountdown(5);
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

    const sendPlayerTalk = (type, index) => {
        if (roomId.value) { // Ensure we are in a room
            gameClient.send(QZNN_Prefix + "PlayerTalk", { RoomId: roomId.value, Type: type, Index: index });
        } else {
            console.warn("[GameStore] Cannot send PlayerTalk: Not in a room.");
        }
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
        bankerMult,
        betMult,
        playerSpeechQueue, // Export the new speech queue
        roomJoinedPromise, // Export roomJoinedPromise
        resetState, // Export resetState
        sendPlayerTalk, // Export the new action
        globalMessage, // Export globalMessage
        // Manual Controls
        enterStateWaiting,
        enterStatePrepare,
        enterStateBanking,
        enterStateRandomBank,
        enterStateBankerConfirm,
        enterStateBetting,


    }
})