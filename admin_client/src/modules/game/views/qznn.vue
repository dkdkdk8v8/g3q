<template>
  <div class="game-room-qznn">
    <!-- Header Bar -->
    <div class="header-bar">
      <div class="header-left">
        <el-button type="primary" :icon="Refresh" @click="refresh" round>刷新</el-button>
        <div class="stats-pills">
          <div class="pill">
            <span class="pill-label">房间</span>
            <span class="pill-value">{{ roomCount }}</span>
          </div>
          <div class="pill pill-success">
            <span class="pill-label">用户</span>
            <span class="pill-value">{{ playerStats.user }}</span>
          </div>
          <div class="pill pill-info">
            <span class="pill-label">机器人</span>
            <span class="pill-value">{{ playerStats.robot }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">游戏玩法</span>
        <div class="filter-chips">
          <button
v-for="gt in gameTypes" :key="gt.value" class="chip"
            :class="{ active: filterType === gt.value }" @click="filterType = gt.value">{{ gt.label }}
            <span class="chip-count">{{ gameTypeRoomCount[gt.value] || 0 }}</span></button>
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-label">房间等级</span>
        <div class="filter-chips">
          <button class="chip" :class="{ active: filterLevel === '' }" @click="filterLevel = ''">全部</button>
          <button
v-for="lv in levelOptions" :key="lv.value" class="chip"
            :class="{ active: filterLevel === lv.value }" @click="filterLevel = lv.value">{{ lv.label }}
            <span class="chip-count">{{ levelRoomCount[lv.value] || 0 }}</span></button>
        </div>
      </div>
    </div>

    <!-- Room List -->
    <div
class="room-list" v-infinite-scroll="loadMore" :infinite-scroll-distance="200"
      :infinite-scroll-disabled="noMore">
      <el-empty v-if="errorMessage" :description="errorMessage" />
      <el-empty v-else-if="Object.keys(list).length === 0" description="暂时没有房间数据" />

      <div v-else>
        <div v-for="group in displayedGroups" :key="group.title" class="level-group">
          <div class="group-header">
            <span class="group-indicator"></span>
            {{ group.title }}
          </div>
          <div class="room-grid">
            <div v-for="item in group.rooms" :key="item.ID" class="room-card" :class="getRoomClass(item.ID)">
              <!-- Card Header -->
              <div class="room-card-header">
                <div class="header-tags">
                  <span class="tag tag-type" :class="'tag-' + getRoomTagType(item.ID)">{{
                    getRoomInfo(item.ID).type }}</span>
                  <span class="tag tag-level">{{ getRoomInfo(item.ID).level }}</span>
                </div>
                <el-tooltip placement="top">
                  <template #content>
                    <div
style="display: flex; align-items: center; gap: 4px; cursor: pointer;"
                      @click="copyGameID(item.GameID)">
                      <span>{{ item.GameID }}</span>
                      <el-icon><copy-document /></el-icon>
                    </div>
                  </template>
                  <span class="state-badge" :class="'state-' + (stateTypeMap[item.State] || 'info')">
                    {{ stateMap[item.State] || item.State }}
                    <span v-if="item.StateLeftSec > 0" class="state-timer">{{ item.StateLeftSec }}s</span>
                  </span>
                </el-tooltip>
              </div>

              <!-- Players -->
              <div class="players-area">
                <div
v-for="(player, index) in item.Players" :key="index" class="player-row"
                  :class="{ 'is-robot': player && player.IsRobot, 'is-human': player && !player.IsRobot }">
                  <template v-if="player">
                    <div class="player-left">
                      <div class="player-info-col">
                        <el-tooltip placement="top" :enterable="true">
                          <template #content>
                            <div
style="display: flex; align-items: center; gap: 4px; cursor: pointer;"
                              @click="copyText(player.ID, '用户ID')">
                              <span>{{ player.ID }}</span>
                              <el-icon><copy-document /></el-icon>
                            </div>
                          </template>
                          <span class="player-nickname" :class="{ 'is-banker': item.BankerID === player.ID, 'is-ob': player.IsOb }">{{ player.NickName || player.ID }}</span>
                        </el-tooltip>
                        <div class="player-balance-row">
                          <span class="balance">{{ (player.Balance / 100).toFixed(2) }}</span>
                          <span v-if="player.BalanceChange > 0" class="positive">+{{ (player.BalanceChange /
                            100).toFixed(2) }}</span>
                          <span v-else-if="player.BalanceChange < 0" class="negative">{{ (player.BalanceChange /
                            100).toFixed(2) }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="player-center">
                      <span v-if="player.CallMult >= 0 && player.BetMult === -1" class="mult-info call">
                        {{ player.CallMult === 0 ? '不抢' : '抢庄x' + player.CallMult }}
                      </span>
                      <span v-if="player.BetMult >= 0" class="mult-info bet">
                        下注x{{ player.BetMult }}
                      </span>
                    </div>
                    <div class="player-right">
                      <template v-if="Array.isArray(player.Cards) && player.Cards.length > 0">
                        <span
v-if="player.Cards.length === 5" class="card-result"
                          :class="getResultClass(getCardResult(player.Cards))">
                          {{ getCardResult(player.Cards) }}
                        </span>
                        <poker-card v-for="(card, idx) in player.Cards" :key="idx" :value="card" size="small" />
                      </template>
                    </div>
                  </template>
                  <div v-else class="empty-seat">空闲</div>
                </div>
              </div>

              <!-- Footer -->
              <div class="room-card-footer">
                <span>{{ dayjs(item.CreateAt).format("MM-DD HH:mm:ss") }}</span>
                <span>{{ dayjs(item.CreateAt).fromNow() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" name="game-room-qznn" setup>
import { useCool } from "/@/cool";
import { useDict } from '/$/dict';
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import dayjs from "dayjs";
import { Refresh, CopyDocument } from "@element-plus/icons-vue";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import { getCardResult } from "../utils/card";
import { QznnRoomTypes, getQznnRoomTypeLabel } from "../utils/dict";
import PokerCard from "../components/poker-card.vue";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");
const { service } = useCool();
const { dict } = useDict();
const list = ref<any>({});
const errorMessage = ref("");
const filterLevel = ref("");
const filterType = ref("0");

const gameTypes = QznnRoomTypes.map((i) => ({ value: String(i.value), label: i.label }));

const levelMap = computed(() => {
  const map: Record<string, string> = {};
  const data = dict.get("qznn_room_level").value || [];
  data.forEach((item: any) => {
    map[String(item.value)] = item.label;
  });
  return map;
});

const levelOptions = computed(() => {
  const data = dict.get("qznn_room_level").value || [];
  return data.map((item: any) => ({ value: String(item.value), label: item.label }));
});

const levelRoomCount = computed(() => {
  const counts: Record<string, number> = {};
  levelOptions.value.forEach((lv) => (counts[lv.value] = 0));
  Object.values(list.value).forEach((room: any) => {
    const raw = getRoomRawParts(room.ID);
    if (filterType.value && raw.type !== filterType.value) return;
    if (counts[raw.level] !== undefined) counts[raw.level]++;
  });
  return counts;
});

function getRoomInfo(id: string) {
  if (!id) return { level: "", type: "" };
  const parts = id.split("_");
  if (parts.length >= 3) {
    return {
      level: levelMap.value[parts[2]] || "未知",
      type: getQznnRoomTypeLabel(parts[1]),
    };
  }
  return { level: "未知", type: "未知" };
}

function getRoomClass(id: string) {
  if (!id) return "";
  const parts = id.split("_");
  if (parts.length < 2) return "";
  const typeStr = parts[1];
  let typeCode = 0;
  for (let i = 0; i < typeStr.length; i++) {
    typeCode += typeStr.charCodeAt(i);
  }
  return `room-variant-${typeCode % 6}`;
}

function getRoomTagType(id: string) {
  if (!id) return "info";
  const parts = id.split("_");
  if (parts.length < 2) return "info";
  const typeStr = parts[1];
  let typeCode = 0;
  for (let i = 0; i < typeStr.length; i++) {
    typeCode += typeStr.charCodeAt(i);
  }
  const types = ['primary', 'success', 'warning', 'danger', 'info', 'primary'];
  return types[typeCode % 6];
}

function getResultClass(result: string) {
  if (!result) return "";
  if (result === "牛牛" || result === "五花牛" || result === "炸弹" || result === "五小牛" || result === "四花牛") return "result-special";
  if (result === "无牛") return "result-none";
  return "result-normal";
}

function getRoomRawParts(id: string) {
  if (!id) return { type: "", level: "" };
  const parts = id.split("_");
  return {
    type: parts.length >= 2 ? parts[1] : "",
    level: parts.length >= 3 ? parts[2] : "",
  };
}

const filteredList = computed<any[]>(() => {
  const all = Object.values(list.value);
  return all.filter((item: any) => {
    const raw = getRoomRawParts(item.ID);
    const matchType = filterType.value ? raw.type === filterType.value : true;
    const matchLevel = filterLevel.value ? raw.level === filterLevel.value : true;
    return matchType && matchLevel;
  });
});

const groupedList = computed(() => {
  const groups: { title: string; rooms: any[] }[] = [];
  const temp: Record<string, any[]> = {};
  filteredList.value.forEach((item) => {
    const { level } = getRoomInfo(item.ID);
    if (!temp[level]) temp[level] = [];
    temp[level].push(item);
  });
  Object.keys(levelMap.value).sort().forEach((key) => {
    const name = levelMap.value[key];
    if (temp[name]) {
      temp[name].sort((a, b) => new Date(b.CreateAt).getTime() - new Date(a.CreateAt).getTime());
      groups.push({ title: name, rooms: temp[name] });
      delete temp[name];
    }
  });
  Object.keys(temp).forEach((name) => {
    temp[name].sort((a, b) => new Date(b.CreateAt).getTime() - new Date(a.CreateAt).getTime());
    groups.push({ title: name, rooms: temp[name] });
  });
  return groups;
});

const displayedRoomsCount = ref(20);

const noMore = computed(() => {
  return displayedRoomsCount.value >= filteredList.value.length;
});

const displayedGroups = computed(() => {
  const limit = displayedRoomsCount.value;
  let count = 0;
  const result: { title: string; rooms: any[] }[] = [];
  for (const group of groupedList.value) {
    if (count >= limit) break;
    const remaining = limit - count;
    if (group.rooms.length <= remaining) {
      result.push(group);
      count += group.rooms.length;
    } else {
      result.push({ ...group, rooms: group.rooms.slice(0, remaining) });
      count += remaining;
    }
  }
  return result;
});

const stateMap: Record<string, string> = {
  StateWaiting: "等待中",
  StatePrepare: "准备中",
  StateStartGame: "开始",
  StatePreCard: "预发牌",
  StateBanking: "抢庄",
  StateRandomBank: "随机庄",
  StateBankerConfirm: "确认庄",
  StateBetting: "下注",
  StateDealing: "发牌",
  StateShowCard: "摊牌",
  StateSettling: "结算",
  StateSettlingDirectPreCard: "下一局",
};

const stateTypeMap: Record<string, string> = {
  StateWaiting: "info",
  StatePrepare: "info",
  StateStartGame: "success",
  StatePreCard: "success",
  StateBanking: "success",
  StateRandomBank: "success",
  StateBankerConfirm: "success",
  StateBetting: "success",
  StateDealing: "success",
  StateShowCard: "success",
  StateSettling: "danger",
  StateSettlingDirectPreCard: "info",
};

const roomCount = computed(() => Object.keys(list.value).length);

const playerStats = computed(() => {
  let user = 0;
  let robot = 0;
  Object.values(list.value).forEach((room: any) => {
    if (room.Players && Array.isArray(room.Players)) {
      room.Players.forEach((p: any) => {
        if (p) {
          if (p.IsRobot) robot++;
          else user++;
        }
      });
    }
  });
  return { user, robot };
});

const gameTypeRoomCount = computed(() => {
  const counts: Record<string, number> = {};
  gameTypes.forEach((gt) => (counts[gt.value] = 0));
  Object.values(list.value).forEach((room: any) => {
    const raw = getRoomRawParts(room.ID);
    if (counts[raw.type] !== undefined) counts[raw.type]++;
  });
  return counts;
});

const copyGameID = (id: any) => {
  navigator.clipboard.writeText(String(id));
  ElMessage.success("GameID 已复制");
};

const copyText = (text: any, label: string = '内容') => {
  navigator.clipboard.writeText(String(text));
  ElMessage.success(`${label} 已复制`);
};

const loadMore = () => {
  if (noMore.value) return;
  displayedRoomsCount.value += 50;
};

watch([filterLevel, filterType], () => {
  displayedRoomsCount.value = 20;
});

let reqId = 0;

async function refresh() {
  const currentId = ++reqId;
  try {
    const res = await service.game.room.qznn();
    if (currentId !== reqId) return;
    errorMessage.value = "";
    list.value = res.data || res || {};
  } catch (err) {
    if (currentId !== reqId) return;
    console.error(err);
    errorMessage.value = "获取房间数据失败 " + ((err as any).message || "");
  }
}

let timer: any = null;
let isActive = false;

const loop = async () => {
  if (!isActive) return;
  await refresh();
  if (isActive) {
    timer = setTimeout(loop, 1000);
  }
};

onMounted(() => {
  isActive = true;
  loop();
});

onUnmounted(() => {
  isActive = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
});
</script>

<style lang="scss" scoped>
.game-room-qznn {
  padding: 16px 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--el-bg-color-page);
}

// ===== Header Bar =====
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stats-pills {
    display: flex;
    gap: 8px;

    .pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      background: var(--el-fill-color);
      font-size: 13px;
      transition: all 0.2s;

      .pill-label {
        color: var(--el-text-color-secondary);
      }

      .pill-value {
        font-weight: 700;
        color: var(--el-text-color-primary);
        font-variant-numeric: tabular-nums;
      }

      &.pill-success .pill-value {
        color: var(--el-color-success);
      }

      &.pill-info .pill-value {
        color: var(--el-color-info);
      }
    }
  }
}

// ===== Filter Bar =====
.filter-bar {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 8px;

  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;

    .filter-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      min-width: 60px;
      white-space: nowrap;
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  }
}

// ===== Chip (shared) =====
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid var(--el-border-color);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    border-color: var(--el-color-primary-light-3);
    color: var(--el-color-primary);
  }

  &.active {
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);
    color: #fff;
    font-weight: 500;
  }

  .chip-count {
    font-size: 11px;
    opacity: 0.8;
    font-variant-numeric: tabular-nums;
  }
}

// ===== Room List =====
.room-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.level-group {
  margin-bottom: 24px;

  .group-header {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 12px;
    padding-left: 4px;
    color: var(--el-text-color-primary);
    display: flex;
    align-items: center;
    gap: 8px;

    .group-indicator {
      width: 4px;
      height: 18px;
      border-radius: 2px;
      background: var(--el-color-primary);
    }
  }
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 10px;
}

// ===== Room Card =====
.room-card {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  overflow: hidden;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);

    :global(.dark) & {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
  }

  // Room variant accent colors (top border)
  &.room-variant-0 { border-top: 3px solid #3b82f6; }
  &.room-variant-1 { border-top: 3px solid #22c55e; }
  &.room-variant-2 { border-top: 3px solid #f59e0b; }
  &.room-variant-3 { border-top: 3px solid #ef4444; }
  &.room-variant-4 { border-top: 3px solid #8b5cf6; }
  &.room-variant-5 { border-top: 3px solid #06b6d4; }
}

.room-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid var(--el-border-color-extra-light);

  .header-tags {
    display: flex;
    gap: 6px;

    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;

      &.tag-type {
        color: #fff;
      }

      &.tag-primary { background: #3b82f6; }
      &.tag-success { background: #22c55e; }
      &.tag-warning { background: #f59e0b; }
      &.tag-danger { background: #ef4444; }
      &.tag-info { background: #6b7280; }

      &.tag-level {
        background: var(--el-fill-color-dark);
        color: var(--el-text-color-regular);
      }
    }
  }

  .state-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;

    &.state-info {
      background: var(--el-fill-color);
      color: var(--el-text-color-secondary);
    }

    &.state-success {
      background: rgba(34, 197, 94, 0.1);
      color: #16a34a;

      :global(.dark) & {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
      }
    }

    &.state-danger {
      background: rgba(239, 68, 68, 0.1);
      color: #dc2626;

      :global(.dark) & {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }
    }

    .state-timer {
      font-variant-numeric: tabular-nums;
    }
  }
}

// ===== Players Area =====
.players-area {
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-row {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  transition: background 0.2s;

  &.is-human {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.06), rgba(34, 197, 94, 0.02));
    border-left: 3px solid rgba(34, 197, 94, 0.4);
  }

  &.is-robot {
    opacity: 0.7;
  }

  .player-left {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    width: 150px;

    .player-info-col {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      gap: 1px;
    }

    .player-nickname {
      display: inline-block;
      width: 80px;
      font-size: 12px;
      font-weight: 500;
      cursor: help;
      border-bottom: 1px dashed var(--el-border-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &.is-banker {
        color: #dc2626;
        font-weight: 600;
      }

      &.is-ob {
        color: var(--el-text-color-placeholder);
      }
    }

    .player-balance-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;

      .balance {
        color: var(--el-text-color-regular);
      }

      .positive { color: var(--el-color-success); font-weight: 600; }
      .negative { color: var(--el-color-danger); font-weight: 600; }
    }
  }

  .player-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 0;

    .mult-info {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
      white-space: nowrap;

      &.call {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
        :global(.dark) & { background: rgba(239, 68, 68, 0.15); color: #f87171; }
      }

      &.bet {
        background: rgba(245, 158, 11, 0.1);
        color: #d97706;
        :global(.dark) & { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
      }
    }
  }

  .player-right {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    justify-content: flex-end;
    min-width: 0;

    .card-result {
      font-size: 11px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      white-space: nowrap;
      margin-right: 4px;

      &.result-special {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #fff;
      }

      &.result-normal {
        background: rgba(59, 130, 246, 0.1);
        color: #2563eb;
        :global(.dark) & { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
      }

      &.result-none {
        color: var(--el-text-color-placeholder);
      }

    }
  }

  .empty-seat {
    flex: 1;
    text-align: center;
    color: var(--el-text-color-placeholder);
    font-size: 11px;
  }
}

// ===== Room Footer =====
.room-card-footer {
  display: flex;
  justify-content: space-between;
  padding: 4px 10px;
  border-top: 1px solid var(--el-border-color-extra-light);
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
