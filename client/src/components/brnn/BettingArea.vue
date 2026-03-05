<script setup>
import { computed } from 'vue'

const props = defineProps({
  area: Object,
  index: Number,
  phase: String,
  canBet: Boolean,
})

const emit = defineEmits(['bet'])

const AREA_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b'] // blue, green, purple, orange

function cardToDisplay(cardId) {
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
  const suits = ['♦','♣','♥','♠']
  const rank = Math.floor(cardId / 4)
  const suit = cardId % 4
  return { rank: ranks[rank], suit: suits[suit], isRed: suit === 0 || suit === 2 }
}

function niuLabel(niuType) {
  if (niuType === 0 || niuType === '') return '没牛'
  if (niuType >= 1 && niuType <= 9) return `牛${niuType}`
  if (niuType === 10) return '牛牛'
  if (niuType === 11) return '五花牛'
  if (niuType === 12) return '炸弹牛'
  if (niuType === 13) return '五小牛'
  return ''
}

function formatCoin(cents) {
  return (cents / 100).toFixed(2)
}

const headerColor = computed(() => AREA_COLORS[props.index] || '#666')

const showFace = computed(() => {
  return props.phase === 'SHOW_CARD' || props.phase === 'SETTLEMENT'
})

const hasCards = computed(() => {
  return props.area && props.area.cards && props.area.cards.length > 0
})

const displayCards = computed(() => {
  if (!hasCards.value || !showFace.value) return []
  return props.area.cards.map(c => cardToDisplay(c))
})

const niuText = computed(() => {
  if (!showFace.value || !props.area) return ''
  return niuLabel(props.area.niuType)
})

const winClass = computed(() => {
  if (props.area.win === true) return 'win'
  if (props.area.win === false) return 'lose'
  return ''
})

const winText = computed(() => {
  if (props.area.win === true) return '赢'
  if (props.area.win === false) return '输'
  return ''
})

function onAreaClick() {
  if (props.canBet) {
    emit('bet')
  }
}
</script>

<template>
  <div
    class="betting-area"
    :class="{ 'can-bet': canBet, [winClass]: !!winClass }"
    @click="onAreaClick"
  >
    <!-- Header -->
    <div class="area-header" :style="{ backgroundColor: headerColor }">
      <span class="area-name">{{ area.name }}</span>
    </div>

    <!-- Cards Row -->
    <div class="area-cards">
      <template v-if="showFace && displayCards.length > 0">
        <div
          v-for="(card, i) in displayCards"
          :key="i"
          class="tiny-card"
          :class="{ 'is-red': card.isRed }"
        >
          <span class="tc-rank">{{ card.rank }}</span>
          <span class="tc-suit">{{ card.suit }}</span>
        </div>
      </template>
      <template v-else-if="hasCards || phase === 'DEALING'">
        <div v-for="i in 5" :key="'b-' + i" class="tiny-card tiny-back">?</div>
      </template>
      <div v-else class="area-cards-placeholder">-</div>
    </div>

    <!-- Niu Type Badge -->
    <div v-if="niuText" class="area-niu">{{ niuText }}</div>

    <!-- Bet Info -->
    <div class="area-bets">
      <div class="bet-row">
        <span class="bet-label">总:</span>
        <span class="bet-value">{{ formatCoin(area.totalBet) }}</span>
      </div>
      <div class="bet-row" :class="{ 'my-bet-active': area.myBet > 0 }">
        <span class="bet-label">我:</span>
        <span class="bet-value">{{ formatCoin(area.myBet) }}</span>
      </div>
    </div>

    <!-- Win/Lose Indicator -->
    <div v-if="winText" class="win-indicator" :class="winClass">
      {{ winText }}
    </div>

    <!-- Clickable hint during betting -->
    <div v-if="canBet" class="bet-hint">点击下注</div>
  </div>
</template>

<style scoped>
.betting-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 0 0 6px 0;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s, background 0.2s;
}

.betting-area.can-bet {
  border-color: rgba(255, 215, 0, 0.4);
  cursor: pointer;
}

.betting-area.can-bet:active {
  background: rgba(255, 215, 0, 0.1);
}

.betting-area.win {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.betting-area.lose {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.area-header {
  width: 100%;
  text-align: center;
  padding: 4px 0;
}

.area-name {
  color: #fff;
  font-size: 14px;
  font-weight: bold;
}

.area-cards {
  display: flex;
  gap: 2px;
  padding: 6px 4px 4px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
}

.tiny-card {
  width: 24px;
  height: 33px;
  border-radius: 3px;
  border: 1px solid #888;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: bold;
  color: #333;
  line-height: 1;
}

.tiny-card.is-red {
  color: #e53e3e;
}

.tc-rank {
  font-size: 10px;
}

.tc-suit {
  font-size: 8px;
}

.tiny-card.tiny-back {
  background: #2d5a27;
  border-color: #3a7a32;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.area-cards-placeholder {
  color: rgba(255, 255, 255, 0.2);
  font-size: 14px;
  height: 33px;
  display: flex;
  align-items: center;
}

.area-niu {
  color: #fbbf24;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 8px;
  background: rgba(251, 191, 36, 0.15);
  border-radius: 10px;
  margin: 2px 0;
}

.area-bets {
  width: 100%;
  padding: 2px 8px;
}

.bet-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
}

.bet-row.my-bet-active {
  color: #fbbf24;
  font-weight: bold;
}

.bet-label {
  flex-shrink: 0;
}

.bet-value {
  text-align: right;
}

.win-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 28px;
  font-weight: bold;
  opacity: 0.85;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.win-indicator.win {
  color: #22c55e;
}

.win-indicator.lose {
  color: #ef4444;
}

.bet-hint {
  font-size: 10px;
  color: rgba(255, 215, 0, 0.5);
  margin-top: 2px;
}
</style>
