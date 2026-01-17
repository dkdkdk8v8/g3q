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
            <cl-filter label="">
                <cl-select v-model="searchParams.app" :options="options.app_id" @change="refresh" clearable
                    placeholder="全部APP" style="width: 150px" />
            </cl-filter>

            <!-- 游戏筛选 -->
            <cl-filter label="">
                <cl-select v-model="searchParams.gameName" :options="options.game_name" @change="refresh" clearable
                    placeholder="全部游戏" style="width: 150px" />
            </cl-filter>

            <!-- 房间等级筛选 -->
            <cl-filter label="">
                <cl-select v-model="searchParams.roomLevel" :options="options.qznn_room_level" @change="refresh"
                    clearable placeholder="全部等级" style="width: 150px" />
            </cl-filter>

            <!-- 房间类型筛选 -->
            <cl-filter label="">
                <cl-select v-model="searchParams.roomType" :options="options.qznn_room_type" @change="refresh" clearable
                    placeholder="全部类型" style="width: 150px" />
            </cl-filter>
        </cl-row>

        <cl-row>
            <el-radio-group v-model="searchParams.showType" @change="refresh">
                <el-radio-button label="date">按日期</el-radio-button>
                <el-radio-button label="app">按APP</el-radio-button>
                <el-radio-button label="game">按游戏</el-radio-button>
                <el-radio-button label="roomLevel">按房间等级</el-radio-button>
                <el-radio-button label="roomType">按房间类型</el-radio-button>
            </el-radio-group>
        </cl-row>

        <cl-row>
            <cl-table ref="Table">
                <template #column-gameWin="{ scope }">
                    <format-money :value="scope.row.gameWin" />
                </template>
            </cl-table>
        </cl-row>
    </cl-crud>
</template>

<script lang="ts" name="sta-date" setup>
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
    game_name: dict.get("game_name"),
    qznn_room_level: dict.get("qznn_room_level"),
    qznn_room_type: dict.get("qznn_room_type"),
});

// 日期范围默认最近30天
const dateRange = ref([
    dayjs().subtract(29, "day").format("YYYY-MM-DD"),
    dayjs().format("YYYY-MM-DD"),
]);

// 搜索参数
const searchParams = reactive({
    startDate: dateRange.value[0],
    endDate: dateRange.value[1],
    app: "",
    gameName: "",
    showType: "date",
    roomLevel: "",
    roomType: "",
});

// 自定义Service
const crudService = {
    page: async (params: any) => {
        let { app, showType, startDate, endDate, gameName, roomLevel, roomType } = searchParams;
        const { sort, order } = params;
        const res = await service.game.staPeriod.getDateStats({
            startDate,
            endDate,
            app,
            gameName,
            showType,
            sort,
            order,
            roomLevel,
            roomType
        });

        const list = res || [];

        return {
            list,
            pagination: {
                total: list.length,
                page: 1,
                size: 10000,
            },
        };
    },
};

// cl-table
const Table = useTable({
    columns: [
        {
            label: "标题",
            prop: "title",
            minWidth: 100,
            fixed: "left",
            sortable: "custom",
            formatter(row) {
                if (searchParams.showType === "app") {
                    return options.app_id.find(i => row.title === i.value)?.label || row.title || '未知';
                }
                if (searchParams.showType === "game") {
                    return options.game_name.find(i => row.title === i.value)?.label || row.title || '未知';
                }
                if (searchParams.showType === "roomLevel") {
                    return options.qznn_room_level.find(i => String(row.title) === String(i.value))?.label || row.title || '未知';
                }
                if (searchParams.showType === "roomType") {
                    return options.qznn_room_type.find(i => String(row.title) === String(i.value))?.label || row.title || '未知';
                }
                return row.title;
            },
        },
        {
            label: "游戏活跃",
            prop: "gameUserCount",
            minWidth: 90,
            sortable: "custom",
        },
        {
            label: "首次游戏",
            prop: "firstGameUserCount",
            minWidth: 90,
            sortable: "custom",
        },
        {
            label: "游戏局数",
            prop: "gameCount",
            minWidth: 90,
            sortable: "custom",
        },
        {
            label: "投注流水",
            prop: "betAmount",
            minWidth: 100,
            sortable: "custom",
            formatter(row) {
                return (row.betAmount / 100).toFixed(2);
            },
        },
        {
            label: "投注次数",
            prop: "betCount",
            minWidth: 100,
            sortable: "custom",
        },
        {
            label: "人均流水",
            prop: "avgBetPerUser",
            minWidth: 100,
            sortable: "custom",
            formatter(row) {
                return (row.avgBetPerUser / 100).toFixed(2);
            },
        },
        {
            label: "次均流水",
            prop: "avgBetPerGame",
            minWidth: 100,
            sortable: "custom",
            formatter(row) {
                return (row.avgBetPerGame / 100).toFixed(2);
            },
        },
        {
            label: "人均投注次数",
            prop: "avgCountPerUser",
            minWidth: 110,
            sortable: "custom",
            formatter(row) {
                return Number(row.avgCountPerUser).toFixed(2);
            },
        },
        {
            label: "杀率",
            prop: "rakeRatio",
            minWidth: 100,
            sortable: "custom",
            formatter(row) {
                return (row.rakeRatio * 100).toFixed(2) + "%";
            },
        },
        {
            label: "平台盈亏",
            prop: "gameWin",
            minWidth: 100,
            fixed: "right",
            sortable: "custom",
        },
    ],
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