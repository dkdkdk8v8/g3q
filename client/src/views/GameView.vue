<script setup>
import { onMounted, computed, onUnmounted, ref, watch } from 'vue';
import { debounce } from '../utils/debounce.js';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';
import PlayerSeat from '../components/PlayerSeat.vue';
import CoinLayer from '../components/CoinLayer.vue';
import DealingLayer from '../components/DealingLayer.vue';
import ChatBubbleSelector from '../components/ChatBubbleSelector.vue';
import { useRouter, useRoute } from 'vue-router';
import { formatCoins } from '../utils/format.js';
import { transformServerCard, calculateHandType } from '../utils/bullfight.js';
import gameClient from '../socket.js';
import { showToast as vantToast } from 'vant';

import talk0 from '@/assets/sounds/talk_0.mp3';
import talk1 from '@/assets/sounds/talk_1.mp3';
import talk2 from '@/assets/sounds/talk_2.mp3';
import talk3 from '@/assets/sounds/talk_3.mp3';
import talk4 from '@/assets/sounds/talk_4.mp3';
import talk5 from '@/assets/sounds/talk_5.mp3';
import talk6 from '@/assets/sounds/talk_6.mp3';
import talk7 from '@/assets/sounds/talk_7.mp3';
import talk8 from '@/assets/sounds/talk_8.mp3';
import talk9 from '@/assets/sounds/talk_9.mp3';
import talk10 from '@/assets/sounds/talk_10.mp3';
import gameBgSound from '@/assets/sounds/game_bg.mp3';
import iconGameStart from '../assets/common/game_start.png';
import gameStartSound from '@/assets/sounds/game_start.mp3';
import gameWinImg from '../assets/common/game_win.png';
import gameLoseImg from '../assets/common/game_lose.png';
import gameWinSound from '@/assets/sounds/game_win.mp3';
import gameLoseSound from '@/assets/sounds/game_lose.mp3';
import sendCardSound from '@/assets/sounds/send_card.mp3';
import randomBankSound from '@/assets/sounds/random_bank.mp3';
import sendCoinSound from '@/assets/sounds/send_coin.mp3';
import countdownSound from '@/assets/sounds/countdown.mp3';
import countdownAlertSound from '@/assets/sounds/countdown_alert.mp3';

const phraseSounds = [
    talk0, talk1, talk2, talk3, talk4, talk5, talk6, talk7, talk8, talk9, talk10
];

const playPhraseSound = (index) => {
    // Check global sound setting
    if (!settingsStore.soundEnabled) return;

    if (index >= 0 && index < phraseSounds.length) {
        const audio = new Audio(phraseSounds[index]);
        audio.play().catch(() => { });
    }
};

const store = useGameStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const route = useRoute();
const coinLayer = ref(null);
const dealingLayer = ref(null);
const seatRefs = ref({}); // 存储所有座位的引用 key: playerId
const tableCenterRef = ref(null); // 桌面中心元素引用
const bgAudio = ref(null);
const startAnimationClass = ref('');
const showStartAnim = ref(false);
const resultImage = ref('');
const resultAnimClass = ref('');
const showResultAnim = ref(false);
const resultTypeClass = ref('');

// Chat/Emoji selector state
const showChatSelector = ref(false);
const showSettings = ref(false);
const playerSpeech = ref(new Map());

// Cooldown mechanism
const lastSpeechTime = ref(0);
const SPEECH_COOLDOWN_SECONDS = 3;
const cooldownMessage = ref('');
const showToast = ref(false);

const checkCooldown = () => {
    const currentTime = Date.now();
    if (currentTime - lastSpeechTime.value < SPEECH_COOLDOWN_SECONDS * 1000) {
        cooldownMessage.value = '您说话太快了，先休息一下吧！';
        showToast.value = true;
        setTimeout(() => {
            showToast.value = false;
        }, 2000);
        return false;
    }
    lastSpeechTime.value = currentTime;
    return true;
};

const onPhraseSelected = (phrase, index) => {
    if (!checkCooldown()) {
        return;
    }
    store.sendPlayerTalk(0, index); // Send PlayerTalk command
    // Local display will be handled by PushTalk from server
    // playPhraseSound(index); // Sound will be triggered by PushTalk
    // playerSpeech.value.set(store.myPlayerId, { type: 'text', content: phrase });
    // setTimeout(() => {
    //     playerSpeech.value.delete(store.myPlayerId);
    // }, 3000);
};

const onEmojiSelected = (emojiUrl, index) => { // Added index parameter
    if (!checkCooldown()) {
        return;
    }
    store.sendPlayerTalk(1, index); // Send PlayerTalk command
    // Local display will be handled by PushTalk from server
    // playerSpeech.value.set(store.myPlayerId, { type: 'emoji', content: emojiUrl });
    // setTimeout(() => {
    //     playerSpeech.value.delete(store.myPlayerId);
    // }, 3000);
};

// Banker selection animation state
const currentlyHighlightedPlayerId = ref(null);
const showBankerConfirmAnim = ref(false); // New state for confirmation animation
const winEffects = ref({}); // Map of playerId -> boolean for win neon effect
let animationIntervalId = null;
let candidateIndex = 0;

// Auto-join message state
const showAutoJoinMessage = ref(false);

// Robot Speech/Emoji Logic Removed (now server-driven)

const commonPhrases = [
    "猜猜我是牛几呀",
    "风水轮流转，底裤都要输光了",
    "辛苦这么多年，一夜回到解放前",
    "我又赢了，谢谢大家送钱",
    "快点开牌，我是牛牛",
    "唉，一手烂牌臭到底",
    "快点吧，我等的花都谢了",
    "吐了个槽的，整个一个杯具啊",
    "你的牌也太好啦",
    "不要吵啦，有什么好吵的，专心玩牌吧",
    "作孽啊"
];

import emoji1 from '@/assets/emoji/emoji_0.png';
import emoji2 from '@/assets/emoji/emoji_1.png';
import emoji3 from '@/assets/emoji/emoji_2.png';
import emoji4 from '@/assets/emoji/emoji_3.png';
import emoji5 from '@/assets/emoji/emoji_4.png';
import emoji6 from '@/assets/emoji/emoji_5.png';
import emoji7 from '@/assets/emoji/emoji_6.png';
import emoji8 from '@/assets/emoji/emoji_7.png';
import emoji9 from '@/assets/emoji/emoji_8.png';
import emoji10 from '@/assets/emoji/emoji_9.png';
import emoji11 from '@/assets/emoji/emoji_10.png';
import emoji12 from '@/assets/emoji/emoji_11.png';
import emoji13 from '@/assets/emoji/emoji_12.png';
import emoji14 from '@/assets/emoji/emoji_13.png';
import emoji15 from '@/assets/emoji/emoji_14.png';
import emoji16 from '@/assets/emoji/emoji_15.png';

const allEmojis = [
    emoji1, emoji2, emoji3, emoji4, emoji5, emoji6, emoji7, emoji8,
    emoji9, emoji10, emoji11, emoji12, emoji13, emoji14, emoji15, emoji16
];

const showMenu = ref(false);
const showHistory = ref(false);
const showHelp = ref(false);

const visibleCounts = ref({});
const dealingCounts = ref({});

const modeName = computed(() => {
    const m = store.gameMode;
    if (m === 0) return '不看牌抢庄';
    if (m === 1) return '看三张抢庄';
    if (m === 2) return '看四张抢庄';
    return '未知玩法';
});

const setSeatRef = (el, playerId) => {
    if (el) {
        seatRefs.value[playerId] = el.$el || el;
    }
};

const myPlayer = computed(() => store.players.find(p => p.id === store.myPlayerId));



watch(() => [...store.playerSpeechQueue], (newQueue) => { // Watch a copy to trigger on push
    if (newQueue.length > 0) {
        const speechEvent = newQueue[0]; // Process the first event in the queue
        const { userId, type, index } = speechEvent;

        // Check for mute users setting - ignore others if muted
        if (settingsStore.muteUsers && userId !== store.myPlayerId) {
            store.playerSpeechQueue.shift();
            return;
        }

        // Play sound if not muted and it's a phrase
        if (settingsStore.soundEnabled && type === 0) {
            playPhraseSound(index);
        }

        // Determine content for display
        let content = '';
        if (type === 0 && commonPhrases[index]) {
            content = commonPhrases[index];
        } else if (type === 1 && allEmojis[index]) {
            content = allEmojis[index];
        } else {
            console.warn(`[GameView] Unknown speech type/index: Type=${type}, Index=${index}`);
            return;
        }

        // Update playerSpeech map for display
        playerSpeech.value.set(userId, { type: type === 0 ? 'text' : 'emoji', content: content });
        playerSpeech.value = new Map(playerSpeech.value); // Trigger reactivity for Map

        // Remove speech bubble after 3 seconds
        setTimeout(() => {
            playerSpeech.value.delete(userId);
            playerSpeech.value = new Map(playerSpeech.value); // Trigger reactivity for Map
        }, 3000);

        // Remove the processed event from the queue
        store.playerSpeechQueue.shift();
    }
}, { deep: true });

// Watch Music Setting
watch(() => settingsStore.musicEnabled, (val) => {
    if (bgAudio.value) {
        if (val) {
            bgAudio.value.play().catch(() => { });
        } else {
            bgAudio.value.pause();
        }
    }
});

const opponentSeats = computed(() => {
    const seats = [null, null, null, null]; // Represents client seats 1, 2, 3, 4

    store.players.forEach(p => {
        // Skip current player, as they are rendered separately
        if (p.id === store.myPlayerId) {
            return;
        }

        // clientSeatNum 1-4 correspond to opponent slots.
        // Map clientSeatNum 1 to seats[0], 2 to seats[1], etc.
        const clientSeatArrayIndex = p.clientSeatNum - 1;

        if (p.clientSeatNum !== undefined && p.clientSeatNum >= 1 && p.clientSeatNum <= 4) {
            seats[clientSeatArrayIndex] = p;
        } else {
            console.warn(`Player ${p.id} has invalid clientSeatNum: ${p.clientSeatNum}`);
        }
    });

    return seats;
});

const getLayoutType = (clientSeatNum) => {
    // clientSeatNum: 1=Middle-Left, 2=Top-Left, 3=Top-Right, 4=Middle-Right
    if (clientSeatNum === 1) return 'left';        // Middle-Left
    if (clientSeatNum === 2) return 'top';         // Top-Left
    if (clientSeatNum === 3) return 'top';         // Top-Right
    if (clientSeatNum === 4) return 'right';       // Middle-Right
    return 'top'; // Fallback
};

const getOpponentClass = (clientSeatNum) => {
    // clientSeatNum: 1=Middle-Left, 2=Top-Left, 3=Top-Right, 4=Middle-Right
    if (clientSeatNum === 1) return 'seat-left';
    if (clientSeatNum === 2) return 'seat-left-top';
    if (clientSeatNum === 3) return 'seat-right-top';
    if (clientSeatNum === 4) return 'seat-right';
    return '';
};

const lastBetStates = ref({});

watch(() => store.players.map(p => ({ id: p.id, bet: p.betMultiplier })), (newVals) => {
    if (!tableCenterRef.value || !coinLayer.value) return;

    const centerRect = tableCenterRef.value.getBoundingClientRect();

    newVals.forEach(p => {
        const oldBet = lastBetStates.value[p.id] || 0;
        if (oldBet === 0 && p.bet > 0) {
            const seatEl = seatRefs.value[p.id];
            if (seatEl) {
                // No animation or sound for placing bet as per user request.
            }
        }
        lastBetStates.value[p.id] = p.bet;
    });
}, { deep: true });

// Watch countdown to play sound effect
watch(() => store.countdown, (newVal, oldVal) => {
    const isCountdownPhase = ['ROB_BANKER', 'BETTING'].includes(store.currentPhase);

    if (settingsStore.soundEnabled && isCountdownPhase && newVal !== oldVal) {
        // Play countdownAlertSound at 2 seconds
        if (newVal === 1) {
            const audio = new Audio(countdownAlertSound);
            audio.play().catch(() => { });
        }
    }
});

watch(() => store.currentPhase, async (newPhase, oldPhase) => {
    if (newPhase === 'IDLE' || newPhase === 'GAME_OVER') {
        visibleCounts.value = {};
        dealingCounts.value = {}; // Reset dealing counts
        lastBetStates.value = {};
    } else if (newPhase === 'GAME_START_ANIMATION') {
        startAnimationClass.value = '';
        showStartAnim.value = true;

        if (settingsStore.soundEnabled) {
            const audio = new Audio(gameStartSound);
            audio.play().catch(() => { });
        }

        setTimeout(() => {
            startAnimationClass.value = 'enter';
        }, 50);

        setTimeout(() => {
            startAnimationClass.value = 'leave';
        }, 1550);

        setTimeout(() => {
            showStartAnim.value = false;
            startAnimationClass.value = '';
        }, 2550);
    } else if (newPhase === 'PRE_DEAL') {
        visibleCounts.value = {};
        dealingCounts.value = {}; // Reset dealing counts
        setTimeout(() => {
            startDealingAnimation();
        }, 100);
    } else if (newPhase === 'ROB_BANKER') {
        if (oldPhase !== 'PRE_DEAL') {
            visibleCounts.value = {};
            dealingCounts.value = {}; // Reset dealing counts
        }
        lastBetStates.value = {};

        // 只有看牌抢庄(mode != 0)才需要在抢庄阶段发牌
        if (store.gameMode !== 0) {
            setTimeout(() => {
                startDealingAnimation(true);
            }, 100);
        }
    } else if (['DEALING', 'SHOWDOWN', 'SETTLEMENT'].includes(newPhase)) { // Changed from SHOWDOWN to DEALING for animation
        setTimeout(() => {
            startDealingAnimation(true);
        }, 100);
    } else if (newPhase === 'BANKER_SELECTION_ANIMATION') {
        const candidates = [...store.bankerCandidates];
        console.log("[GameView] Starting Random Animation with candidates:", candidates);
        if (candidates.length > 0) {
            candidateIndex = 0;
            currentlyHighlightedPlayerId.value = candidates[candidateIndex];

            if (animationIntervalId) clearInterval(animationIntervalId);

            animationIntervalId = setInterval(() => {
                candidateIndex = (candidateIndex + 1) % candidates.length;
                currentlyHighlightedPlayerId.value = candidates[candidateIndex];
                if (settingsStore.soundEnabled) {
                    const audio = new Audio(randomBankSound);
                    audio.play().catch(() => { });
                }
            }, 100);
        }
    }

    if (oldPhase === 'BANKER_SELECTION_ANIMATION' && newPhase !== 'BANKER_SELECTION_ANIMATION') {
        if (animationIntervalId) {
            clearInterval(animationIntervalId);
            animationIntervalId = null;
        }
        currentlyHighlightedPlayerId.value = null;
    }

    if (newPhase === 'BANKER_CONFIRMED') {
        showBankerConfirmAnim.value = true;
        setTimeout(() => {
            showBankerConfirmAnim.value = false;
        }, 1500); // Animation lasts ~1.2s, keep state bit longer to be safe or shorter? CSS is 1.2s. 1.5s is fine.
    }


    if (newPhase === 'SETTLEMENT' && tableCenterRef.value && coinLayer.value) {
        // Trigger Win/Loss Animation
        const me = store.players.find(p => p.id === store.myPlayerId);

        // Activate Neon Flash for winners
        store.players.forEach(p => {
            if (p.roundScore > 0) {
                winEffects.value[p.id] = true;
            }
        });
        // Clear effects after settlement (approx 4s or next phase)
        setTimeout(() => {
            winEffects.value = {};
        }, 5000);

        if (me && !me.isObserver) {
            // Determine result (0 is also win/draw, but typically > 0 is win. Logic says >= 0 is win in display)
            const isWin = me.roundScore >= 0;
            resultImage.value = isWin ? gameWinImg : gameLoseImg;

            if (settingsStore.soundEnabled) {
                const audio = new Audio(isWin ? gameWinSound : gameLoseSound);
                audio.play().catch(() => { });
            }

            showResultAnim.value = true;
            resultAnimClass.value = ''; // Reset class

            setTimeout(() => {
                resultAnimClass.value = 'pop';
            }, 50);

            setTimeout(() => {
                resultAnimClass.value = 'bounce';
            }, 600);

            // Cleanup
            setTimeout(() => {
                showResultAnim.value = false;
                resultAnimClass.value = '';
            }, 4000);
        }

        const banker = store.players.find(p => p.isBanker);
        let bankerRect = null;
        if (banker) {
            const bankerEl = seatRefs.value[banker.id];
            if (bankerEl) {
                const avatarEl = bankerEl.querySelector('.avatar-wrapper'); // Target banker avatar
                bankerRect = avatarEl ? avatarEl.getBoundingClientRect() : bankerEl.getBoundingClientRect();
            }
        }

        if (!bankerRect) {
            bankerRect = tableCenterRef.value.getBoundingClientRect();
        }

        store.players.forEach(p => {
            if (!p.isBanker && p.roundScore < 0) {
                const seatEl = seatRefs.value[p.id];
                if (seatEl) {
                    const avatarEl = seatEl.querySelector('.avatar-wrapper'); // Target avatar specifically
                    const seatRect = avatarEl ? avatarEl.getBoundingClientRect() : seatEl.getBoundingClientRect();

                    let count = Math.ceil(Math.abs(p.roundScore) / 5); // Increased density: div by 5 instead of 20
                    if (count < 10) count = 10; // Min 10
                    if (count > 50) count = 50; // Max 50
                    coinLayer.value.throwCoins(seatRect, bankerRect, count);
                    if (settingsStore.soundEnabled) {
                        const audio = new Audio(sendCoinSound);
                        audio.play().catch(() => { });
                    }
                }
            }
        });

        setTimeout(() => {
            store.players.forEach(p => {
                if (!p.isBanker && p.roundScore > 0) {
                    const seatEl = seatRefs.value[p.id];
                    if (seatEl) {
                        const avatarEl = seatEl.querySelector('.avatar-wrapper'); // Target avatar specifically
                        const seatRect = avatarEl ? avatarEl.getBoundingClientRect() : seatEl.getBoundingClientRect();

                        let count = Math.ceil(p.roundScore / 5); // Increased density: div by 5 instead of 15
                        if (count < 15) count = 15; // Min 15
                        if (count > 60) count = 60; // Max 60
                        coinLayer.value.throwCoins(bankerRect, seatRect, count);
                        if (settingsStore.soundEnabled) {
                            const audio = new Audio(sendCoinSound);
                            audio.play().catch(() => { });
                        }
                    }
                }
            });
        }, 1200);
    }
}, { immediate: true });

const startDealingAnimation = (isSupplemental = false) => {
    if (settingsStore.soundEnabled) {
        const audio = new Audio(sendCardSound);
        audio.play().catch(() => { });
    }

    if (!isSupplemental) {
        visibleCounts.value = {}; // Reset visible counts ONLY if not supplemental
        dealingCounts.value = {}; // Reset dealing counts too
    }

    // Fallback: If dealingLayer is not ready (e.g. immediate watcher on mount), 
    // directly set visible counts to ensure cards are shown without animation.
    if (!dealingLayer.value) {
        store.players.forEach(p => {
            if (p.hand && p.hand.length > 0) {
                visibleCounts.value[p.id] = p.hand.length;
            }
        });
        return;
    }

    const targets = [];
    store.players.forEach(p => {
        if (!p.hand || p.hand.length === 0) return;

        const currentVisible = visibleCounts.value[p.id] || 0;
        const currentDealing = dealingCounts.value[p.id] || 0; // Cards currently flying
        const total = p.hand.length;
        const toDeal = total - currentVisible - currentDealing; // Subtract flying cards

        if (toDeal > 0) {
            // Mark these cards as "in flight" immediately
            if (!dealingCounts.value[p.id]) dealingCounts.value[p.id] = 0;
            dealingCounts.value[p.id] += toDeal;

            const seatEl = seatRefs.value[p.id];
            if (seatEl) {
                const handArea = seatEl.querySelector('.hand-area');
                const rect = handArea ? handArea.getBoundingClientRect() : seatEl.getBoundingClientRect();

                const isMe = p.id === store.myPlayerId;

                targets.push({
                    id: p.id,
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    count: toDeal,
                    startIdx: currentVisible + currentDealing, // Offset by both visible and flying
                    total: total,
                    isMe: isMe
                });
            } else {
                console.warn(`[GameView] No seat ref found for player ${p.id}`);
            }
        }
    });

    if (targets.length === 0) return;

    targets.forEach((t, pIndex) => {
        const cardTargets = [];
        const scale = t.isMe ? 1 : 0.85;
        const spacing = (t.isMe ? 40 : 20) * scale;
        const totalWidth = (t.total - 1) * spacing;
        const startX = t.x - (totalWidth / 2);

        for (let i = 0; i < t.count; i++) {
            const cardIndex = t.startIdx + i;
            const targetX = startX + cardIndex * spacing;
            cardTargets.push({
                x: targetX,
                y: t.y,
                isMe: t.isMe,
                scale: scale,
                index: cardIndex
            });
        }

        setTimeout(() => {
            dealingLayer.value.dealToPlayer(cardTargets, () => {
                if (!visibleCounts.value[t.id]) visibleCounts.value[t.id] = 0;
                visibleCounts.value[t.id] += t.count;

                // Animation finished: remove from flying count
                if (dealingCounts.value[t.id]) {
                    dealingCounts.value[t.id] -= t.count;
                    if (dealingCounts.value[t.id] < 0) dealingCounts.value[t.id] = 0;
                }
            }, isSupplemental && store.gameMode === 2);
        }, pIndex * 80);
    });;
};

onMounted(() => {
    const gameMode = route.query.mode !== undefined ? route.query.mode : 0;
    store.initGame(gameMode);

    if (route.query.autoJoin) {
        // Show prominent message for re-joining
        showAutoJoinMessage.value = true;

        setTimeout(() => {
            showAutoJoinMessage.value = false;
        }, 5000); // 5 seconds duration

        // Remove query param
        router.replace({ query: { ...route.query, autoJoin: undefined } });
    }



    bgAudio.value = new Audio(gameBgSound);
    bgAudio.value.loop = true;
    bgAudio.value.volume = 0.5;

    if (settingsStore.musicEnabled) {
        bgAudio.value.play().catch(() => { });
    }

    // Register handler for PlayerLeave response
    gameClient.on('QZNN.PlayerLeave', (msg) => {
        if (msg.code === 0) {
            router.replace('/lobby');
        } else {
            vantToast(msg.msg || "退出失败");
        }
    });

    // Register latency callback
    gameClient.setLatencyCallback((ms) => {
        networkLatency.value = ms;
    });
});

onUnmounted(() => {
    store.resetState();

    if (bgAudio.value) {
        bgAudio.value.pause();
        bgAudio.value = null;
    }
    gameClient.off('QZNN.PlayerLeave');
    gameClient.setLatencyCallback(null);
});

// Date Filter Logic
const showFilterMenu = ref(false);
const filterType = ref('all'); // 'all', 'today', 'yesterday', 'week', 'custom'
const showDatePicker = ref(false);
const currentDate = ref([]); // Vant 4 DatePicker uses array of strings
const minDate = new Date(new Date().getFullYear() - 2, 0, 1);
const maxDate = new Date();

const filterLabel = computed(() => {
    if (filterType.value === 'all') return '全部';
    if (currentDate.value.length === 3) {
        return `${currentDate.value[0]}-${currentDate.value[1]}-${currentDate.value[2]}`;
    }
    return '自定义';
});

const toggleFilterMenu = () => {
    showFilterMenu.value = !showFilterMenu.value;
};

const selectFilter = (type) => {
    let dateStr = '';
    const now = new Date();

    if (type === 'custom') {
        if (currentDate.value.length === 0) {
            currentDate.value = [
                now.getFullYear().toString(),
                (now.getMonth() + 1).toString().padStart(2, '0'),
                now.getDate().toString().padStart(2, '0')
            ];
        }
        showDatePicker.value = true;
        // Do not fetch yet
    } else {
        // Assume 'all'
        filterType.value = type;
        dateStr = ''; // Empty string for All
        store.fetchHistory({ reset: true, date: dateStr });
    }

    if (typeof showFilterMenu !== 'undefined') {
        showFilterMenu.value = false;
    }
};

const onConfirmDate = ({ selectedValues }) => {
    currentDate.value = selectedValues;
    filterType.value = 'custom';
    showDatePicker.value = false;

    // selectedValues is [year, month, day] strings
    const [y, m, d] = selectedValues;
    // Ensure padding
    const dateStr = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
    store.fetchHistory({ reset: true, date: dateStr });
};

const onCancelDate = () => {
    showDatePicker.value = false;
};

// History Logic
const historyGrouped = computed(() => {
    const groups = [];
    let currentGroup = null;

    // Iterate through store.history which contains mixed Type 0 (Summary) and Type 1 (Record) items
    for (const item of store.history) {
        if (item.Type === 0) {
            // New Group Summary (Daily Header)
            currentGroup = {
                dateStr: item.Date, // e.g., "12月02周5"
                totalBet: item.TotalBet,
                totalValid: item.TotalWinBalance, // Using TotalWinBalance for the "Valid Bet" slot as per UI requirement (or is it actual ValidBet?)
                // User prompt: "TotalWinBalance int64 //总输赢". UI shows "有效投注". 
                // Usually ValidBet is "Effective Bet". But user mapped TotalWinBalance to the summary struct.
                // Let's stick to what the server gives. If the UI label is "有效投注", maybe I should put TotalBet there?
                // The UI has two slots: "投注" and "有效投注".
                // Type 0 has TotalBet and TotalWinBalance.
                // It's possible "Effective Bet" is missing from Type 0, or TotalWinBalance is what user wants to show.
                // Given the prompt: "TotalWinBalance //总输赢", and UI typically shows "Bet" and "Win/Loss".
                // But the UI text says "有效投注" (Valid Bet).
                // Let's use TotalBet for "投注" and TotalWinBalance for the second slot, even if label is "有效投注".
                // Or maybe TotalWinBalance IS the total valid bet? 
                // Let's assume the second slot in the header should display TotalWinBalance (Profit/Loss) as per common history views,
                // despite the class name or label in my previous analysis potentially being "gh-totals".
                // Looking at the UI code: <div class="gh-totals"> 投注 ¥... 有效投注 ¥... </div>
                // If the user wants to show Win/Loss there, the label should probably be "输赢".
                // But if the server provides TotalBet and TotalWinBalance...
                // Let's just map TotalBet -> "投注" and TotalWinBalance -> "有效投注" (or whatever the second field is).
                items: []
            };
            groups.push(currentGroup);
        } else if (item.Type === 1) {
            // Game Record Item
            if (!currentGroup) continue;

            const gdObj = item.GameDataObj;
            // The structure is GameDataObj -> Room -> Players
            // or sometimes direct if not nested (but based on log it is nested under Room)
            const roomData = gdObj.Room || gdObj;

            if (!roomData || !roomData.Players) continue;

            const myData = roomData.Players.find(p => p.ID === store.myPlayerId);
            // If not found, skip or use defaults
            const bet = myData ? (myData.ValidBet || 0) : 0;
            const score = myData ? (myData.BalanceChange || 0) : 0; // Win/Loss

            // Calculate Hand Type
            let handTypeName = '未知';
            if (myData && myData.Cards && Array.isArray(myData.Cards)) {
                const cardObjs = myData.Cards.map(id => transformServerCard(id));
                const typeResult = calculateHandType(cardObjs);
                handTypeName = typeResult.typeName;
            } else if (roomData.State === 'StateBankerConfirm') {
                // If cards are not shown yet (incomplete game in history?), maybe show state
                handTypeName = '未摊牌';
            }

            // Room Name Construction
            let roomName = '抢庄牛牛';
            if (roomData.Config && roomData.Config.Name) {
                roomName += ` | ${roomData.Config.Name}`;
            }

            currentGroup.items.push({
                timestamp: item.CreateAt,
                roomName: roomName,
                handType: handTypeName,
                score: score, // This is Win/Loss
                bet: bet
            });
        }
    }

    return groups;
});

const formatHistoryTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${m}-${d} ${h}:${min}:${s}`;
};

const onRob = debounce((multiplier) => {
    store.playerRob(multiplier);
}, 500);

const onBet = debounce((multiplier) => {
    store.playerBet(multiplier);
}, 500);

const playerShowHandDebounced = debounce((playerId) => {
    store.playerShowHand(playerId);
    selectedCardIndices.value = []; // Immediately restore height
}, 500);

const startGameDebounced = debounce(() => {
    store.startGame();
}, 500);

const openHistoryDebounced = debounce(() => {
    showMenu.value = false;
    showHistory.value = true;
    selectFilter('all'); // Load all history by default
}, 500);

const openSettingsDebounced = debounce(() => {
    showMenu.value = false;
    showSettings.value = true;
}, 500);

const quitGameDebounced = debounce(() => {
    gameClient.send("QZNN.PlayerLeave", { RoomId: store.roomId });
}, 500);

const toggleShowChatSelector = debounce(() => {
    showChatSelector.value = !showChatSelector.value;
}, 500);

const closeHistoryDebounced = debounce(() => {
    showHistory.value = false;
}, 500);

const closeSettingsDebounced = debounce(() => {
    showSettings.value = false;
}, 500);

const openHelpDebounced = debounce(() => {
    showMenu.value = false;
    showHelp.value = true;
}, 500);

const closeHelpDebounced = debounce(() => {
    showHelp.value = false;
}, 500);

const toggleShowMenu = debounce(() => {
    showMenu.value = !showMenu.value;
}, 500);

// Network Latency
const networkLatency = ref(0);
const networkStatusClass = computed(() => {
    if (networkLatency.value < 100) return 'good';
    if (networkLatency.value < 300) return 'fair';
    return 'poor';
});

// Card Calculation Logic
const selectedCardIndices = ref([]);

const handleCardClick = ({ card, index }) => {
    if (store.currentPhase !== 'SHOWDOWN' || (myPlayer.value && myPlayer.value.isShowHand)) return;

    const idxInSelected = selectedCardIndices.value.indexOf(index);
    if (idxInSelected !== -1) {
        // Deselect
        selectedCardIndices.value.splice(idxInSelected, 1);
    } else {
        // Select if less than 3
        if (selectedCardIndices.value.length < 3) {
            selectedCardIndices.value.push(index);
        }
    }
};

const historyListRef = ref(null);

const handleHistoryScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
        if (!store.isLoadingHistory && !store.isHistoryEnd) {
            store.fetchHistory();
        }
    }
};

const calculationData = computed(() => {
    const cards = [];
    let sum = 0;
    const labels = [];

    // Use the order of selection
    selectedCardIndices.value.forEach(idx => {
        if (!myPlayer.value || !myPlayer.value.hand) return;
        const card = myPlayer.value.hand[idx];
        if (card) {
            cards.push(card);
            sum += card.value;
            labels.push(card.label);
        }
    });

    return {
        cards,
        sum,
        labels,
        isFull: cards.length === 3
    };
});

watch(() => store.currentPhase, (newPhase) => {
    selectedCardIndices.value = [];
});

watch(() => myPlayer.value && myPlayer.value.isShowHand, (val) => {
    if (val) {
        selectedCardIndices.value = [];
    }
});
</script>

<template>
    <div class="game-table">
        <img v-if="showStartAnim" :src="iconGameStart" class="game-start-icon" :class="startAnimationClass" />
        <img v-if="showResultAnim" :src="resultImage" class="result-icon" :class="resultAnimClass" />
        <DealingLayer ref="dealingLayer" />
        <CoinLayer ref="coinLayer" />

        <!-- 顶部栏 -->
        <div class="top-bar">
            <div class="menu-container">
                <div class="menu-btn" @click.stop="toggleShowMenu()">
                    <van-icon name="wap-nav" size="20" color="white" />
                    <span style="margin-left:4px;font-size:14px;">菜单</span>
                </div>

                <div class="network-badge" :class="networkStatusClass">
                    <div class="wifi-dot"></div>
                    <span>{{ networkLatency }}ms</span>
                </div>

                <!-- 下拉菜单 -->
                <transition name="fade">
                    <div v-if="showMenu" class="menu-dropdown" @click.stop>
                        <div class="menu-item" @click="openHistoryDebounced()">
                            <van-icon name="balance-list-o" /> 投注记录
                        </div>
                        <div class="menu-divider"></div>
                        <div class="menu-item" @click="openSettingsDebounced()">
                            <van-icon name="setting-o" /> 游戏设置
                        </div>
                        <div class="menu-divider"></div>
                        <div class="menu-item" @click="openHelpDebounced()">
                            <van-icon name="question-o" /> 游戏帮助
                        </div>
                        <div class="menu-divider"></div>
                        <div class="menu-item danger" @click="quitGameDebounced()">
                            <van-icon name="close" /> 退出游戏
                        </div>
                    </div>
                </transition>
            </div>

            <div class="room-info-box">
                <div>房间ID: {{ store.roomId }}</div>
                <div>房间名: {{ store.roomName }}</div>
                <div>底分: {{ formatCoins(store.baseBet) }}</div>
                <div>玩法: {{ modeName }}</div>
            </div>
        </div>

        <div class="opponents-layer">
            <div v-for="(p, index) in opponentSeats" :key="index" class="opponent-seat-abs"
                :class="getOpponentClass(index + 1)">
                <PlayerSeat v-if="p && p.id" :player="p" :ref="(el) => setSeatRef(el, p.id)"
                    :position="getLayoutType(index + 1)"
                    :visible-card-count="visibleCounts[p.id] !== undefined ? visibleCounts[p.id] : 0"
                    :is-ready="p.isReady" :is-animating-highlight="p.id === currentlyHighlightedPlayerId"
                    :speech="playerSpeech.get(p.id)" :trigger-banker-animation="showBankerConfirmAnim && p.isBanker"
                    :is-win="!!winEffects[p.id]" />
                <div v-else class="empty-seat">
                    <div class="empty-seat-avatar">
                        <van-icon name="plus" color="rgba(255,255,255,0.3)" size="20" />
                    </div>
                    <div class="empty-seat-text">等待加入</div>
                </div>
            </div>
        </div>

        <div class="table-center" ref="tableCenterRef">
            <!-- 阶段提示信息容器 -->
            <div v-if="['READY_COUNTDOWN', 'ROB_BANKER', 'BETTING', 'SHOWDOWN', 'BANKER_SELECTION_ANIMATION', 'BANKER_CONFIRMED', 'SETTLEMENT'].includes(store.currentPhase)"
                class="clock-and-info-wrapper">
                <div class="phase-info">
                    <span v-if="store.currentPhase === 'WAITING_FOR_PLAYERS'">匹配玩家中...</span>
                    <span v-else-if="store.currentPhase === 'READY_COUNTDOWN'">游戏即将开始 {{ store.countdown }}</span>
                    <span v-else-if="store.currentPhase === 'ROB_BANKER'">看牌抢庄 {{ store.countdown }}</span>
                    <span v-else-if="store.currentPhase === 'BETTING'">闲家下注 {{ store.countdown }}</span>
                    <span v-else-if="store.currentPhase === 'SHOWDOWN'">摊牌比拼 {{ store.countdown }}</span>
                    <span v-else-if="store.currentPhase === 'BANKER_SELECTION_ANIMATION'">正在选庄...</span>
                    <span v-else-if="store.currentPhase === 'BANKER_CONFIRMED'">庄家已定</span>
                    <span v-else-if="store.currentPhase === 'SETTLEMENT'">结算中...</span>
                </div>
            </div>

            <!-- 重新开始按钮 -->
            <div v-if="store.currentPhase === 'GAME_OVER'" class="restart-btn" @click="startGameDebounced()">
                继续游戏
            </div>
        </div>

        <!-- 自己区域 -->

        <div class="my-area" v-if="myPlayer">
            <div class="controls-container">
                <!-- Auto Join Banner -->
                <transition name="fade">
                    <div v-if="showAutoJoinMessage" class="auto-join-banner">
                        上一局游戏未结束，自动进入此房间
                    </div>
                </transition>


                <div v-if="store.currentPhase === 'ROB_BANKER' && !myPlayer.isObserver && myPlayer.robMultiplier === -1"
                    class="btn-group">
                    <div class="game-btn blue" @click="onRob(0)">不抢</div>
                    <div v-for="mult in store.bankerMult.filter(m => m > 0)" :key="mult" class="game-btn orange"
                        @click="onRob(mult)">
                        {{ mult }}倍
                    </div>
                </div>

                <div v-if="store.currentPhase === 'BETTING' && !myPlayer.isBanker && myPlayer.betMultiplier === 0 && !myPlayer.isObserver"
                    class="btn-group">
                    <div v-for="mult in store.betMult" :key="mult" class="game-btn orange" @click="onBet(mult)">
                        {{ mult }}倍
                    </div>
                </div>

                <div v-if="store.currentPhase === 'BETTING' && myPlayer.isBanker" class="waiting-text">
                    等待闲家下注...
                </div>

                <div v-if="myPlayer.betMultiplier > 0 && store.currentPhase === 'BETTING' && !myPlayer.isBanker && !myPlayer.isObserver"
                    class="waiting-text">
                    已下注，等待开牌...
                </div>

                <!-- 摊牌按钮 -->
                <div v-if="store.currentPhase === 'SHOWDOWN' && !myPlayer.isShowHand && store.countdown > 0 && !myPlayer.isObserver"
                    class="showdown-wrapper">

                    <div class="game-btn orange showdown-btn" @click="playerShowHandDebounced(myPlayer.id)">
                        摊牌
                    </div>

                    <!-- Calculation Formula -->
                    <div class="calc-container">
                        <div class="calc-box">{{ calculationData.labels[0] || '' }}</div>
                        <div class="calc-symbol">+</div>
                        <div class="calc-box">{{ calculationData.labels[1] || '' }}</div>
                        <div class="calc-symbol">+</div>
                        <div class="calc-box">{{ calculationData.labels[2] || '' }}</div>
                        <div class="calc-symbol">=</div>
                        <div class="calc-box result">{{ calculationData.isFull ? calculationData.sum : '' }}</div>
                    </div>
                </div>

                <!-- Observer Waiting Text for Me -->
                <div v-if="myPlayer.isObserver" class="observer-waiting-banner">
                    请耐心等待下一局<span class="loading-dots"></span>
                </div>
            </div>

            <PlayerSeat :player="myPlayer" :is-me="true" :ref="(el) => myPlayer && setSeatRef(el, myPlayer.id)"
                position="bottom"
                :visible-card-count="(myPlayer && visibleCounts[myPlayer.id] !== undefined) ? visibleCounts[myPlayer.id] : 0"
                :is-ready="myPlayer && myPlayer.isReady"
                :is-animating-highlight="myPlayer && myPlayer.id === currentlyHighlightedPlayerId"
                :speech="myPlayer ? playerSpeech.get(myPlayer.id) : null" :selected-card-indices="selectedCardIndices"
                @card-click="handleCardClick"
                :trigger-banker-animation="showBankerConfirmAnim && myPlayer && myPlayer.isBanker"
                :is-win="myPlayer && !!winEffects[myPlayer.id]" />
        </div>

        <!-- 全局点击关闭菜单 -->
        <div v-if="showMenu" class="mask-transparent" @click="toggleShowMenu()"></div>

        <!-- 评论/表情按钮 -->
        <div class="chat-toggle-btn" @click="toggleShowChatSelector()">
            <van-icon name="comment" size="24" color="white" />
        </div>

        <!-- 押注记录弹窗 -->
        <div v-if="showHistory" class="modal-overlay" style="z-index: 8000;">
            <div class="modal-content history-modal">
                <div class="modal-header">
                    <h3>投注记录</h3>
                    <div class="filter-chip" @click.stop="toggleFilterMenu">
                        {{ filterLabel }} <span class="down-triangle" :class="{ 'rotate-180': showFilterMenu }">▼</span>

                        <!-- Filter Menu -->
                        <div v-if="showFilterMenu" class="filter-menu" @click.stop>
                            <div class="filter-menu-item" :class="{ active: filterType === 'all' }"
                                @click="selectFilter('all')">全部</div>
                            <div class="filter-menu-item" :class="{ active: filterType === 'custom' }"
                                @click="selectFilter('custom')">自定义</div>
                        </div>
                    </div>

                    <div class="header-right">
                        <div class="close-icon" @click="closeHistoryDebounced()">×</div>
                    </div>
                </div>

                <div class="history-list-new" ref="historyListRef" @scroll="handleHistoryScroll">
                    <div v-if="!store.isLoadingHistory && historyGrouped.length === 0" class="empty-tip">暂无记录</div>

                    <div v-for="group in historyGrouped" :key="group.dateStr" class="history-group">
                        <div class="group-header">
                            <div class="gh-date">{{ group.dateStr }} <span class="down-triangle">▼</span></div>
                            <div class="gh-totals">
                                投注 ¥{{ formatCoins(group.totalBet) }} &nbsp; 输赢 ¥{{ formatCoins(group.totalValid) }}
                            </div>
                        </div>

                        <div v-for="(item, idx) in group.items" :key="idx" class="history-card">
                            <div class="hc-content">
                                <div class="hc-top-row">
                                    <span class="hc-title">抢庄牛牛 | {{ item.roomName }}</span>
                                    <span class="hc-hand">{{ item.handType }}</span>
                                </div>
                                <div class="hc-bottom-row">
                                    <span class="hc-time">{{ formatHistoryTime(item.timestamp) }}</span>
                                </div>
                            </div>
                            <div class="hc-right">
                                <div class="hc-score" :class="item.score >= 0 ? 'win' : 'lose'">
                                    {{ item.score > 0 ? '+' : '' }}{{ formatCoins(item.score) }}
                                </div>
                                <div class="hc-bet-amt">
                                    投注: ¥{{ formatCoins(item.bet) }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="store.isLoadingHistory" class="loading-more">
                        <van-loading type="spinner" size="24px" color="#cbd5e1">加载中...</van-loading>
                    </div>
                    <div v-if="store.isHistoryEnd && historyGrouped.length > 0" class="loading-more"
                        style="color: #64748b; font-size: 13px;">
                        没有更多了
                    </div>
                </div>

                <!-- Date Picker Popup -->
                <van-popup v-model:show="showDatePicker" position="bottom" :style="{ height: '40%' }" teleport="body"
                    z-index="9000" class="dark-theme-popup">
                    <van-date-picker v-model="currentDate" title="选择日期" :min-date="minDate" :max-date="maxDate"
                        @confirm="onConfirmDate" @cancel="onCancelDate" />
                </van-popup>
            </div>
        </div>

        <!-- Settings Modal -->
        <div v-if="showSettings" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>游戏设置</h3>
                    <div class="close-icon" @click="closeSettingsDebounced()">×</div>
                </div>
                <div class="settings-list">
                    <div class="setting-item">
                        <span>背景音乐</span>
                        <van-switch v-model="settingsStore.musicEnabled" size="24px" active-color="#13ce66"
                            inactive-color="#ff4949" />
                    </div>
                    <div class="setting-item">
                        <span>游戏音效</span>
                        <van-switch v-model="settingsStore.soundEnabled" size="24px" active-color="#13ce66"
                            inactive-color="#ff4949" />
                    </div>
                    <div class="setting-item">
                        <span>屏蔽他人发言</span>
                        <van-switch v-model="settingsStore.muteUsers" size="24px" active-color="#13ce66"
                            inactive-color="#ff4949" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Help Modal -->
        <div v-if="showHelp" class="modal-overlay" style="z-index: 8000;">
            <div class="modal-content help-modal">
                <div class="modal-header">
                    <h3>游戏帮助</h3>
                    <div class="close-icon" @click="closeHelpDebounced()">×</div>
                </div>
                <div class="help-content">
                    <!-- 这个是不看牌抢庄牛牛的基本规则 -->
                    <section v-if="store.gameMode === 0">
                        <h4>基本规则</h4>
                        <p>• <b>抢庄阶段：</b>玩家可以选择“1倍”、“2倍”、“3倍”、“4倍”、“不抢”。抢庄倍数最高的玩家做庄。若多名玩家抢庄最高倍数相同，则携带金币越多的玩家坐庄几率越大，如果所有玩家都不叫分，则系统随机选择一个玩家作为庄家，倍率默认为“1倍”。
                        </p>
                        <p>• <b>加倍阶段：</b>确定庄家后，闲家可以选择“1倍”、“5倍”、“10倍”、“15倍”、“20倍”倍率进行加倍。不选则默认以最小的“1倍”进行加倍。</p>
                        <p>• <b>拼点阶段：</b>发牌之后，玩家可以计算自己的牌型，并选择摊牌。</p>
                        <p>• <b>比牌阶段：</b>每位闲家分别和庄家比较大小，闲家和闲家之间不进行比较。</p>
                    </section>

                    <!-- 这个是看三张抢庄牛牛的基本规则 -->
                    <section v-else-if="store.gameMode === 1">
                        <h4>基本规则</h4>
                        <p>• <b>发牌阶段</b>游戏开始，系统会发给所有玩家三张手牌，并先翻开给玩家看。翻开的三张牌只有玩家自己能看见，无法看见其他人先翻开的三张牌。</p>
                        <p>• <b>抢庄阶段：</b>玩家可以选择“1倍”、“2倍”、“3倍”、“4倍”、“不抢”。抢庄倍数最高的玩家做庄。若多名玩家抢庄最高倍数相同，则携带金币越多的玩家坐庄几率越大，如果所有玩家都不叫分，则系统随机选择一个玩家作为庄家，倍率默认为“1倍”。
                        </p>
                        <p>• <b>加倍阶段：</b>确定庄家后，闲家可以选择“1倍”、“5倍”、“10倍”、“15倍”、“20倍”倍率进行加倍。不选则默认以最小的“1倍”进行加倍。</p>
                        <p>• <b>拼点阶段：</b>投注结束后，系统会发出最后2张牌给各玩家，玩家可以计算自己的牌型，并选择摊牌。</p>
                        <p>• <b>比牌阶段：</b>每位闲家分别和庄家比较大小，闲家和闲家之间不进行比较。</p>
                    </section>

                    <!-- 这个是看四张抢庄牛牛的基本规则 -->
                    <section v-else-if="store.gameMode === 2">
                        <h4>基本规则</h4>
                        <p>• <b>发牌阶段</b>游戏开始，系统会发给所有玩家四张手牌，并先翻开给玩家看。翻开的四张牌只有玩家自己能看见，无法看见其他人先翻开的四张牌。</p>
                        <p>• <b>抢庄阶段：</b>玩家可以选择“1倍”、“2倍”、“3倍”、“4倍”、“不抢”。抢庄倍数最高的玩家做庄。若多名玩家抢庄最高倍数相同，则携带金币越多的玩家坐庄几率越大，如果所有玩家都不叫分，则系统随机选择一个玩家作为庄家，倍率默认为“1倍”。
                        </p>
                        <p>• <b>加倍阶段：</b>确定庄家后，闲家可以选择“1倍”、“5倍”、“10倍”、“15倍”、“20倍”倍率进行加倍。不选则默认以最小的“1倍”进行加倍。</p>
                        <p>• <b>拼点阶段：</b>投注结束后，系统会发出最后1张牌给各玩家，玩家可以计算自己的牌型，并选择摊牌。</p>
                        <p>• <b>比牌阶段：</b>每位闲家分别和庄家比较大小，闲家和闲家之间不进行比较。</p>
                    </section>

                    <section>
                        <h4>牌型</h4>
                        <p>抢庄牛牛游戏中采用一副52张牌，没有大小王。J、Q、K都是10点，其他按照排面的点数计算。</p>
                        <p>• <b>无牛：</b>没有任意三张牌能加起来成为10的倍数。</p>
                        <p>• <b>有牛：</b>从牛一到牛九。任意三张牌相加是10的倍数，剩余两张牌相加不是10的倍数，然后取个位数，各位数是几，就是牛几。</p>
                        <p>• <b>牛牛：</b>任意三张牌相加是10的倍数，剩余2张牌相加也是10的倍数。</p>
                        <p>• <b>四花牛：</b>五张牌中有四张为花牌（J、Q、K）中的任意牌，且第五张为10。</p>
                        <p>• <b>四炸：</b>五张牌中有四张一样的牌即为四炸，此时不需要有牛。</p>
                        <p>• <b>五花牛：</b>手上五张牌全都是J、Q、K组成的特殊牛牛牌型为五花牛。</p>
                        <p>• <b>五小牛：</b>五张牌点数都小于5，且点数之和小于等于10。</p>
                    </section>

                    <section>
                        <h4>牌型比较</h4>
                        <p>• <b>单张大小：</b>从大到小排序为：K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2 > A。</p>
                        <p>• <b>花色大小：</b>花色由大到小排序为：黑桃 <span
                                style="color: black; font-size: 1.3em; text-shadow: 1px 0 0 #aaa, 0 1px 0 #aaa, -1px 0 0 #aaa, 0 -1px 0 #aaa;">♠</span>
                            > 红桃 <span
                                style="color: #ef4444; font-size: 1.3em; text-shadow: 1px 0 0 #aaa, 0 1px 0 #aaa, -1px 0 0 #aaa, 0 -1px 0 #aaa;">♥</span>
                            > 梅花 <span
                                style="color: black; font-size: 1.3em; text-shadow: 1px 0 0 #aaa, 0 1px 0 #aaa, -1px 0 0 #aaa, 0 -1px 0 #aaa;">♣</span>
                            > 方片 <span
                                style="color: #ef4444; font-size: 1.3em; text-shadow: 1px 0 0 #aaa, 0 1px 0 #aaa, -1px 0 0 #aaa, 0 -1px 0 #aaa;">♦</span>。
                        </p>
                        <p>• <b>牌型大小：</b>从大到小排序为：五小牛 > 五花牛 > 四炸 > 四花牛 > 牛牛 > 有牛 > 无牛。</p>
                        <p>• <b>有牛大小：</b>当都为有牛时，从大到小排序为：牛九 > 牛八 > 牛七 > 牛六 > 牛五 > 牛四 > 牛三 > 牛二 > 牛一。</p>
                        <p>• <b>牌型相同：</b>当庄和闲相同牌型时，挑出最大的一张牌进行比较，如果最大牌点数一样，则按花色进行比较。（特例：当有多个四炸时，比较四张相同的牌的点数大小）</p>
                    </section>


                    <section>
                        <h4>结算说明</h4>

                        <h3>赔率</h3>
                        <p>• 无牛到牛六：1倍</p>
                        <p>• 牛七到牛九：2倍</p>
                        <p>• 牛牛：3倍</p>
                        <p>• 四炸：4倍</p>
                        <p>• 五花牛：5倍</p>
                        <p>• 五小牛：5倍</p>

                        <h3>计算公式</h3>
                        <p>• <b>庄家胜利：</b>房间底注 × 庄家牌型倍数 × 庄家抢庄倍数 × 闲家下注倍数。</p>
                        <p>• <b>庄家失败：</b>房间底注 × 闲家牌型倍数 × 庄家抢庄倍数 × 闲家下注倍数。</p>
                        <p>• <b>闲家胜利：</b>房间底注 × 闲家牌型倍数 × 庄家抢庄倍数 × 闲家下注倍数。</p>
                        <p>• <b>闲家失败：</b>房间底注 × 庄家牌型倍数 × 庄家抢庄倍数 × 闲家下注倍数。</p>

                        <h3>结算</h3>
                        <p>• 为了游戏公平，玩家在一局游戏胜利后，赢得的金币总额不会超过身上携带的金币，如某玩家按照游戏规则计算应该赢100金币，但是因为它身上值携带了30金币，所以本局该玩家最多只能赢取30金币，输家按照对应比例相应减少所输的金币。所以如果玩家携带很少的金币进行游戏，很可能会出现赢到的金币低于预期，不够赔付输掉的金币甚至输掉本金的情况，所以强烈建议您携带足够的金币进行游戏。
                        </p>
                        <p>• 在每局游戏中获胜后，系统会收取本局总赢钱金额的5%作为税收。</p>

                    </section>
                </div>
            </div>
        </div>

        <!-- Wrap ChatBubbleSelector to avoid nextSibling error -->
        <div>
            <ChatBubbleSelector v-model:visible="showChatSelector" @selectPhrase="onPhraseSelected"
                @selectEmoji="onEmojiSelected" />
        </div>

        <!-- Cooldown Toast -->
        <transition name="toast-fade">
            <div v-if="showToast" class="cooldown-toast">
                {{ cooldownMessage }}
            </div>
        </transition>
    </div>
</template>

<style scoped>
.game-table {
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at center, #0d9488 0%, #115e59 100%);
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: system-ui, sans-serif;
}

/* Observer Banner Style */
.observer-waiting-banner {
    color: #fef3c7;
    /* Light gold/cream */
    font-size: 16px;
    font-weight: bold;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.7), rgba(17, 24, 39, 0.9), rgba(0, 0, 0, 0.7));
    padding: 10px 30px;
    border-radius: 24px;
    border: 1px solid rgba(251, 191, 36, 0.4);
    /* Gold border */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    margin-bottom: 10px;
}

/* Auto Join Banner Style */
.auto-join-banner {
    position: absolute;
    top: 62%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #fcd34d 0%, #d97706 100%);
    /* Golden gradient */
    color: #4a0404;
    /* Dark red text for contrast */
    font-size: 14px;
    font-weight: bold;
    padding: 15px 30px;
    border-radius: 12px;
    border: 3px solid #fefcbf;
    /* Light yellow border */
    box-shadow: 0 0 20px rgba(202, 169, 62, 0.8), 0 0 30px rgba(211, 177, 65, 0.5);
    /* Glowing effect */
    z-index: 5000;
    text-align: center;
    white-space: nowrap;
    animation: bounce-in 0.8s ease-out;
}

@keyframes bounce-in {
    0% {
        transform: translate(-50%, -150%) scale(0.5);
        opacity: 0;
    }

    70% {
        transform: translate(-50%, -50%) scale(1.1);
        opacity: 1;
    }

    100% {
        transform: translate(-50%, -50%) scale(1);
    }
}



.loading-dots::after {
    content: '...';
    animation: dots-loading 1.5s steps(4, end) infinite;
    display: inline-block;
    vertical-align: bottom;
    overflow: hidden;
    width: 0px;
}

@keyframes dots-loading {
    to {
        width: 1.25em;
    }
}

/* Debug Panel */
.debug-panel {
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    padding: 10px;
    border-radius: 8px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.debug-title {
    color: #fff;
    font-size: 12px;
    margin-bottom: 5px;
    text-align: center;
    cursor: pointer;
    user-select: none;
    padding: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
}

.debug-buttons {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.debug-panel button {
    font-size: 10px;
    padding: 4px;
    cursor: pointer;
    background: #475569;
    color: white;
    border: 1px solid #64748b;
    border-radius: 4px;
}

.debug-panel button:hover {
    background: #64748b;
}

/* 菜单样式 */
.menu-container {
    position: relative;
    z-index: 300;
    display: flex;
    /* Add flex layout */
    align-items: center;
    /* Vertically center */
    gap: 10px;
    /* Space between menu button and network badge */
}

.network-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.3);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.wifi-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #22c55e;
    /* Default green */
    box-shadow: 0 0 4px currentColor;
}

.network-badge.good .wifi-dot {
    background-color: #22c55e;
    color: #22c55e;
}

.network-badge.fair .wifi-dot {
    background-color: #facc15;
    color: #facc15;
}

.network-badge.poor .wifi-dot {
    background-color: #ef4444;
    color: #ef4444;
}

.menu-dropdown {
    position: absolute;
    top: 40px;
    left: 0;
    width: 140px;
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: fadeIn 0.2s ease;
}

.menu-item {
    padding: 12px 16px;
    font-size: 14px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
}

.menu-item:active {
    background: rgba(255, 255, 255, 0.1);
}

.menu-item.danger {
    color: #f87171;
}

.menu-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 8px;
}

.mask-transparent {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 150;
}

/* 弹窗样式 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 8000;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.modal-content {
    width: 85%;
    max-width: 400px;
    max-height: 70vh;
    background: #1e293b;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
}

.close-icon {
    font-size: 24px;
    cursor: pointer;
    color: #94a3b8;
}

.history-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}

.empty-tip {
    text-align: center;
    color: #64748b;
    padding: 20px;
}

.history-item {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 10px;
    color: #cbd5e1;
    font-size: 12px;
}

.settings-list {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px 16px;
    color: white;
    font-size: 16px;
}

.h-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.h-row.bottom {
    margin-bottom: 0;
    color: #64748b;
}

.h-time {
    font-family: monospace;
}

.h-role {
    background: #334155;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
}

.h-role.banker {
    background: #d97706;
    color: white;
}

.h-score {
    font-size: 16px;
    font-weight: bold;
}

.h-score.win {
    color: #facc15;
}

.h-score.lose {
    color: #ef4444;
}

.h-result {
    font-weight: bold;
    margin-right: 6px;
}

.h-result.win {
    color: #facc15;
}

.h-result.lose {
    color: #ef4444;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 顶部栏 */
.top-bar {
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    /* z-index: 200; Removed to avoid trapping children */
    z-index: auto;
}

.menu-btn {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 4px 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    display: flex;
    align-items: center;
}

.menu-container {
    position: relative;
    z-index: 300;
    /* Increased to be above opponents */
}

.room-info-box {
    background: linear-gradient(to bottom, rgba(13, 148, 136, 0.8), rgba(17, 94, 89, 0.8));
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 8px;
    padding: 4px 12px;
    color: #ccfbf1;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    text-align: right;
    position: relative;
    z-index: 100;
    /* Lower than opponents/bubbles */
}

.opponents-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 200;
    /* Above room info, below menu */
}

.opponent-seat-abs {
    position: absolute;
    pointer-events: auto;
    transform: scale(0.85);
}

.seat-right {
    top: 38%;
    /* Adjusted for fixed top alignment */
    right: 10px;
    /* transform: scale(0.85); Removed redundant scale */
}

.seat-right-top {
    top: 15%;
    right: 15%;
}

.seat-left-top {
    top: 15%;
    left: 15%;
}

.seat-left {
    top: 38%;
    /* Adjusted for fixed top alignment */
    left: 10px;
    /* transform: scale(0.85); Removed redundant scale */
}

.empty-seat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100px;
    height: 120px;
    /* Approximate height of a player seat */
    opacity: 0.6;
}

.empty-seat-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.2);
    border: 1px dashed rgba(255, 255, 255, 0.3);
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 4px;
    /* Match PlayerSeat .avatar-area margin-bottom */
}

.empty-seat-text {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    background: rgba(0, 0, 0, 0.2);
    padding: 2px 6px;
    border-radius: 8px;
}

.table-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Removed gap: 10px; as it will be managed by clock-and-info-wrapper */
    width: 200px;
    min-height: 120px;
    /* 允许高度自适应，防止挤压 */
    height: auto;
    pointer-events: none;
    z-index: 1000;
    /* 确保在金币层之下，但需要在发牌层之上吗？不需要，只有闹钟需要 */
}

.clock-and-info-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    /* This handles the 3px distance between clock and phase info */
    pointer-events: auto;
    /* Allow interaction with children if needed */
}

.phase-info {
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.7));
    color: #fbbf24;
    /* Golden text */
    padding: 8px 24px;
    /* Slightly larger padding */
    border-radius: 24px;
    font-size: 16px;
    font-weight: bold;
    margin-top: 10px;
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-bottom: 3px solid rgba(180, 83, 9, 0.8);
    /* Distinct bottom frame/border */
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.6), 0 0 15px rgba(251, 191, 36, 0.2);
    /* Deep shadow + Glow */
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
    min-width: 140px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.phase-tip {
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
}

.my-area {
    margin-top: auto;
    padding-bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
    width: 100%;
}

.controls-container {
    margin-bottom: 20px;
    /* min-height: 50px; */
    /* Removed to fix waiting-text height */
    display: flex;
    justify-content: center;
    width: 100%;
}

.btn-group {
    display: flex;
    gap: 12px;
}

.game-btn {
    width: 70px;
    height: 36px;
    border-radius: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    font-size: 14px;
    color: white;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: transform 0.1s;
}

.game-btn:active {
    transform: translateY(4px);
    box-shadow: none;
}

.game-btn.orange {
    background: linear-gradient(to bottom, #fbbf24, #d97706);
    border: 1px solid #f59e0b;
}

.game-btn.blue {
    background: linear-gradient(to bottom, #60a5fa, #2563eb);
    border: 1px solid #3b82f6;
}

.waiting-text {
    color: #cbd5e1;
    font-size: 14px;
    background: rgba(0, 0, 0, 0.5);
    padding: 4px 12px;
    border-radius: 12px;
}

.restart-btn {
    pointer-events: auto;
    background: linear-gradient(to bottom, #22c55e, #15803d);
    color: white;
    font-size: 20px;
    font-weight: bold;
    padding: 10px 32px;
    border-radius: 25px;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    animation: pulse 2s infinite;
}

.chat-toggle-btn {
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    background: radial-gradient(circle at 30% 30%, #fcd34d 0%, #d97706 100%);
    /* Golden gradient */
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 15px rgba(252, 211, 77, 0.7);
    /* Added subtle glow */
    cursor: pointer;
    z-index: 100;
    border: 2px solid rgba(255, 255, 255, 0.3);
    transition: transform 0.1s;
}

.chat-toggle-btn:active {
    transform: scale(0.95);
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.05);
    }

    100% {
        transform: scale(1);
    }
}

.cooldown-toast {
    position: fixed;
    bottom: 100px;
    /* Position above the chat button */
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 16px;
    z-index: 10001;
    /* Ensure it's on top */
    white-space: nowrap;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
    transition: opacity 0.5s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
    opacity: 0;
}

.game-start-icon {
    position: fixed;
    top: 40%;
    left: -50%;
    transform: translate(-50%, -50%);
    transition: left 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    z-index: 5000;
    pointer-events: none;
    width: 50vw;
    height: auto;
}

.game-start-icon.enter {
    left: 50%;
}

.game-start-icon.leave {
    left: 150%;
    transition: left 0.5s ease-in;
}

.result-icon {
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    width: 70vw;
    height: auto;
    z-index: 6000;
    pointer-events: none;
    transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.result-icon.pop {
    transform: translate(-50%, -50%) scale(1);
}

.result-icon.bounce {
    transform: translate(-50%, -50%) scale(0.666);
}

.showdown-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    /* Stack vertically */
    justify-content: center;
    align-items: center;
    gap: 15px;
    /* Space between button and calculation */
    margin-bottom: 10px;
}

.calc-container {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.5);
    padding: 8px 16px;
    border-radius: 12px;
    /* Removed transform: translateY */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.calc-box {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-weight: bold;
    font-size: 20px;
}

.calc-box.result {
    background: rgba(251, 191, 36, 0.2);
    border-color: #fbbf24;
    color: #fbbf24;
}

.calc-symbol {
    color: white;
    font-weight: bold;
    font-size: 24px;
}

.showdown-btn {
    /* Removed absolute positioning */
    width: 100px;
}

/* History Modal New Styles */
.history-modal {
    background-color: #1e293b;
    /* Match Settings Modal */
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 400px;
    /* Mobile width */
    width: 85%;
    height: 80vh;
    border-radius: 16px;
    /* Full screen-ish on mobile or rectangular */
    overflow: hidden;
}

.history-modal .modal-header {
    background-color: #1e293b;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    padding: 12px 16px;
}

.history-modal .modal-header h3 {
    font-size: 17px;
    font-weight: 500;
}

.header-left,
.header-right {

    display: flex;
    align-items: center;
}

.back-icon {
    font-size: 20px;
    color: #9ca3af;
}

/* Filter bar removed */

.filter-chip {
    background-color: #374151;
    color: #e5e7eb;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 70px;
    justify-content: center;
    cursor: pointer;
    position: relative;
    /* For popup positioning context if needed, though menu is in header */
}

.filter-menu {
    position: absolute;
    top: calc(100% + 8px);
    /* Below the chip with spacing */
    left: 50%;
    transform: translateX(-50%);
    background-color: #334155;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 20;
    overflow: hidden;
    min-width: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.filter-menu-item {
    padding: 10px 16px;
    color: #e5e7eb;
    font-size: 14px;
    text-align: center;
    cursor: pointer;
}

.filter-menu-item:hover {
    background-color: #475569;
}

.filter-menu-item.active {
    color: #facc15;
    background-color: #1e293b;
}

.history-list-new {
    flex: 1;
    overflow-y: auto;
    background-color: #1e293b;
    padding: 0 0 20px;
    /* Removed horizontal padding */
}

.history-group {
    display: flow-root;
}

.group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 18px 18px 18px;
    /* Expanded padding, margin-bottom removed */
    font-size: 12px;
    color: #9ca3af;
    background-color: #0f172a;
    /* border-radius removed */
    width: 100%;
    /* Full width */
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 10;
}

.gh-date {
    font-size: 14px;
    color: #f3f4f6;
    /* White date */
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
}

.down-triangle {
    font-size: 10px;
    color: #9ca3af;
    transition: transform 0.2s ease;
}

.rotate-180 {
    transform: rotate(180deg);
}

.gh-totals {
    font-size: 11px;
}

.history-card {
    background-color: #28374b;
    /* Slightly lighter card bg */
    padding: 12px 12px;
    display: flex;
    align-items: center;
    border-radius: 8px;
    /* Rounded corners */
    margin: 16px 16px;
    /* Added margin */
}

/* Icon wrapper removed */
/* Game icon placeholder removed */

.hc-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.hc-top-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.hc-title {
    font-size: 14px;
    color: #f3f4f6;
    font-weight: 400;
}

.hc-hand {
    font-size: 12px;
    color: #64748b;
    /* Gray */
}

.hc-bottom-row {
    font-size: 12px;
    color: #64748b;
}

.hc-right {
    text-align: right;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.hc-score {
    font-size: 16px;
    font-weight: 500;
}

.hc-score.win {
    color: #fff;
    /* White as per image */
}

.hc-score.lose {
    color: #fff;
    /* White as per image */
}

.hc-bet-amt {
    font-size: 12px;
    color: #64748b;
}

.help-modal {
    background-color: #1e293b;
    color: #e5e7eb;
    max-width: 400px;
    width: 85%;
    max-height: 80vh;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
}

.help-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    text-align: left;
    font-size: 14px;
    line-height: 1.6;
}

.help-content section {
    margin-bottom: 24px;
}

.help-content h4 {
    color: #fbbf24;
    /* Amber-400 */
    font-size: 16px;
    margin-bottom: 12px;
    text-align: center;
    /* Center align */
    position: relative;
    padding-bottom: 8px;
}

.help-content h4::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    /* Short divider */
    height: 1px;
    background-color: rgba(251, 191, 36, 0.5);
    border-radius: 1px;
}

.help-content h3 {
    color: #fbbf24;
    border: 1px solid #fbbf24;
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    margin-top: 16px;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
}

.help-content p {
    margin-bottom: 8px;
    color: #cbd5e1;
}

.help-content b {
    color: #e2e8f0;
}

.loading-more {
    display: flex;
    justify-content: center;
    padding: 10px;
}
</style>

<style>
/* Global styles for Vant components in dark mode */
.dark-theme-popup {
    --van-popup-background: #1e293b;
    --van-picker-background: #1e293b;
    --van-picker-option-text-color: #94a3b8;
    --van-text-color: #e5e7eb;
    --van-picker-mask-color: linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(30, 41, 59, 0.4)), linear-gradient(0deg, rgba(30, 41, 59, 0.9), rgba(30, 41, 59, 0.4));
    --van-border-color: rgba(255, 255, 255, 0.1);
    --van-picker-confirm-action-color: #fbbf24;
    --van-picker-cancel-action-color: #94a3b8;
}

.dark-theme-popup .van-picker__title {
    color: #e5e7eb;
    font-weight: bold;
}

.dark-theme-popup .van-picker-column__item--selected {
    color: #facc15;
    /* Active item color */
    font-weight: bold;
}
</style>