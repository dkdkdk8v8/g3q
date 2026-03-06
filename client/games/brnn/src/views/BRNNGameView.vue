<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useBrnnStore } from '@/stores/brnn'
import { useUserStore } from '@/stores/user'
import { formatCoins } from '@shared/utils/format.js'
import gameClient from '../socket.js'
import DealerCards from '@/components/brnn/DealerCards.vue'
import BettingArea from '@/components/brnn/BettingArea.vue'
import ChipSelector from '@/components/brnn/ChipSelector.vue'
import TrendChart from '@/components/brnn/TrendChart.vue'
import SettlementOverlay from '@/components/brnn/SettlementOverlay.vue'
import HistoryModal from '@/components/brnn/HistoryModal.vue'
import OnlinePlayersModal from '@/components/brnn/OnlinePlayersModal.vue'

const brnnStore = useBrnnStore()
const userStore = useUserStore()
const showHistory = ref(false)
const showOnlinePlayers = ref(false)
const toastMsg = ref('')
let toastTimer = null

function showToast(msg) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2000)
}

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
  // 客户端预检余额（balance 已是服务端扣减后的剩余余额）
  if (brnnStore.selectedChip > userStore.userInfo.balance) {
    showToast('余额不足')
    return
  }
  brnnStore.placeBet(idx)
}

let countdownTimer = null

function onPlaceBetResp(msg) {
  if (msg.code !== 0 && msg.msg) {
    showToast(msg.msg)
  }
}

onMounted(() => {
  brnnStore.registerPushHandlers()
  gameClient.on('BRNN.PlaceBet', onPlaceBetResp)
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
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  gameClient.off('BRNN.PlaceBet')
  brnnStore.unregisterPushHandlers()
  brnnStore.resetState()
})
</script>

<template>
  <div class="brnn-page">
    <!-- Header -->
    <div class="brnn-header">
      <button class="brnn-btn-exit" @click="onExit">退出</button>
      <div class="header-user-info">
        <span class="header-uid">ID: {{ userStore.userInfo.user_id }}</span>
        <span class="header-balance">余额: {{ formatCoins(userStore.userInfo.balance) }}</span>
      </div>
      <span class="header-online header-online-clickable" @click="showOnlinePlayers = true">在线: {{ brnnStore.playerCount }}人</span>
      <button class="brnn-btn-history" @click="showHistory = true">记录</button>
    </div>

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="toastMsg" class="brnn-toast">{{ toastMsg }}</div>
    </Transition>

    <!-- Game Info Bar -->
    <div class="brnn-info-bar">
      <span class="brnn-phase-label">{{ phaseLabel }}</span>
      <span class="brnn-countdown" :class="{ 'countdown-hidden': brnnStore.countdown <= 0 }">{{ brnnStore.countdown || 0 }}s</span>
    </div>

    <!-- Dealer Section -->
    <DealerCards :dealer="brnnStore.dealer" :phase="brnnStore.currentPhase" :dealerWin="brnnStore.dealerWin" />

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

    <!-- Chip Selector (always rendered, visually hidden when not betting) -->
    <ChipSelector
      :chips="brnnStore.chips"
      :selected="brnnStore.selectedChip"
      :disabled="brnnStore.currentPhase !== 'BETTING'"
      @select="brnnStore.selectChipValue"
    />

    <!-- Trend Chart -->
    <TrendChart :trend="brnnStore.trend" />

    <!-- History Modal -->
    <HistoryModal v-if="showHistory" @close="showHistory = false" />

    <!-- Online Players Modal -->
    <OnlinePlayersModal v-if="showOnlinePlayers" @close="showOnlinePlayers = false" />
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

.header-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.header-uid {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.header-balance {
  font-size: 13px;
  color: #fbbf24;
  font-weight: bold;
}

.header-online {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.header-online-clickable {
  cursor: pointer;
  text-decoration: underline;
  -webkit-tap-highlight-color: transparent;
}

.header-online-clickable:active {
  color: #60a5fa;
}

.brnn-btn-history {
  background: rgba(96, 165, 250, 0.8);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.brnn-btn-history:active {
  opacity: 0.7;
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

.brnn-countdown.countdown-hidden {
  visibility: hidden;
}

/* Areas Grid */
.brnn-areas-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px 10px;
  flex: 1;
}

/* Toast */
.brnn-toast {
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 300;
  pointer-events: none;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
</style>
