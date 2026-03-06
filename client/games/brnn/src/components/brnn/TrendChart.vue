<script setup>
import { computed } from 'vue'

const props = defineProps({
  trend: Array,
})

const AREA_NAMES = ['天', '地', '玄', '黄']
const AREA_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b']
const SLOTS = 10

const displayTrend = computed(() => {
  if (!props.trend || props.trend.length === 0) return []
  return props.trend.slice(-SLOTS)
})

// Pad to 10 slots: empty slots on the left, data on the right
const paddedTrend = computed(() => {
  const data = displayTrend.value
  const empty = SLOTS - data.length
  const result = []
  for (let i = 0; i < empty; i++) result.push(null)
  for (const d of data) result.push(d)
  return result
})

</script>

<template>
  <div class="trend-section">
    <div class="trend-header">
      <span class="trend-title">走势</span>
    </div>

    <div class="trend-grid">
      <div v-for="(name, aIdx) in AREA_NAMES" :key="aIdx" class="trend-row">
        <span class="area-label" :style="{ color: AREA_COLORS[aIdx] }">{{ name }}</span>
        <div class="round-cells">
          <div
            v-for="(round, rIdx) in paddedTrend"
            :key="rIdx"
            class="cell-wrap"
          >
            <span v-if="aIdx === 0 && rIdx === SLOTS - 1 && round" class="newest-tag">最新</span>
            <span
              v-if="round"
              class="cell"
              :class="round.AreaWin[aIdx] ? 'cell-win' : 'cell-lose'"
            >{{ round.AreaWin[aIdx] ? '赢' : '输' }}</span>
            <span v-else class="cell cell-empty">-</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trend-section {
  padding: 8px 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.trend-header {
  margin-bottom: 6px;
}

.trend-title {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: bold;
}

.trend-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trend-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.area-label {
  width: 18px;
  font-size: 13px;
  font-weight: bold;
  text-align: center;
  flex-shrink: 0;
}

.round-cells {
  display: flex;
  flex: 1;
  gap: 0;
}

.cell-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.newest-tag {
  position: absolute;
  top: -14px;
  font-size: 9px;
  color: rgba(255, 215, 0, 0.7);
  white-space: nowrap;
}

.cell {
  width: 100%;
  max-width: 28px;
  height: 20px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-win {
  background: rgba(34, 197, 94, 0.25);
  color: #22c55e;
}

.cell-lose {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.cell-empty {
  color: rgba(255, 255, 255, 0.1);
}

</style>
