<template>
  <cl-crud ref="Crud">
    <cl-row>
      <!-- 刷新按钮 -->
      <cl-refresh-btn />
      <cl-multi-delete-btn />
      <el-button type="success" :disabled="!Table?.selection?.length" @click="batchEnable">
        批量启用
      </el-button>
      <el-button type="danger" :disabled="!Table?.selection?.length" @click="batchDisable">
        批量禁用
      </el-button>
      <cl-flex1 />
      <cl-filter label="">
        <el-radio-group v-model="enable" @change="refresh({ enable })">
          <el-radio-button v-for="(item, index) in DictEnable" :key="index" :value="item.value">
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </cl-filter>
      <cl-flex1 />
      <cl-search-key field="user_id" :field-list="[
        {
          label: '用户ID',
          value: 'user_id'
        },
      ]" />
    </cl-row>
    <cl-row>
      <!-- 数据表格 -->
      <cl-table ref="Table">
        <template #column-settings="{ scope }">
          <el-space :size="5">
            <el-tag size="small" :type="scope.row.music ? 'success' : 'info'">音乐</el-tag>
            <el-tag size="small" :type="scope.row.effect ? 'success' : 'info'">音效</el-tag>
            <el-tag size="small" :type="scope.row.talk ? 'success' : 'info'">对话</el-tag>
          </el-space>
        </template>
      </cl-table>
    </cl-row>

    <cl-row>
      <cl-flex1 />
      <!-- 分页控件 -->
      <cl-pagination />
    </cl-row>

    <!-- 新增、编辑 -->
    <cl-upsert ref="Upsert" />
    <!-- 资金记录 -->
    <user-record ref="UserRecordRef" />
  </cl-crud>
</template>

<script lang="ts" name="game-user" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { ref } from "vue";
import UserRecord from "../components/user-record.vue";

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

// 状态
const enable = ref(1);

// 记录弹窗
const UserRecordRef = ref();

// cl-table
const Table = useTable({
  columns: [
    { type: "selection" },
    { label: "APP", prop: "app_id", dict: [], dictColor: true },
    { label: "用户ID", prop: "user_id", minWidth: 120 },
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
    { label: "昵称", prop: "nick_name", minWidth: 120 },
    {
      label: "余额",
      prop: "balance",
      minWidth: 100,
      formatter(row) {
        return (row.balance / 100).toFixed(2);
      },
    },
    {
      label: "锁定余额",
      prop: "balance_lock",
      minWidth: 100,
      formatter(row) {
        return (row.balance_lock / 100).toFixed(2);
      },
    },
    { label: "设置", prop: "settings", minWidth: 180 },
    { label: "游戏ID", prop: "game_id", minWidth: 180, showOverflowTooltip: true },
    { label: "备注", prop: "remark", minWidth: 180, showOverflowTooltip: true },
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
      width: 80,
      fixed: "right",
      dict: DictEnable,
    },
    {
      type: "op",
      width: 80,
      buttons: [
        {
          label: "记录",
          onClick({ scope }) {
            UserRecordRef.value?.open(scope.row);
          },
        },
      ]
    },
  ],
});

// cl-upsert
const Upsert = useUpsert({
  items: [],
});

// cl-crud
const Crud = useCrud(
  {
    service: service.game.user,
  },
  (app) => {
    app.refresh({ enable: enable.value });
  },
);

// 批量禁用
async function batchDisable() {
  const selection = Table.value?.selection;

  if (!selection || selection.length === 0) {
    ElMessage.warning("请选择要禁用的用户");
    return;
  }

  await ElMessageBox.confirm("确定要禁用选中的用户吗？", "提示", {
    type: "warning",
  });

  await service.game.user.batchDisable({
    ids: selection.map((e: any) => e.id),
  });

  ElMessage.success("禁用成功");
  refresh();
}

// 批量启用
async function batchEnable() {
  const selection = Table.value?.selection;

  if (!selection || selection.length === 0) {
    ElMessage.warning("请选择要启用的用户");
    return;
  }

  await ElMessageBox.confirm("确定要启用选中的用户吗？", "提示", {
    type: "warning",
  });

  await service.game.user.batchEnable({
    ids: selection.map((e: any) => e.id),
  });

  ElMessage.success("启用成功");
  refresh();
}

// 刷新
function refresh(params?: any) {
  Crud.value?.refresh(params);
}
</script>
