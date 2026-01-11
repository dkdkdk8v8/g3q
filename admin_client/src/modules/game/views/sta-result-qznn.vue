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
import { reactive, ref, onMounted, onUnmounted, nextTick } from "vue";
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
    '#999999', // 无牛
    '#5470c6', // 牛一
    '#91cc75', // 牛二
    '#fac858', // 牛三
    '#ee6666', // 牛四
    '#73c0de', // 牛五
    '#3ba272', // 牛六
    '#fc8452', // 牛七
    '#9a60b4', // 牛八
    '#ea7ccc', // 牛九
    '#2f4554', // 牛牛
    '#61a0a8', // 五花牛
    '#d48265', // 炸弹牛
    '#749f83'  // 五小牛
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
    } catch (e) {
        console.error(e);
    }
}

function updateChart() {
    if (!rawDataCache.length) return;

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
            axisPointer: {
                type: 'shadow'
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
            bottom: 0
        },
        grid,
        yAxis: {
            type: 'value',
            axisLabel: {
                formatter: (value: number) => (value * 100).toFixed(0) + '%'
            },
            max: 1
        },
        xAxis: {
            type: 'category',
            data: Array.from({ length: 24 }, (_, i) => i + ''),
            axisLabel: {
                interval: 0
            }
        },
        series,
        graphic: {
            elements
        }
    };
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    refresh();
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
});
</script>

<style lang="scss" scoped>
.view-sta-result-qznn {
    padding: 10px;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;

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
        flex: 1;
        display: flex;
        flex-direction: column;

        :deep(.el-card__body) {
            height: 100%;
            box-sizing: border-box;
        }
    }

    .chart-box {
        width: 100%;
        height: 100%;
        min-height: 500px;
    }
}
</style>