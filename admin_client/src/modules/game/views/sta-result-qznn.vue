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

        <el-card shadow="never" class="chart-card mb-10">
            <div class="chart-box" ref="chartBoxRef">
                <v-chart ref="chartRef" :option="chartOption" autoresize />
            </div>
        </el-card>

        <el-card shadow="never" class="chart-card mb-10">
            <el-row :gutter="20">
                <el-col :xs="24" :sm="24" :md="12" :lg="12">
                    <div class="chart-box">
                        <v-chart :option="barRankOption" autoresize />
                    </div>
                </el-col>
                <el-col :xs="24" :sm="24" :md="12" :lg="12">
                    <div class="chart-box">
                        <v-chart :option="multiplierOption" autoresize />
                    </div>
                </el-col>
            </el-row>
        </el-card>

        <el-card shadow="never" class="chart-card">
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
const multiplierOption = ref({});
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

// 牌型倍数
const cardMultipliers: Record<string, number> = {
    NiuNone: 1,
    NiuOne: 1,
    NiuTwo: 1,
    NiuThree: 1,
    NiuFour: 1,
    NiuFive: 1,
    NiuSix: 1,
    NiuSeven: 2,
    NiuEight: 2,
    NiuNine: 3,
    NiuNiu: 4,
    NiuFace: 6,
    NiuBomb: 8,
    NiuFiveSmall: 10,
};

// 颜色配置
const colors = [
    '#c6e2ff', // 无牛 (1倍)
    '#a0cfff', // 牛一 (1倍)
    '#79bbff', // 牛二 (1倍)
    '#53a8ff', // 牛三 (1倍)
    '#409eff', // 牛四 (1倍)
    '#337ecc', // 牛五 (1倍)
    '#215da6', // 牛六 (1倍)
    '#95d475', // 牛七 (2倍)
    '#67c23a', // 牛八 (2倍)
    '#e6a23c', // 牛九 (3倍)
    '#fa8c16', // 牛牛 (4倍)
    '#f56c6c', // 五花牛 (6倍)
    '#9c27b0', // 炸弹牛 (8倍)
    '#eb2f96'  // 五小牛 (10倍)
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
                let res = `${params[0].axisValue}<br/>`;
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
            data: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
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
            name: `${cardTypeMap[key]} (${cardMultipliers[key]}倍)`,
            value: total,
            itemStyle: {
                color: colors[i]
            }
        };
    });

    const grandTotal = pieData.reduce((sum, item) => sum + item.value, 0);
    const sortedData = [...pieData].sort((a, b) => b.value - a.value);

    // 计算倍数分布
    const multiplierTotals: Record<number, number> = {};
    const multiplierColors: Record<number, string> = {
        1: colors[4],  // 1倍 (蓝色系)
        2: colors[8],  // 2倍 (绿色系)
        3: colors[9],  // 3倍 (黄色)
        4: colors[10], // 4倍 (橙色)
        6: colors[11], // 6倍 (红色)
        8: colors[12], // 8倍 (紫色)
        10: colors[13] // 10倍 (粉色)
    };

    cardTypeKeys.forEach((key, i) => {
        const mult = cardMultipliers[key];
        const total = rawDataCache[i].reduce((sum, val) => sum + val, 0);
        multiplierTotals[mult] = (multiplierTotals[mult] || 0) + total;
    });

    const multiplierRankData = Object.entries(multiplierTotals)
        .map(([mult, value]) => ({
            name: `${mult}倍`,
            value,
            itemStyle: { color: multiplierColors[Number(mult)] }
        }))
        .sort((a, b) => b.value - a.value);

    multiplierOption.value = {
        title: [
            {
                text: '倍数占比',
                left: 'center',
                textStyle: { color: textColor }
            },
            {
                text: grandTotal.toLocaleString(),
                subtext: '总局数',
                left: 'center',
                top: '43%',
                textStyle: { fontSize: 22, fontWeight: 'bold', color: textColor },
                subtextStyle: { fontSize: 14, color: textColor }
            }
        ],
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)',
            backgroundColor: isDark.value ? 'rgba(0,0,0,0.7)' : '#fff',
            borderColor: borderColor,
            textStyle: { color: isDark.value ? '#fff' : '#333' },
        },
        legend: {
            type: 'scroll',
            bottom: 0,
            textStyle: { color: textColor }
        },
        series: [
            {
                type: 'pie',
                radius: ['45%', '70%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: isDark.value ? '#1d1e1f' : '#fff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    position: 'outside',
                    formatter: '{b}: {d}%',
                    color: textColor
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: '14',
                        fontWeight: 'bold'
                    }
                },
                data: multiplierRankData
            }
        ]
    };

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
            left: 110,
            right: 90,
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
    const suitMap = ["♠️", "♥️", "♣️", "♦️"];

    // 现代化色系：黑(黑桃)、红(红桃)、绿(草花)、蓝(方块)
    const suitColors = [
        '#303133', // ♠ 黑桃 (深碳灰)
        '#f56c6c', // ♥ 红桃 (柔和红)
        '#67c23a', // ♣ 草花 (清新绿)
        '#409eff'  // ♦ 方块 (专业蓝)
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
                color: suitColors[s],
                borderRadius: [4, 4, 0, 0]
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
                formatter: (value: number) => (value * 100).toFixed(2) + '%',
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