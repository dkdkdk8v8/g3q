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
      </cl-table>
    </cl-row>

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
import { computed, watch } from "vue";
import FormatMoney from "../components/format-money.vue";

const { service } = useCool();
const route = useRoute();
const queryUserId = computed(() => (route.query.app_user_id as string) || "");

const recordTypeOptions = [
  { label: "充值", value: 0 },
  { label: "提现", value: 1 },
  { label: "游戏", value: 2 },
  { label: "后台", value: 3 },
];

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
    { label: "游戏记录ID", prop: "game_record_id", minWidth: 110 },
    { label: "订单ID", prop: "order_id", minWidth: 140, showOverflowTooltip: true },
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
</script>
