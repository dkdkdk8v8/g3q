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
      <cl-filter label="APP">
        <cl-select :options="options.app_id" prop="app_id" :width="120" />
      </cl-filter>
      <cl-search-key field="user_id" :field-list="[
        {
          label: '用户ID',
          value: 'user_id'
        },
      ]" />
    </cl-row>
    <cl-row>
      <cl-filter label="">
        <el-radio-group v-model="enable" @change="refresh({ enable })">
          <el-radio-button v-for="(item, index) in DictEnable" :key="index" :value="item.value">
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </cl-filter>
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
        <template #column-enable="{ scope }">
          <el-tag v-for="(item, index) in DictEnable" :key="index" :type="item.type as any" size="small"
            v-show="scope.row.enable == item.value">{{ item.label }}</el-tag>
        </template>
        <template #column-total_net_balance="{ scope }">
          <format-money :value="scope.row.total_net_balance" />
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
import { reactive, ref } from "vue";
import UserRecord from "../components/user-record.vue";
import { DictEnable } from "../utils/dict";
import FormatMoney from "../components/format-money.vue";
import { useDict } from '/$/dict';

const { dict } = useDict();
const { service } = useCool();

// 字典
const options = reactive({
  app_id: dict.get("app_id"),
});

// 状态
const enable = ref(1);

// 记录弹窗
const UserRecordRef = ref();

// cl-table
const Table = useTable({
  columns: [
    { type: "selection" },
    { label: "APP", prop: "app_id", dict: options.app_id, dictColor: true, minWidth: 100, fixed: "left" },
    { label: "用户ID", prop: "user_id", minWidth: 120, fixed: "left" },
    {
      label: "头像",
      prop: "avatar",
      width: 80,
      component: {
        name: "cl-image",
        props: {
          size: 32,
        },
      },
    },
    { label: "昵称", prop: "nick_name", minWidth: 100 },
    {
      label: "余额",
      prop: "balance",
      minWidth: 80,
      formatter(row) {
        return (row.balance / 100).toFixed(2);
      },
    },
    {
      label: "锁定余额",
      prop: "balance_lock",
      minWidth: 80,
      formatter(row) {
        return (row.balance_lock / 100).toFixed(2);
      },
    },
    {
      label: "总充值",
      prop: "total_deposit",
      minWidth: 80,
      formatter(row) {
        return (row.total_deposit / 100).toFixed(2);
      },
    },
    {
      label: "总提现",
      prop: "total_with_draw",
      minWidth: 80,
      formatter(row) {
        return (row.total_with_draw / 100).toFixed(2);
      },
    },
    {
      label: "游戏次数",
      prop: "total_game_count",
      minWidth: 80,
    },
    {
      label: "总投注",
      prop: "total_bet",
      minWidth: 90,
      formatter(row) {
        return (row.total_bet / 100).toFixed(2);
      },
    },
    {
      label: "净输赢",
      prop: "total_net_balance",
      minWidth: 80,
    },
    { label: "用户设置", prop: "settings", minWidth: 160 },
    { label: "备注", prop: "remark", minWidth: 120, showOverflowTooltip: true },
    {
      label: "最近游戏",
      prop: "last_played",
      minWidth: 150,
      sortable: "custom",
    },
    { label: "创建时间", prop: "create_at", minWidth: 150, sortable: "desc" },
    {
      label: "状态",
      prop: "enable",
      width: 80,
      fixed: "right",
    },
    {
      type: "op",
      width: 80,
      buttons: [
        {
          label: "查看",
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
