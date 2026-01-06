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
        <span class="value">{{ playerCount }}</span>
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
      <div class="divider"></div>
      <div class="group">
        <span class="label">类型:</span>
        <el-button size="small" round :type="filterType === '' ? 'primary' : ''" @click="filterType = ''">全部</el-button>
        <el-button v-for="(count, name) in statsData.types" :key="name" size="small" round
          :type="filterType === name ? 'primary' : ''" @click="filterType = String(name)">{{ name }} {{ count
          }}</el-button>
      </div>
    </div>

    <div class="room-list">
      <el-empty v-if="errorMessage" :description="errorMessage" />

      <el-empty v-else-if="Object.keys(list).length === 0" description="暂时没有房间数据" />

      <div v-else>
        <div v-for="group in groupedList" :key="group.title" class="level-group">
          <div class="group-header">{{ group.title }} <span class="count">({{ group.rooms.length }})</span></div>
          <el-row :gutter="10">
            <el-col v-for="item in group.rooms" :key="item.ID" :xs="24" :sm="12" :md="12" :lg="8" :xl="6">
              <el-card shadow="hover" class="room-card">
                <template #header>
                  <div class="card-header">
                    <div class="header-left">
                      <div class="tags">
                        <el-tag size="small" type="danger" effect="plain">{{ getRoomInfo(item.ID).level }}
                        </el-tag>
                        <el-tag size="small" type="warning" effect="plain">{{ getRoomInfo(item.ID).type }}
                        </el-tag>
                      </div>
                    </div>
                    <el-tag size="small" effect="dark" :type="stateTypeMap[item.State] as any">
                      {{ stateMap[item.State] || item.State }}
                      <span v-if="item.StateLeftSec > 0" style="margin-left: 2px">{{ item.StateLeftSec }}秒</span>
                    </el-tag>
                  </div>
                </template>

                <div class="room-content">
                  <div class="players-list">
                    <div v-for="(player, index) in item.Players" :key="index" class="player-item">
                      <div v-if="player" class="player-info">
                        <!-- <el-avatar :size="24" :src="player.Avatar" :icon="UserFilled" class="avatar"></el-avatar> -->
                        <div class="details">
                          <div class="player-name">
                            <span v-if="item.BankerID === player.ID" style="color: #f56c6c; font-weight: bold">庄</span>
                            <span v-else-if="player.IsOb" style="color: #67c23a; font-weight: bold">看</span>
                            {{ player.ID }}
                            <span v-if="player.CallMult >= 0 && player.BetMult === -1"
                              style="color: #f56c6c; font-weight: bold; margin-left: 2px">
                              {{ player.CallMult }}倍
                            </span>
                            <span v-if="player.BetMult >= 0" style="color: #f56c6c; margin-left: 2px">
                              {{ player.BetMult }}倍
                            </span>
                          </div>
                          <div class="player-id">
                            <template v-if="Array.isArray(player.Cards)">
                              <span v-for="(card, idx) in player.Cards" :key="idx"
                                :style="{ color: getCardStyle(card).color, marginRight: '2px', fontWeight: 'bold', display: 'inline-block', width: '24px', textAlign: 'center' }">
                                {{ getCardStyle(card).text }}
                              </span>
                              <span v-if="player.Cards && player.Cards.length === 5"
                                style="margin-left: 4px; color: #409eff; font-weight: bold">
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
                    <span>{{
                      dayjs(item.CreateAt).format("YYYY-MM-DD HH:mm:ss")
                      }}</span>
                    <span>{{ dayjs(item.CreateAt).fromNow() }}</span>
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
import { computed, onMounted, onUnmounted, ref } from "vue";
import dayjs from "dayjs";
import { Refresh } from "@element-plus/icons-vue";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");
const { service } = useCool();
const list = ref<any>({});
const errorMessage = ref("");
const filterLevel = ref("");
const filterType = ref("");

const filteredList = computed<any[]>(() => {
  const all = Object.values(list.value);
  if (!filterLevel.value && !filterType.value) return all;

  return all.filter((item: any) => {
    const info = getRoomInfo(item.ID);
    const matchLevel = filterLevel.value ? info.level === filterLevel.value : true;
    const matchType = filterType.value ? info.type === filterType.value : true;
    return matchLevel && matchType;
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
  Object.keys(levelMap).sort().forEach((key) => {
    const name = levelMap[key];
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

const levelMap: Record<string, string> = {
  "1": "初级场",
  "2": "中级场",
  "3": "高级场",
  "4": "豪华场",
};

const typeMap: Record<string, string> = {
  "0": "不看牌",
  "1": "看三张",
  "2": "看四张",
};

function getCardResult(cards: number[]) {
  if (!Array.isArray(cards) || cards.length !== 5) return "";
  const ranks = cards.map((c) => Math.floor(c / 4));
  const values = ranks.map((r) => (r >= 10 ? 10 : r + 1));

  // 五小牛: 所有牌值<5 (rank < 4) 且 和 <= 10
  if (ranks.every((r) => r < 4) && values.reduce((a, b) => a + b, 0) <= 10) {
    return "五小牛";
  }
  // 炸弹: 4张牌点数相同
  const counts: Record<number, number> = {};
  ranks.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  if (Object.values(counts).some((c) => c === 4)) {
    return "炸弹";
  }
  // 五花牛: 全是花牌 (J,Q,K -> rank >= 10)
  if (ranks.every((r) => r >= 10)) return "五花牛";
  // 四花牛: 4张花牌 + 1张10 (rank 9)
  const flowers = ranks.filter((r) => r >= 10).length;
  const tens = ranks.filter((r) => r === 9).length;
  if (flowers === 4 && tens === 1) return "四花牛";

  const sum = values.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let k = j + 1; k < 5; k++) {
        if ((values[i] + values[j] + values[k]) % 10 === 0) {
          const left = sum - (values[i] + values[j] + values[k]);
          const niu = left % 10 === 0 ? 10 : left % 10;
          return niu === 10 ? "牛牛" : "牛" + ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"][niu];
        }
      }
    }
  }
  return "无牛";
}

const rankMap = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suitMap = ["♠", "♥", "♣", "♦"];
const colorMap = ["black", "#f56c6c", "black", "#f56c6c"];

function getCardStyle(val: number) {
  if (val === undefined || val === null || val < 0 || val > 51) return { text: "", color: "" };
  const rank = Math.floor(val / 4);
  const suit = val % 4;
  return {
    text: suitMap[suit] + rankMap[rank],
    color: colorMap[suit],
  };
}

function getRoomInfo(id: string) {
  if (!id) return { level: "", type: "" };
  const parts = id.split("_");
  if (parts.length >= 4) {
    return {
      level: levelMap[parts[3]] || "未知",
      type: typeMap[parts[2]] || "未知",
    };
  }
  return { level: "未知", type: "未知" };
}

const roomCount = computed(() => Object.keys(list.value).length);

const playerCount = computed(() => {
  let count = 0;
  Object.values(list.value).forEach((room: any) => {
    if (room.Players && Array.isArray(room.Players)) {
      count += room.Players.filter((p: any) => p).length;
    }
  });
  return count;
});

const statsData = computed(() => {
  const levels: Record<string, number> = {};
  const types: Record<string, number> = {};

  Object.values(levelMap).forEach((v) => (levels[v] = 0));
  Object.values(typeMap).forEach((v) => (types[v] = 0));

  Object.values(list.value).forEach((room: any) => {
    const info = getRoomInfo(room.ID);
    if (levels[info.level] !== undefined) levels[info.level]++;
    if (types[info.type] !== undefined) types[info.type]++;
  });

  return { levels, types };
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

onMounted(() => {
  refresh();
  timer = setInterval(() => {
    refresh();
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
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
      color: #606266;
      display: flex;
      align-items: center;

      .value {
        font-weight: bold;
        color: #303133;
        margin-left: 4px;
      }

      .divider {
        margin: 0 12px;
        color: #dcdfe6;
      }
    }
  }

  .stats-bar {
    margin-bottom: 15px;
    padding: 10px 15px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    font-size: 13px;
    color: #606266;

    .group {
      display: flex;
      align-items: center;
      margin-right: 20px;
      margin-bottom: 5px;
      gap: 5px;

      .label {
        font-weight: bold;
        margin-right: 10px;
      }
    }

    .divider {
      width: 1px;
      height: 16px;
      background-color: #dcdfe6;
      margin-right: 20px;
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
      border-left: 4px solid #409eff;
      color: #303133;

      .count {
        font-size: 14px;
        color: #909399;
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

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
        background-color: #f5f7fa;
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
          background-color: #fff;
          border-radius: 4px;
          overflow: hidden;

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
                color: #909399;
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
                color: #e6a23c;
                font-size: 12px;
                font-weight: bold;
              }

              .player-balance-change {
                font-size: 12px;
                font-weight: bold;

                .positive {
                  color: #67c23a;
                }

                .negative {
                  color: #f56c6c;
                }

                .zero {
                  color: #909399;
                }
              }
            }
          }

          .player-empty {
            color: #c0c4cc;
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
        display: flex;
        justify-content: space-between;
        color: #909399;
        font-size: 12px;
        padding: 0 4px;
        border-top: 1px solid #f0f2f5;
        padding-top: 6px;
      }
    }
  }
}
</style>
