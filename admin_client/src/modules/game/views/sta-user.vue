<template>
    <cl-crud ref="Crud">
        <cl-row>
            <!-- 刷新按钮 -->
            <cl-refresh-btn />

            <!-- 日期筛选 -->
            <div style="margin-right: 10px">
                <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期"
                    end-placeholder="结束日期" value-format="YYYY-MM-DD" @change="onDateChange"
                    :shortcuts="dateShortcuts" />
            </div>

            <cl-flex1 />

            <!-- APP筛选 -->
            <cl-filter label="APP">
                <cl-select v-model="searchParams.app" :options="options.app_id" @change="refresh" clearable
                    placeholder="全部APP" style="width: 150px" />
            </cl-filter>
        </cl-row>

        <cl-row>
            <el-radio-group v-model="searchParams.userType" @change="refresh">
                <el-radio-button label="all">全部用户</el-radio-button>
                <el-radio-button label="real">真实用户</el-radio-button>
                <el-radio-button label="robot">机器人</el-radio-button>
            </el-radio-group>
            <cl-flex1 />
            <!-- 用户ID筛选 -->
            <cl-filter label="用户ID">
                <el-input v-model="searchParams.userId" placeholder="搜索用户ID" clearable @keyup.enter="refresh"
                    @clear="refresh" style="width: 150px" />
            </cl-filter>
        </cl-row>

        <cl-row>
            <cl-table ref="Table" :default-sort="{ prop: 'betAmount', order: 'descending' }">
                <template #column-depositAmount="{ scope }">
                    <format-money :value="scope.row.depositAmount" />
                </template>
                <template #column-withdrawAmount="{ scope }">
                    <format-money :value="scope.row.withdrawAmount" />
                </template>
                <template #column-betAmount="{ scope }">
                    <format-money :value="scope.row.betAmount" />
                </template>
                <template #column-betWin="{ scope }">
                    <format-money :value="scope.row.betWin" />
                </template>
                <template #column-totalDeposit="{ scope }">
                    <format-money :value="scope.row.totalDeposit" />
                </template>
                <template #column-totalWithdraw="{ scope }">
                    <format-money :value="scope.row.totalWithdraw" />
                </template>
                <template #column-totalBet="{ scope }">
                    <format-money :value="scope.row.totalBet" />
                </template>
                <template #column-totalNetBalance="{ scope }">
                    <format-money :value="scope.row.totalNetBalance" />
                </template>
                <template #column-avgBetAmount="{ scope }">
                    <format-money :value="scope.row.avgBetAmount" />
                </template>
                <template #column-winRate="{ scope }">
                    {{ (scope.row.winRate * 100).toFixed(2) }}%
                </template>
                <template #column-returnRate="{ scope }">
                    {{ (scope.row.returnRate * 100).toFixed(2) }}%
                </template>
            </cl-table>
        </cl-row>

        <cl-row>
            <cl-flex1 />
            <cl-pagination />
        </cl-row>
    </cl-crud>
</template>

<script lang="ts" name="sta-user" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { useDict } from '/$/dict';
import { reactive, ref } from "vue";
import dayjs from "dayjs";
import FormatMoney from "../components/format-money.vue";
import { dateShortcuts } from "../utils/date-shortcuts";

const { dict } = useDict();
const { service } = useCool();

// 字典
const options = reactive({
    app_id: dict.get("app_id"),
});

// 日期范围默认最近30天
const dateRange = ref([
    dayjs().subtract(0, "day").format("YYYY-MM-DD"),
    dayjs().format("YYYY-MM-DD"),
]);

// 搜索参数
const searchParams = reactive({
    startDate: dateRange.value[0],
    endDate: dateRange.value[1],
    app: "",
    userType: "real",
    userId: "",
});

// 自定义Service
const crudService = {
    page: async (params: any) => {
        const { app, startDate, endDate, userType, userId } = searchParams;
        const { sort, order, page, size } = params;

        const res = await service.game.staPeriod.getUserStats({
            startDate,
            endDate,
            app,
            userType,
            userId,
            sort,
            order
        });

        const allList = res || [];
        const list = allList.slice((page - 1) * size, page * size).map((item: any, index: number) => {
            return { ...item, ranking: (page - 1) * size + index + 1 };
        });

        return {
            list,
            pagination: {
                total: allList.length,
                page: page,
                size: size,
            },
        };
    },
};

// cl-table
const Table = useTable({
    columns: [
        { label: "排名", prop: "ranking", width: 60, fixed: "left", align: "center" },
        { label: "APP", prop: "appId", minWidth: 100, sortable: "custom", fixed: "left", dict: options.app_id, dictColor: true },
        { label: "用户ID", prop: "userId", minWidth: 110, fixed: "left", showOverflowTooltip: true },
        // { label: "昵称", prop: "nickName", minWidth: 100 },
        { label: "用户盈利", prop: "betWin", minWidth: 90, sortable: "desc" },
        { label: "充值金额", prop: "depositAmount", minWidth: 90, sortable: "custom" },
        { label: "提现金额", prop: "withdrawAmount", minWidth: 90, sortable: "custom" },
        { label: "投注金额", prop: "betAmount", minWidth: 90, sortable: "custom" },
        { label: "投注次数", prop: "betCount", minWidth: 90, sortable: "custom" },
        { label: "次均投注", prop: "avgBetAmount", minWidth: 90, sortable: "custom" },
        { label: "胜率", prop: "winRate", minWidth: 90, sortable: "custom" },
        { label: "返奖率", prop: "returnRate", minWidth: 90, sortable: "custom" },
        { label: "胜利次数", prop: "winCount", minWidth: 90, sortable: "custom" },
        // { label: "当庄次数", prop: "bankerCount", minWidth: 90, sortable: "custom" },
        { label: "总充值", prop: "totalDeposit", minWidth: 90, sortable: "custom" },
        { label: "总提现", prop: "totalWithdraw", minWidth: 90, sortable: "custom" },
        { label: "总游戏数", prop: "totalGameCount", minWidth: 90, sortable: "custom" },
        { label: "总投注", prop: "totalBet", minWidth: 90, sortable: "custom" },
        { label: "总净输赢", prop: "totalNetBalance", minWidth: 90, fixed: "right", sortable: "desc" },
    ]
});

// cl-crud
const Crud = useCrud(
    {
        service: crudService,
    },
    (app) => {
        app.refresh();
    },
);

// 日期改变
function onDateChange(val: any) {
    if (val) {
        searchParams.startDate = val[0];
        searchParams.endDate = val[1];
    } else {
        searchParams.startDate = "";
        searchParams.endDate = "";
    }
    refresh();
}

// 刷新
function refresh() {
    Crud.value?.refresh();
}
</script>