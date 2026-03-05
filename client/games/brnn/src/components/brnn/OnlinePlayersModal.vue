<script setup>
import { onMounted } from 'vue'
import { useBrnnStore } from '@/stores/brnn'
import { formatCoins } from '@shared/utils/format.js'

const emit = defineEmits(['close'])
const brnnStore = useBrnnStore()

onMounted(() => {
  brnnStore.fetchOnlinePlayers()
})
</script>

<template>
  <div class="players-mask" @click.self="emit('close')">
    <div class="players-panel">
      <!-- Header -->
      <div class="players-header">
        <span class="players-title">在线玩家</span>
        <button class="players-close" @click="emit('close')">关闭</button>
      </div>

      <!-- List -->
      <div class="players-list">
        <!-- Loading -->
        <div v-if="brnnStore.isLoadingPlayers" class="list-status">加载中...</div>

        <!-- Empty -->
        <div v-else-if="brnnStore.onlinePlayers.length === 0" class="list-status">暂无在线玩家</div>

        <!-- Player items -->
        <template v-else>
          <div
            v-for="(player, idx) in brnnStore.onlinePlayers"
            :key="player.UserId"
            class="player-item"
          >
            <span class="player-rank">{{ idx + 1 }}</span>
            <div class="player-avatar">
              <img v-if="player.Avatar" :src="player.Avatar" alt="" />
              <span v-else class="avatar-placeholder">{{ (player.NickName || '?')[0] }}</span>
            </div>
            <div class="player-info">
              <span class="player-name">{{ player.NickName || player.UserId }}</span>
              <span class="player-balance">余额: {{ formatCoins(player.Balance) }}</span>
            </div>
            <span class="player-label">近20局</span>
            <div class="player-stats">
              <span class="stat-bet">下注 {{ formatCoins(player.TotalBet) }}</span>
              <span class="stat-win">胜{{ player.WinCount }}局</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.players-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.players-panel {
  width: 92%;
  max-width: 400px;
  max-height: 80vh;
  background: #1e1e30;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.players-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.players-title {
  font-size: 15px;
  font-weight: bold;
  color: #fff;
}

.players-close {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.players-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px 16px;
  -webkit-overflow-scrolling: touch;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.player-rank {
  width: 22px;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.5);
}

.player-item:nth-child(1) .player-rank { color: #fbbf24; }
.player-item:nth-child(2) .player-rank { color: #94a3b8; }
.player-item:nth-child(3) .player-rank { color: #cd7f32; }

.player-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 16px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.5);
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.player-name {
  font-size: 13px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-balance {
  font-size: 11px;
  color: #fbbf24;
}

.player-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.player-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.stat-bet {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.stat-win {
  font-size: 12px;
  font-weight: bold;
  color: #22c55e;
}

.list-status {
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  padding: 16px 0;
}
</style>
