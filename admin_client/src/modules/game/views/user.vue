<template>
  <cl-crud ref="Crud">
    <cl-row>
      <!-- 刷新按钮 -->
      <cl-refresh-btn />
      <cl-filter label="状态">
        <cl-select :options="DictEnable" prop="enable" :width="160" />
      </cl-filter>

      <cl-filter label="机器人">
        <cl-select :options="DictIsRobot" prop="is_robot" :width="160" />
      </cl-filter>

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

    <!-- 新增、编辑 -->
    <cl-upsert ref="Upsert" />
  </cl-crud>
</template>

<script lang="ts" name="game-user" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";

const { service } = useCool();

const DictEnable = [
  {
    label: "启用",
    value: 1,
    type: "success",
  },
  {
    label: "禁用",
    value: 0,
    type: "danger",
  },
];

const DictIsRobot = [
  {
    label: "是",
    value: 1,
    type: "success",
  },
  {
    label: "否",
    value: 0,
    type: "danger",
  },
];

// cl-upsert
const Upsert = useUpsert({
  items: [
    {
      label: "用户ID",
      prop: "user_id",
      component: {
        name: "el-input",
        props: {
          disabled: true,
        },
      }
    },
    {
      label: "昵称",
      prop: "nick_name",
      component: {
        name: "el-input",
        props: {
          disabled: true,
        },
      }
    },
    {
      label: "备注",
      prop: "remark",
      component: {
        name: "el-input",
        props: {
          rows: 3,
          type: "textarea"
        }
      }
    },
    {
      label: "是否启用",
      prop: "enable",
      component: {
        name: "cl-switch",
        props: {
          activeValue: 1,
          inactiveValue: 0,
        }
      }
    }
  ],
});

// cl-table
const Table = useTable({
  columns: [
    { type: "selection" },
    { label: "APP", prop: "app_id" },
    { label: "用户ID", prop: "user_id", minWidth: 120 },
    { label: "昵称", prop: "nick_name", minWidth: 120 },
    {
      label: "头像",
      prop: "avatar",
      width: 100,
      component: {
        name: "cl-image",
        props: {
          size: 32,
        },
      },
    },
    { label: "备注", prop: "remark", minWidth: 180, showOverflowTooltip: true },
    {
      label: "余额",
      prop: "balance",
      formatter(row) {
        return (row.balance / 100).toFixed(2);
      },
    },
    {
      label: "最近游戏",
      prop: "last_played",
      minWidth: 150,
      sortable: "custom",
    },
    { label: "创建时间", prop: "create_at", minWidth: 150, sortable: "desc" },
    { label: "更新时间", prop: "update_at", minWidth: 150, sortable: "custom" },
    {
      label: "状态",
      prop: "enable",
      width: 90,
      fixed: "right",
      dict: DictEnable,
    },
    // { type: "op", buttons: ["edit"], width: 90 },
  ],
});

// cl-crud
const Crud = useCrud(
  {
    service: service.game.user,
  },
  (app) => {
    app.refresh();
  },
);

// 刷新
function refresh(params?: any) {
  Crud.value?.refresh(params);
}
</script>
