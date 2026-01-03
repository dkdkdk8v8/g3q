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
        <span v-for="(count, name) in statsData.levels" :key="name" class="item">{{ name }} <span class="num">{{ count
        }}</span></span>
      </div>
      <div class="divider"></div>
      <div class="group">
        <span v-for="(count, name) in statsData.types" :key="name" class="item">{{ name }} <span class="num">{{ count
        }}</span></span>
      </div>
    </div>

    <el-empty v-if="errorMessage" :description="errorMessage" />

    <el-empty v-else-if="Object.keys(list).length === 0" description="暂时没有房间数据" />

    <el-row v-else :gutter="10">
      <el-col v-for="(item, key) in list" :key="key" :xs="24" :sm="12" :md="8" :lg="6" :xl="4">
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
              <el-tag size="small" effect="dark" :type="stateTypeMap[item.State] as any">{{ stateMap[item.State] ||
                item.State }}
                <span v-if="item.StateLeftSec > 0" style="margin-left: 2px">({{ item.StateLeftSec }}s)</span>
              </el-tag>
            </div>
          </template>

          <div class="room-content">
            <div class="players-list">
              <div v-for="(player, index) in item.Players" :key="index" class="player-item">
                <div v-if="player" class="player-info">
                  <el-avatar :size="24" :src="player.Avatar" :icon="UserFilled" class="avatar"
                    :class="{ 'is-banker': item.BankerID === player.ID }"></el-avatar>
                  <div class="details">
                    <el-tooltip effect="dark" :content="player.NickName" placement="top" :disabled="!player.NickName">
                      <div class="player-name">
                        <span v-if="player.IsOb" style="color: #67c23a">观众</span>
                        {{ player.NickName || "-" }}
                      </div>
                    </el-tooltip>
                    <el-tooltip effect="dark" :content="player.ID" placement="top" :disabled="!player.ID">
                      <div class="player-id">{{ player.ID }} {{ player.Cards }}</div>
                    </el-tooltip>
                  </div>
                  <div class="player-balance">
                    ￥{{ (player.Balance / 100).toFixed(2) }}
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
</template>

<script lang="ts" name="game-room-qznn" setup>
import { useCool } from "/@/cool";
import { computed, onMounted, onUnmounted, ref } from "vue";
import dayjs from "dayjs";
import { UserFilled, Refresh } from "@element-plus/icons-vue";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");
const { service } = useCool();
const list = ref<any>({});
const errorMessage = ref("");

const stateMap: Record<string, string> = {
  StateWaiting: "等待中",
  StatePrepare: "准备中",
  StatePreCard: "预发牌",
  StateBanking: "抢庄中",
  StateRandomBank: "随机抢庄",
  StateBankerConfirm: "确认庄家",
  StateBetting: "下注中",
  StateDealing: "发牌中",
  StateShowCard: "亮牌中",
  StateSettling: "结算中",
  StateSettlingDirectPreCard: "即将下一局",
};

const stateTypeMap: Record<string, string> = {
  StateWaiting: "info",
  StatePrepare: "info",
  StatePreCard: "info",
  StateBanking: "warning",
  StateRandomBank: "warning",
  StateBankerConfirm: "warning",
  StateBetting: "primary",
  StateDealing: "primary",
  StateShowCard: "primary",
  StateSettling: "success",
  StateSettlingDirectPreCard: "success",
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
    background-color: #f5f7fa;
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

      .label {
        font-weight: bold;
        margin-right: 10px;
        color: #303133;
      }

      .item {
        margin-right: 15px;

        .num {
          color: #409eff;
          font-weight: bold;
          margin-left: 4px;
        }
      }
    }

    .divider {
      width: 1px;
      height: 16px;
      background-color: #dcdfe6;
      margin-right: 20px;
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

              &.is-banker {
                border: 2px solid #f56c6c;
                box-sizing: border-box;
              }
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
              }
            }

            .player-balance {
              white-space: nowrap;
              text-align: right;
              color: #e6a23c;
              font-size: 12px;
              font-weight: bold;
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
