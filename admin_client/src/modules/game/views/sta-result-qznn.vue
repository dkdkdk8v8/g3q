<template>
    <div class="view-sta-result-qznn">
        <el-card shadow="never" class="mb-10">
            <div class="filter-row">
                <span class="label">日期：</span>
                <el-date-picker v-model="date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD"
                    @change="refresh" :clearable="false" />

                <span class="label ml-20">APP：</span>
                <cl-select v-model="appId" :options="options.app_id" placeholder="全部APP" clearable @change="refresh"
                    style="width: 200px" />

                <el-button type="primary" @click="refresh" class="ml-20">刷新</el-button>
            </div>
        </el-card>

        <el-card shadow="never" class="chart-card">
            <el-row :gutter="20">
                <el-col :xs="24" :sm="24" :md="24" :lg="16" :xl="16" class="mb-10">
                    <div class="chart-box" ref="chartBoxRef">
                        <v-chart ref="chartRef" :option="chartOption" autoresize />
                    </div>
                </el-col>
                <el-col :xs="24" :sm="24" :md="24" :lg="8" :xl="8" class="mb-10">
                    <div class="chart-box">
                        <v-chart :option="barRankOption" autoresize />
                    </div>
                </el-col>
            </el-row>
        </el-card>

        <el-card shadow="never" class="chart-card mt-10">
            <div class="chart-box">
                <v-chart :option="cardCountOption" autoresize />
            </div>
        </el-card>
    </div>
</template>

<script lang="ts" setup name="sta-result-qznn">
import { useCool } from "/@/cool";
import { useDict } from '/$/dict';
import { reactive, ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import dayjs from "dayjs";

const { service } = useCool();
const { dict } = useDict();

const options = reactive({
    app_id: dict.get("app_id"),
});

const date = ref(dayjs().format("YYYY-MM-DD"));
const appId = ref("");

const chartRef = ref();
const chartBoxRef = ref();
const chartOption = ref({});
const barRankOption = ref({});
const cardCountOption = ref({});
const isDark = ref(false);

// 牌型定义
const cardTypeMap: Record<string, string> = {
    NiuNone: '无牛',
    NiuOne: '牛一',
    NiuTwo: '牛二',
    NiuThree: '牛三',
    NiuFour: '牛四',
    NiuFive: '牛五',
    NiuSix: '牛六',
    NiuSeven: '牛七',
    NiuEight: '牛八',
    NiuNine: '牛九',
    NiuNiu: '牛牛',
    NiuFace: '五花牛',
    NiuBomb: '炸弹牛',
    NiuFiveSmall: '五小牛',
};
const cardTypeKeys = [
    'NiuNone',
    'NiuOne',
    'NiuTwo',
    'NiuThree',
    'NiuFour',
    'NiuFive',
    'NiuSix',
    'NiuSeven',
    'NiuEight',
    'NiuNine',
    'NiuNiu',
    'NiuFace',
    'NiuBomb',
    'NiuFiveSmall'
];

// 颜色配置
const colors = [
    '#909399', // 无牛
    '#3aa1ff', // 牛一
    '#36cbcb', // 牛二
    '#4ecb73', // 牛三
    '#fbd437', // 牛四
    '#f2637b', // 牛五
    '#975fe5', // 牛六
    '#5254cf', // 牛七
    '#435188', // 牛八
    '#faad14', // 牛九
    '#f5222d', // 牛牛
    '#fa541c', // 五花牛
    '#722ed1', // 炸弹牛
    '#13c2c2'  // 五小牛
];

let rawDataCache: number[][] = [];
let totalDataCache: number[] = [];
let cardCountCache: number[] = [];

async function refresh() {
    try {
        const res = await service.game.staPeriod.getCardResultStats({
            date: date.value,
            app: appId.value,
        });

        const hourlyData = res.hourly || [];
        const cardCountData = res.cardCount || [];
        cardCountCache = cardCountData;

        const data = hourlyData;

        // 确保有24小时数据
        const hoursData = Array.from({ length: 24 }, (_, i) => data[i] || {});

        rawDataCache = cardTypeKeys.map(key => {
            return hoursData.map((h: any) => h[key] || 0);
        });

        // 计算每小时总数
        totalDataCache = [];
        for (let i = 0; i < rawDataCache[0].length; ++i) {
            let sum = 0;
            for (let j = 0; j < rawDataCache.length; ++j) {
                sum += rawDataCache[j][i];
            }
            totalDataCache.push(sum);
        }

        updateChart();
        updateRankChart();
        updateCardCountChart(cardCountData);
    } catch (e) {
        console.error(e);
    }
}

function updateChart() {
    if (!rawDataCache.length) return;

    const el = document.documentElement;
    const getVar = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();
    const textColor = getVar('--el-text-color-primary');
    const borderColor = getVar('--el-border-color-lighter');

    const grid = {
        left: 50,
        right: 50,
        top: 50,
        bottom: 50
    };

    // 获取容器宽度用于计算图形
    const containerWidth = chartBoxRef.value?.clientWidth || 1000;
    const containerHeight = chartBoxRef.value?.clientHeight || 500;

    const gridWidth = containerWidth - grid.left - grid.right;
    const gridHeight = containerHeight - grid.top - grid.bottom;

    const categoryWidth = gridWidth / 24;
    const barWidth = categoryWidth * 0.6;
    const barPadding = (categoryWidth - barWidth) / 2;

    const series = cardTypeKeys.map((key, sid) => {
        return {
            name: cardTypeMap[key],
            type: 'bar',
            stack: 'total',
            barWidth: '60%',
            label: {
                show: false, // 太多了不显示标签，靠tooltip
            },
            data: rawDataCache[sid].map((d, did) =>
                totalDataCache[did] <= 0 ? 0 : d / totalDataCache[did]
            )
        };
    });

    const elements: any[] = [];
    for (let j = 1, jlen = 24; j < jlen; ++j) {
        const leftX = grid.left + categoryWidth * j - barPadding;
        const rightX = leftX + barPadding * 2;
        let leftY = grid.top + gridHeight;
        let rightY = leftY;

        for (let i = 0, len = series.length; i < len; ++i) {
            const points: number[][] = [];
            const leftVal = totalDataCache[j - 1] <= 0 ? 0 : (rawDataCache[i][j - 1] / totalDataCache[j - 1]);
            const rightVal = totalDataCache[j] <= 0 ? 0 : (rawDataCache[i][j] / totalDataCache[j]);

            const leftBarHeight = leftVal * gridHeight;
            const rightBarHeight = rightVal * gridHeight;

            points.push([leftX, leftY]);
            points.push([leftX, leftY - leftBarHeight]);

            points.push([rightX, rightY - rightBarHeight]);
            points.push([rightX, rightY]);
            points.push([leftX, leftY]);

            leftY -= leftBarHeight;
            rightY -= rightBarHeight;

            elements.push({
                type: 'polygon',
                shape: {
                    points
                },
                style: {
                    fill: colors[i % colors.length],
                    opacity: 0.25
                },
                silent: true
            });
        }
    }

    chartOption.value = {
        title: {
            text: '牌型趋势',
            left: 'center',
            textStyle: { color: textColor }
        },
        color: colors,
        tooltip: {
            trigger: 'axis',
            confine: true,
            backgroundColor: isDark.value ? 'rgba(0,0,0,0.7)' : '#fff',
            borderColor: borderColor,
            textStyle: { color: isDark.value ? '#fff' : '#333' },
            axisPointer: {
                type: 'shadow',
            },
            formatter: (params: any[]) => {
                let res = `${params[0].axisValue}点<br/>`;
                res += `总局数: ${totalDataCache[params[0].dataIndex]}<br/>`;
                params.forEach(item => {
                    const val = (item.value * 100).toFixed(1) + '%';
                    const count = rawDataCache[item.seriesIndex][item.dataIndex];
                    res += `${item.marker} ${item.seriesName}: ${count} (${val})<br/>`;
                });
                return res;
            }
        },
        legend: {
            data: cardTypeKeys.map(k => cardTypeMap[k]),
            type: 'scroll',
            bottom: 0,
            textStyle: { color: textColor }
        },
        grid,
        yAxis: {
            type: 'value',
            axisLabel: {
                formatter: (value: number) => (value * 100).toFixed(0) + '%',
                color: textColor
            },
            max: 1
        },
        xAxis: {
            type: 'category',
            data: Array.from({ length: 24 }, (_, i) => i + ''),
            axisLabel: {
                interval: 0,
                color: textColor
            }
        },
        series,
        graphic: {
            elements
        }
    };
}

function updateRankChart() {
    if (!rawDataCache.length) return;

    const el = document.documentElement;
    const getVar = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();
    const textColor = getVar('--el-text-color-primary');
    const borderColor = getVar('--el-border-color-lighter');

    const pieData = cardTypeKeys.map((key, i) => {
        const total = rawDataCache[i].reduce((sum, val) => sum + val, 0);
        return {
            name: cardTypeMap[key],
            value: total,
            itemStyle: {
                color: colors[i]
            }
        };
    });

    const grandTotal = pieData.reduce((sum, item) => sum + item.value, 0);
    const sortedData = [...pieData].sort((a, b) => b.value - a.value);

    barRankOption.value = {
        title: {
            text: '牌型排行',
            left: 'center',
            textStyle: { color: textColor }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            confine: true,
            backgroundColor: isDark.value ? 'rgba(0,0,0,0.7)' : '#fff',
            borderColor: borderColor,
            textStyle: { color: isDark.value ? '#fff' : '#333' },
        },
        grid: {
            left: '15%',
            right: '15%',
            top: 40,
            bottom: 20
        },
        xAxis: {
            type: 'value',
            show: false,
        },
        yAxis: {
            type: 'category',
            data: sortedData.map(i => i.name),
            inverse: true,
            axisLabel: { color: textColor },
            axisLine: { show: false },
            axisTick: { show: false },
        },
        series: [
            {
                type: 'bar',
                data: sortedData,
                label: {
                    show: true,
                    position: 'right',
                    formatter: (params: any) => {
                        const percent = grandTotal > 0 ? ((params.value / grandTotal) * 100).toFixed(2) + '%' : '0.00%';
                        return `${params.value} (${percent})`;
                    },
                    color: textColor
                },
                barWidth: '60%'
            }
        ]
    };
}

function updateCardCountChart(data: number[]) {
    if (!data || data.length === 0) {
        cardCountOption.value = {};
        return;
    }

    const el = document.documentElement;
    const getVar = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();
    const textColor = getVar('--el-text-color-primary');
    const borderColor = getVar('--el-border-color-lighter');

    const total = data.reduce((a, b) => a + b, 0);

    // 顺序参考: 0-3 (A♠, A♥, A♣, A♦), 4-7 (2♠, 2♥, 2♣, 2♦)...
    const rankMap = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const suitMap = ["♠", "♥", "♣", "♦"];

    // 4色配色：黑、红、绿、蓝
    const suitColors = [
        isDark.value ? '#E5EAF3' : '#303133', // ♠
        '#f56c6c', // ♥
        '#67c23a', // ♣
        '#409eff'  // ♦
    ];

    const seriesList: any[] = [];
    for (let s = 0; s < 4; s++) {
        const seriesData: number[] = [];
        for (let r = 0; r < 13; r++) {
            const idx = r * 4 + s;
            const val = data[idx] || 0;
            const prob = total > 0 ? (val / total) : 0;
            seriesData.push(prob);
        }
        seriesList.push({
            name: suitMap[s],
            type: 'bar',
            data: seriesData,
            itemStyle: {
                color: suitColors[s]
            },
            barGap: 0
        });
    }

    cardCountOption.value = {
        title: {
            text: '单张牌出现概率',
            left: 'center',
            textStyle: { color: textColor }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: isDark.value ? 'rgba(0,0,0,0.7)' : '#fff',
            borderColor: borderColor,
            textStyle: { color: isDark.value ? '#fff' : '#333' },
            formatter: (params: any[]) => {
                let res = `${params[0].axisValue}<br/>`;
                params.forEach(item => {
                    const val = (item.value * 100).toFixed(2) + '%';
                    const idx = item.dataIndex * 4 + item.seriesIndex;
                    const count = data[idx];
                    res += `${item.marker} ${item.seriesName}: ${val} (${count}次)<br/>`;
                });
                return res;
            }
        },
        legend: {
            data: suitMap,
            bottom: 0,
            textStyle: { color: textColor }
        },
        grid: {
            left: '3%',
            right: '3%',
            bottom: '10%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: rankMap,
            axisLabel: {
                interval: 0,
                color: textColor
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                formatter: (value: number) => (value * 100).toFixed(1) + '%',
                color: textColor
            }
        },
        series: seriesList
    };
}

let resizeObserver: ResizeObserver | null = null;
let observer: MutationObserver | null = null;

onMounted(() => {
    refresh();

    isDark.value = document.documentElement.classList.contains('dark');
    observer = new MutationObserver(() => {
        isDark.value = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    if (chartBoxRef.value) {
        resizeObserver = new ResizeObserver(() => {
            updateChart();
        });
        resizeObserver.observe(chartBoxRef.value);
    }
});

onUnmounted(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
    if (observer) {
        observer.disconnect();
    }
});

watch(isDark, () => {
    updateChart();
    updateRankChart();
    updateCardCountChart(cardCountCache);
});
</script>

<style lang="scss" scoped>
.view-sta-result-qznn {
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

    .chart-card {
        :deep(.el-card__body) {
            box-sizing: border-box;
        }
    }

    .chart-box {
        width: 100%;
        height: 500px;
    }
}
</style>