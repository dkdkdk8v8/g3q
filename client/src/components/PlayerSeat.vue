<script setup>
import { computed, ref, watch } from 'vue';
import { useGameStore } from '../stores/game.js';
import PokerCard from './PokerCard.vue';
import { formatCoins } from '../utils/format.js';

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
      speech: Object // New prop: { type: 'text' | 'emoji', content: string }
  });
  
  const store = useGameStore();
  
  // Computed property to control speech bubble visibility
  const showSpeechBubble = computed(() => {
      return props.speech && props.speech.content;
  });
  
  // Computed property to calculate dynamic width for speech bubble
  const speechBubbleStyle = computed(() => {
      if (props.speech && props.speech.type === 'text' && props.speech.content) {
          // Assume one Chinese character is roughly 8px wide (per user request)
          const charWidth = 15;
          const padding = 20; // Total left/right padding (10px + 10px)
          const textLength = Array.from(props.speech.content).length; // Handle Unicode characters
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

const shouldShowBadge = computed(() => {
    if (!props.player.handResult) return false;
    // Hide badge during IDLE, READY_COUNTDOWN and GAME_OVER phases
    if (['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)) return false;
    
    if (props.isMe) {
        // 自己：必须点了摊牌(isShowHand) 或 结算阶段 才显示牌型结果
        return props.player.isShowHand || store.currentPhase === 'SETTLEMENT';
    } else {
        // 别人：必须等待翻牌动画结束
        return enableHighlight.value;
    }
});

const shouldShowRobMult = computed(() => {
    // Hide in IDLE or READY phases (new game)
    if (['IDLE', 'READY_COUNTDOWN'].includes(store.currentPhase)) return false;

    // Phase: Robbing Banker or Selection (Show for everyone who has acted)
    if (['ROB_BANKER', 'BANKER_SELECTION_ANIMATION'].includes(store.currentPhase)) {
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
</script>

<template>
  <div class="player-seat" :class="`seat-${position}`">
    <!-- ... (keep avatar area) -->
    <div class="avatar-area">
      <div class="avatar-wrapper">
          <div class="avatar-frame" :class="{ 'banker-candidate-highlight': isAnimatingHighlight }">
              <van-image
                round
                :src="player.avatar"
                class="avatar"
                :class="{ 'avatar-gray': player.isObserver }"
              />
          </div>
          
          <!-- Speech Bubble -->
          <div v-show="showSpeechBubble" class="speech-bubble" :style="speechBubbleStyle" :class="{ 'speech-visible': showSpeechBubble }">
                <span v-if="speech && speech.type === 'text'">{{ speech.content }}</span>
                <img v-else-if="speech && speech.type === 'emoji'" :src="speech.content" class="speech-emoji" />
            </div>
          
          <!-- 状态浮层，移到 avatar-area 以便相对于头像定位 -->
          <div class="status-float" v-if="!['IDLE', 'READY_COUNTDOWN'].includes(store.currentPhase)">
              <template v-if="shouldShowRobMult">
                  <div v-if="player.robMultiplier > 0" class="art-text orange">抢x{{ player.robMultiplier }}</div>
                  <div v-else class="art-text gray">不抢</div>
              </template>
              
              <template v-if="shouldShowBetMult">
                  <div class="art-text green">下x{{ player.betMultiplier }}</div>
              </template>
          </div>

          <!-- 庄家徽章，现在移动到 avatar-area 内部 -->
          <div v-if="player.isBanker && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)" class="banker-badge">庄</div>
          <!-- Ready Badge -->
          <div v-if="player.isReady && store.currentPhase === 'READY_COUNTDOWN'" class="ready-badge">✔ 准备</div>
          
          <!-- Observer Badge -->
          <div v-if="player.isObserver" class="observer-badge">等待下一局</div>
      </div>

      <div class="info-box">
        <div class="name van-ellipsis">{{ player.name }}</div>
        <div class="coins-pill">
            <span class="coin-symbol">🟡</span>
            {{ formatCoins(player.coins) }}
        </div>
      </div>
    </div>
    
    <!-- ... (keep score float) -->
    <div v-if="player.roundScore !== 0 && !['IDLE', 'READY_COUNTDOWN', 'GAME_OVER'].includes(store.currentPhase)" class="score-float" :class="player.roundScore > 0 ? 'win' : 'lose'">
        {{ player.roundScore > 0 ? '+' : '' }}{{ formatCoins(player.roundScore) }}
    </div>

    <!-- 手牌区域 (始终渲染以占位) -->
    <div class="hand-area">
      <div class="cards" :style="{ visibility: showCards ? 'visible' : 'hidden' }">
        <PokerCard 
          v-for="(card, idx) in displayedHand" 
          :key="idx" 
          :card="(shouldShowCardFace && (visibleCardCount === -1 || idx < visibleCardCount)) ? card : null" 
          :is-small="!isMe"
          :class="{ 'hand-card': true, 'bull-card-overlay': isBullPart(idx) }"
          :style="{ 
              marginLeft: idx === 0 ? '0' : '-20px',
              opacity: (visibleCardCount === -1 || idx < visibleCardCount) ? 1 : 0,
          }"
        />
      </div>
      <!-- ... (keep hand result) -->
      <div v-if="shouldShowBadge" class="hand-result-badge">
          {{ player.handResult.typeName }} (x{{ player.handResult.multiplier }})
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

/* 布局方向定义 */
.seat-top { flex-direction: column; }
.seat-bottom { flex-direction: column-reverse; width: 100%; } /* 自己 */
/* 左侧和右侧现在也改为垂直布局：头像在上，牌在下 */
.seat-left { flex-direction: column; width: 100px; } 
.seat-right { flex-direction: column; width: 100px; }

/* 头像区域微调 */
.seat-bottom .avatar-area { margin-top: 10px; margin-bottom: 0; }
.seat-top .avatar-area { margin-bottom: 4px; }
.seat-left .avatar-area { margin-bottom: 4px; }
.seat-right .avatar-area { margin-bottom: 4px; }

.avatar-area {
    position: relative; /* Ensure absolute positioning of children is relative to this parent */
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

.avatar-wrapper {
    position: relative;
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
    bottom: 100%; /* Position above the avatar */
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px; /* Gap between badge and avatar */
    background: rgba(0, 0, 0, 0.6);
    color: #e5e7eb;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 20;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.avatar-frame {
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.3);
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2);
    overflow: hidden; /* Crucial for clipping content to the circular frame */
    display: flex; /* Use flexbox to center the image reliably */
    justify-content: center;
    align-items: center;
    transition: box-shadow 0.2s ease-in-out; /* Smooth transition for highlight */
}

.avatar-frame.banker-candidate-highlight {
    box-shadow: 0 0 15px 5px #facc15, 0 0 8px 2px #d97706; /* Golden glow */
    border-color: #facc15;
    animation: pulse-border-glow 1s infinite alternate;
}

@keyframes pulse-border-glow {
    from { box-shadow: 0 0 15px 5px #facc15, 0 0 8px 2px #d97706; }
    to { box-shadow: 0 0 20px 8px #fcd34d, 0 0 10px 3px #fbbf24; }
}

/* Make the van-image fill its parent frame */
.avatar-frame .van-image {
    width: 100%;
    height: 100%;
}

.avatar {
  border: none; /* Remove redundant transparent border */
}

.avatar-gray {
    filter: grayscale(100%);
    opacity: 0.7;
}

.speech-bubble {
    position: absolute;
    bottom: 100%; /* Position above avatar */
    left: 50%; /* Center horizontally */
    transform: translateX(-50%) translateY(-10px); /* Base position for centering and gap */
    opacity: 0; /* Initially hidden */
    background: linear-gradient(to bottom, #f9fafb, #e5e7eb); /* Light background */
    border: 1px solid #d1d5db;
    border-radius: 12px;
    padding: 6px 10px;
    font-size: 14px;
    color: #333;
    white-space: normal; /* Allow normal text wrapping */
    word-break: break-all; /* Break long words */
    z-index: 190; /* High z-index to be above cards but below modals */
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    display: inline-flex; /* Use inline-flex for adaptive width */
    align-items: center; /* Vertically center content */
    justify-content: center; /* Horizontally center content */
    text-align: center; /* Center text when wrapped */
    max-width: 170px; /* Max width for longer phrases (e.g., 2 lines of ~10 chars + padding) */
    /* animation is now controlled by .speech-visible class */
    transition: opacity 0.3s ease-out; /* Smooth fade in/out */
}

.speech-bubble.speech-visible {
    opacity: 1;
    animation: speechBubbleBounceIn 0.3s ease-out forwards;
}

.speech-bubble::before {
    content: '';
    position: absolute;
    top: 100%; /* Position at bottom of bubble */
    left: 50%;
    transform: translateX(-50%) translateY(-2px); /* Center and overlap slightly */
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 12px solid #e5e7eb; /* Tail color matches bubble */
    z-index: 51;
}

.speech-bubble::after {
    content: '';
    position: absolute;
    top: 100%; /* Position at bottom of bubble (inner) */
    left: 50%;
    transform: translateX(-50%) translateY(-3px); /* Center and overlap slightly */
    width: 0;
    height: 0;
    border-left: 8px solid transparent; /* Inner tail slightly smaller */
    border-right: 8px solid transparent;
    border-top: 10px solid #f9fafb; /* Tail color matches bubble inner */
    z-index: 52;
}

/* For right-positioned players, speech bubble should still be above and centered */
.seat-right .speech-bubble {
    left: 50%;
    right: auto;
    transform: translateX(-50%) translateY(-10px); /* Same positioning as others */
}

.seat-right .speech-bubble::before {
    left: 50%;
    right: auto;
    transform: translateX(-50%) translateY(-2px); /* Same positioning as others */
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 12px solid #e5e7eb;
}

.seat-right .speech-bubble::after {
    left: 50%;
    right: auto;
    transform: translateX(-50%) translateY(-3px); /* Same positioning as others */
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
  from, 20%, 40%, 60%, 80%, to {
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

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.banker-badge {
  position: absolute;
  top: 0px;
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
  z-index: 10;
  border: 1px solid #fff;
  box-shadow: 0 0 10px #fbbf24;
  animation: shine 2s infinite;
  transform: translate(50%, -50%); /* 移动自身宽度的一半和高度的一半 */
}

@keyframes shine {
    0% { transform: scale(1); box-shadow: 0 0 5px #fbbf24; }
    50% { transform: scale(1.1); box-shadow: 0 0 15px #fbbf24; }
    100% { transform: scale(1); box-shadow: 0 0 5px #fbbf24; }
}

.info-box {
  margin-top: 2px; /* Adjust to create a 2px gap from the avatar */
  position: relative;
  z-index: 5;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.name {
  font-size: 12px;
  color: white;
  text-shadow: 0 1px 2px black;
  margin-bottom: 2px;
}

.coins-pill {
  background: rgba(0,0,0,0.6);
  border-radius: 10px;
  padding: 0 6px;
  font-size: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 2px;
  border: 1px solid rgba(255,255,255,0.1);
}

.coin-symbol {
    font-size: 10px;
}

.status-float {
    position: absolute;
    top: 0;
    left: 100%; /* 浮动在 info-box 旁边 */
    z-index: 8;
    transform: translateX(10px); /* 稍微向右偏移 */
}

/* 右侧玩家的状态浮层显示在左侧 */
.seat-right .status-float {
    left: auto;
    right: 100%;
    transform: translateX(-10px);
    text-align: right;
    align-items: flex-end;
}


.art-text {
    font-size: 16px;
    font-weight: 900;
    font-style: italic;
    text-shadow: 2px 2px 0px rgba(0,0,0,0.5);
    white-space: nowrap;
}
.art-text.orange { color: #fbbf24; -webkit-text-stroke: 1px #b45309; }
.art-text.green { color: #4ade80; -webkit-text-stroke: 1px #15803d; }
.art-text.gray { color: #cbd5e1; -webkit-text-stroke: 1px #475569; }

.hand-area {
  position: relative;
  /* 占位高度，防止发牌时抖动 */
  height: 60px; 
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

/* 机器人手牌下移，避免遮挡信息 */
.seat-left .hand-area, .seat-right .hand-area, .seat-top .hand-area {
    margin-top: 15px;
}

.seat-bottom .hand-area {
    height: 90px; /* 自己的牌比较大 */
    margin-top: 0; 
    margin-bottom: 10px;
}

.cards {
  display: flex;
  justify-content: center;
}

.hand-card {
  transition: transform 0.2s;
}

.hand-result-badge {
    position: absolute;
    top: 90%; /* 移到下方，避免遮挡牌面 */
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9));
    color: #fbbf24;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: bold;
    white-space: nowrap;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    border: 1px solid #fbbf24;
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

.score-float.win { color: #facc15; }
.score-float.lose { color: #ef4444; }

.hand-card.bull-card-overlay {
    filter: brightness(60%) grayscale(50%); /* Apply a grey filter */
    opacity: 0.8; /* Slightly reduce opacity */
    transition: filter 0.3s ease, opacity 0.3s ease;
}

@keyframes floatUp {
    0% { transform: translateY(0) scale(0.5); opacity: 0; }
    20% { transform: translateY(0) scale(1.2); opacity: 1; }
    100% { transform: translateY(-60px) scale(1); opacity: 0; }
}
</style>
