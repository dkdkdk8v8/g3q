<script setup>
import { ref, onMounted } from 'vue'
import { useBrnnStore } from '@/stores/brnn'
import { useUserStore } from '@/stores/user'
import { formatCoins } from '@shared/utils/format.js'
import { cardToDisplay, niuLabel } from '@shared/utils/bullfight.js'

const emit = defineEmits(['close'])
const brnnStore = useBrnnStore()
const userStore = useUserStore()
const scrollRef = ref(null)
const expandedIdx = ref(-1)

const AREA_NAMES = ['天', '地', '玄', '黄']

function formatTime(createAt) {
  if (!createAt) return ''
  const d = new Date(createAt)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

function balanceChange(item) {
  return (item.BalanceAfter || 0) - (item.BalanceBefore || 0)
}

function toggleExpand(idx) {
  expandedIdx.value = expandedIdx.value === idx ? -1 : idx
}

function cardStr(cardId) {
  const c = cardToDisplay(cardId)
  return c.suit + c.rank
}

function getMyBet(gameDataObj) {
  if (!gameDataObj?.PlayerBets) return null
  return gameDataObj.PlayerBets.find(pb => pb.UserId === userStore.userInfo.user_id)
}

function onScroll() {
  const el = scrollRef.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
    brnnStore.fetchHistory()
  }
}

onMounted(() => {
  brnnStore.fetchHistory({ reset: true })
})
</script>

<template>
  <div class="history-mask" @click.self="emit('close')">
    <div class="history-panel">
      <!-- Header -->
      <div class="history-header">
        <span class="history-title">下注记录</span>
        <button class="history-close" @click="emit('close')">关闭</button>
      </div>

      <!-- List -->
      <div class="history-list" ref="scrollRef" @scroll="onScroll">
        <template v-for="(item, idx) in brnnStore.history" :key="idx">
          <!-- Date summary -->
          <div v-if="item.Type === 0" class="date-summary">
            <span class="date-label">{{ item.Date }}</span>
            <span class="date-stats">
              投注 <em>{{ formatCoins(item.TotalBet) }}</em>
              盈亏 <em :class="item.TotalWinBalance >= 0 ? 'clr-win' : 'clr-lose'">
                {{ item.TotalWinBalance >= 0 ? '+' : '' }}{{ formatCoins(item.TotalWinBalance) }}
              </em>
            </span>
          </div>

          <!-- Game record -->
          <div v-else-if="item.Type === 1" class="record-card" @click="toggleExpand(idx)">
            <!-- Compact row -->
            <div class="record-row">
              <span class="record-time">{{ formatTime(item.CreateAt) }}</span>
              <div v-if="item.GameDataObj" class="record-tags">
                <span
                  v-for="(win, aIdx) in item.GameDataObj.AreaWin"
                  :key="aIdx"
                  class="area-tag"
                  :class="win ? 'tag-win' : 'tag-lose'"
                >{{ AREA_NAMES[aIdx] }}</span>
              </div>
              <span class="record-change" :class="balanceChange(item) >= 0 ? 'clr-win' : 'clr-lose'">
                {{ balanceChange(item) >= 0 ? '+' : '' }}{{ formatCoins(balanceChange(item)) }}
              </span>
              <span class="expand-arrow" :class="{ rotated: expandedIdx === idx }">›</span>
            </div>

            <!-- Expanded detail -->
            <div v-if="expandedIdx === idx && item.GameDataObj" class="record-detail">
              <!-- My bets per area -->
              <div v-if="getMyBet(item.GameDataObj)" class="my-bets-section">
                <div class="my-bets-title">投注详情</div>
                <div class="my-bets-grid">
                  <template v-for="(bet, aIdx) in getMyBet(item.GameDataObj).Bets" :key="'mb'+aIdx">
                    <div v-if="bet > 0" class="my-bet-item" :class="item.GameDataObj.AreaWin[aIdx] ? 'bet-win' : 'bet-lose'">
                      <span class="my-bet-area">{{ AREA_NAMES[aIdx] }}</span>
                      <span class="my-bet-amount">{{ formatCoins(bet) }}</span>
                      <span class="my-bet-result">{{ item.GameDataObj.AreaWin[aIdx] ? '赢' : '输' }}</span>
                    </div>
                  </template>
                </div>
              </div>
              <!-- Dealer -->
              <div class="detail-row dealer-row">
                <span class="detail-label">庄</span>
                <span class="detail-cards" v-if="item.GameDataObj.DealerCards">
                  <span
                    v-for="(cid, ci) in item.GameDataObj.DealerCards"
                    :key="ci"
                    class="mini-card"
                    :class="{ 'card-red': cardToDisplay(cid).isRed }"
                  >{{ cardStr(cid) }}</span>
                </span>
                <span class="detail-niu">{{ niuLabel(item.GameDataObj.DealerNiu) }}</span>
                <span class="detail-mult">x{{ item.GameDataObj.DealerMult }}</span>
              </div>
              <!-- Areas -->
              <div
                v-for="(win, aIdx) in item.GameDataObj.AreaWin"
                :key="'a'+aIdx"
                class="detail-row"
                :class="win ? 'row-win' : 'row-lose'"
              >
                <span class="detail-label">{{ AREA_NAMES[aIdx] }}</span>
                <span class="detail-cards" v-if="item.GameDataObj.AreaCards && item.GameDataObj.AreaCards[aIdx]">
                  <span
                    v-for="(cid, ci) in item.GameDataObj.AreaCards[aIdx]"
                    :key="ci"
                    class="mini-card"
                    :class="{ 'card-red': cardToDisplay(cid).isRed }"
                  >{{ cardStr(cid) }}</span>
                </span>
                <span class="detail-niu" v-if="item.GameDataObj.AreaNiu">{{ niuLabel(item.GameDataObj.AreaNiu[aIdx]) }}</span>
                <span class="detail-result" :class="win ? 'clr-win' : 'clr-lose'">{{ win ? '赢' : '输' }}</span>
                <span class="detail-mult">x{{ item.GameDataObj.AreaMult[aIdx] }}</span>
              </div>
              <!-- Summary: 输赢 / 税收 / 汇总 -->
              <div class="detail-summary">
                <template v-if="getMyBet(item.GameDataObj)">
                  <span>输赢 <em :class="getMyBet(item.GameDataObj).Win >= 0 ? 'clr-win' : 'clr-lose'">{{ getMyBet(item.GameDataObj).Win >= 0 ? '+' : '' }}{{ formatCoins(getMyBet(item.GameDataObj).Win) }}</em></span>
                  <span v-if="getMyBet(item.GameDataObj).Tax > 0">税收 <em class="clr-tax">-{{ formatCoins(getMyBet(item.GameDataObj).Tax) }}</em></span>
                </template>
                <span>汇总 <em :class="balanceChange(item) >= 0 ? 'clr-win' : 'clr-lose'">{{ balanceChange(item) >= 0 ? '+' : '' }}{{ formatCoins(balanceChange(item)) }}</em></span>
              </div>
            </div>
          </div>
        </template>

        <!-- Loading / End -->
        <div v-if="brnnStore.isLoadingHistory" class="list-status">加载中...</div>
        <div v-else-if="brnnStore.isHistoryEnd && brnnStore.history.length > 0" class="list-status">没有更多记录</div>
        <div v-else-if="brnnStore.history.length === 0" class="list-status">暂无下注记录</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-panel {
  width: 92%;
  max-width: 400px;
  max-height: 80vh;
  background: #1e1e30;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.history-title {
  font-size: 15px;
  font-weight: bold;
  color: #fff;
}

.history-close {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px 16px;
  -webkit-overflow-scrolling: touch;
}

/* Date summary row */
.date-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 6px;
}

.date-label {
  font-size: 13px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.6);
}

.date-stats {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.date-stats em {
  font-style: normal;
  font-weight: bold;
  margin-left: 2px;
}

/* Record card - compact */
.record-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.record-tags {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.area-tag {
  font-size: 11px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 3px;
}

.tag-win {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.tag-lose {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.record-change {
  font-size: 13px;
  font-weight: bold;
  flex-shrink: 0;
}

.expand-arrow {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.expand-arrow.rotated {
  transform: rotate(90deg);
}

/* My bets section */
.my-bets-section {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
}

.my-bets-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}

.my-bets-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.my-bet-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.my-bet-item.bet-win {
  background: rgba(34, 197, 94, 0.1);
}

.my-bet-item.bet-lose {
  background: rgba(239, 68, 68, 0.1);
}

.my-bet-area {
  font-weight: bold;
  color: rgba(255, 255, 255, 0.7);
}

.my-bet-amount {
  color: #fbbf24;
  font-weight: bold;
}

.my-bet-result {
  font-size: 11px;
  font-weight: bold;
}

.bet-win .my-bet-result { color: #22c55e; }
.bet-lose .my-bet-result { color: #ef4444; }

/* Expanded detail */
.record-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 11px;
}

.detail-label {
  width: 16px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
  text-align: center;
}

.dealer-row .detail-label {
  color: #fbbf24;
}

.detail-cards {
  display: flex;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.mini-card {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 3px;
  border-radius: 2px;
  white-space: nowrap;
}

.mini-card.card-red {
  color: #f87171;
}

.detail-niu {
  font-size: 11px;
  font-weight: bold;
  color: #60a5fa;
  flex-shrink: 0;
}

.detail-result {
  font-size: 11px;
  font-weight: bold;
  flex-shrink: 0;
}

.detail-mult {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.row-win {
  background: rgba(34, 197, 94, 0.05);
  border-radius: 4px;
  padding: 4px 4px;
}

.row-lose {
  background: rgba(239, 68, 68, 0.03);
  border-radius: 4px;
  padding: 4px 4px;
}

.detail-summary {
  display: flex;
  gap: 12px;
  padding: 6px 0 2px;
  margin-top: 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.detail-summary em {
  font-style: normal;
  font-weight: bold;
  margin-left: 2px;
}

.clr-win { color: #22c55e; }
.clr-lose { color: #ef4444; }
.clr-tax { color: #f59e0b; }

.list-status {
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  padding: 16px 0;
}
</style>
