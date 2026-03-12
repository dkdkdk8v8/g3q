<template>
  <cl-crud ref="Crud">
    <cl-row>
      <cl-refresh-btn />
      <cl-add-btn />
      <cl-multi-delete-btn />
      <cl-flex1 />
      <cl-select :options="DictMerchantType" prop="merchantType" :width="100" :placeholder="'商户类型'" />
      <cl-select :options="DictEnable" prop="enable" :width="100" :placeholder="'状态'" />
      <cl-search-key :placeholder="'搜索 AppID、商户名称、备注'" />
    </cl-row>

    <cl-row>
      <cl-table ref="Table">
        <template #column-enable="{ scope }">
          <el-tag
v-for="item in DictEnable" :key="item.value" v-show="scope.row.enable == item.value"
            :type="item.type as any" size="small">{{ item.label }}</el-tag>
        </template>
        <template #column-ipWhitelist="{ scope }">
          <template v-if="parseIpList(scope.row.ipWhitelist).length">
            <el-tag
              v-for="(ip, idx) in parseIpList(scope.row.ipWhitelist)"
              :key="idx"
              size="small"
              style="margin-right: 4px; margin-bottom: 2px"
            >{{ ip }}</el-tag>
          </template>
          <span v-else style="color: #999">-</span>
        </template>
        <template #column-secretKey="{ scope }">
          <el-space :size="5">
            <span>{{ secretVisible[scope.row.id] ? scope.row.secretKey : '••••••••••••' }}</span>
            <el-icon
style="cursor: pointer; font-size: 16px; vertical-align: middle"
              @click="secretVisible[scope.row.id] = !secretVisible[scope.row.id]">
              <view-icon v-if="!secretVisible[scope.row.id]" />
              <hide-icon v-else />
            </el-icon>
          </el-space>
        </template>
      </cl-table>
    </cl-row>

    <cl-row>
      <cl-flex1 />
      <cl-pagination />
    </cl-row>

    <cl-upsert ref="Upsert">
      <template #slot-ipWhitelist="{ scope }">
        <div>
          <el-tag
            v-for="(ip, idx) in (scope.ipWhitelist || [])"
            :key="idx"
            closable
            style="margin-right: 6px; margin-bottom: 6px"
            @close="scope.ipWhitelist.splice(idx, 1)"
          >{{ ip }}</el-tag>
          <template v-if="ipInput.visible">
            <el-input
              ref="IpInputRef"
              v-model="ipInput.value"
              size="small"
              style="width: 180px"
              placeholder="输入IP，按回车添加"
              @keyup.enter="confirmIpInput(scope)"
              @blur="confirmIpInput(scope)"
            />
          </template>
          <el-button
            v-else
            size="small"
            @click="showIpInput"
          >+ 添加 IP</el-button>
        </div>
      </template>
    </cl-upsert>

    <!-- 测试链接：参数输入弹窗 -->
    <el-dialog v-model="testForm.visible" title="测试启动游戏" width="400px">
      <el-form label-width="80px">
        <el-form-item label="游戏">
          <el-select v-model="testForm.gameCode" style="width: 100%">
            <el-option v-for="g in gameOptions" :key="g.value" :label="g.label" :value="g.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="玩家 ID">
          <el-input v-model="testForm.playerId" placeholder="game3q" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="testForm.visible = false">取消</el-button>
        <el-button type="primary" @click="doTestLaunchGame">确定</el-button>
      </template>
    </el-dialog>

    <!-- 测试链接：结果弹窗 -->
    <el-dialog v-model="testResult.visible" title="测试结果" width="600px">
      <template v-if="testResult.loading">
        <div style="text-align: center; padding: 30px 0">
          <el-icon class="is-loading" :size="24">
            <loading-icon />
          </el-icon>
          <div style="margin-top: 8px; color: #999">请求中...</div>
        </div>
      </template>

      <template v-else-if="testResult.url || testResult.html">
        <h4 style="margin: 0 0 8px">方式一：URL 直链</h4>
        <div style="position: relative">
          <el-input :model-value="testResult.url" type="textarea" :rows="3" readonly />
          <el-button
            size="small"
            style="position: absolute; top: 6px; right: 6px; z-index: 1"
            @click="copyText(testResult.url)"
          >复制</el-button>
        </div>

        <h4 style="margin: 16px 0 8px">方式二：HTML 测速页面</h4>
        <div style="position: relative">
          <el-input :model-value="testResult.html" type="textarea" :rows="6" readonly />
          <el-button
            size="small"
            style="position: absolute; top: 6px; right: 6px; z-index: 1"
            @click="copyText(testResult.html)"
          >复制</el-button>
        </div>
      </template>

      <template v-else-if="testResult.error">
        <el-alert :title="testResult.error" type="error" :closable="false" />
      </template>
    </el-dialog>
  </cl-crud>
</template>

<script lang="ts" name="merchant-list" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { useDict } from '/$/dict';
import { ElMessage, ElMessageBox } from "element-plus";
import { View as ViewIcon, Hide as HideIcon, Loading as LoadingIcon } from "@element-plus/icons-vue";
import { nextTick, reactive, ref } from "vue";

const { service } = useCool();
const { dict } = useDict();

const DictEnable = [
  { label: "已启用", value: 1, type: "success" },
  { label: "已禁用", value: 0, type: "danger" },
];

const DictMerchantType = [
  { label: "正式", value: 0, type: "success" },
  { label: "测试", value: 1, type: "danger" },
];

// 密钥显示控制
const secretVisible = reactive<Record<number, boolean>>({});

// IP白名单输入
const IpInputRef = ref();
const ipInput = reactive({ visible: false, value: "" });

function showIpInput() {
  ipInput.visible = true;
  ipInput.value = "";
  nextTick(() => IpInputRef.value?.focus());
}

/** 将 simple-json 字段统一转为数组（可能是字符串或已解析的数组） */
function parseIpList(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val) {
    try { const arr = JSON.parse(val); if (Array.isArray(arr)) return arr; } catch {}
  }
  return [];
}

function confirmIpInput(scope: any) {
  const val = ipInput.value.trim();
  if (val && !scope.ipWhitelist.includes(val)) {
    scope.ipWhitelist.push(val);
  }
  ipInput.visible = false;
  ipInput.value = "";
}

// cl-table
const Table = useTable({
  columns: [
    { type: "selection" },
    { label: "APP ID", prop: "appId", minWidth: 100 },
    { label: "商户名称", prop: "merchantName", minWidth: 100 },
    { label: "密钥", prop: "secretKey", minWidth: 250 },
    { label: "备注", prop: "remark", minWidth: 120, showOverflowTooltip: true },
    { label: "商户类型", prop: "merchantType", width: 80, dict: DictMerchantType },
    { label: "IP白名单", prop: "ipWhitelist", minWidth: 150 },
    { label: "状态", prop: "enable", width: 80 },
    { label: "创建时间", prop: "createTime", minWidth: 200, sortable: "desc" },
    {
      type: "op",
      width: 250,
      buttons: ["edit",
        {
          label: "重置密钥",
          onClick({ scope }) {
            resetSecret(scope.row);
          },
        },
        {
          label: "测试链接",
          type: "success",
          hidden: (({ scope }: any) => scope.row.merchantType != 1) as any,
          onClick({ scope }) {
            testLaunchGame(scope.row);
          },
        },
      ],
    },
  ],
});

// cl-upsert
const Upsert = useUpsert({
  items: [
    {
      prop: "appId",
      label: "APP ID",
      required: true,
      component: { name: "el-input", props: { placeholder: "请输入APP ID" } },
    },
    {
      prop: "merchantName",
      label: "商户名称",
      required: true,
      component: { name: "el-input", props: { placeholder: "请输入商户名称" } },
    },
    {
      prop: "merchantType",
      label: "商户类型",
      value: 0,
      component: {
        name: "el-radio-group",
        options: DictMerchantType,
      },
    },
    {
      prop: "enable",
      label: "状态",
      value: 1,
      component: {
        name: "el-radio-group",
        options: DictEnable,
      },
    },
    {
      prop: "ipWhitelist",
      label: "IP白名单",
      component: { name: "slot-ipWhitelist" },
    },
    {
      prop: "remark",
      label: "备注",
      component: {
        name: "el-input",
        props: { type: "textarea", rows: 2 },
      },
    },
  ],
  onOpened(data) {
    // 数据库返回布尔值，转为数字匹配 radio 选项
    if (data.id) {
      data.enable = data.enable ? 1 : 0;
    }
    // 确保 ipWhitelist 是数组（simple-json 可能返回字符串）
    data.ipWhitelist = parseIpList(data.ipWhitelist);
  },
  onSubmit(data, { next }) {
    const ipWhitelist = Array.isArray(data.ipWhitelist) && data.ipWhitelist.length > 0
      ? data.ipWhitelist
      : null;
    next({
      ...data,
      enable: !!data.enable,
      ipWhitelist,
    });
  },
});

// cl-crud
const Crud = useCrud(
  { service: service.merchant.merchant },
  (app) => {
    app.refresh();
  },
);

// 重置密钥
async function resetSecret(row: any) {
  await ElMessageBox.confirm(
    `确定要重置商户「${row.merchantName}」的密钥吗？重置后旧密钥立即失效。`,
    "重置密钥",
    { type: "warning" },
  );
  const res = await service.merchant.merchant.resetSecret({ id: row.id });
  ElMessage.success("密钥已重置");
  Crud.value?.refresh();
}

// 测试链接
const gameOptions = dict.get("game_name");

const testForm = reactive({
  visible: false,
  merchantId: 0,
  gameCode: '',
  playerId: 'game3q',
});

const testResult = reactive({
  visible: false,
  loading: false,
  url: "",
  html: "",
  error: "",
});

function testLaunchGame(row: any) {
  testForm.merchantId = row.id;
  testForm.gameCode = gameOptions.value?.[0]?.value || '';
  testForm.playerId = 'game3q';
  testForm.visible = true;
}

async function doTestLaunchGame() {
  testForm.visible = false;
  testResult.visible = true;
  testResult.loading = true;
  testResult.url = "";
  testResult.html = "";
  testResult.error = "";
  try {
    const res = await service.merchant.merchant.testLaunchGame({
      id: testForm.merchantId,
      gameCode: testForm.gameCode,
      playerId: testForm.playerId || 'game3q',
    });
    testResult.url = res.url;
    testResult.html = res.html;
  } catch (e: any) {
    testResult.error = e.message || "请求失败";
  } finally {
    testResult.loading = false;
  }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success("已复制");
  });
}
</script>
