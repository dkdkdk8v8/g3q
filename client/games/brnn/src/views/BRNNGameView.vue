<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useBrnnStore } from '@/stores/brnn'
import { useUserStore } from '@/stores/user'
import { formatCoins } from '@shared/utils/format.js'
import DealerCards from '@/components/brnn/DealerCards.vue'
import BettingArea from '@/components/brnn/BettingArea.vue'
import ChipSelector from '@/components/brnn/ChipSelector.vue'
import TrendChart from '@/components/brnn/TrendChart.vue'
import SettlementOverlay from '@/components/brnn/SettlementOverlay.vue'

const brnnStore = useBrnnStore()
const userStore = useUserStore()

const phaseLabel = computed(() => {
  switch (brnnStore.currentPhase) {
    case 'IDLE':       return '等待中'
    case 'BETTING':    return '下注中'
    case 'DEALING':    return '发牌中'
    case 'SHOW_CARD':  return '开牌中'
    case 'SETTLEMENT': return '结算中'
    default:           return ''
  }
})

function onExit() {
  brnnStore.leaveRoom()
}

function onBet(idx) {
  brnnStore.placeBet(idx)
}

let countdownTimer = null

onMounted(() => {
  brnnStore.registerPushHandlers()
  brnnStore.joinRoom()
  countdownTimer = setInterval(() => {
    if (brnnStore.countdown > 0) {
      brnnStore.countdown--
    }
  }, 1000)
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  brnnStore.unregisterPushHandlers()
  brnnStore.resetState()
})
</script>

<template>
  <div class="brnn-page">
    <!-- Header -->
    <div class="brnn-header">
      <button class="brnn-btn-exit" @click="onExit">退出</button>
      <span class="header-balance">余额: {{ formatCoins(userStore.userInfo.balance) }}</span>
      <span class="header-online">在线: {{ brnnStore.playerCount }}人</span>
    </div>

    <!-- Game Info Bar -->
    <div class="brnn-info-bar">
      <span class="info-round">第 {{ brnnStore.gameCount }} 局</span>
      <span class="brnn-phase-label">{{ phaseLabel }}</span>
      <span v-if="brnnStore.countdown > 0" class="brnn-countdown">{{ brnnStore.countdown }}s</span>
    </div>

    <!-- Dealer Section -->
    <DealerCards :dealer="brnnStore.dealer" :phase="brnnStore.currentPhase" />

    <!-- 4 Betting Areas (2x2 grid) -->
    <div class="brnn-areas-grid">
      <BettingArea
        v-for="(area, idx) in brnnStore.areas"
        :key="idx"
        :area="area"
        :index="idx"
        :phase="brnnStore.currentPhase"
        :canBet="brnnStore.currentPhase === 'BETTING'"
        @bet="onBet(idx)"
      />
    </div>

    <!-- Settlement overlay -->
    <SettlementOverlay
      v-if="brnnStore.lastWin !== 0"
      :win="brnnStore.lastWin"
    />

    <!-- Chip Selector (only during betting) -->
    <ChipSelector
      v-if="brnnStore.currentPhase === 'BETTING'"
      :chips="brnnStore.chips"
      :selected="brnnStore.selectedChip"
      @select="brnnStore.selectChipValue"
    />

    <!-- Trend Chart -->
    <TrendChart :trend="brnnStore.trend" />
  </div>
</template>

<style scoped>
.brnn-page {
  width: 100vw;
  min-height: 100vh;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-sizing: border-box;
}

/* Header */
.brnn-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  gap: 12px;
}

.brnn-btn-exit {
  background: rgba(239, 68, 68, 0.8);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.brnn-btn-exit:active {
  opacity: 0.7;
}

.header-balance {
  flex: 1;
  font-size: 13px;
  color: #fbbf24;
  font-weight: bold;
}

.header-online {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

/* Info Bar */
.brnn-info-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.2);
}

.info-round {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.brnn-phase-label {
  font-size: 14px;
  font-weight: bold;
  color: #60a5fa;
}

.brnn-countdown {
  font-size: 18px;
  font-weight: bold;
  color: #f97316;
  min-width: 30px;
  text-align: center;
}

/* Areas Grid */
.brnn-areas-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px 10px;
  flex: 1;
}
</style>
