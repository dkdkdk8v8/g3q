<template>
  <div class="game-room-qznn">
    <div class="op-bar">
      <el-button type="primary" :icon="Refresh" @click="refresh">刷新
      </el-button>
      <div class="stats">
        <span class="label">房间:</span>
        <span class="value">{{ roomCount }}</span>
        <span class="divider">|</span>
        <span class="label">用户:</span>
        <span class="value">{{ playerStats.user }}</span>
        <span class="divider">|</span>
        <span class="label">机器人:</span>
        <span class="value">{{ playerStats.robot }}</span>
      </div>
    </div>

    <div class="stats-bar">
      <div class="group">
        <span class="label">等级:</span>
        <el-button size="small" round :type="filterLevel === '' ? 'primary' : ''"
          @click="filterLevel = ''">全部</el-button>
        <el-button v-for="(count, name) in statsData.levels" :key="name" size="small" round
          :type="filterLevel === name ? 'primary' : ''" @click="filterLevel = String(name)">{{ name }} {{ count
          }}</el-button>
      </div>
      <div class="group">
        <span class="label">类型:</span>
        <el-button size="small" round :type="filterType === '' ? 'primary' : ''" @click="filterType = ''">全部</el-button>
        <el-button v-for="(count, name) in statsData.types" :key="name" size="small" round
          :type="filterType === name ? 'primary' : ''" @click="filterType = String(name)">{{ name }} {{ count
          }}</el-button>
      </div>
      <div class="group">
        <span class="label">用户:</span>
        <el-button size="small" round :type="filterUserType === '' ? 'primary' : ''"
          @click="filterUserType = ''">全部</el-button>
        <el-button size="small" round :type="filterUserType === 'real' ? 'primary' : ''"
          @click="filterUserType = 'real'">真实用户房间 {{ statsData.userTypes.real }}</el-button>
        <el-button size="small" round :type="filterUserType === 'robot' ? 'primary' : ''"
          @click="filterUserType = 'robot'">机器人房间 {{ statsData.userTypes.robot }}</el-button>
      </div>
    </div>

    <div class="room-list" v-infinite-scroll="loadMore" :infinite-scroll-distance="200"
      :infinite-scroll-disabled="noMore">
      <el-empty v-if="errorMessage" :description="errorMessage" />

      <el-empty v-else-if="Object.keys(list).length === 0" description="暂时没有房间数据" />

      <div v-else>
        <div v-for="group in displayedGroups" :key="group.title" class="level-group">
          <div class="group-header">{{ group.title }} <span class="count"></span></div>
          <el-row :gutter="10">
            <el-col v-for="item in group.rooms" :key="item.ID" :xs="24" :sm="12" :md="12" :lg="8" :xl="6">
              <el-card shadow="hover" class="room-card" :class="getRoomClass(item.ID)">
                <template #header>
                  <el-tooltip placement="top">
                    <template #content>
                      <span>{{ item.GameID }}</span>
                      <el-icon style="margin-left: 5px; cursor: pointer; vertical-align: middle;"
                        @click="copyGameID(item.GameID)">
                        <CopyDocument />
                      </el-icon>
                    </template>
                    <div class="card-header">
                      <div class="header-left">
                        <div class="tags">
                          <el-tag size="small" :type="getRoomTagType(item.ID)" effect="plain">{{
                            getRoomInfo(item.ID).type
                          }}
                          </el-tag>
                          <el-tag size="small" type="danger" effect="plain" style="cursor: pointer">{{
                            getRoomInfo(item.ID).level }}</el-tag>
                        </div>
                      </div>
                      <el-tag size="small" effect="dark" :type="(stateTypeMap[item.State] || 'info') as any">
                        {{ stateMap[item.State] || item.State }}
                        <span v-if="item.StateLeftSec > 0" style="margin-left: 2px">{{ item.StateLeftSec }}秒</span>
                      </el-tag>
                    </div>
                  </el-tooltip>
                </template>

                <div class="room-content">
                  <div class="players-list">
                    <div v-for="(player, index) in item.Players" :key="index" class="player-item"
                      :class="{ 'is-robot': player && player.IsRobot, 'is-human': player && !player.IsRobot }">
                      <div v-if="player" class="player-info">
                        <!-- <el-avatar :size="24" :src="player.Avatar" :icon="UserFilled" class="avatar"></el-avatar> -->
                        <div class="details">
                          <div class="player-name">
                            <span v-if="item.BankerID === player.ID"
                              style="color: var(--el-color-danger); font-weight: bold">庄</span>
                            <span v-else-if="player.IsOb"
                              style="color: var(--el-color-success); font-weight: bold">看</span>
                            <el-tooltip placement="top" :enterable="true">
                              <template #content>
                                <div style="display: flex; align-items: center; gap: 4px; cursor: pointer;"
                                  @click="copyText(player.ID, '用户ID')">
                                  <span>{{ player.ID }}</span>
                                  <el-icon>
                                    <CopyDocument />
                                  </el-icon>
                                </div>
                              </template>
                              <span style="cursor: help; border-bottom: 1px dashed #999;">{{ player.NickName ||
                                player.ID
                              }}</span>
                            </el-tooltip>
                            <span v-if="player.CallMult >= 0 && player.BetMult === -1"
                              style="color: var(--el-color-danger); font-weight: bold; margin-left: 2px">
                              {{ player.CallMult === 0 ? '不抢' : '抢庄x' + player.CallMult }}
                            </span>
                            <span v-if="player.BetMult >= 0" style="color: var(--el-color-danger); margin-left: 2px">
                              下注x{{ player.BetMult }}
                            </span>
                          </div>
                          <div class="player-id">
                            <template v-if="Array.isArray(player.Cards)">
                              <span v-for="(card, idx) in player.Cards" :key="idx"
                                :style="{ color: getCardStyle(card).color, marginRight: '2px', fontWeight: 'bold', display: 'inline-block', width: '24px', textAlign: 'center' }">
                                {{ getCardStyle(card).text }}
                              </span>
                              <span v-if="player.Cards && player.Cards.length === 5"
                                style="margin-left: 4px; color: var(--el-color-primary); font-weight: bold">
                                {{ getCardResult(player.Cards) }} {{ player.IsShow ? '摊牌' : '' }}
                              </span>
                            </template>
                            <span v-else>{{ player.Cards }}</span>
                          </div>
                        </div>
                        <div class="balance-wrapper">
                          <div class="player-balance">
                            ￥{{ (player.Balance / 100).toFixed(2) }}
                          </div>
                          <div class="player-balance-change">
                            <span v-if="player.BalanceChange > 0" class="positive">+{{ (player.BalanceChange /
                              100).toFixed(2)
                              }}</span>
                            <span v-else-if="player.BalanceChange < 0" class="negative">{{ (player.BalanceChange /
                              100).toFixed(2)
                              }}</span>
                            <span v-else class="zero">0</span>
                          </div>
                        </div>
                      </div>
                      <div v-else class="player-empty">空闲</div>
                    </div>
                  </div>

                  <div class="room-footer">
                    <div class="time-info">
                      <span>{{ dayjs(item.CreateAt).format("YYYY-MM-DD HH:mm:ss") }}</span>
                      <span>{{ dayjs(item.CreateAt).fromNow() }}</span>
                    </div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>
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
import { getCardResult, getCardStyle } from "../utils/card";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");
const { service } = useCool();
const { dict } = useDict();
const list = ref<any>({});
const errorMessage = ref("");
const filterLevel = ref("");
const filterType = ref("");
const filterUserType = ref("");

const levelMap = computed(() => {
  const map: Record<string, string> = {};
  const data = dict.get("qznn_room_level").value || [];
  data.forEach((item: any) => {
    map[String(item.value)] = item.label;
  });
  return map;
});

const typeMap = computed(() => {
  const map: Record<string, string> = {};
  const data = dict.get("qznn_room_type").value || [];
  data.forEach((item: any) => {
    map[String(item.value)] = item.label;
  });
  return map;
});

function getRoomInfo(id: string) {
  if (!id) return { level: "", type: "" };
  const parts = id.split("_");
  if (parts.length >= 3) {
    return {
      level: levelMap.value[parts[2]] || "未知",
      type: typeMap.value[parts[1]] || "未知",
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
  return `room-type-${typeCode % 6}`;
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
  return types[typeCode % 6] as any;
}

const filteredList = computed<any[]>(() => {
  const all = Object.values(list.value);

  return all.filter((item: any) => {
    const info = getRoomInfo(item.ID);
    const matchLevel = filterLevel.value ? info.level === filterLevel.value : true;
    const matchType = filterType.value ? info.type === filterType.value : true;

    let matchUserType = true;
    if (filterUserType.value) {
      const players = (item.Players || []).filter((p: any) => p);
      const isRobotRoom = players.length > 0 && players.every((p: any) => p.IsRobot);
      if (filterUserType.value === 'robot') {
        matchUserType = isRobotRoom;
      } else if (filterUserType.value === 'real') {
        matchUserType = !isRobotRoom;
      }
    }
    return matchLevel && matchType && matchUserType;
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

  // 按照 levelMap 的 key 顺序 (1, 2, 3, 4) 添加分组
  Object.keys(levelMap.value).sort().forEach((key) => {
    const name = levelMap.value[key];
    if (temp[name]) {
      temp[name].sort((a, b) => new Date(b.CreateAt).getTime() - new Date(a.CreateAt).getTime());
      groups.push({ title: name, rooms: temp[name] });
      delete temp[name];
    }
  });
  // 添加剩余未匹配的分组（如未知）
  Object.keys(temp).forEach((name) => {
    temp[name].sort((a, b) => new Date(b.CreateAt).getTime() - new Date(a.CreateAt).getTime());
    groups.push({ title: name, rooms: temp[name] });
  });
  return groups;
});

// 懒加载控制：当前显示的房间总数限制
const displayedRoomsCount = ref(20);

const noMore = computed(() => {
  return displayedRoomsCount.value >= filteredList.value.length;
});

// 根据限制计算当前需要渲染的分组数据
const displayedGroups = computed(() => {
  const limit = displayedRoomsCount.value;
  let count = 0;
  const result: { title: string; rooms: any[] }[] = [];

  for (const group of groupedList.value) {
    if (count >= limit) break;

    const remaining = limit - count;
    // 如果当前组的房间数未超过剩余配额，全部放入
    if (group.rooms.length <= remaining) {
      result.push(group);
      count += group.rooms.length;
    } else {
      // 否则只截取部分房间
      result.push({
        ...group,
        rooms: group.rooms.slice(0, remaining)
      });
      count += remaining;
    }
  }
  return result;
});

const stateMap: Record<string, string> = {
  StateWaiting: "等待中",
  StatePrepare: "准备中",
  StateStartGame: "开始游戏",
  StatePreCard: "预发牌",
  StateBanking: "玩家抢庄",
  StateRandomBank: "随机抢庄",
  StateBankerConfirm: "确认庄家",
  StateBetting: "玩家下注",
  StateDealing: "发牌中",
  StateShowCard: "玩家摊牌",
  StateSettling: "结算中",
  StateSettlingDirectPreCard: "即将下一局",
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

const statsData = computed(() => {
  const levels: Record<string, number> = {};
  const types: Record<string, number> = {};
  const userTypes: Record<string, number> = { real: 0, robot: 0 };

  Object.values(levelMap.value).forEach((v) => (levels[v] = 0));
  Object.values(typeMap.value).forEach((v) => (types[v] = 0));

  Object.values(list.value).forEach((room: any) => {
    const info = getRoomInfo(room.ID);
    if (levels[info.level] !== undefined) levels[info.level]++;
    if (types[info.type] !== undefined) types[info.type]++;

    const players = (room.Players || []).filter((p: any) => p);
    const isRobotRoom = players.length > 0 && players.every((p: any) => p.IsRobot);
    if (isRobotRoom) {
      userTypes.robot++;
    } else {
      userTypes.real++;
    }
  });

  return { levels, types, userTypes };
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
  // 每次滚动到底部增加显示 50 个房间
  displayedRoomsCount.value += 50;
};

// 当筛选条件变化时，重置显示数量，避免数据错乱或停留在底部
watch([filterLevel, filterType, filterUserType], () => {
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
  padding: 10px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  .op-bar {
    margin-bottom: 10px;
    display: flex;
    align-items: center;

    .stats {
      margin-left: 15px;
      font-size: 14px;
      color: var(--el-text-color-regular);
      display: flex;
      align-items: center;

      .value {
        font-weight: bold;
        color: var(--el-text-color-primary);
        margin-left: 4px;
      }

      .divider {
        margin: 0 12px;
        color: var(--el-border-color);
      }
    }
  }

  .stats-bar {
    margin-bottom: 15px;
    padding: 10px 15px;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-size: 13px;
    color: var(--el-text-color-regular);

    .group {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      gap: 5px;

      .label {
        font-weight: bold;
        margin-right: 10px;
      }
    }
  }

  .room-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .level-group {
    margin-bottom: 20px;

    .group-header {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      padding-left: 8px;
      border-left: 4px solid var(--el-color-primary);
      color: var(--el-text-color-primary);

      .count {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        font-weight: normal;
        margin-left: 5px;
      }
    }
  }

  .room-card {
    margin-bottom: 10px;
    border-radius: 8px;
    transition: all 0.3s;

    :deep(.el-card__header) {
      padding: 8px 10px;
    }

    :deep(.el-card__body) {
      padding: 8px;
    }

    :deep(.el-card__header) {
      background-color: var(--room-header-bg);
      transition: background-color 0.3s;
    }

    // Room Type Colors
    &.room-type-0 {
      --room-header-bg: #d9ecff;

      :global(.dark) & {
        --room-header-bg: #1d2530;
      }
    }

    &.room-type-1 {
      --room-header-bg: #e1f3d8;

      :global(.dark) & {
        --room-header-bg: #1d2b1d;
      }
    }

    &.room-type-2 {
      --room-header-bg: #faecd8;

      :global(.dark) & {
        --room-header-bg: #2b251d;
      }
    }

    &.room-type-3 {
      --room-header-bg: #fde2e2;

      :global(.dark) & {
        --room-header-bg: #2b1d1d;
      }
    }

    &.room-type-4 {
      --room-header-bg: #e9e9eb;

      :global(.dark) & {
        --room-header-bg: #262727;
      }
    }

    &.room-type-5 {
      --room-header-bg: #e7dcf5;

      :global(.dark) & {
        --room-header-bg: #251d2b;
      }
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--el-box-shadow-light);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      font-size: 14px;

      .header-left {
        display: flex;
        flex-direction: column;

        .tags {
          display: flex;
          gap: 6px;
        }
      }
    }

    .room-content {
      font-size: 13px;

      .players-list {
        background-color: var(--el-fill-color-light);
        border-radius: 4px;
        padding: 4px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 4px;

        .player-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 44px;
          box-sizing: border-box;
          padding: 0 4px;
          background-color: var(--el-bg-color);
          border-radius: 4px;
          overflow: hidden;

          &.is-human {
            background: linear-gradient(to right, var(--el-color-success-light-7), var(--el-color-success-light-9));
          }

          &.is-robot {
            // background-color: var(--el-color-primary-light-9);
          }

          .player-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 6px;

            .avatar {
              flex-shrink: 0;
            }

            .details {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: flex-start;
              overflow: hidden;
              margin-right: 4px;
              text-align: left;

              .player-name {
                font-size: 13px;
                font-weight: 500;
                margin-left: 2px;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .player-id {
                font-size: 12px;
                color: var(--el-text-color-secondary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                height: 18px;
                line-height: 18px;
              }
            }

            .balance-wrapper {
              display: flex;
              flex-direction: column;
              align-items: flex-end;

              .player-balance {
                white-space: nowrap;
                color: var(--el-color-warning);
                font-size: 12px;
                font-weight: bold;
              }

              .player-balance-change {
                font-size: 12px;
                font-weight: bold;

                .positive {
                  color: var(--el-color-success);
                }

                .negative {
                  color: var(--el-color-danger);
                }

                .zero {
                  color: var(--el-text-color-secondary);
                }
              }
            }
          }

          .player-empty {
            color: var(--el-text-color-placeholder);
            flex: 1;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
          }
        }
      }

      .room-footer {
        margin-top: 6px;
        color: var(--el-text-color-secondary);
        font-size: 12px;
        padding: 0 4px;
        border-top: 1px solid var(--el-border-color-lighter);
        padding-top: 6px;

        .time-info {
          display: flex;
          justify-content: space-between;
        }
      }
    }
  }
}
</style>
