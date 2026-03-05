<script setup>
import { computed } from 'vue'

const props = defineProps({
  win: Number, // positive = win, negative = lose, in cents
})

function formatCoin(cents) {
  return (cents / 100).toFixed(2)
}

const isWin = computed(() => props.win > 0)
const displayText = computed(() => {
  if (props.win > 0) return '+' + formatCoin(props.win)
  return formatCoin(props.win) // negative already has minus sign
})
</script>

<template>
  <div class="settlement-overlay" :class="isWin ? 'overlay-win' : 'overlay-lose'">
    <div class="settlement-content">
      <div class="settlement-label">{{ isWin ? '恭喜赢得' : '本局输了' }}</div>
      <div class="settlement-amount">{{ displayText }}</div>
    </div>
  </div>
</template>

<style scoped>
.settlement-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  animation: overlayFadeIn 0.3s ease-out;
  pointer-events: none;
}

.settlement-content {
  text-align: center;
  padding: 20px 40px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid;
  animation: contentPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.overlay-win .settlement-content {
  border-color: #22c55e;
}

.overlay-lose .settlement-content {
  border-color: #ef4444;
}

.settlement-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}

.settlement-amount {
  font-size: 32px;
  font-weight: bold;
}

.overlay-win .settlement-amount {
  color: #22c55e;
}

.overlay-lose .settlement-amount {
  color: #ef4444;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes contentPopIn {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
