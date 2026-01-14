<script setup>
import { computed, ref, watch } from 'vue';
import { useGameStore } from '../stores/game.js';
import PokerCard from './PokerCard.vue';
import { formatCoins } from '../utils/format.js';
import goldImg from '@/assets/common/gold.png';
import zhuangImg from '@/assets/common/zhuang.png';
import avatarFrameImg from '@/assets/common/avatar_circle.png';
import userInfoBgImg from '@/assets/common/user_info_rect.png';

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
import niuMeiImg from '@/assets/niu/niu_mei.png';

const NO_BULL_TYPE_NAME = '没牛'; // New constant

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
    '四花牛': niuSihuaImg,
    '五花牛': niuWuhuaImg,
    '五小牛': niuWuxiaoImg,
    [NO_BULL_TYPE_NAME]: niuMeiImg, // Use constant here
};

const getHandTypeImageUrl = (handTypeName) => {
    // Normalize handTypeName for lookup
    const normalizedHandTypeName = handTypeName ? handTypeName.trim() : ''; // Add trim for robustness
    return handTypeImageMap[normalizedHandTypeName] || null; // Return null if no image found
};



const props = defineProps({
    player: Object,
    isMe: Boolean,
    isVertical: Boolean, // 兼容旧逻辑
    position: {
        type: String,
        default: 'top'
    },
    visibleCardCount: { // 控制显示几张牌，-1为全部显示
        type: Number,
        default: -1
    },
    isReady: Boolean, // Add isReady prop
    isAnimatingHighlight: Boolean, // New prop for sequential highlight animation
    speech: Object, // New prop: { type: 'text' | 'emoji', content: string }
    selectedCardIndices: {
        type: Array,
        default: () => []
    },
    triggerBankerAnimation: Boolean, // New prop for one-time banker confirmation animation
    isWin: Boolean // New prop for neon flash effect on winner
});

const store = useGameStore();
const emit = defineEmits(['card-click']);

// Computed property to control speech bubble visibility
const showSpeechBubble = computed(() => {
    return props.speech && props.speech.content;
});

// Computed property to calculate dynamic width for speech bubble
const speechBubbleStyle = computed(() => {
    // Return empty to let CSS handle width (responsive)
    return {};
});

// 始终返回完整手牌以保持布局稳定
const displayedHand = computed(() => {
    if (!props.player.hand) return [];
    return props.player.hand;
});

const showCards = computed(() => {
    return displayedHand.value.length > 0;
});

const shouldShowCardFace = computed(() => {
    if (props.isMe) return true;
    if (store.currentPhase === 'SETTLEMENT') return true;
    if (store.currentPhase === 'SHOWDOWN' && props.player.isShowHand) return true;
    return false;
});

// 控制高亮显示的延迟开关 (为了等翻牌动画结束)
const enableHighlight = ref(false);

const isDealingProcessing = ref(false);

watch(() => store.currentPhase, (val) => {
    if (val === 'DEALING') {
        isDealingProcessing.value = true;
    } else if (val === 'SHOWDOWN') {
        // 如果是 SHOWDOWN，给一点缓冲时间让发牌动画视觉结束
        setTimeout(() => {
            isDealingProcessing.value = false;
        }, 1200); // 1.2秒延迟，覆盖发牌动画的尾巴
    } else {
        isDealingProcessing.value = false;
    }
}, { immediate: true });

watch(shouldShowCardFace, (val) => {
    if (val) {
        if (props.isMe) {
            // 自己不用等翻牌动画 (因为一直是正面)，直接就绪
            enableHighlight.value = true;
        } else {
            // 别人(机器人)需要等翻牌动画(约600ms)结束后再高亮
            enableHighlight.value = false;
            setTimeout(() => {
                enableHighlight.value = true;
            }, 800);
        }
    } else {
        enableHighlight.value = false;
    }
}, { immediate: true });

const isBullPart = (index) => {
    if (!shouldShowCardFace.value) return false;
    if (!props.player.handResult) return false;

    // Strict check for "Me": Only show overlay if I clicked show hand OR it's settlement
    if (props.isMe) {
        if (!props.player.isShowHand && store.currentPhase !== 'SETTLEMENT') {
            return false;
        }
    }

    // Must wait for animation delay to end
    if (!enableHighlight.value) return false;

    // Do not apply overlay during DEALING phase or during the dealing buffer period
    if (store.currentPhase === 'DEALING' || (!props.player.isShowHand && isDealingProcessing.value)) return false;

    const type = props.player.handResult.type;
    // Only bull types (BULL_1 ~ BULL_BULL) have cards to highlight as bull parts
    if (type.startsWith('BULL_') && type !== 'NO_BULL') {
        const indices = props.player.handResult.bullIndices;
        // If the card's index IS in bullIndices, it's a bull card to receive the overlay
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
    if (!props.player.handResult) return false;
    // Hide badge during IDLE, READY_COUNTDOWN and GAME_OVER phases
    if (['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)) return false;

    // Unified logic: Show if player has shown hand OR if it is settlement
    return props.player.isShowHand || store.currentPhase === 'SETTLEMENT';
});

watch(badgeTriggerCondition, (val) => {
    if (badgeTimer) {
        clearTimeout(badgeTimer);
        badgeTimer = null;
    }

    if (val) {
        if (props.isMe) {
            shouldShowBadge.value = true;
        } else {
            // Delay for others
            badgeTimer = setTimeout(() => {
                shouldShowBadge.value = true;
            }, 500);
        }
    } else {
        shouldShowBadge.value = false;
    }
}, { immediate: true });

const shouldShowRobMult = computed(() => {
    // Hide in IDLE or READY phases (new game)
    if (['IDLE', 'READY_COUNTDOWN'].includes(store.currentPhase)) return false;

    // Phase: Robbing Banker or Selection (Show for everyone who has acted)
    if (['ROB_BANKER', 'BANKER_SELECTION_ANIMATION', 'BANKER_CONFIRMED'].includes(store.currentPhase)) {
        return props.player.robMultiplier > -1;
    }

    // Phase: After Banking (Show only for Banker)
    // Phases: BANKER_CONFIRMED, BETTING, DEALING, SHOWDOWN, SETTLEMENT, GAME_OVER
    if (props.player.isBanker) {
        return true;
    }

    return false;
});

const shouldShowBetMult = computed(() => {
    // Hide in IDLE or READY phases
    if (['IDLE', 'READY_COUNTDOWN', 'ROB_BANKER', 'BANKER_SELECTION_ANIMATION', 'BANKER_CONFIRMED'].includes(store.currentPhase)) return false;

    // Only show for Non-Banker
    if (props.player.isBanker) return false;

    // Show if bet is placed
    return props.player.betMultiplier > 0;
});

const slideTransitionName = computed(() => {
    return 'pop-up';
});

const displayName = computed(() => {
    const name = props.player.name || '';
    if (props.isMe) {
        if (name.length > 10) {
            return name.slice(0, 4) + '...' + name.slice(-4);
        }
        return name;
    }
    if (name.length <= 1) return name;

    const first = name.charAt(0);
    const last = name.charAt(name.length - 1);

    // Check if first character is Chinese
    if (/^[\u4e00-\u9fa5]/.test(name)) {
        // Chinese: first + stars (length - 2) + last
        // If length is 2, stars will be 0, showing full name "张三"
        const starCount = Math.max(0, name.length - 2);
        return `${first}${'*'.repeat(starCount)}${last}`;
    } else {
        // Pure English / Other: first + fixed 6 stars + last
        return `${first}******${last}`;
    }
});
</script>
<template>
    <div class="player-seat" :class="`seat-${position}`">
        <!-- ... (keep avatar area) -->
        <div class="avatar-area">
            <div class="avatar-wrapper">
                <div class="avatar-frame" :class="{
                    'banker-candidate-highlight': isAnimatingHighlight,
                    'banker-confirm-anim': triggerBankerAnimation,
                    'is-banker': player.isBanker && !['SETTLEMENT', 'GAME_OVER'].includes(store.currentPhase),
                    'win-neon-flash': isWin,
                    'is-opponent': true
                }">
                    <van-image :src="player.avatar" class="avatar" fit="cover"
                        :class="{ 'avatar-gray': player.isObserver, 'opponent-avatar': true }" />
                </div>

                <!-- Avatar Frame Overlay -->
                <img :src="avatarFrameImg" class="avatar-border-overlay" />

                <!-- Speech Bubble -->
                <div v-show="showSpeechBubble" class="speech-bubble" :style="speechBubbleStyle"
                    :class="{ 'speech-visible': showSpeechBubble }">
                    <span v-if="speech && speech.type === 'text'">{{ speech.content }}</span>
                    <img v-else-if="speech && speech.type === 'emoji'" :src="speech.content" class="speech-emoji" />
                </div>

                <!-- 状态浮层，移到 avatar-area 以便相对于头像定位 -->
                <div class="status-float" :class="{ 'is-me': isMe }"
                    v-if="!['IDLE', 'READY_COUNTDOWN'].includes(store.currentPhase)">
                    <Transition :name="slideTransitionName">
                        <div v-if="shouldShowRobMult" class="status-content">
                            <span v-if="player.robMultiplier > 0" class="status-text rob-text"
                                :class="{ 'text-large': isMe }">抢{{ player.robMultiplier
                                }}倍</span>
                            <span v-else class="status-text no-rob-text" :class="{ 'text-large': isMe }">不抢</span>
                        </div>
                    </Transition>

                    <Transition :name="slideTransitionName">
                        <div v-if="shouldShowBetMult" class="status-content">
                            <span class="status-text bet-text" :class="{ 'text-large': isMe }">押{{ player.betMultiplier
                                }}倍</span>
                        </div>
                    </Transition>
                </div>

                <!-- 庄家徽章，现在移动到 avatar-area 内部 -->
                <div v-if="player.isBanker && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)"
                    class="banker-badge"><img :src="zhuangImg" alt="庄" class="banker-badge-img" /></div>
                <!-- Ready Badge -->
                <div v-if="player.isReady && store.currentPhase === 'READY_COUNTDOWN'" class="ready-badge">✔ 准备</div>

                <!-- Observer Badge -->
                <div v-if="player.isObserver" class="observer-badge">等待下一局</div>
            </div>

            <div class="info-box" :style="{ backgroundImage: `url(${userInfoBgImg})` }"
                :class="{ 'is-observer': player.isObserver }">
                <div class="name van-ellipsis">{{ displayName }}</div>
                <div class="coins-pill">
                    {{ formatCoins(player.coins) }}
                </div>
            </div>
        </div>

        <!-- ... (keep score float) -->
        <div v-if="player.roundScore !== 0 && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)"
            class="score-float" :class="player.roundScore > 0 ? 'win' : 'lose'">
            {{ player.roundScore > 0 ? '+' : '' }}<img :src="goldImg" class="coin-icon-float" />{{
                formatCoins(player.roundScore) }}
        </div>

        <!-- 手牌区域 (始终渲染以占位) -->
        <div class="hand-area" :class="{ 'opponent-hand': !isMe }">
            <div class="cards" :class="{ 'is-me-cards': isMe }"
                :style="{ visibility: showCards ? 'visible' : 'hidden' }">
                <PokerCard v-for="(card, idx) in displayedHand" :key="idx"
                    :card="(shouldShowCardFace && (visibleCardCount === -1 || idx < visibleCardCount)) ? card : null"
                    :is-small="!isMe"
                    :class="{ 'hand-card': true, 'bull-card-overlay': isBullPart(idx), 'selected': selectedCardIndices.includes(idx) }"
                    :style="{
                        opacity: (visibleCardCount === -1 || idx < visibleCardCount) ? 1 : 0,
                    }" @click="props.isMe ? emit('card-click', { card, index: idx }) : null" />
            </div>
            <!-- ... (keep hand result) -->
            <div v-if="shouldShowBadge" class="hand-result-badge">
                <img v-if="getHandTypeImageUrl(player.handResult.typeName)"
                    :src="getHandTypeImageUrl(player.handResult.typeName)" alt="手牌类型" class="hand-type-img" />
                <template v-else>
                    TypeName: "{{ player.handResult.typeName }}" - URL Debug: {{
                        getHandTypeImageUrl(player.handResult.typeName) || 'null' }}
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
.player-seat {
    display: flex;
    align-items: center;
    position: relative;
    width: 100px;
}

.hand-card.selected {
    transform: translateY(-20px);
}

/* 布局方向定义 */
.seat-top {
    flex-direction: column;
}

.seat-bottom {
    flex-direction: column-reverse;
    width: 100%;
}

/* 自己 */
/* 左侧和右侧现在也改为垂直布局：头像在上，牌在下 */
.seat-left,
.seat-top-left {
    flex-direction: column;
}

.seat-right,
.seat-top-right {
    flex-direction: column;
}

/* Allow opponents to have auto width to fit side-by-side info */
.seat-top,
.seat-left,
.seat-right,
.seat-top-left,
.seat-top-right {
    width: 160px;
    /* Fixed width to prevent horizontal shifting */
    min-width: 100px;
    /* Keep minimum width */
}

/* 头像区域微调 */
.seat-bottom .avatar-area {
    margin-top: 10px;
    margin-bottom: 0;
}

.seat-top .avatar-area {
    margin-bottom: 4px;
}

.seat-left .avatar-area,
.seat-top-left .avatar-area {
    margin-bottom: 4px;
}

.seat-right .avatar-area,
.seat-top-right .avatar-area {
    margin-bottom: 4px;
}

.avatar-area {
    justify-content: center;
    position: relative;
    /* Ensure absolute positioning of children is relative to this parent */
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

/* Opponent Avatar Area: ALL Column Layout */
.seat-top .avatar-area,
.seat-left .avatar-area,
.seat-right .avatar-area,
.seat-bottom .avatar-area,
.seat-top-left .avatar-area,
.seat-top-right .avatar-area {
    flex-direction: column;
    align-items: center;
    justify-content: center;
}


.avatar-wrapper {
    position: relative;
    width: 52px;
    height: 52px;
    flex-shrink: 0;
    /* Prevent avatar shrinking */
    /* Removed z-index: 6 to allow banker badge (z-100) to be above info-box (z-10) */
}

/* Increase avatar size for opponents */
:not(.seat-bottom) .avatar-wrapper {
    width: 52px;
    height: 52px;
}

.ready-badge {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    background: #22c55e;
    color: white;
    font-size: 10px;
    padding: 0 4px;
    border-radius: 4px;
    z-index: 20;
    white-space: nowrap;
}

.observer-badge {
    position: absolute;
    bottom: 100%;
    /* Position above the avatar */
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    /* Gap between badge and avatar */
    background: rgba(0, 0, 0, 0.6);
    color: #e5e7eb;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 20;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.avatar-border-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 5;
    /* Above avatar, below banker badge (100) */
    pointer-events: none;
    object-fit: fill;
}

.avatar-frame {
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

    /* Keep overflow hidden for the avatar image inside */
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
    padding: 0;
    /* Inner padding for avatar */
}

/* Avatar Frame: Round for ALL */
.avatar-frame.is-opponent {
    border-radius: 50%;
}

/* Also ensure Van Image has border radius */
.van-image.opponent-avatar {
    border-radius: 50% !important;
    overflow: hidden;
    width: 100% !important;
    height: 100% !important;
}

.avatar-frame.banker-candidate-highlight {
    box-shadow: 0 0 15px 5px #facc15, 0 0 8px 2px #d97706;
    border-color: #facc15;
    animation: pulse-border-glow 1s infinite alternate;
}

.avatar-frame.is-banker {
    border-color: #fbbf24;
    box-shadow: 0 0 6px #fbbf24;
}

.avatar-frame.banker-confirm-anim {
    position: relative;
    z-index: 50;
    animation: bankerConfirmPop 1.2s ease-out forwards;
}

@keyframes bankerConfirmPop {
    0% {
        border-color: transparent;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
    }

    40% {
        border-color: #fbbf24;
        box-shadow: 0 0 25px 8px rgba(251, 191, 36, 0.9);
    }

    60% {
        border-color: #fbbf24;
        box-shadow: 0 0 25px 8px rgba(251, 191, 36, 0.9);
    }

    100% {
        border-color: #fbbf24;
        box-shadow: 0 0 6px #fbbf24;
    }

    /* Smoothly land on steady state */
}

@keyframes pulse-border-glow {
    from {
        box-shadow: 0 0 15px 5px #facc15, 0 0 8px 2px #d97706;
    }

    to {
        box-shadow: 0 0 20px 8px #fcd34d, 0 0 10px 3px #fbbf24;
    }
}

.avatar-frame.win-neon-flash {
    animation: neon-flash 0.5s infinite alternate;
    border-color: #ffd700;
}

@keyframes neon-flash {
    0% {
        box-shadow: 0 0 5px #ffd700, 0 0 10px #ffd700;
    }

    100% {
        box-shadow: 0 0 20px #ffd700, 0 0 40px #ff4500;
    }
}

/* Make the van-image fill its parent frame */
.avatar-frame .van-image {
    width: 100%;
    height: 100%;
}

.van-image.opponent-avatar {
    border-radius: 8px !important;
    overflow: hidden;
}

.avatar {
    border: none;
    /* Remove redundant transparent border */
}

.avatar-gray {
    filter: grayscale(100%);
    opacity: 0.7;
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

/* For right-positioned players, speech bubble should still be above and centered */
.seat-right .speech-bubble {
    left: 50%;
    right: auto;
    transform: translateX(-50%) translateY(-10px);
    /* Same positioning as others */
}

.seat-right .speech-bubble::before {
    left: 50%;
    right: auto;
    transform: translateX(-50%) translateY(-2px);
    /* Same positioning as others */
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 12px solid #e5e7eb;
}

.seat-right .speech-bubble::after {
    left: 50%;
    right: auto;
    transform: translateX(-50%) translateY(-3px);
    /* Same positioning as others */
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 10px solid #f9fafb;
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

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.banker-badge {
    position: absolute;
    bottom: 0px;
    right: 0px;
    width: 24px;
    height: 24px;
    /* 使用 flex 完美居中 */
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
    /* 移动自身宽度的一半和高度的一半 */
}

.banker-badge-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Ensure the entire image is visible within the bounds */
}



.info-box {
    margin-top: -8px;
    position: relative;
    z-index: 10;
    width: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    /* Space between name and coins */

    /* Background Image */

    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-color: transparent;
    /* Remove old bg */

    /* Remove clip-path as image handles the shape */
    clip-path: none;

    padding: 4px 0;
}

/* Reset alignments for all seats to center because of column layout */
.seat-top .info-box,
.seat-left .info-box,
.seat-top-left .info-box,
.seat-right .info-box,
.seat-top-right .info-box,
.seat-bottom .info-box {
    align-items: center;
    margin-left: 0;
    margin-right: 0;
    margin-top: -13px;
    width: 90px;
}

.info-box.is-observer {
    filter: grayscale(100%);
    opacity: 0.6;
}

.name {
    font-size: 12px;
    font-weight: bold;
    color: white;
    text-shadow: 0 1px 2px black;
    margin-bottom: 0px;
    max-width: 80%;
    text-align: center;
    line-height: 1.2;
}

:not(.seat-bottom) .name {
    font-size: 12px;
}

.coins-pill {
    /* Remove previous pill background */
    background: transparent;
    border-radius: 0;
    padding: 0;
    border: none;

    font-size: 12px;
    font-weight: bold;
    color: #fbbf24;
    display: flex;
    align-items: center;
    gap: 2px;
    justify-content: center;
}

:not(.seat-bottom) .coins-pill {
    font-size: 11px;
}

.coin-icon-seat {
    width: 18px;
    /* Increased from 16px */
    height: 18px;
    object-fit: contain;
}

:not(.seat-bottom) .coin-icon-seat {
    width: 14px;
    height: 14px;
}

.coin-icon-float {
    width: 20px;
    height: 20px;
    object-fit: contain;
    vertical-align: middle;
    margin: 0 2px;
}

/* Status Float Position: Above Avatar for ALL players */
.status-float {
    position: absolute;
    top: auto;
    bottom: 90%;
    /* Closer to avatar for opponents (was 100%) */
    left: 50%;
    transform: translateX(-50%);
    right: auto;
    z-index: 150;
    /* Ensure it is above cards and other elements */
    margin-bottom: 0px;
    width: max-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    /* Let clicks pass through */
}

.status-float.is-me {
    bottom: 100%;
    /* Higher for self */
    margin-bottom: 10px;
    /* Extra spacing for self */
}

/* 右侧玩家的状态浮层显示在左侧 - Removed as overridden by generic opponent rule */
/* .seat-right .status-float was here */


.art-text {
    font-size: 16px;
    font-weight: 900;
    font-style: italic;
    text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
    white-space: nowrap;
}

.art-text.orange {
    color: #fbbf24;
    -webkit-text-stroke: 1px #b45309;
}

.art-text.green {
    color: #4ade80;
    -webkit-text-stroke: 1px #15803d;
}

.art-text.gray {
    color: #cbd5e1;
    -webkit-text-stroke: 1px #475569;
}

.status-text {
    font-family: "Microsoft YaHei", "Heiti SC", sans-serif;
    font-weight: 900;
    font-style: italic;
    padding: 2px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    height: 40px;
    /* Reduced fixed height */

    /* Default shadow for visibility */
    text-shadow:
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 3px 5px rgba(0, 0, 0, 0.5);
}

/* Rob (Positive) */
.rob-text {
    color: #fcd34d;
    /* Amber-300 */
    text-shadow:
        -2px -2px 0 #b45309,
        2px -2px 0 #b45309,
        -2px 2px 0 #b45309,
        2px 2px 0 #b45309,
        0 3px 5px rgba(0, 0, 0, 0.5);
    font-size: 18px;
}

/* No Rob - Updated to match Rob style */
.no-rob-text {
    color: #fcd34d;
    /* Match rob-text */
    text-shadow:
        -2px -2px 0 #b45309,
        2px -2px 0 #b45309,
        -2px 2px 0 #b45309,
        2px 2px 0 #b45309,
        0 3px 5px rgba(0, 0, 0, 0.5);
    font-size: 18px;
    /* Match rob-text */
}

/* Bet */
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
.status-text.text-large {
    font-size: 22px;
    /* Reduced from 26px */
    height: 40px;
    text-shadow:
        -2px -2px 0 #000,
        2px -2px 0 #000,
        -2px 2px 0 #000,
        2px 2px 0 #000,
        0 4px 8px rgba(0, 0, 0, 0.6);
}

/* Specific stroke colors for Large size */
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

.hand-area {
    position: relative;
    /* 占位高度，防止发牌时抖动 */
    height: 20vw;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
}

/* 机器人手牌下移，避免遮挡信息 */
.seat-top .hand-area {
    margin-top: 6.6667vw;
}

.opponent-hand {
    position: absolute !important;
    top: -32px !important;
    left: 0;
    width: 100%;
    margin-top: 0 !important;
    z-index: 15;
    pointer-events: none;
}
.opponent-hand .hand-card {
    pointer-events: auto;
}

.seat-bottom .hand-area {

    height: 24vw;

    /* 自己的牌比较大 */

    margin-top: 0;

    margin-bottom: 2.6667vw;
    /* Increased to move hand cards further up */

}

.cards {
    display: flex;
    justify-content: center;
}

.hand-card {
    transition: transform 0.2s;
    flex-shrink: 0;
}

.cards .hand-card+.hand-card {
    margin-left: -7.4667vw;
}

.cards.is-me-cards .hand-card+.hand-card {
    margin-left: 0.2667vw;
}

.hand-result-badge {
    position: absolute;
    top: 90%;
    left: 50%;
    transform: translate(-50%, -50%);
    /* Remove background, border, padding, gap */
    color: #fbbf24;
    /* Keep text color for fallback */
    font-size: 14px;
    /* Keep text size for fallback */
    font-weight: bold;
    /* Keep text weight for fallback */
    white-space: nowrap;
    z-index: 10;
    /* Remove box-shadow */
    display: flex;
    align-items: center;
    justify-content: center;
    /* Center content horizontally */
}

.hand-type-img {
    height: 40px;
    /* Scaled up by 2x from 20px */
    object-fit: contain;
    vertical-align: middle;
}


.score-float {
    position: absolute;
    top: 0;
    font-weight: bold;
    font-size: 24px;
    text-shadow: 2px 2px 0 #000;
    animation: floatUp 1.5s forwards;
    z-index: 20;
    font-family: 'Arial Black', sans-serif;
}

.score-float.win {
    color: #facc15;
}

.score-float.lose {
    color: #ef4444;
}

.slide-from-left-enter-active,
.slide-from-right-enter-active {
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.slide-from-left-enter-from {
    opacity: 0;
    transform: translateX(-30px);
}

.slide-from-right-enter-from {
    opacity: 0;
    transform: translateX(30px);
}

/* Pop Up Animation for Opponents (Above Avatar) */
.pop-up-enter-active,
.pop-up-leave-active {
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    transform-origin: bottom center;
    /* Grow from bottom */
}

.pop-up-enter-from {
    opacity: 0;
    /* Start from below (inside avatar) and small */
    /* REMOVED translateX(-50%) to fix centering issue */
    transform: translateY(20px) scale(0.2);
}

.pop-up-leave-to {
    opacity: 0;
    /* REMOVED translateX(-50%) to fix centering issue */
    transform: scale(0.5);
}

.hand-card.bull-card-overlay {
    filter: brightness(60%) grayscale(50%);
    /* Apply a grey filter */
    opacity: 0.8;
    /* Slightly reduce opacity */
    transition: filter 0.3s ease, opacity 0.3s ease;
}

@keyframes floatUp {
    0% {
        transform: translateY(0) scale(0.5);
        opacity: 0;
    }

    20% {
        transform: translateY(0) scale(1.2);
        opacity: 1;
    }

    100% {
        transform: translateY(-60px) scale(1);
        opacity: 0;
    }
}
</style>
