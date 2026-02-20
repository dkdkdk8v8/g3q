<script setup>
import { onMounted, computed, onUnmounted, ref, watch, nextTick } from 'vue';
import { debounce } from '../utils/debounce.js';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';

import CoinLayer from '../components/CoinLayer.vue';
import DealingLayer from '../components/DealingLayer.vue';

import SettingsModal from '../components/SettingsModal.vue';
import HelpModal from '../components/HelpModal.vue';
import HistoryModal from '../components/HistoryModal.vue';
import HostingModal from '../components/HostingModal.vue';
import WinAnimation from '../components/WinAnimation.vue';
import LoseAnimation from '../components/LoseAnimation.vue';
import GameStartAnimation from '../components/GameStartAnimation.vue';
import { useRouter, useRoute } from 'vue-router';
import { formatCoins } from '../utils/format.js';
import { transformServerCard, calculateHandType } from '../utils/bullfight.js';
import { AudioUtils } from '../utils/audio.js';
import gameClient from '../socket.js';
import { showToast as vantToast } from 'vant';
import PokerCard from '../components/PokerCard.vue';

const store = useGameStore();
const settingsStore = useSettingsStore();

// --- Showdown Sound Logic ---
const playedShowdownSounds = ref(new Set());

const niuSoundMap = {
    'NO_BULL': niu0Sound,
    'BULL_1': niu1Sound,
    'BULL_2': niu2Sound,
    'BULL_3': niu3Sound,
    'BULL_4': niu4Sound,
    'BULL_5': niu5Sound,
    'BULL_6': niu6Sound,
    'BULL_7': niu7Sound,
    'BULL_8': niu8Sound,
    'BULL_9': niu9Sound,
    'BULL_BULL': niuNiuSound,
    'FIVE_SMALL': niuWuxiaoSound,
    'FIVE_FLOWER': niuWuhuaSound,
    'BOMB': niuBoomSound,
    'FOUR_FLOWER': null // No sound
};

const playHandSound = (handResult) => {
    if (!settingsStore.soundEnabled || !handResult || !handResult.type) return;
    const sound = niuSoundMap[handResult.type];
    if (sound) {
        AudioUtils.playEffect(sound);
    }
};

watch(() => store.players, (newPlayers) => {
    newPlayers.forEach(p => {
        // Play sound if player shows hand, has result, and sound hasn't been played this round
        if (p.isShowHand && p.handResult && !playedShowdownSounds.value.has(p.id)) {
            playHandSound(p.handResult);
            playedShowdownSounds.value.add(p.id);
        }
    });
}, { deep: true });

watch(() => store.currentPhase, (val) => {
    if (['IDLE', 'READY_COUNTDOWN', 'ROB_BANKER'].includes(val)) {
        playedShowdownSounds.value.clear();
    }
});
// ----------------------------

const backgroundImageStyle = computed(() => {
    let bgUrl = gameBgImg; // Default
    if (store.gameMode === 1) {
        bgUrl = gameBgSanImg;
    } else if (store.gameMode === 2) {
        bgUrl = gameBgSiImg;
    }
    return {
        backgroundImage: `url(${bgUrl})`
    };
});

const calcContainerBackgroundStyle = computed(() => {
    let bgUrl;
    // Mode 0: Default game, uses existing 'couniu.png'
    if (store.gameMode === 0) {
        bgUrl = new URL('../assets/common/couniu.png', import.meta.url).href;
    }
    // Mode 1: 看三张抢庄, uses couniu_san.png
    else if (store.gameMode === 1) {
        bgUrl = couniuSanImg;
    }
    // Mode 2: 看四张抢庄, uses couniu_si.png
    else if (store.gameMode === 2) {
        bgUrl = couniuSiImg;
    }

    if (bgUrl) {
        return {
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center'
        };
    }
    return {};
});

const baseBetStyle = computed(() => {
    let borderColor = '#22c55e66'; // Default Green (Mode 0)
    if (store.gameMode === 1) {
        borderColor = '#3b82f666'; // Blue (Mode 1)
    } else if (store.gameMode === 2) {
        borderColor = '#a855f766'; // Purple (Mode 2 & 3)
    }
    return {
        borderColor: borderColor,
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '20px', // Make it pill-shaped
        backgroundColor: 'rgba(0, 0, 0, 0.2)' // Semi-transparent background
    };
});

const betMultipliers = computed(() => {
    return (store.betMult || []).sort((a, b) => a - b);
});

const allRobOptions = computed(() => {
    const options = [0, ...(store.bankerMult || [])].filter((value, index, self) => self.indexOf(value) === index).sort((a, b) => a - b);
    return options;
});

const showHosting = ref(false); // Hosting Modal State
const isSwitchingRoom = ref(false); // Switching Room State
const isHosting = ref(false); // Is Hosting Active?
const hostingSettings = ref({ rob: 0, bet: 1 }); // Stored Settings

// Tuoguan icon animation state
const currentTuoguaningIcon = ref(tuoguaningIconImg);
let tuoguaningInterval = null;

watch(isHosting, (newVal) => {
    if (newVal) {
        tuoguaningInterval = setInterval(() => {
            currentTuoguaningIcon.value = currentTuoguaningIcon.value === tuoguaningIconImg ? tuoguaningIcon2Img : tuoguaningIconImg;
        }, 500);
    } else {
        if (tuoguaningInterval) {
            clearInterval(tuoguaningInterval);
            tuoguaningInterval = null;
        }
        currentTuoguaningIcon.value = tuoguaningIconImg;
    }
});

onUnmounted(() => {
    if (tuoguaningInterval) clearInterval(tuoguaningInterval);
});

// ... (existing logic)

// Hosting Watcher
watch(() => store.currentPhase, (newPhase) => {
    if (!isHosting.value) return;

    if (newPhase === 'ROB_BANKER') {
        // Auto Rob
        setTimeout(() => {
            if (store.currentPhase === 'ROB_BANKER' && isHosting.value) {
                // Check if rob option is valid (available in allRobOptions)
                // Actually, just sending what user selected is fine, server validates or we check allRobOptions
                // Let's perform check if we want to be safe, but usually fixed 0-4
                const robVal = hostingSettings.value.rob;
                // Check if this robVal is in allRobOptions? If not, fallback to 0 (No Rob)
                const isValid = allRobOptions.value.includes(robVal);
                onRob(isValid ? robVal : 0);
            }
        }, 800);
    } else if (newPhase === 'BETTING') {
        // Auto Bet
        setTimeout(() => {
            if (store.currentPhase === 'BETTING' && isHosting.value) {
                // Check if banker
                const me = store.players.find(p => p.id === store.myPlayerId);
                if (me && !me.isBanker) {
                    const betVal = hostingSettings.value.bet;
                    // Validate against betMultipliers?
                    const isValid = betMultipliers.value.includes(betVal);
                    // If invalid (e.g. not enough coins for high bet), maybe fallback to lowest?
                    // For now, try selected. If invalid, maybe it fails silently or server handles.
                    // Ideally check betMultipliers.
                    onBet(isValid ? betVal : (betMultipliers.value[0] || 1));
                }
            }
        }, 800);
    } else if (newPhase === 'SHOWDOWN') {
        // Auto Show Hand
        setTimeout(() => {
            if (store.currentPhase === 'SHOWDOWN' && isHosting.value) {
                store.playerShowHand(store.myPlayerId);
            }
        }, 800);
    }
});

// ...

const openHostingDebounced = debounce(() => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
    if (isHosting.value) {
        isHosting.value = false;
        vantToast("托管已取消");
        return;
    }
    showHosting.value = true;
}, 500);

const handleHostingConfirm = (settings) => {
    hostingSettings.value = settings;
    isHosting.value = true;

    // Immediate check for current phase actions upon enabling hosting
    const me = store.players.find(p => p.id === store.myPlayerId);
    if (!me) return;

    if (store.currentPhase === 'ROB_BANKER') {
        // If haven't robbed yet (robMultiplier is usually -1 or similar if not acted)
        // Checking robMultiplier == -1 is common for "not acted"
        if (me.robMultiplier === -1) {
            const robVal = hostingSettings.value.rob;
            const isValid = allRobOptions.value.includes(robVal);
            onRob(isValid ? robVal : 0);
        }
    } else if (store.currentPhase === 'BETTING') {
        // If not banker and haven't bet yet (betMultiplier == 0)
        if (!me.isBanker && me.betMultiplier === 0) {
            const betVal = hostingSettings.value.bet;
            const isValid = betMultipliers.value.includes(betVal);
            onBet(isValid ? betVal : (betMultipliers.value[0] || 1));
        }
    } else if (store.currentPhase === 'SHOWDOWN') {
        // If haven't shown hand
        if (!me.isShowHand) {
            store.playerShowHand(store.myPlayerId);
        }
    }
};

const switchRoomStartTime = ref(0);

const switchRoom = debounce(() => {
    if (isSwitchingRoom.value) return;
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
    // Disable hosting when switching room
    isHosting.value = false;

    isSwitchingRoom.value = true;
    switchRoomStartTime.value = Date.now();

    // Start Animation (This captures the screenshot)
    startSwitchRoomAnimation();

    gameClient.send("QZNN.PlayerChangeRoom", { RoomId: store.roomId });

    // Set a timeout to force reset if stuck (10s safety)
    switchRoomTimeout.value = setTimeout(() => {
        if (isSwitchingRoom.value) {
            console.warn("[GameView] Room switch timed out after 10s.");
            finishSwitchRoomAnimation();
        }
    }, 10000);
}, 500);

const gameTableRef = ref(null);
const snapshotContainer = ref(null);
const showSnapshot = ref(false);
const snapshotAnimClass = ref('');
const gameViewStyle = ref({});

const startSwitchRoomAnimation = () => {
    if (!gameTableRef.value) return;

    // 1. Clone the current game view
    // Note: cloneNode(true) copies attributes like 'id', duplicate IDs are generally bad but harmless for display-only clone.
    const original = gameTableRef.value;
    const clone = original.cloneNode(true);

    // Remove pointer events from clone to prevent interaction
    clone.style.pointerEvents = 'none';

    // 2. Setup Overlay
    showSnapshot.value = true;
    snapshotAnimClass.value = '';

    nextTick(() => {
        if (snapshotContainer.value) {
            snapshotContainer.value.innerHTML = '';
            snapshotContainer.value.appendChild(clone);
        }

        // 3. Move Real View to Right (Hidden behind overlay)
        // Instant move (0 transition) so it's ready to slide in later
        // But we wait a tick to ensure overlay is painted
        setTimeout(() => {
            gameViewStyle.value = {
                transform: 'translateX(100%)',
                transition: 'none'
            };
        }, 50);

        // 4. Wait 2 seconds, then slide
        setTimeout(() => {
            // Animate Overlay Left
            snapshotAnimClass.value = 'slide-out-left';

            // Animate Real View from Right to Center
            gameViewStyle.value = {
                transform: 'translateX(0)',
                transition: 'transform 0.5s ease-in-out'
            };

            // Cleanup after animation completes (0.5s match CSS)
            setTimeout(() => {
                finishSwitchRoomAnimation();
            }, 500);
        }, 1250); // 2000ms wait + 50ms buffer
    });
};

const finishSwitchRoomAnimation = () => {
    showSnapshot.value = false;
    snapshotAnimClass.value = '';
    gameViewStyle.value = {};
    isSwitchingRoom.value = false;

    if (switchRoomTimeout.value) {
        clearTimeout(switchRoomTimeout.value);
        switchRoomTimeout.value = null;
    }
};

import gameBgSound from '@/assets/sounds/game_bg.mp3';
import gameBgImg from '@/assets/common/game_bg.jpg'; // Import default BG explicitly
import gameBgSanImg from '@/assets/common/game_bg_san.jpg';
import gameBgSiImg from '@/assets/common/game_bg_zise.jpg';
import iconGameStart from '../assets/common/game_start.png';
import gameStartSound from '@/assets/sounds/game_start.mp3';
import gameWinSound from '@/assets/sounds/game_win.mp3';
import gameLoseSound from '@/assets/sounds/game_lose.mp3';
import sendCardSound from '@/assets/sounds/send_card.mp3';
import randomBankSound from '@/assets/sounds/random_bank.mp3';
import sendCoinSound from '@/assets/sounds/send_coin.mp3';
import countdownAlertSound from '@/assets/sounds/countdown_alert.mp3';
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import niu0Sound from '@/assets/sounds/niu_0.mp3';
import niu1Sound from '@/assets/sounds/niu_1.mp3';
import niu2Sound from '@/assets/sounds/niu_2.mp3';
import niu3Sound from '@/assets/sounds/niu_3.mp3';
import niu4Sound from '@/assets/sounds/niu_4.mp3';
import niu5Sound from '@/assets/sounds/niu_5.mp3';
import niu6Sound from '@/assets/sounds/niu_6.mp3';
import niu7Sound from '@/assets/sounds/niu_7.mp3';
import niu8Sound from '@/assets/sounds/niu_8.mp3';
import niu9Sound from '@/assets/sounds/niu_9.mp3';
import niuNiuSound from '@/assets/sounds/niu_niu.mp3';
import niuBoomSound from '@/assets/sounds/niu_boom.mp3';
import niuWuhuaSound from '@/assets/sounds/niu_wuhuan.mp3';
import niuWuxiaoSound from '@/assets/sounds/niu_wuxiao.mp3';
import goldImg from '@/assets/common/gold.png';
import zhuangImg from '@/assets/common/zhuang.png';
import tanpaiImg from '@/assets/common/tanpai.png';
import couniuSanImg from '@/assets/common/couniu_san.png';
import couniuSiImg from '@/assets/common/couniu_si.png';
import tuoguanBgImg from '@/assets/tuoguan/tuoguan_bg.png';
import tuoguanIconImg from '@/assets/tuoguan/tuoguan_icon.png';
import tuoguanTextImg from '@/assets/tuoguan/tuoguan_text.png';
import tuoguaningIconImg from '@/assets/tuoguan/tuoguaning_icon.png';
import tuoguaningIcon2Img from '@/assets/tuoguan/tuoguaning_icon2.png';
import tuoguaningTextImg from '@/assets/tuoguan/tuoguaning_text.png';
import replaceRoomTextImg from '@/assets/common/replace_room_text.png';

// Lobby style buttons
import btnExit from '@/assets/lobby/exit_btn.png';
import btnHelp from '@/assets/lobby/help_btn.png';
import btnHistory from '@/assets/lobby/bet_history_btn.png';
import btnSetting from '@/assets/lobby/sett_btn.png';

import avatarFrameImg from '@/assets/common/avatar_circle.png';
import userInfoBgImg from '@/assets/common/user_info_rect.png';
import defaultAvatar from '@/assets/common/default_avatar.png';

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

// Multiplier images (Buttons)
import beishuBuqiangImg from '@/assets/beishu/beishu_buqiang.png';
import beishu1Img from '@/assets/beishu/beishu_1.png';
import beishu2Img from '@/assets/beishu/beishu_2.png';
import beishu3Img from '@/assets/beishu/beishu_3.png';
import beishu4Img from '@/assets/beishu/beishu_4.png';
import beishu5Img from '@/assets/beishu/beishu_5.png';
import beishu10Img from '@/assets/beishu/beishu_10.png';
import beishu15Img from '@/assets/beishu/beishu_15.png';
import beishu20Img from '@/assets/beishu/beishu_20.png';

// Status images (Rob Banker qz_)
import qzBetNo from '@/assets/beishu/qz_bet_no.png';
import qzBet1 from '@/assets/beishu/qz_bet_1.png';
import qzBet2 from '@/assets/beishu/qz_bet_2.png';
import qzBet3 from '@/assets/beishu/qz_bet_3.png';
import qzBet4 from '@/assets/beishu/qz_bet_4.png';
import qzBet5 from '@/assets/beishu/qz_bet_5.png';
import qzBet10 from '@/assets/beishu/qz_bet_10.png';
import qzBet15 from '@/assets/beishu/qz_bet_15.png';
import qzBet20 from '@/assets/beishu/qz_bet_20.png';

// Status images (Betting ya_)
import yaBet1 from '@/assets/beishu/ya_bet_1.png';
import yaBet2 from '@/assets/beishu/ya_bet_2.png';
import yaBet3 from '@/assets/beishu/ya_bet_3.png';
import yaBet4 from '@/assets/beishu/ya_bet_4.png';
import yaBet5 from '@/assets/beishu/ya_bet_5.png';
import yaBet10 from '@/assets/beishu/ya_bet_10.png';
import yaBet15 from '@/assets/beishu/ya_bet_15.png';
import yaBet20 from '@/assets/beishu/ya_bet_20.png';

const NO_BULL_TYPE_NAME = '没牛';

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

// Button Map (beishu_)
const multiplierImageMap = {
    0: beishuBuqiangImg,
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

// Status Maps (qz_ / ya_)
const robStatusImageMap = {
    0: qzBetNo,
    1: qzBet1,
    2: qzBet2,
    3: qzBet3,
    4: qzBet4,
    5: qzBet5,
    10: qzBet10,
    15: qzBet15,
    20: qzBet20,
};

const betStatusImageMap = {
    1: yaBet1,
    2: yaBet2,
    3: yaBet3,
    4: yaBet4,
    5: yaBet5,
    10: yaBet10,
    15: yaBet15,
    20: yaBet20,
};

const getRobStatusImageUrl = (multiplier) => {
    return robStatusImageMap[multiplier] || null;
};

const getBetStatusImageUrl = (multiplier) => {
    return betStatusImageMap[multiplier] || null;
};





// Responsive scaling logic
const gameScale = ref(1);

const updateGameScale = () => {
    const designWidth = 375;
    const designHeight = 844;
    const aspect = window.innerWidth / window.innerHeight;
    const designAspect = designWidth / designHeight;

    if (aspect > designAspect) {
        gameScale.value = window.innerHeight / (window.innerWidth / designAspect);
    } else {
        gameScale.value = 1;
    }
    if (gameScale.value < 0.7) gameScale.value = 0.7;
};

const getSeatStyle = (seatNum) => {
    const s = gameScale.value;
    if (s === 1) return {};

    let origin = 'center center';
    if (seatNum === 1) origin = 'left center';
    if (seatNum === 2) origin = 'left top';
    if (seatNum === 3) origin = 'right top';
    if (seatNum === 4) origin = 'right center';

    return {
        transform: `scale(${s * 1})`,
        transformOrigin: origin
    };
};

const getMyAreaStyle = () => {
    const s = gameScale.value;
    if (s === 1) return {};
    return {
        transform: `scale(${s})`,
        transformOrigin: 'bottom center',
        width: `${100 / s}%`,
        marginLeft: `${(1 - 1 / s) * 50}%`
    };
};

onMounted(() => {
    updateGameScale();
    window.addEventListener('resize', debounce(updateGameScale, 100));
});

onUnmounted(() => {
    window.removeEventListener('resize', updateGameScale);
});
const router = useRouter();
const route = useRoute();
const coinLayer = ref(null);
const dealingLayer = ref(null);
const seatRefs = ref({}); // 存储所有座位的引用 key: playerId
const tableCenterRef = ref(null); // 桌面中心元素引用
const startAnimationClass = ref('');
const showStartAnim = ref(false);
const resultImage = ref('');
const resultAnimClass = ref('');
const showResultAnim = ref(false);
const showWinAnim = ref(false); // New Win Animation State
const showLoseAnim = ref(false); // New Lose Animation State
const resultTypeClass = ref('');

const showSettings = ref(false);

// Banker selection animation state
const currentlyHighlightedPlayerId = ref(null);
const showBankerConfirmAnim = ref(false); // New state for confirmation animation
const winEffects = ref({}); // Map of playerId -> boolean for win neon effect
let animationIntervalId = null;
let candidateIndex = 0;

// Auto-join message state
const showAutoJoinMessage = ref(false);

const showSwitchRoomOverlay = ref(false);
const logoAnimationState = ref(''); // 'entering', 'leaving', ''
const switchRoomTimeout = ref(null); // Timeout for forced overlay disappearance

// Robot Speech/Emoji Logic Removed (now server-driven)






const showHistory = ref(false);
const showHelp = ref(false);

const visibleCounts = ref({});
const hiddenCardsMap = ref({});
const dealingCounts = ref({});

const modeName = computed(() => {
    const m = store.gameMode;
    if (m === 0) return '抢庄牛牛';
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

// New helper function to control when card data is passed to PokerCard to trigger flip animation
const getEffectiveCardProp = (originalCard, cardIndex) => {
    // This logic specifically applies to my player's cards during supplemental dealing.
    if (myPlayer.value && myPlayer.value.id) {
        const dCount = dealingCounts.value[myPlayer.value.id] || 0;
        const vCount = visibleCounts.value[myPlayer.value.id] || 0;

        // Determine if this specific card (by index) is one of the newly dealt cards
        // that is still in "flying" state (i.e., its opacity is 0 due to dealingCounts).
        // These cards are at the end of the `visibleCounts` range.
        // Their indices are from `vCount - dCount` to `vCount - 1`.
        const isCurrentlyFlyingIn = (dCount > 0 && cardIndex >= (vCount - dCount));

        if (isCurrentlyFlyingIn) {
            // If it's a card currently flying in, pass null to make PokerCard render its back face.
            // When `dCount` becomes 0 (dealing finished), this condition becomes false,
            // and the actual card data will be passed, triggering PokerCard's flip animation.
            return null;
        }
    }
    // For other cases (e.g., not my player, or not a flying-in card), pass the original card data.
    // PokerCard's own `card` prop watcher will handle its state.
    return originalCard;
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
    // Hide in IDLE, READY, SETTLEMENT, or GAME_OVER phases
    if (['IDLE', 'READY_COUNTDOWN', 'SETTLEMENT', 'GAME_OVER'].includes(store.currentPhase)) return false;

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
    if (['IDLE', 'READY_COUNTDOWN', 'ROB_BANKER', 'BANKER_SELECTION_ANIMATION', 'BANKER_CONFIRMED', 'SETTLEMENT', 'GAME_OVER'].includes(store.currentPhase)) return false;

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



// Watch Music Setting
watch(() => settingsStore.musicEnabled, (val) => {
    if (val) {
        AudioUtils.playMusic(gameBgSound, 0.5);
    } else {
        AudioUtils.pauseMusic();
    }
});

const candidatePlayers = computed(() => {
    return (store.bankerCandidates || []).map(id => store.players.find(p => p.id === id)).filter(p => !!p);
});

const candidatePositions = ref({});

const updateCandidatePositions = () => {
    const newPositions = {};
    if (!store.bankerCandidates) return;

    store.bankerCandidates.forEach(pid => {
        const seatEl = seatRefs.value[pid];
        if (seatEl) {
            // Try to find the avatar frame specifically
            const avatarEl = seatEl.querySelector('.avatar-frame') || seatEl.querySelector('.avatar-wrapper');
            if (avatarEl) {
                const rect = avatarEl.getBoundingClientRect();
                newPositions[pid] = {
                    top: `${rect.top}px`,
                    left: `${rect.left}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                };
            }
        }
    });
    candidatePositions.value = newPositions;
};

watch(() => store.currentPhase, (val) => {
    if (val === 'BANKER_SELECTION_ANIMATION') {
        setTimeout(() => {
            updateCandidatePositions();
        }, 50); // Slight delay to ensure DOM is stable
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
            AudioUtils.playEffect(countdownAlertSound);
        }
    }
});

watch(() => store.currentPhase, async (newPhase, oldPhase) => {
    if (newPhase === 'IDLE' || newPhase === 'GAME_OVER') {
        visibleCounts.value = {};
        dealingCounts.value = {}; // Reset dealing counts
        lastBetStates.value = {};
    } else if (newPhase === 'GAME_START_ANIMATION') {
        showStartAnim.value = true;

        if (settingsStore.soundEnabled) {
            AudioUtils.playEffect(gameStartSound);
        }

        setTimeout(() => {
            showStartAnim.value = false;
        }, 2550);
    } else if (newPhase === 'PRE_DEAL') {
        visibleCounts.value = {};
        hiddenCardsMap.value = {}; // Reset hidden cards map
        // Initialize to 0 to prevent premature display
        store.players.forEach(p => {
            if (p.hand && p.hand.length > 0) {
                visibleCounts.value[p.id] = 0;
            }
        });
        dealingCounts.value = {}; // Reset dealing counts
        setTimeout(() => {
            startDealingAnimation();
        }, 100);
    } else if (newPhase === 'ROB_BANKER') {
        if (oldPhase !== 'PRE_DEAL') {
            visibleCounts.value = {};
            hiddenCardsMap.value = {};
            store.players.forEach(p => {
                if (p.hand && p.hand.length > 0) {
                    visibleCounts.value[p.id] = 0;
                }
            });
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
        if (store.gameMode === 0) {
            // Mode 0: Initial Deal (5 cards)
            // Reset visibleCounts to 0 to start fresh
            store.players.forEach(p => {
                if (p.hand && p.hand.length > 0) {
                    visibleCounts.value[p.id] = 0;
                }
            });
            setTimeout(() => {
                startDealingAnimation(false); // isSupplemental = false
            }, 100);
        } else {
            // Mode 1 & 2: Supplemental Deal (fill remaining cards)
            // Do NOT reset visibleCounts
            setTimeout(() => {
                startDealingAnimation(true); // isSupplemental = true
            }, 100);
        }
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
                    AudioUtils.playEffect(randomBankSound);
                }
            }, 150);
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
        }, 1200); // Animation lasts 1.2s. Match exactly to avoid delay in halo swap.
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

            if (settingsStore.soundEnabled) {
                AudioUtils.playEffect(isWin ? gameWinSound : gameLoseSound);
            }

            if (isWin) {
                showWinAnim.value = true;
                setTimeout(() => {
                    showWinAnim.value = false;
                }, 4000); // 4s display
            } else {
                showLoseAnim.value = true;
                setTimeout(() => {
                    showLoseAnim.value = false;
                }, 4000); // 4s display
            }
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
                        AudioUtils.playEffect(sendCoinSound);
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
                            AudioUtils.playEffect(sendCoinSound);
                        }
                    }
                }
            });
        }, 1200);
    }
}, { immediate: true });

const startDealingAnimation = (isSupplemental = false) => {
    if (!isSupplemental) {
        visibleCounts.value = {}; // Reset visible counts ONLY if not supplemental
        hiddenCardsMap.value = {};
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

            // NEW: For myPlayer in supplemental deal, reserve space immediately to trigger slide
            if (isSupplemental && p.id === store.myPlayerId) {
                if (!visibleCounts.value[p.id]) visibleCounts.value[p.id] = 0;
                visibleCounts.value[p.id] += toDeal;
            }

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

    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(sendCardSound);
    }

    targets.forEach((t, pIndex) => {
        const cardTargets = [];
        // Scale adjustment: Opponent seats have transform: scale(0.85) in CSS, so we must match that.
        const scale = (t.isMe ? 1 : 1) * gameScale.value;

        // Viewport scaling to match postcss-px-to-viewport (assuming 375 design width)
        const viewportRatio = window.innerWidth / 375;

        // Spacing calculation (Base pixels at 375 width):
        // Me: 60px width + 5px margin = 65px
        // Opponent: 48px width - 28px margin = 20px
        const baseSpacing = t.isMe ? 65 : 20;

        // Spacing must be scaled because the static cards are inside a scaled container
        // and thus the visual distance between centers is scaled.
        // We apply the same scale to the flying card spacing.
        const spacing = baseSpacing * viewportRatio * scale;

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

        // --- NEW LOGIC START ---
        // Immediately update visibleCounts to trigger layout update (start moving)
        if (!(isSupplemental && t.id === store.myPlayerId)) {
            if (!visibleCounts.value[t.id]) visibleCounts.value[t.id] = 0;
            visibleCounts.value[t.id] += t.count;

            // Mark new cards as hidden for opponents (MyPlayer uses dealingCounts logic in template)
            if (!t.isMe) {
                const currentHidden = hiddenCardsMap.value[t.id] || [];
                // Add indices of new cards
                const newIndices = cardTargets.map(c => c.index);
                hiddenCardsMap.value[t.id] = [...currentHidden, ...newIndices];
            }
        }
        // --- NEW LOGIC END ---

        setTimeout(() => {
            dealingLayer.value.dealToPlayer(cardTargets, () => {
                // Callback: Unhide cards
                if (!(isSupplemental && t.id === store.myPlayerId)) {
                    // For opponents, remove from hiddenCardsMap
                    if (!t.isMe && hiddenCardsMap.value[t.id]) {
                        const newIndices = cardTargets.map(c => c.index);
                        hiddenCardsMap.value[t.id] = hiddenCardsMap.value[t.id].filter(idx => !newIndices.includes(idx));
                    }
                }

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

    // Preload animation images to prevent layout jumps
    const preloadImages = [iconGameStart];
    preloadImages.forEach(src => {
        const img = new Image();
        img.src = src;
    });

    if (route.query.autoJoin) {
        // Show prominent message for re-joining
        showAutoJoinMessage.value = true;

        setTimeout(() => {
            showAutoJoinMessage.value = false;
        }, 5000); // 5 seconds duration

        // Remove query param
        router.replace({ query: { ...route.query, autoJoin: undefined } });
    }



    if (settingsStore.musicEnabled) {
        AudioUtils.playMusic(gameBgSound, 0.5);
    }

    // Register handler for PlayerLeave response
    gameClient.on('QZNN.PlayerLeave', (msg) => {
        if (msg.code === 0) {
            router.replace('/lobby');
        } else {
            vantToast(msg.msg || "退出失败");
        }
    });

    // Register handler for PlayerChangeRoom response
    gameClient.on('QZNN.PlayerChangeRoom', (msg) => {
        if (msg.code !== 0) {
            vantToast(msg.msg || "切换房间失败");
            // If failed, we should reset animation immediately
            finishSwitchRoomAnimation();
        } else {
            // Success. We don't hide overlay here. The animation loop (startSwitchRoomAnimation) handles the timing.
            // The 2s delay ensures the "old" room stays visible (via snapshot) while the store updates.
            // When the 2s is up, the real view (now updated) slides in.
            // No action needed here unless we want to extend the wait if response is slow (but user said 2s fixed).
        }
    });

    // Register latency callback
    gameClient.setLatencyCallback((ms) => {
        networkLatency.value = ms;
    });
});

onUnmounted(() => {
    store.resetState();

    AudioUtils.stopMusic();
    gameClient.off('QZNN.PlayerLeave');
    gameClient.off('QZNN.PlayerChangeRoom');
    gameClient.setLatencyCallback(null);
});

// Date Filter Logic - Moved to HistoryModal
// History Logic - Moved to HistoryModal


const onRob = debounce((multiplier) => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
    store.playerRob(multiplier);
}, 500);

const onBet = debounce((multiplier) => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
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
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
    showHistory.value = true;
}, 500);

const openSettingsDebounced = debounce(() => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
    showSettings.value = true;
}, 500);

const quitGameDebounced = debounce(() => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
    gameClient.send("QZNN.PlayerLeave", { RoomId: store.roomId });
}, 500);



const closeHistoryDebounced = debounce(() => {
    showHistory.value = false;
}, 500);

const closeSettingsDebounced = debounce(() => {
    showSettings.value = false;
}, 500);

const openHelpDebounced = debounce(() => {

    if (settingsStore.soundEnabled) {

        AudioUtils.playEffect(btnClickSound);

    }

    showHelp.value = true;
}, 500);

const closeHelpDebounced = debounce(() => {
    showHelp.value = false;
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

const shouldMoveStatusFloat = computed(() => {

    // If cards are showing, move it

    if (showCards.value) return true;

    // If dealing is in progress, move it (anticipate cards)

    if (store.currentPhase === 'DEALING' || isDealingProcessing.value) return true;

    return false;

});



// --- My Player Badge Teleport Logic ---
const myBadgeAnchorRef = ref(null);
const myTeleportStyle = ref({ display: 'none' }); // Hidden initially to prevent flash
let myBadgeUpdateFrame = null;

const updateMyBadgePosition = () => {
    if (myBadgeAnchorRef.value) {
        const rect = myBadgeAnchorRef.value.getBoundingClientRect();

        // Relaxed check: Allow 0 width (image loading), just ensure element exists
        if (rect) {
            myTeleportStyle.value = {
                position: 'absolute',
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                zIndex: 8001, // Higher than CoinLayer (7000)
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            };
        }
    }
};

const startMyBadgeLoop = () => {
    if (myBadgeUpdateFrame) cancelAnimationFrame(myBadgeUpdateFrame);
    const loop = () => {
        updateMyBadgePosition();
        myBadgeUpdateFrame = requestAnimationFrame(loop);
    };
    loop();
};

const stopMyBadgeLoop = () => {
    if (myBadgeUpdateFrame) {
        cancelAnimationFrame(myBadgeUpdateFrame);
        myBadgeUpdateFrame = null;
    }
};

watch(shouldShowBadge, (val) => {
    if (val) {
        nextTick(() => {
            startMyBadgeLoop();
        });
    } else {
        stopMyBadgeLoop();
    }
}, { immediate: true });

onUnmounted(() => {
    stopMyBadgeLoop();
});

const shouldMoveStatusToHighPosition = computed(() => {



    // Strictly match the visibility of the calculation area (Make Bull)



    if (store.currentPhase === 'SHOWDOWN' && myPlayer.value && !myPlayer.value.isShowHand && store.countdown > 0 && !myPlayer.value.isObserver) {



        return true;



    }



    return false;



});

</script>



<template>

    <div class="game-table" :style="{ ...backgroundImageStyle, ...gameViewStyle }" ref="gameTableRef">

        <GameStartAnimation v-if="showStartAnim" />

        <WinAnimation v-if="showWinAnim" />
        <LoseAnimation v-if="showLoseAnim" />
        <img v-show="showResultAnim" :src="resultImage" class="result-icon" :class="resultAnimClass" />

        <DealingLayer ref="dealingLayer" />

        <CoinLayer ref="coinLayer" />

        <!-- Full-screen Switch Room Snapshot Overlay -->
        <Teleport to="body">
            <div v-if="showSnapshot" class="switch-snapshot-overlay" :class="snapshotAnimClass">
                <!-- 1. The Snapshot Clone -->
                <div class="snapshot-clone-container" ref="snapshotContainer"></div>

                <!-- 2. The Frosted Glass Layer -->
                <div class="frosted-glass-layer"></div>

                <!-- 3. The Text/Logo -->
                <div class="snapshot-text-container">
                    <img :src="replaceRoomTextImg" class="switch-room-text-img" /><span
                        class="relace-room-text-loading-dots"></span>
                </div>
            </div>
        </Teleport>

        <!-- Random Banker Selection Overlay -->

        <transition name="fade">

            <div v-if="store.currentPhase === 'BANKER_SELECTION_ANIMATION'" class="banker-selection-overlay">

                <div v-for="p in candidatePlayers" :key="p.id" class="candidate-item-absolute"
                    :style="candidatePositions[p.id]">

                    <div class="avatar-wrapper-overlay" :class="{ 'highlight': p.id === currentlyHighlightedPlayerId }">

                        <div class="avatar-clip">

                            <van-image :src="p.avatar || defaultAvatar" class="avatar-img-content" fit="cover" />

                        </div>

                        <div class="highlight-ring"></div>

                        <img :src="avatarFrameImg" class="avatar-border-overlay" />

                    </div>

                </div>

            </div>

        </transition>



        <!-- 顶部栏 -->

        <div class="top-bar">

            <!-- Left: Functional Buttons -->

            <div class="top-left-btns">

                <img :src="btnExit" class="icon-exit" @click="quitGameDebounced" alt="Exit" />

                <img :src="btnHistory" class="icon-btn" @click="openHistoryDebounced" alt="History" />

                <img :src="btnHelp" class="icon-btn" @click="openHelpDebounced" alt="Help" />

                <img :src="btnSetting" class="icon-btn" @click="openSettingsDebounced" alt="Settings" />

            </div>



            <!-- Network Latency -->

            <div class="network-badge" :class="networkStatusClass">

                <div class="signal-icon">

                    <div class="bar bar-1"></div>

                    <div class="bar bar-2"></div>

                    <div class="bar bar-3"></div>

                    <div class="bar bar-4"></div>

                </div>

                <span>{{ networkLatency }}ms</span>

            </div>

        </div>



        <!-- Base Bet Display -->

        <div class="base-bet-display" :style="baseBetStyle">

            <span class="bet-amount">底分</span>

            <img :src="goldImg" class="gold-icon-small" />

            <span class="bet-amount">{{ formatCoins(store.baseBet, 0) }}</span>

        </div>

        <div class="opponents-layer">

            <div v-for="(p, index) in opponentSeats" :key="index" class="opponent-seat-abs"
                :class="getOpponentClass(index + 1)" :style="getSeatStyle(index + 1)">

                <PlayerSeat v-if="p && p.id" :player="p" :ref="(el) => setSeatRef(el, p.id)"
                    :position="getLayoutType(index + 1)"
                    :visible-card-count="visibleCounts[p.id] !== undefined ? visibleCounts[p.id] : 0"
                    :hidden-card-indices="hiddenCardsMap[p.id] || []" :is-ready="p.isReady"
                    :is-animating-highlight="p.id === currentlyHighlightedPlayerId"
                    :trigger-banker-animation="showBankerConfirmAnim && p.isBanker" :is-win="!!winEffects[p.id]" />
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

            <div v-if="['READY_COUNTDOWN', 'ROB_BANKER', 'BETTING', 'SHOWDOWN', 'BANKER_SELECTION_ANIMATION', 'BANKER_CONFIRMED'].includes(store.currentPhase)"
                class="clock-and-info-wrapper">

                <div class="phase-info">

                    <span v-if="store.currentPhase === 'WAITING_FOR_PLAYERS'">匹配玩家中...</span>

                    <span v-else-if="store.currentPhase === 'READY_COUNTDOWN'">游戏即将开始 {{ store.countdown }}</span>

                    <span v-else-if="store.currentPhase === 'ROB_BANKER'">等待其他玩家抢庄 {{ store.countdown }}</span>

                    <span v-else-if="store.currentPhase === 'BETTING'">等待其他玩家投注 {{ store.countdown }}</span>

                    <span v-else-if="store.currentPhase === 'SHOWDOWN'">等待玩家摊牌比拼 {{ store.countdown }}</span>

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



        <div class="my-area" v-if="myPlayer" :ref="(el) => setSeatRef(el, myPlayer.id)" :style="getMyAreaStyle()">

            <!-- 1. Calculation Formula Area -->

            <div v-show="store.currentPhase === 'SHOWDOWN' && !myPlayer.isShowHand && store.countdown > 0 && !myPlayer.isObserver"
                class="showdown-wrapper">

                <!-- Calculation Formula -->

                <div class="calc-container" :style="calcContainerBackgroundStyle">

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

                    <TransitionGroup tag="div" class="cards" name="list">
                        <template v-for="(card, idx) in myPlayer.hand" :key="idx">
                            <PokerCard
                                v-if="visibleCounts[myPlayer.id] === undefined || idx < visibleCounts[myPlayer.id]"
                                :card="shouldShowCardFace ? getEffectiveCardProp(card, idx) : null" :is-small="false"
                                :class="{ 'hand-card': true, 'bull-card-overlay': isBullPart(idx), 'selected': selectedCardIndices.includes(idx) }"
                                :style="{
                                    marginLeft: idx === 0 ? '0' : '5px', /* for myPlayer */
                                    opacity: (dealingCounts[myPlayer.id] && idx >= (visibleCounts[myPlayer.id] - dealingCounts[myPlayer.id])) ? 0 : 1
                                }" @click="handleCardClick({ card, index: idx })" />
                        </template>
                    </TransitionGroup>

                    <!-- Hand Result Badge - adapted from PlayerSeat (Anchor + Teleport) -->
                    <div v-if="myPlayer.handResult && myPlayer.handResult.typeName && shouldShowBadge"
                        class="hand-result-badge" ref="myBadgeAnchorRef" style="opacity: 0;">
                        <img v-if="getHandTypeImageUrl(myPlayer.handResult.typeName)"
                            :src="getHandTypeImageUrl(myPlayer.handResult.typeName)" alt="手牌类型" class="hand-type-img"
                            :style="['FIVE_SMALL', 'FIVE_FLOWER', 'FOUR_FLOWER', 'BOMB'].includes(myPlayer.handResult.type) ? { height: '75px' } : {}" />
                        <template v-else>TypeName: "{{ myPlayer.handResult.typeName }}"</template>
                    </div>

                    <Teleport to="body">
                        <div v-if="myPlayer.handResult && myPlayer.handResult.typeName && shouldShowBadge"
                            :style="myTeleportStyle">
                            <img v-if="getHandTypeImageUrl(myPlayer.handResult.typeName)"
                                :src="getHandTypeImageUrl(myPlayer.handResult.typeName)" alt="手牌类型"
                                class="hand-type-img" style="height: 100%; width: auto;" />
                            <template v-else>
                                <span style="color: #fbbf24; font-size: 14px; font-weight: bold;">
                                    {{ myPlayer.handResult.typeName }}
                                </span>
                            </template>
                        </div>
                    </Teleport>

                </div>

            </div>



            <!-- 3. My Personal Info + Chat Button -->

            <div class="my-player-info-row">

                <!-- Avatar and Info Box - adapted from PlayerSeat -->

                <div class="avatar-area my-player-avatar-info">
                    <div class="avatar-wrapper" :class="{
                        'banker-confirm-anim': showBankerConfirmAnim && myPlayer.isBanker
                    }">
                        <!-- Avatar Container -->
                        <div class="avatar-frame" :class="{
                            'banker-candidate-highlight': myPlayer.id === currentlyHighlightedPlayerId,
                            'is-banker': myPlayer.isBanker && !['SETTLEMENT', 'GAME_OVER'].includes(store.currentPhase),
                            'win-neon-flash': !!winEffects[myPlayer.id]
                        }">
                            <van-image :src="myPlayer.avatar" class="avatar" fit="cover"
                                :class="{ 'avatar-gray': myPlayer.isObserver }" />
                        </div>

                        <!-- Avatar Frame Overlay -->
                        <img :src="avatarFrameImg" class="avatar-border-overlay" />


                    </div>



                    <div class="info-box" :style="{ '--bg-img': `url(${userInfoBgImg})` }"
                        :class="{ 'is-observer': myPlayer.isObserver }">

                        <!-- Banker Badge -->

                        <div v-if="myPlayer.isBanker && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)"
                            class="banker-badge"><img :src="zhuangImg" alt="庄" class="banker-badge-img" /></div>

                        <div class="name van-ellipsis">{{ myPlayer.name }}</div>



                        <div class="coins-pill">



                            {{ formatCoins(myPlayer.coins) }}



                        </div>



                    </div>



                    <!-- Status float (rob/bet multiplier status) -->

                    <div class="status-float"
                        :class="{ 'move-up-high': shouldMoveStatusFloat && shouldMoveStatusToHighPosition, 'move-up-low': shouldMoveStatusFloat && !shouldMoveStatusToHighPosition }">

                        <Transition name="pop-up">
                            <div v-if="shouldShowRobMult" class="status-content">
                                <img :src="getRobStatusImageUrl(myPlayer.robMultiplier)" class="status-img"
                                    alt="抢庄状态" />
                            </div>
                        </Transition>

                        <Transition name="pop-up">
                            <div v-if="shouldShowBetMult" class="status-content">
                                <img :src="getBetStatusImageUrl(myPlayer.betMultiplier)" class="status-img"
                                    alt="下注状态" />
                            </div>
                        </Transition>

                    </div>

                </div>

                <!-- Hosting Button -->
                <div class="hosting-btn" v-if="!myPlayer.isObserver" @click="openHostingDebounced"
                    :class="{ active: isHosting }">
                    <img :src="tuoguanBgImg" class="tuoguan-bg" alt="托管背景" />

                    <svg v-if="isHosting" class="tuoguan-neon-border" viewBox="0 0 88 36"
                        xmlns="http://www.w3.org/2000/svg">
                        <path class="neon-base" d="M 18 1 L 87 1 L 87 35 L 18 35 A 17 17 0 0 1 18 1 Z" fill="none" />
                        <path class="neon-layer-1" d="M 18 1 L 87 1 L 87 35 L 18 35 A 17 17 0 0 1 18 1 Z" fill="none" />
                    </svg>

                    <div class="tuoguan-content">
                        <img v-if="!isHosting" :src="tuoguanIconImg" alt="托管图标" class="tuoguan-icon" />
                        <img v-else :src="currentTuoguaningIcon" alt="托管中图标" class="tuoguan-icon tuoguan-icon-anim" />

                        <img v-if="!isHosting" :src="tuoguanTextImg" alt="托管文字" class="tuoguan-text" />
                        <img v-else :src="tuoguaningTextImg" alt="托管中文字" class="tuoguan-text-ing" />
                    </div>
                </div>

                <!-- My Score Float -->
                <div v-if="myPlayer.roundScore !== 0 && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)"
                    class="score-float" :class="myPlayer.roundScore > 0 ? 'win' : 'lose'">
                    <SpriteNumber :value="(myPlayer.roundScore > 0 ? '+' : '') + formatCoins(myPlayer.roundScore)"
                        :type="myPlayer.roundScore > 0 ? 'red' : 'white'" :height="22" />
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
                    等待闲家下注<span class="loading-dots"></span>
                </div>

                <!-- Switch Room Button -->

                <div v-if="myPlayer.isObserver || ['IDLE', 'READY_COUNTDOWN', 'SETTLEMENT', 'WAITING_FOR_PLAYERS'].includes(store.currentPhase)"
                    class="game-btn switch-room-btn" :class="{ 'disabled': isSwitchingRoom }" @click="switchRoom">

                    <img src="../assets/common/replace_table_btn.png" alt="切换房间" class="switch-room-img" />

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



        <!-- Modals -->
        <HistoryModal v-model:visible="showHistory" />

        <SettingsModal v-model:visible="showSettings" />

        <HelpModal v-model:visible="showHelp" :mode="store.gameMode" />

        <HostingModal v-model:visible="showHosting" :rob-options="allRobOptions" :bet-options="betMultipliers"
            @confirm="handleHostingConfirm" />

    </div>
</template>

<style scoped>
.game-table {
    width: 100vw;
    height: 100dvh;
    background-repeat: no-repeat;
    background-position: center center;
    background-size: 100% 100%;
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
    background: rgba(19, 41, 40, 0.6);
    padding: 6px 24px;
    border-radius: 24px;
    border: 0.2667vw solid rgba(255, 255, 253, 0.3);
    /* Distinct bottom frame/border */
    box-shadow: 0 1vw 2.2vw rgba(0, 0, 0, 0.6), 0 0 4vw rgba(251, 191, 36, 0.2);
    /* Deep shadow + Glow */
    text-shadow: 0 0.5333vw 1.0667vw rgba(0, 0, 0, 0.9);
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
    font-size: 18px;
    content: '...';
    animation: dots-loading 1.5s steps(4, end) infinite;
    display: inline-block;
    vertical-align: bottom;
    overflow: hidden;
    width: 0px;
}

.relace-room-text-loading-dots::after {
    color: #ffd56c;
    font-weight: bold;
    font-size: 18px;
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
}

/* New top-left buttons */
.top-left-btns {
    display: flex;
    gap: 8px;
    /* Space between buttons */
    align-items: center;
    flex-shrink: 0;
    /* Prevent shrinking */
}

.icon-exit {
    width: 22px;
    height: 32px;
    cursor: pointer;
    transition: transform 0.1s;
    object-fit: contain;
}

.icon-btn {
    width: 32px;
    height: 32px;
    cursor: pointer;
    transition: transform 0.1s;
    object-fit: contain;
}

.icon-btn:active {
    transform: scale(0.9);
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

.signal-icon {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;
    width: 18px;
}

.bar {
    width: 3px;
    background-color: rgba(255, 255, 255, 0.3);
    border-radius: 1px;
}

.bar-1 {
    height: 25%;
}

.bar-2 {
    height: 50%;
}

.bar-3 {
    height: 75%;
}

.bar-4 {
    height: 100%;
}

/* Good: All bars green */
.network-badge.good .bar {
    background-color: #22c55e;
    box-shadow: 0 0 2px #22c55e;
}

/* Fair: 3 bars yellow */
.network-badge.fair .bar {
    background-color: rgba(255, 255, 255, 0.3);
    box-shadow: none;
}

.network-badge.fair .bar-1,
.network-badge.fair .bar-2,
.network-badge.fair .bar-3 {
    background-color: #facc15;
    box-shadow: 0 0 2px #facc15;
}

/* Poor: 2 bars red */
.network-badge.poor .bar {
    background-color: rgba(255, 255, 255, 0.3);
    box-shadow: none;
}

.network-badge.poor .bar-1,
.network-badge.poor .bar-2 {
    background-color: #ef4444;
    box-shadow: 0 0 2px #ef4444;
}





/* 弹窗样式 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 8500;
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
    top: 42%;
    /* Adjusted for fixed top alignment */
    right: -2px;
    /* transform: scale(0.85); Removed redundant scale */
}

.seat-right-top {
    top: 20%;
    right: 6vw;
}

.seat-left-top {
    top: 20%;
    left: 6vw;
}

.seat-left {
    top: 42%;
    /* Adjusted for fixed top alignment */
    left: 0;
    /* transform: scale(0.85); Removed redundant scale */
}

.empty-seat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 160px;
    /* Match PlayerSeat width */
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
    top: 42%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8vw;
    /* This handles the 3px distance between clock and phase info */
    width: 53.3333vw;
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
    gap: 0.8vw;
    /* This handles the 3px distance between clock and phase info */
    pointer-events: auto;
    /* Allow interaction with children if needed */
}

.phase-info {
    background: rgba(19, 41, 40, 0.6);
    color: #fdfdfc;
    /* Golden text */
    padding: 1.1333vw 3.4vw;
    /* Slightly larger padding */
    border-radius: 6.4vw;
    font-size: 1.8vh;
    font-weight: bold;
    margin-top: calc(8vw - 36px);
    border: 0.2667vw solid rgba(255, 255, 253, 0.3);
    /* Distinct bottom frame/border */
    box-shadow: 0 1vw 2.2vw rgba(0, 0, 0, 0.6), 0 0 4vw rgba(251, 191, 36, 0.2);
    /* Deep shadow + Glow */
    text-shadow: 0 0.5333vw 1.0667vw rgba(0, 0, 0, 0.9);
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
    top: 11vh;
    left: 50%;
    transform: translateX(-50%);
    /* Background and Border handled by inline style */
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
    font-weight: bold;
    z-index: 5;
    padding: 0 16px;
    box-sizing: border-box;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
    text-shadow: 1px 2px 1px rgba(0, 0, 0, 0.3);
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
    padding-bottom: 30px;
}

/* GameView.vue specific styles for myPlayer components */
/* GameView.vue specific styles for myPlayer components */
.my-hand-cards-area {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    margin-top: 5px;
    margin-bottom: -53px;
    position: relative;
    z-index: 150;
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
    bottom: -5px;
    /* Adjust as needed */
    left: 50%;
    transform: translateX(-50%);
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
    height: 45px;
    /* Doubled size */
    object-fit: contain;
    vertical-align: middle;
}

.my-player-info-row {
    position: relative;
    /* Anchor for status float */
    display: flex;

    justify-content: center;
    /* Center align user info */

    align-items: center;

    width: 100%;

    box-sizing: border-box;

    padding: 0 20px;
    /* Padding for spacing from screen edges */

    margin-top: 0;
    /* Adjust spacing from element above */

    margin-bottom: 10px;
    /* Adjust spacing from element below */

}

/* Player Info (avatar, name, coins) styles (adapted from PlayerSeat.vue for myPlayer) */
.my-player-info-row .avatar-area {
    position: relative;
    display: flex;
    flex-direction: column;
    /* Changed to column */
    align-items: center;
    /* Center align */
    width: auto;
    /* Let it shrink to content */
}

.my-player-info-row .avatar-wrapper {
    position: relative;
    width: 62px;
    height: 62px;
    flex-shrink: 0;
    border-radius: 50%;
    /* Removed z-index to allow child badge to pop over sibling info-box */
}

.my-player-info-row .avatar-frame {
    width: 100%;
    height: 100%;
    /* Use the imported image for background */

    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-color: transparent;

    border-radius: 50%;
    /* Remove old border properties */
    border: none;
    box-shadow: none;

    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
    padding: 0;
}

.my-player-info-row .avatar-frame.banker-candidate-highlight {
    box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
    border-color: #fbbf24;
    animation: pulse-border-glow 1s infinite alternate;
}

@keyframes pulse-border-glow {
    from {
        box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
    }

    to {
        box-shadow: 0 0 15px 5px #fbbf24, 0 0 8px 2px #d97706;
    }
}

.my-player-info-row .avatar-frame.is-banker {
    border-color: #fbbf24;
    box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
    /* Slightly weaker shadow */
    transition: none;
}

/* Hide static banker styles while animation is playing on the wrapper to prevent double shadows */
.my-player-info-row .avatar-wrapper.banker-confirm-anim .avatar-frame.is-banker {
    box-shadow: none !important;
    border-color: transparent !important;
}

.my-player-info-row .avatar-wrapper.banker-confirm-anim {
    position: relative;
    z-index: 5;
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
    top: 25%;
    /* Center vertically */
    right: -10px;
    /* Position on the right edge */
    width: 23px;
    /* 3/4 of original size (24px) */
    height: 23px;
    /* 3/4 of original size (24px) */
    /* 使用 flex 完美居中 */
    display: flex;
    justify-content: center;
    align-items: center;
    background: radial-gradient(circle at 30% 30%, #fcd34d 0%, #d97706 100%);
    color: #78350f;
    font-size: 14px;
    border-radius: 50%;
    font-weight: bold;
    z-index: 9999;
    border: 1px solid #fff;
    box-shadow: 0 0 12px #facc15;
    /* Slightly reduced shadow */
    animation: shine 2s infinite;
    transform: translateY(-50%);
    /* Adjust only Y to center vertically */
}

.banker-badge-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Ensure the entire image is visible within the bounds */
}

.my-player-info-row .info-box {
    margin-left: 0;
    margin-top: -13px;
    /* Slight overlap */
    position: relative;
    z-index: 101;
    /* Higher than banker badge (100) */
    width: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Center text */
    justify-content: center;
    gap: 3px;
    /* Space between name and coins */

    /* Background Image handled by ::before */
    background-color: transparent;

    /* Remove clip-path */
    clip-path: none;

    padding: 4px 6px;
}

.my-player-info-row .info-box::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: var(--bg-img);
    background-size: 100% 100%;
    background-repeat: no-repeat;
    opacity: 0.65;
    z-index: 0;
}

.my-player-info-row .info-box> :not(.banker-badge) {
    position: relative;
    z-index: 1;
}

.my-player-info-row .info-box.is-observer {
    filter: grayscale(100%);
    opacity: 0.6;
}

.my-player-info-row .name {
    font-size: 14px;
    /* Slightly larger than opponents */
    font-weight: bold;
    color: white;
    text-shadow: 0 1px 2px black;
    margin-bottom: 0px;
    max-width: 80%;
    text-align: center;
    line-height: 1.2;
}

.my-player-info-row .coins-pill {
    background: transparent;
    border-radius: 0;
    padding: 0;
    border: none;

    font-size: 13px;
    font-weight: bold;
    color: #fbbf24;
    display: flex;
    align-items: center;
    gap: 2px;
    justify-content: center;
}

.my-player-info-row .coin-icon-seat {
    width: 18px;
    height: 18px;
    object-fit: contain;
}

.my-player-info-row .status-float {
    position: absolute;
    top: auto;
    bottom: 100%;
    /* Position above avatar */
    left: 50%;
    transform: translateX(-50%);
    z-index: 150;
    margin-left: 0;
    width: max-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: bottom 0.3s ease;
}

.status-img {
    height: 27px;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.my-player-info-row .status-float.move-up-high {
    bottom: calc(100% + 23vw);
    /* Approx 140px on mobile, clears cards + calc area */
}

.my-player-info-row .status-float.move-up-low {
    bottom: calc(100% + 7vw);
    /* Approx 75px on mobile, clears cards only */
}



.my-player-info-row .avatar-border-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    /* Above avatar (in frame), below banker badge (100) */
    pointer-events: none;
    object-fit: fill;
    /* Or contain, depending on image */
}

/* Ensure controls container has enough height */
.controls-container {
    margin-bottom: 20px;
    min-height: 120px;
    /* Reserve space for multiplier options */
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    position: relative;
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
    width: 25vw;
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
    padding: 0 12px 5px 12px;
    border-radius: 12px;
    align-self: center;
    /* Prevent stretching in flex container */
}

.observer-waiting-banner {
    /* ... existing styles ... */
    /* Ensure it doesn't conflict with absolute button if needed */
}

/* ... existing styles ... */


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



/* Status Float Pop-up Animation */
.pop-up-enter-active,
.pop-up-leave-active {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: bottom center;
    /* Changed from center left */
}

.pop-up-enter-from {
    opacity: 0;
    /* Start from center and small */
    transform: scale(0.2);
}

.pop-up-leave-to {
    opacity: 0;
    transform: scale(0.5);
}

.list-move {
    transition: transform 0.5s ease;
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
    transform: translate(-50%, -50%) scale(0.1);
    width: 70vw;
    height: auto;
    z-index: 6000;
    pointer-events: none;
    opacity: 0;
    transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease;
}

.result-icon.pop {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
}

.result-icon.bounce {
    transform: translate(-50%, -50%) scale(0.666);
    opacity: 1;
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
    height: 50px;
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







/* Banker Selection Overlay */
.banker-selection-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    /* Changed to 0.3 */
    z-index: 2000;
    /* Above table (200) and most UI, below result (6000) */
    pointer-events: none;
    /* Let clicks pass through if needed, but here mainly for visual */
}

.candidate-item-absolute {
    position: absolute;
    z-index: 2001;
    transition: transform 0.2s;
}

.avatar-wrapper-overlay {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 50%;
    /* Ensure base shape is circle */
    transition: transform 0.1s;
}

.avatar-clip {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    /* This clips the square avatar to a circle */
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    background: #000;
    /* Fallback background */
}

.avatar-img-content {
    width: 100%;
    height: 100%;
    display: block;
}

.highlight-ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 3px solid transparent;
    box-sizing: border-box;
    z-index: 2;
    /* Above image, below frame overlay */
    pointer-events: none;
    transition: border-color 0.1s, box-shadow 0.1s;
}

.avatar-wrapper-overlay .avatar-border-overlay {
    position: absolute;
    top: -5%;
    left: -5%;
    width: 110%;
    height: 110%;
    pointer-events: none;
    z-index: 3;
    /* Topmost decoration */
}

.avatar-wrapper-overlay.highlight {
    transform: scale(1.15);
    z-index: 10;
}

.avatar-wrapper-overlay.highlight .highlight-ring {
    border-color: #fbbf24;
    box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
}

.score-float {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    font-weight: bold;
    font-size: 24px;
    text-shadow: 1px 1px 1px #000;
    animation: floatUpCentered 2s forwards;
    z-index: 200;
    font-family: 'Arial Black', sans-serif;
    pointer-events: none;
    white-space: nowrap;
    display: flex;
    align-items: center;
}

.score-float.win {
    color: #00cf31;
}

.score-float.lose {
    color: #f95f5f;
}

.coin-icon-float {
    width: 20px;
    height: 20px;
    object-fit: contain;
    vertical-align: middle;
    margin: 0 2px;
}

@keyframes floatUpCentered {
    0% {
        transform: translate(-50%, 0) scale(0.5);
        opacity: 0;
    }

    10% {
        transform: translate(-50%, 0) scale(1.2);
        opacity: 1;
    }

    100% {
        transform: translate(-50%, -60px) scale(1);
        opacity: 1;
    }
}

.switch-room-btn {
    /* margin-top: 10px; Removed to use absolute positioning */
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    /* Added to center the image if needed */
    justify-content: center;
    align-items: center;
    padding: 0;
    /* Ensure no padding affects image size */
    width: auto;
    /* Set a default size for the container */
    height: 40px;
    /* Set a default size for the container */
}

.switch-room-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.hosting-btn {
    position: absolute;
    right: -6px;
    top: 76%;
    transform: translateY(-50%);

    cursor: pointer;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    height: 36px;
    width: 88px;
}

.tuoguan-bg {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: contain;
    z-index: 1;
}

.tuoguan-content {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0 4%;
    box-sizing: border-box;
}

.tuoguan-icon {
    height: 60%;
    width: auto;
    object-fit: contain;
}

.tuoguan-text {
    height: 40%;
    width: auto;
    object-fit: contain;
    margin-left: 6px;
}

.tuoguan-text-ing {
    height: 40%;
    width: auto;
    object-fit: contain;
    margin-left: 2px;
}

.tuoguan-neon-border {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 3;
    pointer-events: none;
}

.tuoguan-neon-border path {
    stroke-width: 2.2px;
    stroke-linecap: round;
}

.tuoguan-neon-border .neon-base {
    stroke: rgba(224, 224, 224, 0.15);
    filter: drop-shadow(0 0 2px rgba(224, 224, 224, 0.25));
}

.tuoguan-neon-border .neon-layer-5 {
    stroke: rgba(224, 224, 224, 0.25);
    stroke-dasharray: 180 46;
    animation: neon-chase-5 2s linear infinite;
}

.tuoguan-neon-border .neon-layer-4 {
    stroke: rgba(224, 224, 224, 0.25);
    stroke-dasharray: 140 86;
    animation: neon-chase-4 2s linear infinite;
    filter: drop-shadow(0 0 2px rgba(224, 224, 224, 0.35));
}

.tuoguan-neon-border .neon-layer-3 {
    stroke: rgba(224, 224, 224, 0.35);
    stroke-dasharray: 100 126;
    animation: neon-chase-3 2s linear infinite;
    filter: drop-shadow(0 0 3px rgba(224, 224, 224, 0.45));
}

.tuoguan-neon-border .neon-layer-2 {
    stroke: rgba(224, 224, 224, 0.85);
    stroke-dasharray: 60 166;
    animation: neon-chase-2 2s linear infinite;
    filter: drop-shadow(0 0 4px rgba(224, 224, 224, 0.5));
}

.tuoguan-neon-border .neon-layer-1 {
    stroke: #ffffff;
    stroke-dasharray: 20 206;
    animation: neon-chase-1 2s linear infinite;
    filter: drop-shadow(0 0 5px #ffffff);
}

@keyframes neon-chase-5 {
    0% {
        stroke-dashoffset: 90;
    }

    100% {
        stroke-dashoffset: -136;
    }
}

@keyframes neon-chase-4 {
    0% {
        stroke-dashoffset: 70;
    }

    100% {
        stroke-dashoffset: -156;
    }
}

@keyframes neon-chase-3 {
    0% {
        stroke-dashoffset: 50;
    }

    100% {
        stroke-dashoffset: -176;
    }
}

@keyframes neon-chase-2 {
    0% {
        stroke-dashoffset: 30;
    }

    100% {
        stroke-dashoffset: -196;
    }
}

@keyframes neon-chase-1 {
    0% {
        stroke-dashoffset: 10;
    }

    100% {
        stroke-dashoffset: -216;
    }
}

.hosting-btn:active {
    transform: translateY(-50%) scale(0.95);
}
</style>

<style>
/* Switch Room Snapshot Overlay */
.switch-snapshot-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100dvh;
    z-index: 9999;
    /* Highest priority */
    pointer-events: none;
    /* Let clicks pass if needed, but usually blocks */
    overflow: hidden;
    transition: transform 0.5s ease-in-out;
}

.switch-snapshot-overlay.slide-out-left {
    transform: translateX(-100%);
}

.snapshot-clone-container {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
}

.frosted-glass-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    /* Match previous darkness */
    backdrop-filter: blur(8px);
    /* Frosted glass effect */
    z-index: 2;
}

.snapshot-text-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
}

.snapshot-text-container .switch-room-text-img {
    width: 30vw;
    margin-right: 2px;
}

@keyframes fadeIn {
    to {
        opacity: 1;
    }
}

.switch-room-logo.logo-enter {
    animation: logoBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.switch-room-logo.logo-leave {
    transition: all 0.3s ease-in;
    transform: scale(0.1);
    opacity: 0;
}

@keyframes logoBounce {
    0% {
        transform: scale(0.1);
        opacity: 0;
    }

    70% {
        transform: scale(1.1);
        opacity: 1;
    }

    100% {
        transform: scale(1.0);
        opacity: 1;
    }
}


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

@keyframes bankerConfirmPop {
    0% {
        border-color: #fbbf24;
        box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
        transform: scale(1);
    }

    50% {
        border-color: #fbbf24;
        box-shadow: 0 0 20px 6px #fbbf24, 0 0 10px 2px #d97706;
        transform: scale(1.2);
    }

    100% {
        border-color: #fbbf24;
        box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
        transform: scale(1);
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