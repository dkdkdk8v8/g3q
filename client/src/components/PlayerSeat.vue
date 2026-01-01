<script setup>
import { computed } from 'vue';
import { useGameStore } from '../stores/game.js';
import PokerCard from './PokerCard.vue';

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
  }
});

const store = useGameStore();

// 始终返回完整手牌以保持布局稳定
const displayedHand = computed(() => {
    if (!props.player.hand) return [];
    return props.player.hand;
});

const showCards = computed(() => {
  return displayedHand.value.length > 0;
});

// ... (keep existing shouldShowCardFace logic)
const shouldShowCardFace = computed(() => {
    if (props.isMe) return true;
    if (store.currentPhase === 'SETTLEMENT') return true;
    if (store.currentPhase === 'SHOWDOWN' && props.player.isShowHand) return true;
    return false;
});
// ...
</script>

<template>
  <div class="player-seat" :class="`seat-${position}`">
    <!-- ... (keep avatar area) -->
    <div class="avatar-area">
      <div class="avatar-frame">
          <van-image
            round
            :src="player.avatar"
            class="avatar"
          />
      </div>
      
      <!-- 状态浮层，移到 avatar-area 以便相对于头像定位 -->
      <div class="status-float" v-if="store.currentPhase !== 'GAME_OVER'">
          <div v-if="player.robMultiplier > 0" class="art-text orange">抢x{{ player.robMultiplier }}</div>
          <div v-if="player.robMultiplier === 0" class="art-text gray">不抢</div>
          <div v-if="player.betMultiplier > 0" class="art-text green">下x{{ player.betMultiplier }}</div>
      </div>

      <div class="info-box">
        <div class="name van-ellipsis">{{ player.name }}</div>
        <div class="coins-pill">
            <span class="coin-symbol">🟡</span>
            {{ player.coins }}
        </div>
      </div>
      <!-- 庄家徽章，现在移动到 avatar-area 内部 -->
      <div v-if="player.isBanker && store.currentPhase !== 'GAME_OVER'" class="banker-badge">庄</div>
    </div>
    
    <!-- ... (keep score float) -->
    <div v-if="player.roundScore !== 0 && player.state !== 'IDLE' && store.currentPhase !== 'GAME_OVER'" class="score-float" :class="player.roundScore > 0 ? 'win' : 'lose'">
        {{ player.roundScore > 0 ? '+' : '' }}{{ player.roundScore }}
    </div>

    <!-- 手牌区域 (始终渲染以占位) -->
    <div class="hand-area">
      <div class="cards" :style="{ visibility: showCards ? 'visible' : 'hidden' }">
        <PokerCard 
          v-for="(card, idx) in displayedHand" 
          :key="card ? card.id : idx" 
          :card="shouldShowCardFace ? card : null" 
          :is-small="!isMe"
          class="hand-card"
          :style="{ 
              marginLeft: idx === 0 ? '0' : '-20px',
              opacity: (visibleCardCount === -1 || idx < visibleCardCount) ? 1 : 0
          }"
        />
      </div>
      <!-- ... (keep hand result) -->
      <div v-if="player.handResult && shouldShowCardFace && store.currentPhase !== 'GAME_OVER'" class="hand-result-badge">
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

.avatar-frame {
    width: 52px; /* Total size: 48px image + 2*1px border + 2px "margin" on each side (simulating the previous padding) */
    height: 52px;
    background: rgba(0,0,0,0.3);
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2);
    overflow: hidden; /* Crucial for clipping content to the circular frame */
    display: flex; /* Use flexbox to center the image reliably */
    justify-content: center;
    align-items: center;
}

/* Make the van-image fill its parent frame */
.avatar-frame .van-image {
    width: 100%;
    height: 100%;
}

.avatar {
  border: none; /* Remove redundant transparent border */
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

/* 侧边手牌不需要 margin-top */
.seat-left .hand-area, .seat-right .hand-area {
    margin-top: 0;
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

@keyframes floatUp {
    0% { transform: translateY(0) scale(0.5); opacity: 0; }
    20% { transform: translateY(0) scale(1.2); opacity: 1; }
    100% { transform: translateY(-60px) scale(1); opacity: 0; }
}
</style>
