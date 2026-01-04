<script setup>
import { onMounted, computed, onUnmounted, ref, watch } from 'vue';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';
import PlayerSeat from '../components/PlayerSeat.vue';
import CoinLayer from '../components/CoinLayer.vue';
import DealingLayer from '../components/DealingLayer.vue';
import ChatBubbleSelector from '../components/ChatBubbleSelector.vue';
import { useRouter, useRoute } from 'vue-router';
import { formatCoins } from '../utils/format.js';

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
    playPhraseSound(index);
    playerSpeech.value.set(store.myPlayerId, { type: 'text', content: phrase });
    setTimeout(() => {
        playerSpeech.value.delete(store.myPlayerId);
    }, 3000);
};

const onEmojiSelected = (emojiUrl) => {
    if (!checkCooldown()) {
        return;
    }
    playerSpeech.value.set(store.myPlayerId, { type: 'emoji', content: emojiUrl });
    setTimeout(() => {
        playerSpeech.value.delete(store.myPlayerId);
    }, 3000);
};

// Banker selection animation state
const currentlyHighlightedPlayerId = ref(null);
let animationIntervalId = null;
let candidateIndex = 0;

// Robot Speech/Emoji Logic
const robotSpeechInterval = ref(null);
const lastRobotSpeechTime = ref(new Map());
const ROBOT_SPEECH_PROBABILITY = 0.2;
const ROBOT_SPEECH_CHECK_INTERVAL_SECONDS = 5;
const ROBOT_SPEECH_COOLDOWN_SECONDS = 15;

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

import emoji1 from '@/assets/emoji/emoji_1.png';
import emoji2 from '@/assets/emoji/emoji_2.png';
import emoji3 from '@/assets/emoji/emoji_3.png';
import emoji4 from '@/assets/emoji/emoji_4.png';
import emoji5 from '@/assets/emoji/emoji_5.png';
import emoji6 from '@/assets/emoji/emoji_6.png';
import emoji7 from '@/assets/emoji/emoji_7.png';
import emoji8 from '@/assets/emoji/emoji_8.png';
import emoji9 from '@/assets/emoji/emoji_9.png';
import emoji10 from '@/assets/emoji/emoji_10.png';
import emoji11 from '@/assets/emoji/emoji_11.png';
import emoji12 from '@/assets/emoji/emoji_12.png';
import emoji13 from '@/assets/emoji/emoji_13.png';
import emoji14 from '@/assets/emoji/emoji_14.png';
import emoji15 from '@/assets/emoji/emoji_15.png';
import emoji16 from '@/assets/emoji/emoji_16.png';

const allEmojis = [
    emoji1, emoji2, emoji3, emoji4, emoji5, emoji6, emoji7, emoji8,
    emoji9, emoji10, emoji11, emoji12, emoji13, emoji14, emoji15, emoji16
];

const triggerRobotSpeech = (robotId, type, content) => {
    playerSpeech.value.set(robotId, { type, content });
    playerSpeech.value = new Map(playerSpeech.value);

    lastRobotSpeechTime.value.set(robotId, Date.now());
    setTimeout(() => {
        playerSpeech.value.delete(robotId);
        playerSpeech.value = new Map(playerSpeech.value);
    }, 3000);
};

const startRobotSpeech = () => {
    robotSpeechInterval.value = setInterval(() => {
        // If mute users is enabled, robots should be silent (visual and audio)
        if (settingsStore.muteUsers) return;

        const currentPlayers = store.players;
        if (!currentPlayers || currentPlayers.length <= 1) {
            return;
        }

        currentPlayers.forEach(p => {
            if (p.id === store.myPlayerId) return;

            const robotId = p.id;
            const now = Date.now();
            const lastSpoke = lastRobotSpeechTime.value.get(robotId) || 0;

            if (now - lastSpoke < ROBOT_SPEECH_COOLDOWN_SECONDS * 1000) {
                return;
            }

            if (Math.random() < ROBOT_SPEECH_PROBABILITY) {
                if (Math.random() < 0.5) {
                    const randomIndex = Math.floor(Math.random() * commonPhrases.length);
                    const phrase = commonPhrases[randomIndex];
                    playPhraseSound(randomIndex);
                    triggerRobotSpeech(robotId, 'text', phrase);
                } else {
                    const randomIndex = Math.floor(Math.random() * allEmojis.length);
                    const emojiUrl = allEmojis[randomIndex];
                    triggerRobotSpeech(robotId, 'emoji', emojiUrl);
                }
            }
        });
    }, ROBOT_SPEECH_CHECK_INTERVAL_SECONDS * 1000);
};

const showMenu = ref(false);
const showHistory = ref(false);
const isDebugPanelExpanded = ref(false);

const visibleCounts = ref({});

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

// Watch Music Setting
watch(() => settingsStore.musicEnabled, (val) => {
    if (bgAudio.value) {
        if (val) {
            bgAudio.value.play().catch(() => {});
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
                const seatRect = seatEl.getBoundingClientRect();
                let count = 3 + (p.bet - 1) * 2;
                if (count > 15) count = 15;
                coinLayer.value.throwCoins(seatRect, centerRect, count);
            }
        }
        lastBetStates.value[p.id] = p.bet;
    });
}, { deep: true });

watch(() => store.currentPhase, async (newPhase, oldPhase) => {
    if (newPhase === 'IDLE' || newPhase === 'GAME_OVER') {
        visibleCounts.value = {};
        lastBetStates.value = {};
    } else if (newPhase === 'PRE_DEAL') {
        visibleCounts.value = {};
        setTimeout(() => {
            startDealingAnimation();
        }, 100);
    } else if (newPhase === 'ROB_BANKER') {
        if (oldPhase !== 'PRE_DEAL') {
            visibleCounts.value = {};
        }
        lastBetStates.value = {};

        // 只有看牌抢庄(mode != 0)才需要在抢庄阶段发牌
        if (store.gameMode !== 0) {
            setTimeout(() => {
                startDealingAnimation(true);
            }, 100);
        }
    } else if (newPhase === 'DEALING') { // Changed from SHOWDOWN to DEALING for animation
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


    if (newPhase === 'SETTLEMENT' && tableCenterRef.value && coinLayer.value) {
        const banker = store.players.find(p => p.isBanker);
        let bankerRect = null;
        if (banker) {
            const bankerEl = seatRefs.value[banker.id];
            if (bankerEl) bankerRect = bankerEl.getBoundingClientRect();
        }

        if (!bankerRect) {
            bankerRect = tableCenterRef.value.getBoundingClientRect();
        }

        store.players.forEach(p => {
            if (!p.isBanker && p.roundScore < 0) {
                const seatEl = seatRefs.value[p.id];
                if (seatEl) {
                    const seatRect = seatEl.getBoundingClientRect();
                    let count = Math.ceil(Math.abs(p.roundScore) / 20);
                    if (count < 5) count = 5;
                    if (count > 20) count = 20;
                    coinLayer.value.throwCoins(seatRect, bankerRect, count);
                }
            }
        });

        setTimeout(() => {
            store.players.forEach(p => {
                if (!p.isBanker && p.roundScore > 0) {
                    const seatEl = seatRefs.value[p.id];
                    if (seatEl) {
                        const seatRect = seatEl.getBoundingClientRect();
                        let count = Math.ceil(p.roundScore / 15);
                        if (count < 8) count = 8;
                        if (count > 30) count = 30;
                        coinLayer.value.throwCoins(bankerRect, seatRect, count);
                    }
                }
            });
        }, 1200);
    }
}, { immediate: true });

const startDealingAnimation = (isSupplemental = false) => {
    if (!isSupplemental) {
        visibleCounts.value = {}; // Reset visible counts ONLY if not supplemental
    }
    if (!dealingLayer.value) return;

    const targets = [];
    store.players.forEach(p => {
        if (!p.hand || p.hand.length === 0) return;

        const currentVisible = visibleCounts.value[p.id] || 0;
        const total = p.hand.length;
        const toDeal = total - currentVisible;

        if (toDeal > 0) {
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
                    startIdx: currentVisible,
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
            }, isSupplemental && store.gameMode === 2);
        }, pIndex * 80);
    });;
};

onMounted(() => {
    const gameMode = route.query.mode !== undefined ? route.query.mode : 0;
    store.initGame(gameMode);

    if (route.query.autoJoin) {
        // Display speech bubble for re-joining
        setTimeout(() => {
            playerSpeech.value.set(store.myPlayerId, { type: 'text', content: '上一局游戏未结束，自动进入房间' });
        }, 500); // Small delay to ensure UI is ready

        setTimeout(() => {
            playerSpeech.value.delete(store.myPlayerId);
        }, 3500);

        // Remove query param
        router.replace({ query: { ...route.query, autoJoin: undefined } });
    }

    startRobotSpeech();

    bgAudio.value = new Audio(gameBgSound);
    bgAudio.value.loop = true;
    bgAudio.value.volume = 0.5;
    
    if (settingsStore.musicEnabled) {
        bgAudio.value.play().catch(() => { });
    }
});

onUnmounted(() => {
    store.resetState();
    if (robotSpeechInterval.value) {
        clearInterval(robotSpeechInterval.value);
    }
    if (bgAudio.value) {
        bgAudio.value.pause();
        bgAudio.value = null;
    }
});

const onRob = (multiplier) => {
    store.playerRob(multiplier);
};

const onBet = (multiplier) => {
    store.playerBet(multiplier);
};

const openHistory = () => {
    showMenu.value = false;
    showHistory.value = true;
};

const openSettings = () => {
    showMenu.value = false;
    showSettings.value = true;
};

const quitGame = () => {
    router.replace('/lobby');
};
</script>

<template>
    <div class="game-table">
        <DealingLayer ref="dealingLayer" />
        <CoinLayer ref="coinLayer" />

        <!-- Debug Control Panel -->
        <div class="debug-panel">
            <div class="debug-title" @click="isDebugPanelExpanded = !isDebugPanelExpanded">
                阶段控制
                <span style="margin-left: 5px;float: right;">{{ isDebugPanelExpanded ? '▼' : '▲' }}</span>
            </div>
            <div v-show="isDebugPanelExpanded" class="debug-buttons">
                <button @click="store.enterStateWaiting()">等待用户</button>
                <button @click="store.enterStatePrepare()">准备开始</button>
                <button @click="store.enterStatePreCard()">预先发牌</button>
                <button @click="store.enterStateBanking()">开始抢庄</button>
                <button @click="store.enterStateRandomBank()">随机选庄</button>
                <button @click="store.enterStateBankerConfirm()">确认庄家</button>
                <button @click="store.enterStateBetting()">闲家下注</button>
                <button @click="store.enterStateDealing()">补充手牌</button>
                <button @click="store.enterStateShowCard()">摊牌比拼</button>
                <button @click="store.enterStateSettling()">结算对局</button>
            </div>
        </div>

        <!-- 顶部栏 -->
        <div class="top-bar">
            <div class="menu-container">
                <div class="menu-btn" @click.stop="showMenu = !showMenu">
                    <van-icon name="wap-nav" size="20" color="white" />
                    <span style="margin-left:4px;font-size:14px;">菜单</span>
                </div>
                <!-- 下拉菜单 -->
                <transition name="fade">
                    <div v-if="showMenu" class="menu-dropdown" @click.stop>
                        <div class="menu-item" @click="openHistory">
                            <van-icon name="balance-list-o" /> 投注记录
                        </div>
                        <div class="menu-divider"></div>
                        <div class="menu-item" @click="openSettings">
                            <van-icon name="setting-o" /> 游戏设置
                        </div>
                        <div class="menu-divider"></div>
                        <div class="menu-item danger" @click="quitGame">
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
                    :speech="playerSpeech.get(p.id)" />
                <div v-else class="empty-seat">
                    <div class="empty-seat-avatar">
                        <van-icon name="plus" color="rgba(255,255,255,0.3)" size="20" />
                    </div>
                    <div class="empty-seat-text">等待加入</div>
                </div>
            </div>
        </div>

        <div class="table-center" ref="tableCenterRef">
            <!-- 闹钟和阶段提示信息的容器 -->
            <div v-if="store.countdown > 0 && ['READY_COUNTDOWN', 'ROB_BANKER', 'BETTING', 'SHOWDOWN'].includes(store.currentPhase)"
                class="clock-and-info-wrapper">
                <!-- 倒计时闹钟 -->
                <div class="alarm-clock">
                    <div class="alarm-body">
                        <div class="alarm-time">{{ store.countdown < 10 ? '0' + store.countdown : store.countdown
                                }}</div>
                        </div>
                        <div class="alarm-ears left"></div>
                        <div class="alarm-ears right"></div>
                    </div>

                    <!-- 阶段提示信息，统一显示在倒计时下方并样式类似“结算中...” -->
                    <div class="phase-info">
                        <span v-if="store.currentPhase === 'WAITING_FOR_PLAYERS'">匹配玩家中...</span>
                        <span v-else-if="store.currentPhase === 'READY_COUNTDOWN'">游戏即将开始</span>
                        <span v-else-if="store.currentPhase === 'ROB_BANKER'">看牌抢庄</span>
                        <span v-else-if="store.currentPhase === 'BETTING'">闲家下注</span>
                        <span v-else-if="store.currentPhase === 'SHOWDOWN'">摊牌比拼</span>
                    </div>
                </div>

                <!-- 选庄动画提示 -->
                <div v-if="store.currentPhase === 'BANKER_SELECTION_ANIMATION'" class="phase-info settlement-info">
                    正在选庄...</div>
                <div v-if="store.currentPhase === 'BANKER_CONFIRMED'" class="phase-info settlement-info">庄家已定</div>

                <!-- 仅当闹钟不显示时，显示结算中 -->
                <div v-if="store.currentPhase === 'SETTLEMENT' && store.countdown === 0"
                    class="phase-info settlement-info">结算中...</div>

                <!-- 重新开始按钮 -->
                <div v-if="store.currentPhase === 'GAME_OVER'" class="restart-btn" @click="store.startGame()">
                    继续游戏
                </div>
            </div>

            <!-- 自己区域 -->

            <div class="my-area" v-if="myPlayer">
                <div class="controls-container">


                    <div v-if="store.currentPhase === 'ROB_BANKER' && !myPlayer.isObserver" class="btn-group">
                        <div class="game-btn blue" @click="onRob(0)">不抢</div>
                        <div class="game-btn orange" @click="onRob(1)">1倍</div>
                        <div class="game-btn orange" @click="onRob(2)">2倍</div>
                        <div class="game-btn orange" @click="onRob(3)">3倍</div>
                    </div>

                    <div v-if="store.currentPhase === 'BETTING' && !myPlayer.isBanker && myPlayer.betMultiplier === 0 && !myPlayer.isObserver"
                        class="btn-group">
                        <div class="game-btn orange" @click="onBet(1)">1倍</div>
                        <div class="game-btn orange" @click="onBet(2)">2倍</div>
                        <div class="game-btn orange" @click="onBet(5)">5倍</div>
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
                        class="btn-group">
                        <div class="game-btn orange" style="width: 100px" @click="store.playerShowHand(myPlayer.id)">摊牌
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
                    :speech="myPlayer ? playerSpeech.get(myPlayer.id) : null" />
            </div>

            <!-- 全局点击关闭菜单 -->
            <div v-if="showMenu" class="mask-transparent" @click="showMenu = false"></div>

            <!-- 评论/表情按钮 -->
            <div class="chat-toggle-btn" @click="showChatSelector = true">
                <van-icon name="comment" size="24" color="white" />
            </div>

            <!-- 押注记录弹窗 -->
            <div v-if="showHistory" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>投注记录</h3>
                        <div class="close-icon" @click="showHistory = false">×</div>
                    </div>
                    <div class="history-list">
                        <div v-if="store.history.length === 0" class="empty-tip">暂无记录</div>
                        <div v-for="(item, idx) in store.history" :key="idx" class="history-item">
                            <div class="h-row top">
                                <span class="h-time">{{ new Date(item.timestamp).toLocaleTimeString() }}</span>
                                <span class="h-role" :class="{ banker: item.isBanker }">{{ item.isBanker ? '庄' : '闲'
                                    }}</span>
                            </div>
                            <div class="h-row main">
                                <span class="h-result" :class="item.score >= 0 ? 'win' : 'lose'">
                                    {{ item.score >= 0 ? '赢' : '输' }}
                                </span>
                                <span class="h-score" :class="item.score >= 0 ? 'win' : 'lose'">
                                    {{ item.score >= 0 ? '+' : '' }}{{ formatCoins(item.score) }}
                                </span>
                                <span class="h-hand">{{ item.handType }}</span>
                            </div>
                            <div class="h-row bottom">
                                <span>余额: {{ formatCoins(item.balance) }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Settings Modal -->
            <div v-if="showSettings" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>游戏设置</h3>
                        <div class="close-icon" @click="showSettings = false">×</div>
                    </div>
                    <div class="settings-list">
                        <div class="setting-item">
                            <span>背景音乐</span>
                            <van-switch v-model="settingsStore.musicEnabled" size="24px" active-color="#13ce66" inactive-color="#ff4949" />
                        </div>
                        <div class="setting-item">
                            <span>游戏音效</span>
                            <van-switch v-model="settingsStore.soundEnabled" size="24px" active-color="#13ce66" inactive-color="#ff4949" />
                        </div>
                        <div class="setting-item">
                            <span>屏蔽他人发言</span>
                            <van-switch v-model="settingsStore.muteUsers" size="24px" active-color="#13ce66" inactive-color="#ff4949" />
                        </div>
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
    color: #fef3c7; /* Light gold/cream */
    font-size: 16px;
    font-weight: bold;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.7), rgba(17, 24, 39, 0.9), rgba(0, 0, 0, 0.7));
    padding: 10px 30px;
    border-radius: 24px;
    border: 1px solid rgba(251, 191, 36, 0.4); /* Gold border */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    margin-bottom: 10px;
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
    z-index: 200;
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
    z-index: 2000;
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
    transform: scale(0.85);
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
    transform: scale(0.85);
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

.alarm-clock {
    position: relative;
    width: 60px;
    height: 60px;
    /* pointer-events: auto; moved to wrapper */
    z-index: 1002;
    /* 必须高于发牌层(999) */
}

.alarm-body {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 30% 30%, #fff 0%, #e5e5e5 100%);
    border-radius: 50%;
    border: 4px solid #f97316;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    z-index: 2;
    position: relative;
}

.alarm-time {
    font-size: 24px;
    font-weight: bold;
    color: #333;
    font-family: monospace;
}

.alarm-ears {
    position: absolute;
    /* top: -6px; Removed to allow individual positioning */
    width: 16px;
    height: 16px;
    background: #f97316;
    border-radius: 50%;
    z-index: 1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.alarm-ears.left {
    top: -6px;
    left: 2px;
    transform: rotate(-15deg);
}

/* Keep original top for left ear */
.alarm-ears.right {
    top: -5px;
    right: -5px;
    transform: rotate(15deg);
}

/* Move right 5px, up 2px */

.phase-info {
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
    margin-top: 10px;
}

.phase-info.settlement-info {
    /* Added for the independent settlement info */
    margin-top: 10px;
    /* To maintain some distance from other elements if not in wrapper */
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
    min-height: 50px;
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
</style>