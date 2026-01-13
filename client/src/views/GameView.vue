<script setup>
import { onMounted, computed, onUnmounted, ref, watch } from 'vue';
import { debounce } from '../utils/debounce.js';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';

import CoinLayer from '../components/CoinLayer.vue';
import DealingLayer from '../components/DealingLayer.vue';
import ChatBubbleSelector from '../components/ChatBubbleSelector.vue';
import SettingsModal from '../components/SettingsModal.vue';
import HelpModal from '../components/HelpModal.vue';
import HistoryModal from '../components/HistoryModal.vue';
import { useRouter, useRoute } from 'vue-router';
import { formatCoins } from '../utils/format.js';
import { transformServerCard, calculateHandType } from '../utils/bullfight.js';
import gameClient from '../socket.js';
import { showToast as vantToast } from 'vant';
import PokerCard from '../components/PokerCard.vue';

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
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import goldImg from '@/assets/common/gold.png';
import zhuangImg from '@/assets/common/zhuang.png';
import tanpaiImg from '@/assets/common/tanpai.png';
import gameTopDifenBg from '@/assets/common/game_top_difen_bg.png';

// Niu hand type images
import niu1Img from '@/assets/niu/niu_1.png';
import niu2Img from '@/assets/niu/niu_2.png';
import niu3Img from '@/assets/niu/niu_3.png';
import niu4Img from '@/assets/niu/niu_4.png';
import niu5Img from '@/assets/niu/niu_5.png';
import niu6Img from '@/assets/niu/niu_6.png';
import niu7Img from '@/assets/niu/niu_7.png';
import niu8Img from '@/assets/niu/niu_8.png';
import niu9Img from '@/assets/niu/niu_9.png';
import niuNiuImg from '@/assets/niu/niu_niu.png';
import niuBoomImg from '@/assets/niu/niu_boom.png';
import niuSihuaImg from '@/assets/niu/niu_sihua.png';
import niuWuhuaImg from '@/assets/niu/niu_wuhua.png';
import niuWuxiaoImg from '@/assets/niu/niu_wuxiao.png';
import niuMeiImg from '@/assets/niu/niu_mei.png'; // Add this import

// Multiplier images

const NO_BULL_TYPE_NAME = '没牛'; // New constant
import beishuBuqiangImg from '@/assets/beishu/beishu_buqiang.png';
import beishu1Img from '@/assets/beishu/beishu_1.png';
import beishu2Img from '@/assets/beishu/beishu_2.png';
import beishu3Img from '@/assets/beishu/beishu_3.png';
import beishu4Img from '@/assets/beishu/beishu_4.png';
import beishu5Img from '@/assets/beishu/beishu_5.png';
import beishu10Img from '@/assets/beishu/beishu_10.png';
import beishu15Img from '@/assets/beishu/beishu_15.png';
import beishu20Img from '@/assets/beishu/beishu_20.png';

const handTypeImageMap = {
    '牛1': niu1Img,
    '牛2': niu2Img,
    '牛3': niu3Img,
    '牛4': niu4Img,
    '牛5': niu5Img,
    '牛6': niu6Img,
    '牛7': niu7Img,
    '牛8': niu8Img,
    '牛9': niu9Img,
    '牛牛': niuNiuImg,
    '炸弹': niuBoomImg,
    '四花牛': niuSihuaImg, // Added after modifying bullfight.js
    '五花牛': niuWuhuaImg,
    '五小牛': niuWuxiaoImg,
    [NO_BULL_TYPE_NAME]: niuMeiImg, // Use constant here
    // '没牛' and '未知' will be handled as text or fallback
};

const getHandTypeImageUrl = (handTypeName) => {
    // Normalize handTypeName for lookup
    const normalizedHandTypeName = handTypeName ? handTypeName.trim() : ''; // Add trim for robustness
    return handTypeImageMap[normalizedHandTypeName] || null; // Return null if no image found
};

const multiplierImageMap = {
    0: beishuBuqiangImg, // For '不抢'
    1: beishu1Img,
    2: beishu2Img,
    3: beishu3Img,
    4: beishu4Img,
    5: beishu5Img,
    10: beishu10Img,
    15: beishu15Img,
    20: beishu20Img,
};

const getMultiplierImageUrl = (multiplier) => {
    return multiplierImageMap[multiplier] || null;
};

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

const betMultipliers = computed(() => {
    return (store.betMult || []).sort((a, b) => a - b);
});

const allRobOptions = computed(() => {
    const options = [0, ...(store.bankerMult || [])].filter((value, index, self) => self.indexOf(value) === index).sort((a, b) => a - b);
    return options;
});
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



// PlayerSeat logic for myPlayer (extracted)
const showCards = computed(() => {
    return myPlayer.value && myPlayer.value.hand && myPlayer.value.hand.length > 0;
});

const isDealingProcessing = ref(false);
watch(() => store.currentPhase, (val) => {
    if (val === 'DEALING') {
        isDealingProcessing.value = true;
    } else if (val === 'SHOWDOWN') {
        setTimeout(() => {
            isDealingProcessing.value = false;
        }, 1200);
    } else {
        isDealingProcessing.value = false;
    }
}, { immediate: true });

const shouldShowCardFace = computed(() => {
    if (myPlayer.value && myPlayer.value.id === store.myPlayerId) return true; // Always show self cards
    if (store.currentPhase === 'SETTLEMENT') return true;
    if (store.currentPhase === 'SHOWDOWN' && myPlayer.value && myPlayer.value.isShowHand) return true;
    return false;
});

const enableHighlight = ref(false); // Used by isBullPart
watch(shouldShowCardFace, (val) => {
    if (val) {
        // For 'me' player, no delay needed
        enableHighlight.value = true;
    } else {
        enableHighlight.value = false;
    }
}, { immediate: true });

const isBullPart = (index) => {
    if (!shouldShowCardFace.value) return false;
    if (!myPlayer.value || !myPlayer.value.handResult) return false;

    // If I clicked show hand OR it's settlement
    if (!myPlayer.value.isShowHand && store.currentPhase !== 'SETTLEMENT') {
        return false;
    }

    if (!enableHighlight.value) return false;

    if (store.currentPhase === 'DEALING' || (!myPlayer.value.isShowHand && isDealingProcessing.value)) return false;

    const type = myPlayer.value.handResult.type;
    if (type.startsWith('BULL_') && type !== 'NO_BULL') {
        const indices = myPlayer.value.handResult.bullIndices;
        if (indices && indices.includes(index)) {
            return true;
        }
        return false;
    }
    return false;
};

const shouldShowBadge = ref(false);
let badgeTimer = null;

const badgeTriggerCondition = computed(() => {
    if (!myPlayer.value || !myPlayer.value.handResult) return false;
    // Hide badge during IDLE, READY_COUNTDOWN and GAME_OVER phases
    if (['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)) return false;

    // Unified logic: Show if player has shown hand OR if it is settlement
    return myPlayer.value.isShowHand || store.currentPhase === 'SETTLEMENT';
});

watch(badgeTriggerCondition, (val) => {
    if (badgeTimer) {
        clearTimeout(badgeTimer);
        badgeTimer = null;
    }

    if (val) {
        shouldShowBadge.value = true;
    } else {
        shouldShowBadge.value = false;
    }
}, { immediate: true });

const shouldShowRobMult = computed(() => {
    if (!myPlayer.value) return false;
    // Hide in IDLE or READY phases (new game)
    if (['IDLE', 'READY_COUNTDOWN'].includes(store.currentPhase)) return false;

    // Phase: Robbing Banker or Selection (Show for everyone who has acted)
    if (['ROB_BANKER', 'BANKER_SELECTION_ANIMATION', 'BANKER_CONFIRMED'].includes(store.currentPhase)) {
        return myPlayer.value.robMultiplier > -1;
    }

    // Phase: After Banking (Show only for Banker)
    if (myPlayer.value.isBanker) {
        return true;
    }

    return false;
});

const shouldShowBetMult = computed(() => {
    if (!myPlayer.value) return false;
    // Hide in IDLE or READY phases
    if (['IDLE', 'READY_COUNTDOWN', 'ROB_BANKER', 'BANKER_SELECTION_ANIMATION', 'BANKER_CONFIRMED'].includes(store.currentPhase)) return false;

    // Only show for Non-Banker
    if (myPlayer.value.isBanker) return false;

    // Show if bet is placed
    return myPlayer.value.betMultiplier > 0;
});

const isControlsContentVisible = computed(() => {
    if (!myPlayer.value) return false; // Ensure myPlayer is available

    // Rob Banker Multipliers
    if (store.currentPhase === 'ROB_BANKER' && !myPlayer.value.isObserver && myPlayer.value.robMultiplier === -1) return true;
    // Betting Multipliers
    if (store.currentPhase === 'BETTING' && !myPlayer.value.isBanker && myPlayer.value.betMultiplier === 0 && !myPlayer.value.isObserver) return true;
    // Banker Waiting Text
    if (store.currentPhase === 'BETTING' && myPlayer.value.isBanker) return true;
    // Player Bet Confirmed Waiting Text
    if (myPlayer.value.betMultiplier > 0 && store.currentPhase === 'BETTING' && !myPlayer.value.isBanker && !myPlayer.value.isObserver) return true;
    // Observer Waiting Text
    if (myPlayer.value.isObserver) return true;
    // Showdown Button
    if (store.currentPhase === 'SHOWDOWN' && !myPlayer.value.isShowHand && store.countdown > 0 && !myPlayer.value.isObserver) return true;


    return false;
});

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
    if (clientSeatNum === 2) return 'top-left';    // Top-Left
    if (clientSeatNum === 3) return 'top-right';   // Top-Right
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
    } else if (newPhase === 'DEALING') {
        // Initial Deal: Reset visibleCounts to 0 to prevent flash and start fresh
        store.players.forEach(p => {
            if (p.hand && p.hand.length > 0) {
                visibleCounts.value[p.id] = 0;
            }
        });
        setTimeout(() => {
            startDealingAnimation(false); // isSupplemental = false
        }, 100);
    } else if (['SHOWDOWN', 'SETTLEMENT'].includes(newPhase)) {
        // Supplemental Deal: Do NOT reset visibleCounts, just trigger animation for new cards
        setTimeout(() => {
            startDealingAnimation(true); // isSupplemental = true
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
            }, 200);
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
        // Clear effects after settlement (adjusted to 3.5s)
        setTimeout(() => {
            winEffects.value = {};
        }, 3500);

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
        store.players.forEach(p => {
            if (p.hand && p.hand.length > 0) {
                visibleCounts.value[p.id] = 0;
            }
        });
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

        // Ensure visibleCounts is initialized to 0 if missing, so cards are hidden for animation
        if (visibleCounts.value[p.id] === undefined) {
            visibleCounts.value[p.id] = 0;
        }

        const currentVisible = visibleCounts.value[p.id];
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
        // Scale adjustment: Opponent seats have transform: scale(0.85) in CSS, so we must match that.
        const scale = t.isMe ? 1 : 0.85;

        // Spacing calculation:
        // Me: 60px width + 1px margin = 61px (Scale 1)
        // Opponent: (48px width - 20px overlap) * 0.85 scale = 23.8px
        const spacing = t.isMe ? 61 : 23.8;

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

// Date Filter Logic - Moved to HistoryModal
// History Logic - Moved to HistoryModal


const onRob = debounce((multiplier) => {
    if (settingsStore.soundEnabled) {
        new Audio(btnClickSound).play().catch(() => { });
    }
    store.playerRob(multiplier);
}, 500);

const onBet = debounce((multiplier) => {
    if (settingsStore.soundEnabled) {
        new Audio(btnClickSound).play().catch(() => { });
    }
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
// Speech Bubble Helpers
const getSpeech = (playerId) => playerSpeech.value.get(playerId);

const showSpeechBubble = (playerId) => {
    const s = getSpeech(playerId);
    return s && s.content;
};

const getSpeechBubbleStyle = (playerId) => {
    const s = getSpeech(playerId);
    if (s && s.type === 'text' && s.content) {
        // Assume one Chinese character is roughly 15px wide (per PlayerSeat)
        const charWidth = 15;
        const padding = 20; // Total left/right padding (10px + 10px)
        const textLength = Array.from(s.content).length; // Handle Unicode characters
        let calculatedWidth = (textLength * charWidth) + padding;

        // Cap the width to prevent it from becoming too wide (max 8 chars per line)
        const maxWidthCap = (8 * charWidth) + padding;
        if (calculatedWidth > maxWidthCap) {
            calculatedWidth = maxWidthCap;
        }

        // Ensure a minimum width for very short phrases or emojis if needed (not strictly for text)
        const minWidth = 60; // For small phrases or emojis
        if (calculatedWidth < minWidth) {
            calculatedWidth = minWidth;
        }

        return { width: `${calculatedWidth}px` };
    }
    // For emojis, or if no speech content, let CSS handle default sizing or use a default width
    return { width: 'auto' };
};

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
        </div>

        <!-- Base Bet Display -->
        <div class="base-bet-display" :style="{ '--game-top-difen-bg': 'url(' + gameTopDifenBg + ')' }">
            <span class="bet-amount">底分：</span>
            <img :src="goldImg" class="gold-icon-small" />
            <span class="bet-amount">{{ formatCoins(store.baseBet) }}</span>
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

        <!-- Watermark for Room Name and Mode -->
        <div class="room-mode-watermark">
            {{ store.roomName }}•{{ modeName }}
        </div>

        <!-- 自己区域 -->

        <div class="my-area" v-if="myPlayer" :ref="(el) => setSeatRef(el, myPlayer.id)">
            <!-- 1. Calculation Formula Area -->
            <div v-show="store.currentPhase === 'SHOWDOWN' && !myPlayer.isShowHand && store.countdown > 0 && !myPlayer.isObserver"
                class="showdown-wrapper">
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

            <!-- 2. My Hand Cards Area -->
            <div class="my-hand-cards-area">
                <div class="hand-area">
                    <div class="cards">
                        <PokerCard v-for="(card, idx) in myPlayer.hand" :key="idx"
                            :card="(shouldShowCardFace && (visibleCounts[myPlayer.id] === undefined || idx < visibleCounts[myPlayer.id])) ? card : null"
                            :is-small="false"
                            :class="{ 'hand-card': true, 'bull-card-overlay': isBullPart(idx), 'selected': selectedCardIndices.includes(idx) }"
                            :style="{
                                marginLeft: idx === 0 ? '0' : '1px', /* for myPlayer */
                                opacity: (visibleCounts[myPlayer.id] === undefined || idx < visibleCounts[myPlayer.id]) ? 1 : 0
                            }" @click="handleCardClick({ card, index: idx })" />
                    </div>
                    <!-- Hand Result Badge - adapted from PlayerSeat -->
                    <div v-if="myPlayer.handResult && myPlayer.handResult.typeName && shouldShowBadge"
                        class="hand-result-badge">
                        <img v-if="getHandTypeImageUrl(myPlayer.handResult.typeName)"
                            :src="getHandTypeImageUrl(myPlayer.handResult.typeName)" alt="手牌类型" class="hand-type-img" />
                        <template v-else>TypeName: "{{ myPlayer.handResult.typeName }}" - URL Debug: {{
                            getHandTypeImageUrl(myPlayer.handResult.typeName) || 'null' }}</template>
                    </div>
                </div>
            </div>

            <!-- 3. My Personal Info + Chat Button -->
            <div class="my-player-info-row">
                <!-- Avatar and Info Box - adapted from PlayerSeat -->
                <div class="avatar-area my-player-avatar-info">
                    <div class="avatar-wrapper">
                        <div class="avatar-frame" :class="{
                            'banker-candidate-highlight': myPlayer.id === currentlyHighlightedPlayerId,
                            'banker-confirm-anim': showBankerConfirmAnim && myPlayer.isBanker,
                            'is-banker': myPlayer.isBanker && !['SETTLEMENT', 'GAME_OVER'].includes(store.currentPhase),
                            'win-neon-flash': !!winEffects[myPlayer.id]
                        }">
                            <van-image :src="myPlayer.avatar" class="avatar"
                                :class="{ 'avatar-gray': myPlayer.isObserver }" />
                        </div>

                        <!-- Speech Bubble -->
                        <div v-show="showSpeechBubble(myPlayer.id)" class="speech-bubble"
                            :style="getSpeechBubbleStyle(myPlayer.id)"
                            :class="{ 'speech-visible': showSpeechBubble(myPlayer.id) }">
                            <span v-if="getSpeech(myPlayer.id) && getSpeech(myPlayer.id).type === 'text'">{{
                                getSpeech(myPlayer.id).content }}</span>
                            <img v-else-if="getSpeech(myPlayer.id) && getSpeech(myPlayer.id).type === 'emoji'"
                                :src="getSpeech(myPlayer.id).content" class="speech-emoji" />
                        </div>

                        <!-- Banker Badge -->
                        <div v-if="myPlayer.isBanker && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)"
                            class="banker-badge"><img :src="zhuangImg" alt="庄" class="banker-badge-img" /></div>
                    </div>

                    <div class="info-box" :class="{ 'is-observer': myPlayer.isObserver }">
                        <div class="name van-ellipsis">{{ myPlayer.name.length > 10 ? myPlayer.name.slice(0, 4) + '...'
                            +
                            myPlayer.name.slice(-4) : myPlayer.name }}</div>
                        <div class="coins-pill">
                            <img :src="goldImg" class="coin-icon-seat" />
                            {{ formatCoins(myPlayer.coins) }}
                        </div>
                    </div>

                    <!-- Status float (rob/bet multiplier status) -->
                    <div class="status-float">
                        <Transition name="pop-up">
                            <div v-if="shouldShowRobMult" class="status-content">
                                <span v-if="myPlayer.robMultiplier > 0" class="status-text rob-text text-large">抢{{
                                    myPlayer.robMultiplier
                                    }}倍</span>
                                <span v-else class="status-text no-rob-text text-large">不抢</span>
                            </div>
                        </Transition>

                        <Transition name="pop-up">
                            <div v-if="shouldShowBetMult" class="status-content">
                                <span class="status-text bet-text text-large">押{{ myPlayer.betMultiplier }}倍</span>
                            </div>
                        </Transition>
                    </div>
                </div>

                <!-- Chat button -->
                <div class="chat-toggle-btn" @click="toggleShowChatSelector()">
                    <van-icon name="comment" size="24" color="white" />
                </div>
            </div>

            <!-- 4. Multiplier Options (controls-container) -->
            <div class="controls-container">
                <!-- Auto Join Banner -->
                <transition name="fade">
                    <div v-if="showAutoJoinMessage" class="auto-join-banner">
                        上一局游戏未结束，自动进入此房间
                    </div>
                </transition>

                <!-- Rob Banker Multipliers -->
                <div v-show="store.currentPhase === 'ROB_BANKER' && !myPlayer.isObserver && myPlayer.robMultiplier === -1"
                    class="btn-group-column">
                    <div class="btn-row">
                        <div v-for="mult in allRobOptions.slice(0, 2)" :key="mult" class="multiplier-option-btn"
                            @click="onRob(mult)">
                            <img :src="getMultiplierImageUrl(mult)" :alt="mult === 0 ? '不抢' : `${mult}倍`"
                                class="multiplier-btn-img" />
                        </div>
                    </div>
                    <div class="btn-row">
                        <div v-for="mult in allRobOptions.slice(2)" :key="mult" class="multiplier-option-btn"
                            @click="onRob(mult)">
                            <img :src="getMultiplierImageUrl(mult)" :alt="mult === 0 ? '不抢' : `${mult}倍`"
                                class="multiplier-btn-img" />
                        </div>
                    </div>
                </div>

                <!-- Betting Multipliers -->
                <div v-show="store.currentPhase === 'BETTING' && !myPlayer.isBanker && myPlayer.betMultiplier === 0 && !myPlayer.isObserver"
                    class="btn-group-column">
                    <div class="btn-row">
                        <div v-for="mult in betMultipliers.slice(0, 2)" :key="mult" class="multiplier-option-btn"
                            @click="onBet(mult)">
                            <img :src="getMultiplierImageUrl(mult)" :alt="`${mult}倍`" class="multiplier-btn-img" />
                        </div>
                    </div>
                    <div class="btn-row">
                        <div v-for="mult in betMultipliers.slice(2)" :key="mult" class="multiplier-option-btn"
                            @click="onBet(mult)">
                            <img :src="getMultiplierImageUrl(mult)" :alt="`${mult}倍`" class="multiplier-btn-img" />
                        </div>
                    </div>
                </div>

                <div v-show="store.currentPhase === 'BETTING' && myPlayer.isBanker" class="waiting-text">
                    等待闲家下注...
                </div>

                <!-- Observer Waiting Text -->
                <div v-show="myPlayer.isObserver" class="observer-waiting-banner">
                    请耐心等待下一局<span class="loading-dots"></span>
                </div>

                <!-- NEW: Showdown Button -->
                <div v-show="store.currentPhase === 'SHOWDOWN' && !myPlayer.isShowHand && store.countdown > 0 && !myPlayer.isObserver"
                    class="game-btn showdown-btn" @click="playerShowHandDebounced(myPlayer.id)">
                    <img :src="tanpaiImg" class="showdown-btn-img" alt="摊牌" />
                </div>

                <!-- Placeholder -->
                <div v-show="!isControlsContentVisible" class="controls-placeholder">
                </div>
            </div>
        </div>

        <!-- 全局点击关闭菜单 -->
        <div v-if="showMenu" class="mask-transparent" @click="toggleShowMenu()"></div>

        <!-- Modals -->
        <HistoryModal v-model:visible="showHistory" />

        <SettingsModal v-model:visible="showSettings" />

        <HelpModal v-model:visible="showHelp" :mode="store.gameMode" />

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
    background: url('@/assets/common/game_bg.jpg') no-repeat center center;
    background-size: cover;
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
    padding: 6px 24px;
    border-radius: 24px;
    border: 1px solid rgba(251, 191, 36, 0.4);
    /* Gold border */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    align-self: center;
    /* Prevent stretching */
    justify-content: center;
    backdrop-filter: blur(4px);
    margin-bottom: 10px;
}

/* Auto Join Banner Style */
.auto-join-banner {
    position: absolute;
    top: 52%;
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

.speech-bubble {
    position: absolute;
    bottom: 100%;
    /* Position above avatar */
    left: 50%;
    /* Center horizontally */
    transform: translateX(-50%) translateY(-10px);
    /* Base position for centering and gap */
    opacity: 0;
    /* Initially hidden */
    background: linear-gradient(to bottom, #f9fafb, #e5e7eb);
    /* Light background */
    border: 1px solid #d1d5db;
    border-radius: 12px;
    padding: 6px 10px;
    font-size: 14px;
    color: #333;
    white-space: normal;
    /* Allow normal text wrapping */
    word-break: break-all;
    /* Break long words */
    z-index: 190;
    /* High z-index to be above cards but below modals */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    display: inline-flex;
    /* Use inline-flex for adaptive width */
    align-items: center;
    /* Vertically center content */
    justify-content: center;
    /* Horizontally center content */
    text-align: center;
    /* Center text when wrapped */
    max-width: 170px;
    /* Max width for longer phrases (e.g., 2 lines of ~10 chars + padding) */
    /* animation is now controlled by .speech-visible class */
    transition: opacity 0.3s ease-out;
    /* Smooth fade in/out */
}

.speech-bubble.speech-visible {
    opacity: 1;
    animation: speechBubbleBounceIn 0.3s ease-out forwards;
}

.speech-bubble::before {
    content: '';
    position: absolute;
    top: 100%;
    /* Position at bottom of bubble */
    left: 50%;
    transform: translateX(-50%) translateY(-2px);
    /* Center and overlap slightly */
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 12px solid #e5e7eb;
    /* Tail color matches bubble */
    z-index: 51;
}

.speech-bubble::after {
    content: '';
    position: absolute;
    top: 100%;
    /* Position at bottom of bubble (inner) */
    left: 50%;
    transform: translateX(-50%) translateY(-3px);
    /* Center and overlap slightly */
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    /* Inner tail slightly smaller */
    border-right: 8px solid transparent;
    border-top: 10px solid #f9fafb;
    /* Tail color matches bubble inner */
    z-index: 52;
}

.speech-emoji {
    width: 30px;
    height: 30px;
    object-fit: contain;
}

@keyframes speechBubbleBounceIn {

    from,
    20%,
    40%,
    60%,
    80%,
    to {
        animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
    }

    from {
        /* Maintain base transform, animate scale only */
        transform: translateX(-50%) translateY(-10px) scale3d(0.3, 0.3, 0.3);
    }

    20% {
        transform: translateX(-50%) translateY(-10px) scale3d(1.1, 1.1, 1.1);
    }

    40% {
        transform: translateX(-50%) translateY(-10px) scale3d(0.9, 0.9, 0.9);
    }

    60% {
        transform: translateX(-50%) translateY(-10px) scale3d(1.03, 1.03, 1.03);
    }

    80% {
        transform: translateX(-50%) translateY(-10px) scale3d(0.97, 0.97, 0.97);
    }

    to {
        transform: translateX(-50%) translateY(-10px) scale3d(1, 1, 1);
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
    right: 8%;
}

.seat-left-top {
    top: 15%;
    left: 8%;
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
    top: 36%;
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
    margin-top: 30px;
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

.coin-icon-text {
    width: 14px;
    height: 14px;
    object-fit: contain;
    vertical-align: text-bottom;
    margin: 0 1px;
}

.coin-amount-text {
    color: #fbbf24;
}

/* Base Bet Display */
.base-bet-display {
    position: absolute;
    top: 93px;
    /* Adjust this value as needed based on visual inspection */
    left: 50%;
    transform: translateX(-50%);
    background: var(--game-top-difen-bg) no-repeat center center;
    /* Use CSS variable */
    background-size: contain;
    /* Example width, adjust as needed */
    height: 40px;
    /* Example height, adjust as needed */
    display: flex;
    align-items: center;
    justify-content: center;
    color: #55a773;
    font-size: 14px;
    font-weight: bold;
    z-index: 250;
    font-weight: bold;
    /* Adjust padding to center text within the background image, if image has borders */
    padding: 0 20px;
    box-sizing: border-box;
}

.base-bet-display .gold-icon-small {
    width: 16px;
    /* Adjust size */
    height: 16px;
    object-fit: contain;
    margin-right: 4px;
    margin-left: 4px;
}

.base-bet-display .bet-amount {
    color: #fbbf24;
    /* Amber-400, similar to other coin displays */
    font-weight: bold;
}


.my-area {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
    width: 100%;
}

/* GameView.vue specific styles for myPlayer components */
/* GameView.vue specific styles for myPlayer components */
.my-hand-cards-area {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    margin-top: 10px;
    /* Adjust spacing from element above */
}

/* Hand area styles (adapted from PlayerSeat.vue for myPlayer) */
.my-hand-cards-area .hand-area {
    height: 90px;
    /* For myPlayer cards */
    margin-top: 0;
    /* Increased to move hand cards further up */
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
}

.my-hand-cards-area .cards {
    display: flex;
    justify-content: center;
}

.my-hand-cards-area .hand-card.selected {
    transform: translateY(-10px);
}

.my-hand-cards-area .hand-result-badge {
    position: absolute;
    top: 90%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fbbf24;
    font-size: 14px;
    font-weight: bold;
    white-space: nowrap;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
}

.my-hand-cards-area .hand-type-img {
    height: 40px;
    object-fit: contain;
    vertical-align: middle;
}

.my-player-info-row {
    position: relative;
    /* Anchor for status float */
    display: flex;

    justify-content: space-between;
    /* To push info left and chat right */

    align-items: center;

    width: 95%;

    padding: 0 20px;
    /* Padding for spacing from screen edges */

    margin-top: 10px;
    /* Adjust spacing from element above */

    margin-bottom: 10px;
    /* Adjust spacing from element below */

}

/* Player Info (avatar, name, coins) styles (adapted from PlayerSeat.vue for myPlayer) */
.my-player-info-row .avatar-area {
    position: relative;
    display: flex;
    flex-direction: row;
    /* Horizontal layout for avatar and info-box */
    align-items: center;
    width: auto;
    /* Let it shrink to content */
}

.my-player-info-row .avatar-wrapper {
    position: relative;
    width: 62px;
    height: 62px;
    flex-shrink: 0;
}

.my-player-info-row .avatar-frame {
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    /* Rounded square for myPlayer avatar */
    border: 4px solid transparent;
    box-sizing: border-box;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
}

.my-player-info-row .avatar-frame.banker-candidate-highlight {
    box-shadow: 0 0 15px 5px #facc15, 0 0 8px 2px #d97706;
    border-color: #facc15;
    animation: pulse-border-glow 1s infinite alternate;
}

.my-player-info-row .avatar-frame.is-banker {
    border-color: #fbbf24;
    box-shadow: 0 0 6px #fbbf24;
}

.my-player-info-row .avatar-frame.banker-confirm-anim {
    position: relative;
    z-index: 50;
    animation: bankerConfirmPop 1.2s ease-out forwards;
}

.my-player-info-row .avatar-frame.win-neon-flash {
    animation: neon-flash 0.5s infinite alternate;
    border-color: #ffd700;
}

.my-player-info-row .avatar-frame .van-image {
    width: 100%;
    height: 100%;
}

.my-player-info-row .avatar {
    border: none;
}

.my-player-info-row .avatar-gray {
    filter: grayscale(100%);
    opacity: 0.7;
}

.my-player-info-row .banker-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 24px;
    height: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: radial-gradient(circle at 30% 30%, #fcd34d 0%, #d97706 100%);
    color: #78350f;
    font-size: 14px;
    border-radius: 50%;
    font-weight: bold;
    z-index: 100;
    border: 1px solid #fff;
    box-shadow: 0 0 10px #fbbf24;
    animation: shine 2s infinite;
    transform: translate(50%, 50%);
}

.banker-badge-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Ensure the entire image is visible within the bounds */
}

.my-player-info-row .info-box {
    margin-left: 8px;
    /* Gap between avatar and info */
    position: relative;
    z-index: 5;
    width: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    /* Align name and coins to the left */
}

.my-player-info-row .info-box.is-observer {
    filter: grayscale(100%);
    opacity: 0.6;
}

.my-player-info-row .name {
    font-size: 16px;
    font-weight: bold;
    color: white;
    text-shadow: 0 1px 2px black;
    margin-bottom: 2px;
}

.my-player-info-row .coins-pill {
    background: rgba(0, 0, 0, 0.6);
    border-radius: 20px;
    padding: 2px 5px 2px 2px;
    font-size: 13px;
    font-weight: bold;
    color: #fbbf24;
    display: flex;
    align-items: center;
    gap: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.my-player-info-row .coin-icon-seat {
    width: 18px;
    height: 18px;
    object-fit: contain;
}

.my-player-info-row .status-float {
    position: absolute;
    top: 50%;
    left: 100%;
    transform: translateY(-50%);
    z-index: 8;
    margin-left: 12px;
    width: max-content;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

/* Ensure chat button pushes to the right within my-player-info-row */
.my-player-info-row .chat-toggle-btn {
    margin-left: auto;
    /* Push to the right */
}

.controls-container {
    margin-bottom: 20px;
    min-height: 120px;
    /* Reserve space for multiplier options */
    display: flex;
    justify-content: center;
    width: 100%;
}

.controls-placeholder {
    height: 120px;
    /* Explicitly take the reserved height */
    width: 100%;
}

.btn-group {
    display: flex;
    gap: 12px;
}

.btn-group-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* gap: 20px; */
    /* Increased vertical gap between btn-rows */
    /* Removed width: 100%; to allow it to shrink to content */
}

.btn-row {
    display: flex;
    gap: 10px;
    /* Reduced gap between game-buttons within a row */
    justify-content: center;
}

.multiplier-option-btn {
    width: 20vw;
    height: auto;
}

.game-btn {
    /* Re-added generic game-btn for other buttons that still use it */
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

.multiplier-btn-img {
    height: auto;
    width: 100%;
    object-fit: contain;
}

.game-btn.orange {
    /* Removed background */
    border: none;
    /* Remove border */
    box-shadow: none;
    /* Remove shadow */
}

.game-btn.blue {
    /* Removed background */
    border: none;
    /* Remove border */
    box-shadow: none;
    /* Remove shadow */
}

.waiting-text {
    color: #cbd5e1;
    font-size: 14px;
    background: rgba(0, 0, 0, 0.5);
    padding: 4px 12px;
    border-radius: 12px;
    align-self: center;
    /* Prevent stretching in flex container */
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
    bottom: 20px;
    right: 20px;
    /* Removed width and height to allow padding to control size */
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 4px 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: none;
    /* Remove box-shadow for consistency with menu-btn */
    cursor: pointer;
    z-index: 100;
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

/* Status Float Pop-up Animation */
.pop-up-enter-active,
.pop-up-leave-active {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: center left;
    /* Origin from the left side (avatar side) */
}

.pop-up-enter-from {
    opacity: 0;
    /* Start slightly to the left (towards avatar) and small */
    transform: translateX(-30px) scale(0.2);
}

.pop-up-leave-to {
    opacity: 0;
    transform: scale(0.5);
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
    min-height: 50px;
}

.calc-container {
    display: flex;
    align-items: center;
    gap: 8px;
    background: url('@/assets/common/couniu.png') no-repeat center center;
    background-size: 100% 100%;
    padding: 8px 30px;
    /* Removed border-radius and box-shadow to let image dictate shape */
}

.calc-box {
    width: 30px;
    height: 30px;
    border: 2px solid rgba(197, 160, 123, 1);
    border-radius: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: rgb(236, 180, 124);
    font-weight: bold;
    font-size: 18px;
}

.calc-box.result {
    font-weight: bold;
    border-color: rgba(197, 160, 123, 1);
    color: rgb(236, 180, 124);
}

.calc-symbol {
    color: white;
    font-weight: bold;
    font-size: 20px;
}

.showdown-btn {
    /* Removed absolute positioning */
    width: auto;
    height: auto;
    background: none;
    border: none;
    box-shadow: none;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
}

.showdown-btn-img {
    height: 45px;
    width: auto;
    object-fit: contain;
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
    font-size: 14px;
    color: #facc15;
    /* Keep text color for fallback */
    font-weight: bold;
    /* Keep text weight for fallback */
    display: flex;
    align-items: center;
    /* Remove any background/border properties if they were here */
}

.hand-type-img {
    height: 96px;
    /* Scaled up by 4x from 24px */
    object-fit: contain;
    vertical-align: middle;
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

/* Watermark Style */
.room-mode-watermark {
    position: absolute;
    bottom: 35%;
    /* 40% from the bottom */
    left: 50%;
    transform: translateX(-50%);
    color: #55a773;
    /* Very light white, translucent for watermark effect */
    font-size: 16px;
    /* Not too large */
    font-weight: bold;
    pointer-events: none;
    /* Do not block interactions */
    z-index: 1;
    /* Ensure it's behind interactive elements */
    white-space: nowrap;
    text-shadow: 1px 2px 1px rgba(0, 0, 0, 0.3);
    /* Subtle shadow for better readability on varied backgrounds */
}

/* --- Status Text Styles (Duplicated from PlayerSeat for myPlayer) --- */
.status-text {
    font-family: "Microsoft YaHei", "Heiti SC", sans-serif;
    font-weight: 900;
    font-style: italic;
    padding: 2px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    /* Default shadow */
    text-shadow:
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 3px 5px rgba(0, 0, 0, 0.5);
}

.rob-text {
    color: #fcd34d;
    text-shadow:
        -2px -2px 0 #b45309,
        2px -2px 0 #b45309,
        -2px 2px 0 #b45309,
        2px 2px 0 #b45309,
        0 3px 5px rgba(0, 0, 0, 0.5);
    font-size: 18px;
}

.no-rob-text {
    color: #fcd34d;
    /* Updated to match rob-text */
    text-shadow:
        -2px -2px 0 #b45309,
        2px -2px 0 #b45309,
        -2px 2px 0 #b45309,
        2px 2px 0 #b45309,
        0 3px 5px rgba(0, 0, 0, 0.5);
    font-size: 18px;
    /* Updated to match rob-text */
}

.bet-text {
    color: #ffffff;
    /* White */
    text-shadow:
        -2px -2px 0 #166534,
        /* Green-800 */
        2px -2px 0 #166534,
        -2px 2px 0 #166534,
        2px 2px 0 #166534,
        0 3px 5px rgba(0, 0, 0, 0.5);
    font-size: 18px;
}

/* Large Size for Self */
.text-large {
    font-size: 22px !important;
    /* Reduced from 26px */
    height: 40px;
    text-shadow:
        -2px -2px 0 #000,
        2px -2px 0 #000,
        -2px 2px 0 #000,
        2px 2px 0 #000,
        0 4px 8px rgba(0, 0, 0, 0.6);
}

.rob-text.text-large,
.no-rob-text.text-large {
    text-shadow:
        -2px -2px 0 #b45309,
        2px -2px 0 #b45309,
        -2px 2px 0 #b45309,
        2px 2px 0 #b45309,
        0 4px 8px rgba(0, 0, 0, 0.6);
}

.bet-text.text-large {
    text-shadow:
        -2px -2px 0 #166534,
        /* Green-800 */
        2px -2px 0 #166534,
        -2px 2px 0 #166534,
        2px 2px 0 #166534,
        0 4px 8px rgba(0, 0, 0, 0.6);
}
</style>

<style>
/* Global styles for Vant components in dark mode */

@keyframes shine {
    0% {
        transform: scale(1);
        box-shadow: 0 0 5px #fbbf24;
    }

    50% {
        transform: scale(1.1);
        box-shadow: 0 0 15px #fbbf24;
    }

    100% {
        transform: scale(1);
        box-shadow: 0 0 5px #fbbf24;
    }
}

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