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
            <div class="filter-row mt-10">
                <el-radio-group v-model="userType" @change="refresh">
                    <el-radio-button label="all">全部</el-radio-button>
                    <el-radio-button label="real">真实用户</el-radio-button>
                    <el-radio-button label="robot">机器人</el-radio-button>
                </el-radio-group>
            </div>
        </el-card>

        <el-card shadow="never" class="chart-card mb-10">
            <el-row :gutter="20">
                <el-col :span="12">
                    <div class="chart-box">
                        <v-chart :option="pieOption" autoresize />
                    </div>
                </el-col>
                <el-col :span="12">
                    <div class="chart-box">
                        <v-chart :option="barRankOption" autoresize />
                    </div>
                </el-col>
            </el-row>
        </el-card>

        <el-card shadow="never" class="chart-card">
            <div class="chart-box" ref="chartBoxRef">
                <v-chart ref="chartRef" :option="chartOption" autoresize />
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
const userType = ref("all");

const chartRef = ref();
const chartBoxRef = ref();
const chartOption = ref({});
const pieOption = ref({});
const barRankOption = ref({});
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

async function refresh() {
    try {
        const res = await service.game.staPeriod.getCardResultStats({
            date: date.value,
            app: appId.value,
            userType: userType.value
        });

        // 转换数据格式
        // res 是长度24的数组，每个元素是对象 { NiuNone: 10, ... }
        // rawData 需要是 [SeriesIndex][HourIndex]
        const data = res || [];

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
        updatePieChart();
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

function updatePieChart() {
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

    pieOption.value = {
        title: {
            text: '牌型分布',
            left: 'center',
            textStyle: { color: textColor }
        },
        tooltip: {
            trigger: 'item',
            confine: true
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            textStyle: { color: textColor }
        },
        series: [
            {
                name: '牌型',
                type: 'pie',
                radius: '50%',
                data: pieData,
                label: {
                    show: false,
                    formatter: '{b}: {d}%'
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
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
    updatePieChart();
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