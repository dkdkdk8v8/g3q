<template>
  <cl-crud ref="Crud">
    <cl-row>
      <cl-refresh-btn />
      <cl-flex1 />
      <cl-filter label="类型">
        <cl-select
          :options="recordTypeOptions"
          prop="record_type"
          :width="120"
        />
      </cl-filter>
      <cl-search-key
        field="app_user_id"
        :field-list="[{ label: '用户ID', value: 'app_user_id' }]"
        :model-value="queryUserId"
      />

    </cl-row>

    <cl-row>
      <cl-table ref="Table">
        <template #column-_change="{ scope }">
          <format-money :value="scope.row.balance_after - scope.row.balance_before" />
        </template>
        <template #column-order_state="{ scope }">
          <template v-if="!scope.row.order_id">-</template>
          <el-tag
            v-else
            :type="orderStateTagType[scope.row.order_state]"
            size="small"
            disable-transitions
          >
            {{ orderStateLabel[scope.row.order_state] || '未知' }}
          </el-tag>
        </template>
        <template #column-game_record_id="{ scope }">
          <template v-if="scope.row.game_record_id > 0">
            <el-button
              type="primary"
              link
              size="small"
              @click="viewGameRecord(scope.row.game_record_id)"
            >
              查看
            </el-button>
          </template>
          <template v-else>-</template>
        </template>
      </cl-table>
    </cl-row>

    <el-dialog
      v-model="gameRecordVisible"
      title="游戏记录详情"
      width="700px"
      destroy-on-close
    >
      <div v-if="gameRecordLoading" style="text-align: center; padding: 20px">
        <el-icon class="is-loading" :size="24"><loading-icon /></el-icon>
      </div>
      <template v-else-if="gameRecordData">
        <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
          <el-descriptions-item label="游戏记录ID">{{ gameRecordData.id }}</el-descriptions-item>
          <el-descriptions-item label="游戏名称">{{ gameRecordData.game_name }}</el-descriptions-item>
          <el-descriptions-item label="游戏ID">{{ gameRecordData.game_id }}</el-descriptions-item>
          <el-descriptions-item label="房间ID">{{ gameRecordData.room_id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ gameRecordData.create_at }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="parsedGameData" class="gr-view-toggle">
          <el-segmented
            v-model="gameDataView"
            :options="[
              { label: '可视化', value: 'visual' },
              { label: '数据源', value: 'raw' },
            ]"
            size="small"
          />
        </div>

        <!-- 抢庄牛牛 可视化 -->
        <template v-if="gameDataView === 'visual' && parsedGameData?.Room">
          <div class="gr-players">
            <div
              v-for="(player, idx) in parsedGameData.Room.Players"
              :key="idx"
              class="gr-player"
              :class="{ 'is-banker': player && player.ID === parsedGameData.Room.BankerID }"
            >
              <template v-if="player">
                <div class="gr-player-row">
                  <div class="gr-player-left">
                    <span
                      v-if="player.ID === parsedGameData.Room.BankerID"
                      class="gr-role banker"
                    >庄</span>
                    <span v-else-if="player.IsOb" class="gr-role ob">看</span>
                    <span class="gr-nick">{{ player.NickName || player.ID }}</span>
                    <span class="gr-uid">({{ player.ID }})</span>
                  </div>
                  <div class="gr-player-right">
                    <span class="gr-balance">￥{{ (player.Balance / 100).toFixed(2) }}</span>
                    <span
                      class="gr-change"
                      :class="{
                        positive: player.BalanceChange > 0,
                        negative: player.BalanceChange < 0,
                      }"
                    >
                      {{ player.BalanceChange > 0 ? '+' : '' }}{{ (player.BalanceChange / 100).toFixed(2) }}
                    </span>
                  </div>
                </div>
                <div class="gr-player-row gr-detail-row">
                  <div class="gr-cards">
                    <poker-card
                      v-for="(card, ci) in player.Cards"
                      :key="ci"
                      :value="card"
                      size="small"
                    />
                    <span
                      v-if="player.Cards && player.Cards.length === 5"
                      class="gr-niu"
                    >{{ getCardResult(player.Cards) }}</span>
                  </div>
                  <div class="gr-mults">
                    <template v-if="player.ID === parsedGameData.Room.BankerID">
                      <el-tag size="small" type="danger" effect="plain">抢庄x{{ player.CallMult }}</el-tag>
                    </template>
                    <template v-else-if="!player.IsOb">
                      <el-tag
                        v-if="player.CallMult >= 0"
                        size="small"
                        effect="plain"
                      >{{ player.CallMult === 0 ? '不抢' : '抢庄x' + player.CallMult }}</el-tag>
                      <el-tag
                        v-if="player.BetMult >= 0"
                        size="small"
                        type="warning"
                        effect="plain"
                      >下注x{{ player.BetMult }}</el-tag>
                    </template>
                    <el-tag size="small" effect="plain">投注￥{{ (player.ValidBet / 100).toFixed(2) }}</el-tag>
                  </div>
                </div>
              </template>
              <div v-else class="gr-empty">空闲</div>
            </div>
          </div>
        </template>

        <!-- 数据源 / 其他游戏 fallback JSON -->
        <template v-if="gameDataView === 'raw' || !parsedGameData?.Room">
          <el-input
            type="textarea"
            :model-value="formatGameData(gameRecordData.game_data)"
            readonly
            :autosize="{ minRows: 6, maxRows: 20 }"
            style="font-family: monospace"
          />
        </template>
      </template>
    </el-dialog>

    <cl-row>
      <cl-flex1 />
      <cl-pagination />
    </cl-row>
  </cl-crud>
</template>

<script lang="ts" name="game-user-record" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { useRoute } from "vue-router";
import { computed, ref, watch } from "vue";
import { Loading as LoadingIcon } from "@element-plus/icons-vue";
import FormatMoney from "../components/format-money.vue";
import { getCardResult } from "../utils/card";
import PokerCard from "../components/poker-card.vue";

const { service } = useCool();
const route = useRoute();
const queryUserId = computed(() => (route.query.app_user_id as string) || "");

const recordTypeOptions = [
  { label: "充值", value: 0 },
  { label: "提现", value: 1 },
  { label: "游戏", value: 2 },
  { label: "后台", value: 3 },
];

const orderStateLabel: Record<number, string> = { 0: "处理中", 1: "成功", 2: "失败" };
const orderStateTagType: Record<number, string> = { 0: "info", 1: "success", 2: "danger" };

const Table = useTable({
  columns: [
    { label: "ID", prop: "id", width: 80 },
    { label: "用户ID", prop: "app_user_id", minWidth: 140 },
    {
      label: "类型",
      prop: "record_type",
      width: 90,
      dict: recordTypeOptions,
      dictColor: true,
    },
    {
      label: "变化前余额",
      prop: "balance_before",
      minWidth: 110,
      formatter(row: any) {
        return (row.balance_before / 100).toFixed(2);
      },
    },
    {
      label: "变化后余额",
      prop: "balance_after",
      minWidth: 110,
      formatter(row: any) {
        return (row.balance_after / 100).toFixed(2);
      },
    },
    {
      label: "变化金额",
      prop: "_change",
      minWidth: 110,
    },
    {
      label: "有效投注",
      prop: "valid_bet",
      minWidth: 100,
      formatter(row: any) {
        return (row.valid_bet / 100).toFixed(2);
      },
    },
    { label: "游戏记录", prop: "game_record_id", minWidth: 100 },
    { label: "订单ID", prop: "order_id", minWidth: 140, showOverflowTooltip: true },
    { label: "订单状态", prop: "order_state", width: 90 },
    { label: "创建时间", prop: "create_at", minWidth: 160, sortable: "desc" },
  ],
});

const Crud = useCrud(
  {
    service: service.game.userRecord,
  },
  (app) => {
    app.refresh(queryUserId.value ? { app_user_id: queryUserId.value } : {});
  },
);

// 路由参数变化时刷新
watch(queryUserId, (val) => {
  Crud.value?.refresh(val ? { app_user_id: val } : {});
});

// 游戏记录弹窗
const gameRecordVisible = ref(false);
const gameRecordLoading = ref(false);
const gameRecordData = ref<any>(null);
const gameDataView = ref<'visual' | 'raw'>('visual');

const parsedGameData = computed(() => {
  if (!gameRecordData.value?.game_data) return null;
  try {
    return JSON.parse(gameRecordData.value.game_data);
  } catch {
    return null;
  }
});

async function viewGameRecord(id: number) {
  gameRecordVisible.value = true;
  gameRecordLoading.value = true;
  gameRecordData.value = null;
  gameDataView.value = 'visual';
  try {
    const res = await service.game.gameRecord.info({ id });
    gameRecordData.value = res;
  } finally {
    gameRecordLoading.value = false;
  }
}

function formatGameData(data: string): string {
  if (!data) return "";
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return data;
  }
}
</script>

<style lang="scss" scoped>
.gr-view-toggle {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.gr-players {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gr-player {
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color-lighter);

  &.is-banker {
    border-color: var(--el-color-danger-light-5);
    background: var(--el-color-danger-light-9);
  }
}

.gr-player-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gr-player-left {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.gr-role {
  font-weight: bold;
  font-size: 12px;
  margin-right: 2px;

  &.banker {
    color: var(--el-color-danger);
  }

  &.ob {
    color: var(--el-color-success);
  }
}

.gr-nick {
  font-weight: 500;
}

.gr-uid {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.gr-player-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gr-balance {
  color: var(--el-color-warning);
  font-weight: bold;
  font-size: 13px;
}

.gr-change {
  font-weight: bold;
  font-size: 13px;

  &.positive {
    color: var(--el-color-success);
  }

  &.negative {
    color: var(--el-color-danger);
  }
}

.gr-detail-row {
  margin-top: 6px;
}

.gr-cards {
  display: flex;
  align-items: center;
  gap: 3px;
}

.gr-niu {
  margin-left: 6px;
  color: var(--el-color-primary);
  font-weight: bold;
  font-size: 13px;
}

.gr-mults {
  display: flex;
  gap: 4px;
}

.gr-empty {
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  padding: 4px 0;
}
</style>
