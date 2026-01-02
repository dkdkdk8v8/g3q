<template>
  <cl-crud ref="Crud">
    <cl-row>
      <!-- 刷新按钮 -->
      <cl-refresh-btn />
      <cl-flex1 />
      <!-- 关键字搜索 -->
      <cl-search-key placeholder="搜索关键字" />
    </cl-row>

    <cl-row>
      <!-- 数据表格 -->
      <cl-table size="small" ref="Table" />
    </cl-row>

    <cl-row>
      <cl-flex1 />
      <!-- 分页控件 -->
      <cl-pagination />
    </cl-row>
  </cl-crud>
</template>

<script lang="ts" name="game-room-qznn" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";

const { service } = useCool();

// cl-table
const Table = useTable({
  columns: [
    { label: "ID", prop: "id", minWidth: 80 },
    { label: "房间ID", prop: "room_id", minWidth: 120 },
    { label: "游戏ID", prop: "game_id", minWidth: 120 },
    { label: "场次ID", prop: "round_id", minWidth: 120 },
    { label: "底分", prop: "base_score", minWidth: 120 },
    { label: "状态", prop: "status", minWidth: 100 },
    { label: "创建时间", prop: "created_at", minWidth: 150, sortable: "desc" },
    { label: "更新时间", prop: "updated_at", minWidth: 150, sortable: "custom" },
  ],
});

// cl-crud
const Crud = useCrud(
  {
    service: service.game.room.qznn,
  },
  (app) => {
    app.refresh();
  },
);
</script>
