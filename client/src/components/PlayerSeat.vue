<script setup>
import { computed } from 'vue';
import PokerCard from './PokerCard.vue';

const props = defineProps({
  player: Object,
  isMe: Boolean
});

const showCards = computed(() => {
  return props.player.hand && props.player.hand.length > 0;
});
</script>

<template>
  <div class="player-seat" :class="{ 'is-me': isMe }">
    <!-- 头像区域 -->
    <div class="avatar-area">
      <!-- 庄家徽章 -->
      <div v-if="player.isBanker" class="banker-badge">庄</div>
      
      <div class="avatar-frame">
          <van-image
            round
            width="48px"
            height="48px"
            :src="player.avatar"
            class="avatar"
          />
      </div>
      
      <div class="info-box">
        <div class="name van-ellipsis">{{ player.name }}</div>
        <div class="coins-pill">
            <span class="coin-symbol">🟡</span>
            {{ player.coins }}
        </div>
      </div>
    </div>

    <!-- 状态标签 (抢庄/下注倍数 - 浮动艺术字效果) -->
    <div class="status-float">
        <div v-if="player.robMultiplier > 0" class="art-text orange">抢x{{ player.robMultiplier }}</div>
        <div v-if="player.robMultiplier === 0" class="art-text gray">不抢</div>
        <div v-if="player.betMultiplier > 0" class="art-text green">下x{{ player.betMultiplier }}</div>
    </div>
    
    <!-- 赢分提示 -->
    <div v-if="player.roundScore !== 0 && player.state !== 'IDLE'" class="score-float" :class="player.roundScore > 0 ? 'win' : 'lose'">
        {{ player.roundScore > 0 ? '+' : '' }}{{ player.roundScore }}
    </div>

    <!-- 手牌区域 -->
    <div v-if="showCards" class="hand-area">
      <div class="cards">
        <PokerCard 
          v-for="(card, idx) in player.hand" 
          :key="card ? card.id : idx" 
          :card="card" 
          :is-small="!isMe"
          class="hand-card"
          :style="{ marginLeft: idx === 0 ? '0' : (isMe ? '-30px' : '-20px') }"
        />
      </div>
      <!-- 牌型结果 -->
      <div v-if="player.handResult" class="hand-result-badge">
          {{ player.handResult.typeName }} (x{{ player.handResult.multiplier }})
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-seat {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 100px;
}

.is-me {
  width: 100%;
}

.avatar-area {
  position: relative;
  text-align: center;
  margin-bottom: 4px;
}

.avatar-frame {
    padding: 2px;
    background: rgba(0,0,0,0.3);
    border-radius: 50%;
    display: inline-block;
    border: 1px solid rgba(255,255,255,0.2);
}

.avatar {
  border: 2px solid transparent;
}

.banker-badge {
  position: absolute;
  top: -8px;
  right: 16px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  background: radial-gradient(circle at 30% 30%, #fcd34d 0%, #d97706 100%);
  color: #78350f;
  font-size: 14px;
  border-radius: 50%;
  font-weight: bold;
  z-index: 10;
  border: 1px solid #fff;
  box-shadow: 0 0 10px #fbbf24;
  animation: shine 2s infinite;
}

@keyframes shine {
    0% { transform: scale(1); box-shadow: 0 0 5px #fbbf24; }
    50% { transform: scale(1.1); box-shadow: 0 0 15px #fbbf24; }
    100% { transform: scale(1); box-shadow: 0 0 5px #fbbf24; }
}

.info-box {
  margin-top: -10px; /* 向上重叠一点 */
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
    right: -20px; /* 浮动在头像旁边 */
    z-index: 8;
}

.is-me .status-float {
    top: -40px;
    right: auto;
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
  margin-top: 8px;
  position: relative;
}

.is-me .hand-area {
    margin-top: -80px; /* 调整位置避免遮挡按钮 */
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
    top: 50%;
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
