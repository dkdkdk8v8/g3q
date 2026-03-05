<script setup>
import { computed } from 'vue'

const props = defineProps({
  trend: Array, // Array of TrendRecord objects, e.g. [{GameCount, DealerNiu, AreaNiu, AreaWin}, ...]
})

const AREA_NAMES = ['天', '地', '玄', '黄']

// Show the last 20 rounds
const displayTrend = computed(() => {
  if (!props.trend || props.trend.length === 0) return []
  return props.trend.slice(-20)
})

const hasData = computed(() => displayTrend.value.length > 0)
</script>

<template>
  <div class="trend-section">
    <div class="trend-header">
      <span class="trend-title">走势</span>
      <span class="trend-count">最近 {{ displayTrend.length }} 局</span>
    </div>

    <div v-if="hasData" class="trend-table-wrap">
      <table class="trend-table">
        <thead>
          <tr>
            <th class="col-round">#</th>
            <th v-for="(name, i) in AREA_NAMES" :key="i" class="col-area">{{ name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(round, rIdx) in displayTrend" :key="rIdx">
            <td class="col-round">{{ rIdx + 1 }}</td>
            <td v-for="(win, aIdx) in round.AreaWin" :key="aIdx" class="col-area">
              <span class="dot" :class="win ? 'dot-win' : 'dot-lose'"></span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="trend-empty">暂无走势数据</div>
  </div>
</template>

<style scoped>
.trend-section {
  padding: 8px 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.trend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.trend-title {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: bold;
}

.trend-count {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}

.trend-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.trend-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.trend-table th {
  color: rgba(255, 255, 255, 0.5);
  font-weight: normal;
  padding: 3px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.trend-table td {
  padding: 3px 4px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.col-round {
  width: 28px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 10px;
}

.col-area {
  width: 25%;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-win {
  background: #22c55e;
}

.dot-lose {
  background: #ef4444;
}

.trend-empty {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  text-align: center;
  padding: 12px 0;
}
</style>
