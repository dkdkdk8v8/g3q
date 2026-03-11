<template>
  <cl-crud ref="Crud">
    <cl-row>
      <cl-refresh-btn />
      <cl-flex1 />
      <cl-filter label="商户">
        <el-select
          v-model="filterAppId"
          placeholder="全部商户"
          clearable
          style="width: 160px"
          @change="refresh"
        >
          <el-option
            v-for="m in merchantOptions"
            :key="m.appId"
            :label="m.merchantName"
            :value="m.appId"
          />
        </el-select>
      </cl-filter>
      <cl-filter label="状态码">
        <el-select
          v-model="filterStatusCode"
          placeholder="全部"
          clearable
          style="width: 120px"
          @change="refresh"
        >
          <el-option label="成功 (0)" :value="0" />
          <el-option label="失败 (非0)" value="fail" />
        </el-select>
      </cl-filter>
      <cl-search-key
        field="path"
        :field-list="[
          { label: '接口路径', value: 'path' },
          { label: 'IP', value: 'clientIp' },
        ]"
      />
    </cl-row>

    <cl-row>
      <cl-table ref="Table">
        <template #column-appId="{ scope }">
          {{ getMerchantName(scope.row.appId) }}
        </template>
        <template #column-statusCode="{ scope }">
          <el-tag
            :type="scope.row.statusCode === 0 ? 'success' : 'danger'"
            size="small"
          >{{ scope.row.statusCode }}</el-tag>
        </template>
        <template #column-costMs="{ scope }">
          {{ scope.row.costMs }}ms
        </template>
        <template #column-clientIp="{ scope }">
          <el-tag
            :type="getIpTagType(scope.row.appId, scope.row.clientIp)"
            size="small"
          >{{ scope.row.clientIp || '-' }}</el-tag>
        </template>
        <template #column-reqBody="{ scope }">
          <cl-code-json
            v-if="scope.row.reqBody"
            :content="scope.row.reqBody"
            popover
            :max-height="400"
          />
          <span v-else>-</span>
        </template>
        <template #column-rspBody="{ scope }">
          <cl-code-json
            v-if="scope.row.rspBody"
            :content="scope.row.rspBody"
            popover
            :max-height="400"
          />
          <span v-else>-</span>
        </template>
      </cl-table>
    </cl-row>

    <cl-row>
      <cl-flex1 />
      <cl-pagination />
    </cl-row>

  </cl-crud>
</template>

<script lang="ts" name="merchant-api-log" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { onMounted, ref } from "vue";

const { service } = useCool();

const filterAppId = ref<string>('');
const filterStatusCode = ref<number | string>('');

// 商户列表（select选项 + 白名单缓存）
const merchantOptions = ref<any[]>([]);
const whitelistMap = ref<Record<string, string[]>>({});

async function loadMerchants() {
  try {
    const res = await service.merchant.merchant.list();
    merchantOptions.value = res || [];
    const map: Record<string, string[]> = {};
    for (const m of (res || [])) {
      let list = m.ipWhitelist;
      if (typeof list === "string" && list) {
        try { list = JSON.parse(list); } catch { list = []; }
      }
      map[m.appId] = Array.isArray(list) ? list : [];
    }
    whitelistMap.value = map;
  } catch { }
}

/** 根据appId获取商户名称 */
function getMerchantName(appId: string): string {
  const m = merchantOptions.value.find((item: any) => item.appId === appId);
  return m ? `${m.merchantName} (${appId})` : appId;
}

/** 判断是否为局域网IP（兼容 ::ffff:x.x.x.x 格式） */
function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  const raw = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (raw === "127.0.0.1" || raw === "::1" || raw === "localhost") return true;
  const parts = raw.split(".").map(Number);
  if (parts.length !== 4) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

/** 根据IP和白名单返回tag类型 */
function getIpTagType(appId: string, ip: string): 'success' | 'danger' | 'info' | 'primary' {
  if (!ip) return "info";
  if (isPrivateIp(ip)) return "primary";
  const list = whitelistMap.value[appId];
  if (!list || list.length === 0) return "info";
  return list.includes(ip) ? "success" : "danger";
}

onMounted(() => {
  loadMerchants();
});

const Table = useTable({
  columns: [
    { label: "商户", prop: "appId", minWidth: 120 },
    { label: "接口", prop: "path", minWidth: 160, showOverflowTooltip: true },
    { label: "方法", prop: "method", width: 70 },
    { label: "状态码", prop: "statusCode", width: 80 },
    { label: "耗时", prop: "costMs", width: 90 },
    { label: "IP", prop: "clientIp", minWidth: 120 },
    { label: "请求", prop: "reqBody", minWidth: 200, showOverflowTooltip: false },
    { label: "响应", prop: "rspBody", minWidth: 200, showOverflowTooltip: false },
    { label: "时间", prop: "createTime", minWidth: 150, sortable: "desc" },
  ],
});

const Crud = useCrud(
  { service: service.merchant.apiLog },
  (app) => {
    app.refresh();
  },
);

function refresh() {
  const params: any = {};
  if (filterAppId.value) params.appId = filterAppId.value;
  if (filterStatusCode.value !== '') {
    params.statusCode = filterStatusCode.value;
  }
  Crud.value?.refresh(params);
}
</script>
