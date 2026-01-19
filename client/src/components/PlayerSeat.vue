<script setup>
import { computed, ref, watch } from 'vue';
import { useGameStore } from '../stores/game.js';
import PokerCard from './PokerCard.vue';
import { formatCoins } from '../utils/format.js';
import goldImg from '@/assets/common/gold.png';
import zhuangImg from '@/assets/common/zhuang.png';
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
    selectedCardIndices: {
        type: Array,
        default: () => []
    },
    triggerBankerAnimation: Boolean, // New prop for one-time banker confirmation animation
    isWin: Boolean // New prop for neon flash effect on winner
});

const store = useGameStore();
const emit = defineEmits(['card-click']);

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
    // Hide in IDLE, READY, SETTLEMENT, or GAME_OVER phases
    if (['IDLE', 'READY_COUNTDOWN', 'SETTLEMENT', 'GAME_OVER'].includes(store.currentPhase)) return false;

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
    // Hide in IDLE, READY, SETTLEMENT or GAME_OVER phases
    if (['IDLE', 'READY_COUNTDOWN', 'ROB_BANKER', 'BANKER_SELECTION_ANIMATION', 'BANKER_CONFIRMED', 'SETTLEMENT', 'GAME_OVER'].includes(store.currentPhase)) return false;

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

const shouldMoveStatusFloat = computed(() => {
    // If cards are showing, move it
    if (showCards.value) return true;
    // If dealing is in progress, move it (anticipate cards)
    if (store.currentPhase === 'DEALING' || isDealingProcessing.value) return true;
    // Also during SHOWDOWN/SETTLEMENT if cards are there
    return false;
});
</script>
<template>
    <div class="player-seat" :class="`seat-${position}`">
        <!-- ... (keep avatar area) -->
        <div class="avatar-area">
            <div class="avatar-wrapper" :class="{
                'banker-confirm-anim': triggerBankerAnimation
            }">
                <div class="avatar-frame" :class="{
                    'banker-candidate-highlight': isAnimatingHighlight,
                    'is-banker': player.isBanker && !['SETTLEMENT', 'GAME_OVER'].includes(store.currentPhase),
                    'win-neon-flash': isWin,
                    'is-opponent': true
                }">
                    <van-image :src="player.avatar || defaultAvatar" class="avatar" fit="cover"
                        :class="{ 'avatar-gray': player.isObserver, 'opponent-avatar': true }" />
                </div>

                <!-- Avatar Frame Overlay -->
                <img :src="avatarFrameImg" class="avatar-border-overlay" />



                <!-- 状态浮层，移到 avatar-area 以便相对于头像定位 -->
                <div class="status-float" :class="{ 'is-me': isMe, 'move-up': shouldMoveStatusFloat }"
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
                            <span class="status-text bet-text" :class="{ 'text-large': isMe }">压{{ player.betMultiplier
                                }}倍</span>
                        </div>
                    </Transition>
                </div>

                <!-- Ready Badge -->
                <div v-if="player.isReady && store.currentPhase === 'READY_COUNTDOWN'" class="ready-badge">✔ 准备</div>

                <!-- Observer Badge -->
                <div v-if="player.isObserver" class="observer-badge">等待下一局</div>
            </div>

            <div class="info-box" :style="{ '--bg-img': `url(${userInfoBgImg})` }"
                :class="{ 'is-observer': player.isObserver }">
                <!-- 庄家徽章，现在移动到 info-box 内部 -->
                <div v-if="player.isBanker && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)"
                    class="banker-badge"><img :src="zhuangImg" alt="庄" class="banker-badge-img" /></div>
                <div class="name van-ellipsis">{{ displayName }}</div>
                <div class="coins-pill">
                    {{ formatCoins(player.coins) }}
                </div>
            </div>
        </div>

        <!-- ... (keep score float) -->
        <div v-if="player.roundScore !== 0 && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)"
            class="score-float" :class="player.roundScore > 0 ? 'win' : 'lose'">
            {{ player.roundScore > 0 ? '+' : '' }}{{
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
    border-radius: 50%;
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
    box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
    border-color: #fbbf24;
    animation: pulse-border-glow 1s infinite alternate;
}

.avatar-frame.is-banker {
    border-color: #fbbf24;
    box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
    /* Slightly weaker shadow */
    transition: none;
}

/* Hide static banker styles while animation is playing on the wrapper */
.avatar-wrapper.banker-confirm-anim .avatar-frame.is-banker {
    box-shadow: none !important;
    border-color: transparent !important;
}

.avatar-wrapper.banker-confirm-anim {
    position: relative;
    z-index: 50;
    animation: bankerConfirmPop 1.2s ease-out forwards;
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

@keyframes pulse-border-glow {
    from {
        box-shadow: 0 0 10px 3px #fbbf24, 0 0 5px 1px #d97706;
    }

    to {
        box-shadow: 0 0 15px 5px #fbbf24, 0 0 8px 2px #d97706;
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

    bottom: 25%;

    right: -10px;

    width: 21px;
    /* 3/4 of original size (24px) */

    height: 21px;
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

    transform: translate(50%, -50%);

    /* Adjusted transform for top-right positioning */

}

.banker-badge-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Ensure the entire image is visible within the bounds */
}



.info-box {
    width: 120px;
    height: 44px;
    z-index: 101;
    /* Higher than banker badge (100) */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #fff;
    font-size: 12px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    box-sizing: border-box;
    padding-top: 4px;
    /* Adjust for better vertical alignment */
    position: relative;
    /* Added for absolute positioning of children */
}

.info-box::before {
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

/* Ensure content sits above the background */
.info-box> :not(.banker-badge) {
    position: relative;
    z-index: 1;
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
    margin-bottom: 3.6px;
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
    transition: bottom 0.3s ease;
}

.status-float.is-me {
    bottom: 100%;
    /* Higher for self */
    margin-bottom: 10px;
    /* Extra spacing for self */
}

.status-float.move-up {
    bottom: calc(100% + 10px);
}

.status-float.is-me.move-up {
    bottom: calc(100% + 24vw + 10px);
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
    top: -26px !important;
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
    margin-left: -5.6667vw;
}

.cards.is-me-cards .hand-card+.hand-card {
    margin-left: 0.2667vw;
}

.hand-result-badge {
    position: absolute;
    bottom: 9px;
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

.hand-type-img {
    height: 27px;
    object-fit: contain;
    vertical-align: middle;
}


.score-float {
    position: absolute;
    top: -6px;
    font-weight: bold;
    font-size: 22px;
    text-shadow: 2px 2px 0 #000;
    animation: floatUp 3s forwards;
    z-index: 20;
    font-family: 'Arial Black', sans-serif;
}

.score-float.win {
    color: #2ccc67;
}

.score-float.lose {
    color: #fe5d5d;
}

/* ... */

@keyframes floatUp {
    0% {
        transform: translateY(0) scale(0.5);
        opacity: 0;
    }

    10% {
        transform: translateY(0) scale(1.2);
        opacity: 1;
    }

    80% {
        transform: translateY(-50px) scale(1);
        opacity: 1;
    }

    100% {
        transform: translateY(-50px) scale(1);
        /* Stay at 80% position */
        opacity: 1;
        /* Remain visible */
    }
}

/* Status Float Pop-up Animation */
.pop-up-enter-active,
.pop-up-leave-active {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: bottom center;
}

.pop-up-enter-from {
    opacity: 0;
    /* Start from lower (avatar center approx) and small */
    transform: translateY(40px) scale(0.2);
}

.pop-up-leave-to {
    opacity: 0;
    transform: scale(0.5);
}
</style>
