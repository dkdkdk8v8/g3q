<template>
    <div class="view-sta-period">
        <el-card shadow="never" class="mb-10">
            <div class="filter-row">
                <span class="label">日期：</span>
                <el-date-picker v-model="date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD"
                    @change="refresh" :clearable="false" />

                <div style="flex: 1"></div>

                <el-radio-group v-model="duration" @change="refresh">
                    <el-radio-button v-for="(item, index) in options.sta_duration" :key="index" :value="item.value">
                        {{ item.label }}
                    </el-radio-button>
                </el-radio-group>

                <span class="label ml-20"></span>
                <cl-select v-model="appId" :options="options.app_id" placeholder="全部APP" clearable @change="refresh"
                    style="width: 200px" />

                <el-button type="primary" @click="refresh" class="ml-20">刷新</el-button>
            </div>
        </el-card>

        <el-card shadow="never" class="mb-10">
            <el-row :gutter="20">
                <el-col :xs="12" :sm="8" :md="4" v-for="item in summaryData" :key="item.key">
                    <el-statistic :title="item.title" :value="item.value"
                        :precision="item.isMoney || item.isRate ? 2 : 0">
                        <template #prefix>
                            <span v-if="item.isMoney" style="font-size: 14px; margin-right: 2px">¥</span>
                        </template>
                        <template #suffix>
                            <span v-if="item.isRate" style="font-size: 14px">%</span>
                        </template>
                    </el-statistic>
                    <div class="statistic-footer">
                        <span class="label">较昨日</span>
                        <span :class="['value', Number(item.diff) >= 0 ? 'up' : 'down']">
                            {{ Number(item.diff) >= 0 ? '↑' : '↓' }}{{ Math.abs(Number(item.diff)) }}%
                        </span>
                    </div>
                </el-col>
            </el-row>
        </el-card>

        <div class="chart-container">
            <el-row :gutter="15">
                <el-col :xs="24" :sm="24" :md="12" :lg="12" :xl="8" v-for="(item, index) in chartList" :key="index"
                    class="mb-15">
                    <el-card shadow="hover">
                        <div class="chart-box">
                            <v-chart :option="item.option" :loading="item.loading" :loading-options="loadingOptions"
                                autoresize />
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
import { reactive, ref, onMounted, onUnmounted, watch, computed } from "vue";
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
const lastData = ref<any>(null);
const summaryData = ref<any[]>([]);
const isDark = ref(false);

// 指标定义
const metrics = [
    { key: 'gameUserCount', title: '游戏活跃', isMoney: false },
    { key: 'firstGameUserCount', title: '首次游戏', isMoney: false },
    { key: 'betCount', title: '投注次数', isMoney: false },
    { key: 'betAmount', title: '投注金额', isMoney: true },
    { key: 'gameWin', title: '平台盈亏', isMoney: true },
    { key: 'platformKillRate', title: '平台杀率', isMoney: false, isRate: true },
];

const loadingOptions = computed(() => {
    return {
        text: "加载中...",
        textColor: isDark.value ? "#fff" : "#000",
        maskColor: isDark.value ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.8)",
    };
});

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
            duration: duration.value,
        });
        lastData.value = res;
        generateCharts(res);
    } catch (e) {
        console.error(e);
        chartList.value.forEach(e => e.loading = false);
    }
}

function generateCharts(data: any) {
    const getValue = (val: any, isMoney: boolean, isRate?: boolean) => {
        if (val === null || val === undefined) return null;
        if (isRate) return Number((val * 100).toFixed(2));
        return isMoney ? Number((val / 100).toFixed(2)) : val;
    };

    const isToday = date.value === dayjs().format("YYYY-MM-DD");

    // 确定当前有效的数据长度（针对今日数据，找出最后一个有记录的小时）
    let activeLen = data.current.length;
    if (isToday) {
        let lastIdx = -1;
        for (let i = data.current.length - 1; i >= 0; i--) {
            // 只要活跃用户或投注次数大于0，就认为该小时有实际业务数据
            if ((data.current[i].gameUserCount || 0) > 0 || (data.current[i].betCount || 0) > 0) {
                lastIdx = i;
                break;
            }
        }
        activeLen = lastIdx + 1;
    }

    // 计算总计数据及昨日对比
    summaryData.value = metrics.map(m => {
        let currentTotal = 0;
        let yesterdayTotal = 0;

        const isCumulative = ['gameUserCount', 'firstGameUserCount'].includes(m.key);

        if (isCumulative) {
            // 1. 累加数据（活跃、新增）：取有效长度的最后一条记录作为当前总计
            currentTotal = activeLen > 0 ? (data.current[activeLen - 1][m.key] || 0) : 0;

            // 对比昨日：如果是今天则对比昨日同一小时，如果是历史日期则对比昨日全天最后一条
            const yesIdx = isToday ? activeLen - 1 : (data.yesterday.length - 1);
            yesterdayTotal = (data.yesterday && yesIdx >= 0 && data.yesterday[yesIdx])
                ? (data.yesterday[yesIdx][m.key] || 0)
                : 0;
        } else if (m.key === 'platformKillRate') {
            // 2. 杀率：根据盈亏和投注重新计算
            const curWin = data.current.reduce((a: number, b: any) => a + (b.gameWin || 0), 0);
            const curBet = data.current.reduce((a: number, b: any) => a + (b.betAmount || 0), 0);
            currentTotal = curBet > 0 ? curWin / curBet : 0;

            let yesData = data.yesterday || [];
            if (isToday) {
                yesData = yesData.slice(0, activeLen);
            }
            const yesWin = yesData.reduce((a: number, b: any) => a + (b.gameWin || 0), 0);
            const yesBet = yesData.reduce((a: number, b: any) => a + (b.betAmount || 0), 0);
            yesterdayTotal = yesBet > 0 ? yesWin / yesBet : 0;
        } else {
            // 3. 普通数值：求和
            currentTotal = data.current.reduce((a: number, b: any) => a + (b[m.key] || 0), 0);

            let yesData = data.yesterday || [];
            if (isToday) {
                yesData = yesData.slice(0, activeLen);
            }
            yesterdayTotal = yesData.reduce((a: number, b: any) => a + (b[m.key] || 0), 0);
        }

        let diff = 0;
        if (yesterdayTotal !== 0) {
            diff = ((currentTotal - yesterdayTotal) / Math.abs(yesterdayTotal)) * 100;
        } else if (currentTotal !== 0) {
            diff = 100;
        }

        return {
            ...m,
            value: getValue(currentTotal, m.isMoney, m.isRate),
            diff: diff.toFixed(2)
        };
    });

    const hours = data.hours || [];

    const el = document.documentElement;
    const getVar = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();

    const getRgba = (color: string, opacity: number) => {
        let r = 0, g = 0, b = 0;
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
        } else if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (match) {
                r = parseInt(match[0]);
                g = parseInt(match[1]);
                b = parseInt(match[2]);
            }
        }
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    const primary = getVar('--el-color-primary') || '#5099f5';
    const warning = getVar('--el-color-warning') || '#e6a23c';
    const textColor = getVar('--el-text-color-primary');
    const borderColor = getVar('--el-border-color-lighter');

    metrics.forEach((m: any, i) => {
        const option = {
            title: {
                text: m.title,
                textStyle: { color: textColor }
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDark.value ? 'rgba(0,0,0,0.7)' : '#fff',
                borderColor: borderColor,
                textStyle: { color: isDark.value ? '#fff' : '#333' },
                formatter: (params: any[]) => {
                    let res = `${params[0].axisValueLabel}<br/>`;
                    params.forEach(item => {
                        let val = (item.value === null || item.value === undefined) ? '-' : item.value;
                        if (typeof val === 'number' && (m.isMoney || m.isRate)) {
                            val = val.toFixed(2);
                        }
                        const prefix = m.isMoney ? '¥' : '';
                        const suffix = m.isRate ? '%' : '';
                        res += `${item.marker} ${item.seriesName}: ${prefix}${val}${suffix}<br/>`;
                    });
                    return res;
                }
            },
            color: [primary, getRgba(primary, 0.5), getRgba(warning, 0.5)],
            legend: {
                data: ['当天', '前一天', '上周同期'],
                textStyle: { color: textColor }
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
                axisLabel: { color: textColor },
                axisLine: { lineStyle: { color: borderColor } }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: textColor,
                    formatter: (value: number) => {
                        if (m.isMoney) return '¥' + value;
                        if (m.isRate) return value + '%';
                        return value;
                    }
                },
                splitLine: { lineStyle: { color: borderColor, type: 'dashed' } }
            },
            series: [
                {
                    name: '当天',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    areaStyle: {
                        color: getRgba(primary, 0.3)
                    },
                    data: data.current.map((e: any) => getValue(e[m.key], m.isMoney, m.isRate)),
                    markLine: m.key === 'platformKillRate' ? {
                        silent: true,
                        symbol: 'none',
                        label: {
                            position: 'start',
                            formatter: ''
                        },
                        lineStyle: {
                            color: '#f56c6c',
                            type: 'dashed'
                        },
                        data: [{ yAxis: 2.5 }]
                    } : undefined
                },
                {
                    name: '前一天',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    data: data.yesterday.map((e: any) => getValue(e[m.key], m.isMoney, m.isRate)),
                },
                {
                    name: '上周同期',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    data: data.lastWeek.map((e: any) => getValue(e[m.key], m.isMoney, m.isRate)),
                },
            ],
        };

        if (chartList.value[i]) {
            chartList.value[i].option = option;
            chartList.value[i].loading = false;
        }
    });
}

let observer: MutationObserver | null = null;

onMounted(() => {
    refresh();

    isDark.value = document.documentElement.classList.contains('dark');
    observer = new MutationObserver(() => {
        isDark.value = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onUnmounted(() => {
    if (observer) observer.disconnect();
});

watch(isDark, () => {
    if (lastData.value) {
        generateCharts(lastData.value);
    }
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

    .mt-10 {
        margin-top: 10px;
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

    .statistic-footer {
        display: flex;
        align-items: center;
        font-size: 12px;
        margin-top: 4px;
        color: var(--el-text-color-regular);

        .label {
            margin-right: 4px;
        }

        .up {
            color: var(--el-color-success);
        }

        .down {
            color: var(--el-color-danger);
        }
    }
}
</style>
