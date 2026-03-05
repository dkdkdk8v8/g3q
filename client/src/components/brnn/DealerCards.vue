<script setup>
import { computed } from 'vue'

const props = defineProps({
  dealer: Object,
  phase: String,
})

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

const showFace = computed(() => {
  return props.phase === 'SHOW_CARD' || props.phase === 'SETTLEMENT'
})

const hasCards = computed(() => {
  return props.dealer && props.dealer.cards && props.dealer.cards.length > 0
})

const displayCards = computed(() => {
  if (!hasCards.value || !showFace.value) return []
  return props.dealer.cards.map(c => cardToDisplay(c))
})

const niuText = computed(() => {
  if (!showFace.value || !props.dealer) return ''
  return niuLabel(props.dealer.niuType)
})

const multText = computed(() => {
  if (!showFace.value || !props.dealer || !props.dealer.niuMult) return ''
  return `x${props.dealer.niuMult}`
})
</script>

<template>
  <div class="dealer-section">
    <div class="dealer-label">庄家</div>
    <div class="dealer-cards">
      <template v-if="showFace && displayCards.length > 0">
        <div
          v-for="(card, i) in displayCards"
          :key="i"
          class="mini-card"
          :class="{ 'is-red': card.isRed }"
        >
          <span class="card-rank">{{ card.rank }}</span>
          <span class="card-suit">{{ card.suit }}</span>
        </div>
      </template>
      <template v-else>
        <div v-for="i in 5" :key="'back-' + i" class="mini-card card-back">
          <span class="card-back-text">?</span>
        </div>
      </template>
    </div>
    <div v-if="niuText" class="dealer-niu">
      <span class="niu-text">{{ niuText }}</span>
      <span v-if="multText" class="niu-mult">{{ multText }}</span>
    </div>
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
}

.dealer-label {
  color: #ffd700;
  font-size: 14px;
  font-weight: bold;
  white-space: nowrap;
}

.dealer-cards {
  display: flex;
  gap: 4px;
  flex: 1;
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
</style>
