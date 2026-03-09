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
      <cl-filter v-if="showAppFilter" label="APP">
        <cl-select :options="options.app_id" prop="app_id" :width="120" />
      </cl-filter>
      <cl-search-key field="app_user_id" :field-list="[
        {
          label: '用户ID',
          value: 'app_user_id'
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

    <!-- 修改余额弹窗 -->
    <el-dialog v-model="balanceForm.visible" title="修改余额" width="420px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="用户ID">
          <span>{{ balanceForm.displayUserId }}</span>
        </el-form-item>
        <el-form-item label="当前余额">
          <span>{{ (balanceForm.currentBalance / 100).toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="修改金额">
          <el-input-number v-model="balanceForm.amount" :precision="2" :step="1" controls-position="right"
            style="width: 200px" />
          <div style="color: #909399; font-size: 12px; margin-top: 4px">
            正数增加，负数扣减
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="balanceForm.visible = false">取消</el-button>
        <el-button type="primary" :loading="balanceForm.loading" @click="doModifyBalance">
          确定
        </el-button>
      </template>
    </el-dialog>
  </cl-crud>
</template>

<script lang="ts" name="game-user" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { reactive, ref, computed } from "vue";
import { DictEnable } from "../utils/dict";
import FormatMoney from "../components/format-money.vue";
import { useOptions } from '/$/options';
import { useBase } from '/$/base';

const { options: optionsStore } = useOptions();
const { service, router } = useCool();
const { user } = useBase();

// 解析当前用户绑定的商户
const userAppIds = computed<string[]>(() => {
  try {
    const ids = user.info?.appIds ? JSON.parse(user.info.appIds) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
});

// 根据绑定商户过滤选项
const allMerchantOptions = optionsStore.get("merchant_app");
const filteredAppOptions = computed(() => {
  if (!userAppIds.value.length) return allMerchantOptions.value;
  return allMerchantOptions.value.filter((o: any) => userAppIds.value.includes(o.value));
});
const showAppFilter = computed(() => filteredAppOptions.value.length > 1);

// 字典
const options = reactive({
  app_id: filteredAppOptions,
});

// 是否显示APP列（admin 或绑定多个商户时显示）
const showAppColumn = computed(() => {
  if (user.info?.username === 'admin') return true;
  return filteredAppOptions.value.length > 1;
});

// 状态
const enable = ref(1);

// cl-table
const Table = useTable({
  columns: [
    { type: "selection" },
    { label: "APP", prop: "app_id", dict: options.app_id, dictColor: true, minWidth: 100, fixed: "left", hidden: !showAppColumn.value },
    { label: "用户ID", prop: "app_user_id", minWidth: 120, fixed: "left" },
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
      label: "总余额",
      prop: "_total_balance",
      minWidth: 90,
      formatter(row) {
        return ((Number(row.balance) + Number(row.balance_lock)) / 100).toFixed(2);
      },
    },
    {
      label: "可用余额",
      prop: "balance",
      minWidth: 90,
      formatter(row) {
        return (row.balance / 100).toFixed(2);
      },
    },
    {
      label: "锁定余额",
      prop: "balance_lock",
      minWidth: 90,
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
      width: 180,
      buttons: [
        {
          label: "修改余额",
          onClick({ scope }) {
            openModifyBalance(scope.row);
          },
        },
        {
          label: "资金记录",
          onClick({ scope }) {
            router.push({
              path: "/game/user-record",
              query: { app_user_id: scope.row.app_user_id },
            });
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
    const params: any = { enable: enable.value };
    // 只绑定1个商户时自动带上筛选
    if (userAppIds.value.length === 1) {
      params.app_id = userAppIds.value[0];
    }
    app.refresh(params);
  },
);

// 修改余额
const balanceForm = reactive({
  visible: false,
  loading: false,
  userId: "",
  displayUserId: "",
  currentBalance: 0,
  amount: 0,
});

function openModifyBalance(row: any) {
  balanceForm.userId = row.user_id;
  balanceForm.displayUserId = row.app_user_id;
  balanceForm.currentBalance = row.balance;
  balanceForm.amount = 0;
  balanceForm.visible = true;
}

async function doModifyBalance() {
  if (!balanceForm.amount) {
    ElMessage.warning("请输入修改金额");
    return;
  }
  const amountCent = Math.round(balanceForm.amount * 100);
  await ElMessageBox.confirm(
    `确定要${amountCent > 0 ? "增加" : "扣减"} ${Math.abs(balanceForm.amount).toFixed(2)} 元吗？`,
    "确认修改余额",
    { type: "warning" }
  );
  balanceForm.loading = true;
  try {
    await service.game.user.modifyBalance({
      userId: balanceForm.userId,
      amount: amountCent,
    });
    ElMessage.success("余额修改成功");
    balanceForm.visible = false;
    refresh();
  } catch (e: any) {
    ElMessage.error(e.message || "修改失败");
  } finally {
    balanceForm.loading = false;
  }
}

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
