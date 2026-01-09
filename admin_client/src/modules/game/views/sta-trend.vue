<template>
    <div class="view-sta-period">
        <el-card shadow="never" class="mb-10">
            <div class="filter-row">
                <span class="label">日期：</span>
                <el-date-picker v-model="date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD"
                    @change="refresh" :clearable="false" />

                <span class="label ml-20">时间粒度：</span>
                <cl-select v-model="duration" :options="options.sta_duration" placeholder="请选择" :clearable="false"
                    @change="refresh" style="width: 120px" />

                <span class="label ml-20">APP：</span>
                <cl-select v-model="appId" :options="options.app_id" placeholder="全部APP" clearable @change="refresh"
                    style="width: 200px" />

                <el-button type="primary" @click="refresh" class="ml-20">刷新</el-button>
            </div>
        </el-card>

        <div class="chart-container">
            <el-row :gutter="15">
                <el-col :xs="24" :sm="24" :md="12" :lg="12" :xl="8" v-for="(item, index) in chartList" :key="index"
                    class="mb-15">
                    <el-card shadow="hover">
                        <div class="chart-box">
                            <v-chart :option="item.option" :loading="item.loading" autoresize />
                        </div>
                    </el-card>
                </el-col>
            </el-row>
        </div>
    </div>
</template>

<script lang="ts" setup name="sta-trend">
import { useCool } from "/@/cool";
import { useDict } from '/$/dict';
import { reactive, ref, onMounted } from "vue";
import dayjs from "dayjs";

const { service } = useCool();
const { dict } = useDict();

const options = reactive({
    app_id: dict.get("app_id"),
    sta_duration: dict.get("sta_duration"),
});

const date = ref(dayjs().format("YYYY-MM-DD"));
const appId = ref("");
const duration = ref(10);

const chartList = ref<any[]>([]);

// 指标定义
const metrics = [
    { key: 'gameUserCount', title: '游戏人数', isMoney: false },
    { key: 'firstGameUserCount', title: '首次游戏人数', isMoney: false },
    { key: 'betCount', title: '投注次数', isMoney: false },
    { key: 'betAmount', title: '投注金额', isMoney: true },
    { key: 'gameWin', title: '平台盈亏', isMoney: true },
];

async function refresh() {
    if (chartList.value.length === 0) {
        chartList.value = metrics.map(m => ({
            title: m.title,
            loading: true,
            option: {}
        }));
    } else {
        chartList.value.forEach(e => e.loading = true);
    }

    try {
        const res = await service.game.staPeriod.getDayTrend({
            date: date.value,
            app: appId.value,
            duration: duration.value
        });
        generateCharts(res);
    } catch (e) {
        console.error(e);
        chartList.value.forEach(e => e.loading = false);
    }
}

function generateCharts(data: any) {
    const hours = data.hours || [];

    const getValue = (val: any, isMoney: boolean) => {
        if (val === null || val === undefined) return null;
        return isMoney ? Number((val / 100).toFixed(2)) : val;
    };

    metrics.forEach((m, i) => {
        const option = {
            title: {
                text: m.title,
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params: any[]) => {
                    let res = `${params[0].axisValueLabel}<br/>`;
                    params.forEach(item => {
                        const val = (item.value === null || item.value === undefined) ? '-' : item.value;
                        res += `${item.marker} ${item.seriesName}: ${val}<br/>`;
                    });
                    return res;
                }
            },
            color: ['#5099f5', '#5099f550', '#aa04'],
            legend: {
                data: ['当天', '前一天', '上周同期'],
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true,
            },
            xAxis: {
                type: 'category',
                boundaryGap: true,
                data: hours,
            },
            yAxis: {
                type: 'value',
            },
            series: [
                {
                    name: '当天',
                    type: 'line',
                    areaStyle: {
                        color: 'rgba(80,153,245,0.3)',
                    },
                    data: data.current.map((e: any) => getValue(e[m.key], m.isMoney)),
                },
                {
                    name: '前一天',
                    type: 'line',
                    data: data.yesterday.map((e: any) => getValue(e[m.key], m.isMoney)),
                },
                {
                    name: '上周同期',
                    type: 'line',
                    data: data.lastWeek.map((e: any) => getValue(e[m.key], m.isMoney)),
                },
            ],
        };

        if (chartList.value[i]) {
            chartList.value[i].option = option;
            chartList.value[i].loading = false;
        }
    });
}

onMounted(() => {
    refresh();
});
</script>

<style lang="scss" scoped>
.view-sta-period {
    padding: 10px;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;

    .filter-row {
        display: flex;
        align-items: center;

        .label {
            font-size: 14px;
            color: #606266;
        }

        .ml-20 {
            margin-left: 20px;
        }
    }

    .mb-10 {
        margin-bottom: 10px;
    }

    .mb-15 {
        margin-bottom: 15px;
    }

    .chart-box {
        height: 300px;
    }

    .chart-container {
        min-height: 400px;
    }
}
</style>
