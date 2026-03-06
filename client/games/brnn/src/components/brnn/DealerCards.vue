<script setup>
import { computed } from 'vue'
import { cardToDisplay, niuLabel } from '@shared/utils/bullfight.js'
import { formatCoins } from '@shared/utils/format.js'

const props = defineProps({
  dealer: Object,
  phase: String,
  dealerWin: { type: Number, default: 0 },
})

const showFace = computed(() => {
  return props.phase === 'SHOW_CARD' || props.phase === 'SETTLEMENT'
})

const hasCards = computed(() => {
  return props.dealer && props.dealer.cards && props.dealer.cards.length > 0
})

const EMPTY_CARD = { rank: '', suit: '', isRed: false }

const faceCards = computed(() => {
  if (!hasCards.value) return Array(5).fill(EMPTY_CARD)
  const cards = props.dealer.cards.map(c => cardToDisplay(c))
  while (cards.length < 5) cards.push(EMPTY_CARD)
  return cards
})

const niuText = computed(() => {
  if (!showFace.value || !props.dealer) return ''
  return niuLabel(props.dealer.niuType)
})

const multText = computed(() => {
  if (!showFace.value || !props.dealer || !props.dealer.niuMult) return ''
  return `x${props.dealer.niuMult}`
})

const dealerWinText = computed(() => {
  if (!props.dealerWin) return ''
  const yuan = formatCoins(Math.abs(props.dealerWin))
  return props.dealerWin > 0 ? `+${yuan}` : `-${yuan}`
})

const dealerWinClass = computed(() => {
  if (!props.dealerWin) return ''
  return props.dealerWin > 0 ? 'dealer-win-positive' : 'dealer-win-negative'
})
</script>

<template>
  <div class="dealer-section">
    <div class="dealer-label">庄家</div>
    <div class="dealer-cards">
      <!-- Face cards (always in DOM, toggled by v-show) -->
      <div v-show="showFace" class="cards-row">
        <div
          v-for="(card, i) in faceCards"
          :key="i"
          class="mini-card"
          :class="{ 'is-red': card.isRed }"
        >
          <span class="card-rank">{{ card.rank }}</span>
          <span class="card-suit">{{ card.suit }}</span>
        </div>
      </div>
      <!-- Back cards (always in DOM, toggled by v-show) -->
      <div v-show="!showFace" class="cards-row">
        <div v-for="i in 5" :key="'back-' + i" class="mini-card card-back">
          <span class="card-back-text">?</span>
        </div>
      </div>
    </div>
    <div class="dealer-niu" :class="{ 'niu-hidden': !niuText }">
      <span class="niu-text">{{ niuText || '-' }}</span>
      <span class="niu-mult">{{ multText || '-' }}</span>
    </div>
    <!-- Dealer win/loss animation -->
    <Transition name="dealer-win-anim">
      <div v-if="dealerWinText" :key="dealerWin" class="dealer-win-badge" :class="dealerWinClass">
        {{ dealerWinText }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dealer-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 8px;
  margin: 6px 10px;
  position: relative;
}

.dealer-label {
  color: #ffd700;
  font-size: 14px;
  font-weight: bold;
  white-space: nowrap;
}

.dealer-cards {
  flex: 1;
  display: flex;
  justify-content: center;
}

.cards-row {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.mini-card {
  width: 32px;
  height: 44px;
  border-radius: 4px;
  border: 1px solid #666;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  color: #333;
  line-height: 1.1;
}

.mini-card.is-red {
  color: #e53e3e;
}

.card-rank {
  font-size: 12px;
}

.card-suit {
  font-size: 10px;
}

.mini-card.card-back {
  background: #2d5a27;
  border-color: #3a7a32;
  color: #fff;
}

.card-back-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
}

.dealer-niu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  min-width: 36px;
}

.dealer-niu.niu-hidden {
  visibility: hidden;
}

.niu-text {
  color: #fbbf24;
  font-size: 13px;
  font-weight: bold;
}

.niu-mult {
  color: #f97316;
  font-size: 11px;
  font-weight: bold;
}

/* Dealer win/loss badge */
.dealer-win-badge {
  position: absolute;
  top: -10px;
  right: 12px;
  font-size: 16px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.dealer-win-positive {
  color: #f44336;
}

.dealer-win-negative {
  color: #4caf50;
}

/* Animation: slide up + fade in, then fade out */
.dealer-win-anim-enter-active {
  animation: dealerWinIn 0.5s ease-out;
}

.dealer-win-anim-leave-active {
  animation: dealerWinOut 0.5s ease-in;
}

@keyframes dealerWinIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dealerWinOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}
</style>
