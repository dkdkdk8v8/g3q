<template>
    <cl-dialog v-model="visible" title="资金记录" width="900px">
        <div v-if="list.length > 0" class="chart-container">
            <v-chart :option="chartOption" autoresize />
        </div>
        <div class="list" v-infinite-scroll="loadMore" :infinite-scroll-disabled="loading || finished">
            <el-timeline>
                <el-timeline-item v-for="(item, index) in list" :key="index" hide-timestamp>
                    <el-card shadow="hover" class="record-card">
                        <template #header>
                            <div class="card-header"
                                @click="item.record_type === RecordType.GAME ? item.expanded = !item.expanded : null"
                                :class="{ 'is-clickable': item.record_type === RecordType.GAME }">
                                <div class="left">
                                    <span class="time">{{ item.create_at }}</span>
                                    <el-tag :type="getRecordTypeInfo(item.record_type).type" effect="dark">
                                        {{ getRecordTypeInfo(item.record_type).label }}
                                    </el-tag>
                                </div>
                                <div class="right">
                                    <span class="label"></span>
                                    <span class="amount" :class="getBalanceChange(item) >= 0 ? 'plus' : 'minus'">
                                        {{ getBalanceChange(item) > 0 ? '+' : '' }}{{ (getBalanceChange(item) /
                                            100).toFixed(2) }}
                                    </span>
                                    <span class="label">余额:</span>
                                    <span class="balance">{{ (item.balance_after / 100).toFixed(2) }}</span>
                                    <el-icon v-if="item.record_type === RecordType.GAME" class="expand-icon"
                                        :class="{ 'is-expanded': item.expanded }">
                                        <ArrowRight />
                                    </el-icon>
                                </div>
                            </div>
                        </template>

                        <div v-show="item.expanded" v-if="item.record_type === RecordType.GAME && item.parsedGameData"
                            class="game-detail">
                            <div class="room-info">
                                <div class="tags">
                                    <el-tag size="small" type="danger" effect="plain">{{
                                        options.qznn_room_level.find(i => i.value ===
                                            item.parsedGameData.Room.Config.Level)?.label}}</el-tag>
                                    <el-tag size="small" type="warning" effect="plain">{{
                                        options.qznn_room_type.find(i => i.value ===
                                            item.parsedGameData.Room.Config.BankerType)?.label}}</el-tag>
                                </div>
                                <span class="room-id">{{ item.parsedGameData.Room.ID }}</span>
                            </div>

                            <div class="players-grid">
                                <div v-for="(player, pIndex) in item.parsedGameData.Room.Players" :key="pIndex"
                                    class="player-item" :class="{ 'is-me': player && player.ID === item.user_id }">
                                    <template v-if="player">
                                        <div class="p-header">
                                            <span class="name">{{ player.NickName || player.ID }}</span>
                                            <span v-if="player.ID === item.parsedGameData.Room.BankerID"
                                                class="banker-badge">庄</span>
                                            <span v-if="player.IsOb" class="watch-badge">看</span>
                                        </div>
                                        <div class="p-cards">
                                            <span v-for="(card, cIndex) in player.Cards" :key="cIndex"
                                                :style="{ color: getCardStyle(card).color }">{{ getCardStyle(card).text
                                                }}</span>
                                            <span class="card-result">{{ getCardResult(player.Cards) }}</span>
                                        </div>
                                        <div class="p-info">
                                            <span v-if="player.CallMult > 0">抢庄:{{ player.CallMult }}倍</span>
                                            <span v-if="player.BetMult > 0">下注:{{ player.BetMult }}倍</span>
                                        </div>
                                        <div class="p-balance" v-show="!player.IsOb"
                                            :class="player.BalanceChange >= 0 ? 'win' : 'lose'">
                                            {{ player.BalanceChange > 0 ? '+' : '' }}{{ (player.BalanceChange /
                                                100).toFixed(2) }}
                                        </div>
                                    </template>
                                    <div v-else class="empty-seat">空</div>
                                </div>
                            </div>
                        </div>
                    </el-card>
                </el-timeline-item>
            </el-timeline>

            <div v-if="loading" class="loading">加载中...</div>
            <div v-if="finished && list.length > 0" class="finished">没有更多了</div>
            <el-empty v-if="finished && list.length === 0" description="暂无记录" />
        </div>
    </cl-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useCool } from "/@/cool";
import { useDict } from '/$/dict';
import { getCardResult, getCardStyle } from "../utils/card";
import { ArrowRight } from "@element-plus/icons-vue";

const RecordType = {
    DEPOSIT: 0,
    WITHDRAW: 1,
    GAME: 2,
    ADMIN: 3,
};

const RecordTypeMap: any = {
    [RecordType.DEPOSIT]: { label: "充值", type: "primary" },
    [RecordType.WITHDRAW]: { label: "提现", type: "warning" },
    [RecordType.GAME]: { label: "游戏", type: "success" },
    [RecordType.ADMIN]: { label: "后台", type: "info" },
};

function getRecordTypeInfo(type: number) {
    return RecordTypeMap[type] || { label: "其他", type: "info" };
}

const { service } = useCool();
const { dict } = useDict();

const options = reactive({
    qznn_room_level: dict.get("qznn_room_level"),
    qznn_room_type: dict.get("qznn_room_type"),
});

const visible = ref(false);
const loading = ref(false);
const finished = ref(false);
const list = ref<any[]>([]);
const pagination = reactive({
    page: 1,
    size: 100,
    total: 0,
});
const userId = ref<any>(null);
const isDark = ref(false);

const chartOption = computed(() => {
    const data = [...list.value].reverse();
    const el = document.documentElement;
    const getVar = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();

    const textColor = getVar('--el-text-color-primary') || (isDark.value ? '#cfd3dc' : '#303133');
    const borderColor = getVar('--el-border-color-lighter') || (isDark.value ? '#414243' : '#ebeef5');

    return {
        grid: {
            left: '60',
            right: '20',
            top: '20',
            bottom: '40'
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark.value ? '#1d1e1f' : '#fff',
            borderColor: borderColor,
            textStyle: { color: textColor },
            formatter: (params: any) => {
                const item = data[params[0].dataIndex];
                return `${item.create_at}<br/>余额: ${(item.balance_after / 100).toFixed(2)}`;
            }
        },
        xAxis: {
            type: 'category',
            data: data.map((_, index) => index),
            axisLabel: { show: false },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: textColor,
                formatter: (val: number) => (val / 100).toFixed(2)
            },
            splitLine: {
                lineStyle: {
                    color: borderColor,
                    type: 'dashed'
                }
            }
        },
        dataZoom: [
            {
                type: 'inside',
                start: Math.max(0, 100 - (100 / data.length) * 100),
                end: 100
            },
            {
                type: 'slider',
                height: 18,
                bottom: 5,
                start: Math.max(0, 100 - (100 / data.length) * 100),
                end: 100,
                borderColor: 'transparent',
                backgroundColor: isDark.value ? '#333' : '#f4f4f4',
                fillerColor: 'rgba(64, 158, 255, 0.2)',
                handleStyle: {
                    color: '#409eff'
                },
                textStyle: { color: textColor },
                realtime: true
            }
        ],
        series: [{
            data: data.map(i => i.balance_after),
            type: 'line',
            smooth: true,
            symbol: 'none',
            itemStyle: { color: '#409eff' }
        }]
    };
});

let observer: MutationObserver | null = null;

onMounted(() => {
    isDark.value = document.documentElement.classList.contains('dark');
    observer = new MutationObserver(() => {
        isDark.value = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onUnmounted(() => {
    if (observer) observer.disconnect();
});

function open(row: any) {
    visible.value = true;
    userId.value = row.user_id;
    list.value = [];
    pagination.page = 1;
    finished.value = false;
    loadMore();
}

async function loadMore() {
    if (loading.value || finished.value) return;
    loading.value = true;

    try {
        const res = await service.game.user.pageUserRecords({
            page: pagination.page,
            size: pagination.size,
            user_id: userId.value,
        });

        const records = res.list.map((item: any) => {
            if (item.gameRecord && typeof item.gameRecord.game_data === 'string') {
                try {
                    item.parsedGameData = JSON.parse(item.gameRecord.game_data);
                } catch (e) {
                    console.error("Parse error", e);
                }
            }
            item.expanded = false;
            return item;
        });
        list.value.push(...records);
        pagination.total = res.pagination.total;

        if (list.value.length >= pagination.total) {
            finished.value = true;
        } else {
            pagination.page++;
        }
    } catch (e) {
        console.error(e);
        finished.value = true;
    } finally {
        loading.value = false;
    }
}

function getBalanceChange(item: any) {
    return item.balance_after - item.balance_before;
}

defineExpose({
    open,
});
</script>

<style lang="scss" scoped>
.chart-container {
    height: 200px;
    margin: 0 10px 10px 10px;
    padding: 10px;
    background: var(--el-fill-color-blank);
    border-radius: 4px;
    border: 1px solid var(--el-border-color-lighter);
}

.list {
    height: 60vh;
    overflow-y: auto;
    padding: 10px;

    .record-card {
        :deep(.el-card__header) {
            padding: 10px;
        }

        :deep(.el-card__body) {
            padding: 0;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: default;

            &.is-clickable {
                cursor: pointer;
            }

            .left {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 13px;
            }

            .right {
                font-size: 13px;

                .label {
                    color: var(--el-text-color-regular);
                    margin-left: 10px;
                }

                .amount {
                    font-weight: bold;

                    &.plus {
                        color: var(--el-color-success);
                    }

                    &.minus {
                        color: var(--el-color-danger);
                    }
                }

                .balance {
                    font-weight: bold;
                    margin-left: 5px;
                }

                .expand-icon {
                    margin-left: 10px;
                    transition: transform 0.3s;
                    font-size: 14px;

                    &.is-expanded {
                        transform: rotate(90deg);
                    }
                }
            }
        }

        .game-detail {
            padding: 10px;
        }

        .room-info {
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;

            .tags {
                display: flex;
                gap: 5px;
            }

            .room-id {
                font-size: 12px;
                color: var(--el-text-color-secondary);
            }
        }

        .players-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;

            .player-item {
                background: var(--el-fill-color-light);
                border-radius: 4px;
                padding: 8px;
                font-size: 12px;
                border: 1px solid transparent;

                &.is-me {
                    background: var(--el-color-primary-light-9);
                    border-color: var(--el-color-primary-light-5);
                }

                .p-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;

                    .name {
                        font-weight: bold;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .banker-badge {
                        background: var(--el-color-danger);
                        color: var(--el-color-white);
                        padding: 0 4px;
                        border-radius: 2px;
                        font-size: 10px;
                    }

                    .watch-badge {
                        background: var(--el-color-success);
                        color: var(--el-color-white);
                        padding: 0 4px;
                        border-radius: 2px;
                        font-size: 10px;
                    }
                }

                .p-cards {
                    margin-bottom: 4px;
                    white-space: nowrap;

                    span {
                        margin-right: 2px;
                        font-weight: bold;
                    }

                    .card-result {
                        margin-left: 4px;
                        color: var(--el-color-primary);
                    }
                }

                .p-info {
                    color: var(--el-text-color-secondary);
                    margin-bottom: 4px;
                    display: flex;
                    gap: 5px;
                }

                .p-balance {
                    font-weight: bold;
                    text-align: right;

                    &.win {
                        color: var(--el-color-success);
                    }

                    &.lose {
                        color: var(--el-color-danger);
                    }
                }
            }

            .empty-seat {
                text-align: center;
                color: var(--el-text-color-placeholder);
                padding: 20px 0;
            }
        }

        .game-data {
            color: var(--el-text-color-regular);
            font-size: 13px;
            flex: 1;
            word-break: break-all;
        }
    }

    .loading,
    .finished {
        text-align: center;
        padding: 10px;
        color: var(--el-text-color-secondary);
        font-size: 12px;
    }
}
</style>