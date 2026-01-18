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

            <!-- 用户ID筛选 -->
            <cl-filter label="用户ID">
                <el-input v-model="searchParams.userId" placeholder="搜索用户ID" clearable @keyup.enter="refresh"
                    @clear="refresh" style="width: 150px" />
            </cl-filter>

            <!-- APP筛选 -->
            <cl-filter label="APP">
                <cl-select v-model="searchParams.app" :options="options.app_id" @change="refresh" clearable
                    placeholder="全部APP" style="width: 150px" />
            </cl-filter>
        </cl-row>

        <cl-row>
            <cl-table ref="Table" />
        </cl-row>

        <cl-row>
            <cl-flex1 />
            <cl-pagination />
        </cl-row>
    </cl-crud>
</template>

<script lang="tsx" name="sta-user" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { useDict } from '/$/dict';
import { reactive, ref } from "vue";
import dayjs from "dayjs";
import { dateShortcuts } from "../utils/date-shortcuts";
import FormatMoney from "../components/format-money.vue"

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
    userId: "",
});

// 自定义Service
const crudService = {
    page: async (params: any) => {
        const { app, startDate, endDate, userId } = searchParams;
        const { sort, order, page, size } = params;

        const res = await service.game.staPeriod.getUserStats({
            startDate,
            endDate,
            app,
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

// 格式化金额
function fmtMoney(row: any, column: any, value = 0) {
    return Number(value / 100).toFixed(2);
}

// 格式化百分比
function fmtPercent(row: any, column: any, value = 0) {
    return (Number(value || 0) * 100).toFixed(2) + "%";
}

function fmtMoneyWin(row: any, column: any, value = 0) {
    return <FormatMoney value={value} />
}

// cl-table
const Table = useTable({
    columns: [
        { label: "排名", prop: "ranking", width: 60, fixed: "left", align: "center" },
        { label: "APP", prop: "appId", minWidth: 100, sortable: "custom", fixed: "left", dict: options.app_id, dictColor: true },
        { label: "用户ID", prop: "userId", minWidth: 110, fixed: "left", showOverflowTooltip: true },
        { label: "用户盈利", prop: "betWin", minWidth: 90, fixed: "left", sortable: "desc", formatter: fmtMoneyWin },
        { label: "充值金额", prop: "depositAmount", minWidth: 90, sortable: "custom", formatter: fmtMoney },
        { label: "提现金额", prop: "withdrawAmount", minWidth: 90, sortable: "custom", formatter: fmtMoney },
        { label: "投注流水", prop: "betAmount", minWidth: 100, sortable: "custom", formatter: fmtMoney },
        { label: "投注次数", prop: "betCount", minWidth: 90, sortable: "custom" },
        { label: "次均投注", prop: "avgBetAmount", minWidth: 90, sortable: "custom", formatter: fmtMoney },
        { label: "胜率", prop: "winRate", minWidth: 90, sortable: "custom", formatter: fmtPercent },
        { label: "返奖率", prop: "returnRate", minWidth: 90, sortable: "custom", formatter: fmtPercent },
        { label: "胜利次数", prop: "winCount", minWidth: 90, sortable: "custom" },
        { label: "总充值", prop: "totalDeposit", minWidth: 90, sortable: "custom", formatter: fmtMoney },
        { label: "总提现", prop: "totalWithdraw", minWidth: 90, sortable: "custom", formatter: fmtMoney },
        { label: "总游戏数", prop: "totalGameCount", minWidth: 90, sortable: "custom" },
        { label: "总流水", prop: "totalBet", minWidth: 90, sortable: "custom", formatter: fmtMoney },
        { label: "总输赢", prop: "totalNetBalance", minWidth: 90, fixed: "right", sortable: "desc", formatter: fmtMoneyWin },
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