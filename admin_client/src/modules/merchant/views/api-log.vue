<template>
  <cl-crud ref="Crud">
    <cl-row>
      <cl-refresh-btn />
      <cl-flex1 />
      <cl-filter label="APP ID">
        <el-input
          v-model="filterAppId"
          placeholder="APP ID"
          clearable
          style="width: 140px"
          @change="refresh"
        />
      </cl-filter>
      <cl-filter label="状态码">
        <el-input
          v-model="filterStatusCode"
          placeholder="状态码"
          clearable
          style="width: 100px"
          @change="refresh"
        />
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
        <template #column-statusCode="{ scope }">
          <el-tag :type="scope.row.statusCode === 0 ? 'success' : 'danger'" size="small">
            {{ scope.row.statusCode }}
          </el-tag>
        </template>
        <template #column-reqBody="{ scope }">
          <el-button v-if="scope.row.reqBody" link size="small" @click="showDetail('请求参数', scope.row.reqBody)">
            查看
          </el-button>
          <span v-else>-</span>
        </template>
        <template #column-rspBody="{ scope }">
          <el-button v-if="scope.row.rspBody" link size="small" @click="showDetail('响应内容', scope.row.rspBody)">
            查看
          </el-button>
          <span v-else>-</span>
        </template>
      </cl-table>
    </cl-row>

    <cl-row>
      <cl-flex1 />
      <cl-pagination />
    </cl-row>

    <!-- JSON 详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="detailTitle" width="600px">
      <pre style="max-height: 400px; overflow: auto; background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 13px;">{{ detailContent }}</pre>
    </el-dialog>
  </cl-crud>
</template>

<script lang="ts" name="merchant-api-log" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ref } from "vue";

const { service } = useCool();

const filterAppId = ref('');
const filterStatusCode = ref('');

// 详情弹窗
const detailVisible = ref(false);
const detailTitle = ref('');
const detailContent = ref('');

function showDetail(title: string, content: string) {
  detailTitle.value = title;
  try {
    detailContent.value = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    detailContent.value = content;
  }
  detailVisible.value = true;
}

const Table = useTable({
  columns: [
    { label: "APP ID", prop: "appId", minWidth: 110 },
    { label: "接口", prop: "path", minWidth: 180, showOverflowTooltip: true },
    { label: "方法", prop: "method", width: 70 },
    { label: "状态码", prop: "statusCode", width: 80 },
    { label: "耗时(ms)", prop: "costMs", width: 90, sortable: "custom" },
    { label: "IP", prop: "clientIp", minWidth: 120 },
    { label: "请求", prop: "reqBody", width: 70 },
    { label: "响应", prop: "rspBody", width: 70 },
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
  if (filterStatusCode.value) params.statusCode = filterStatusCode.value;
  Crud.value?.refresh(params);
}
</script>
