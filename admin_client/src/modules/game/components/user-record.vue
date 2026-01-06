<template>
    <cl-dialog v-model="visible" title="资金记录" width="800px">
        <div class="list" v-infinite-scroll="loadMore" :infinite-scroll-disabled="loading || finished">
            <el-timeline>
                <el-timeline-item v-for="(item, index) in list" :key="index" :timestamp="item.create_at"
                    placement="top">
                    <el-card shadow="hover">
                        <div class="row">
                            <el-tag :type="item.recordType === 'game' ? 'success' : 'info'" effect="dark">
                                {{ item.recordType }}
                            </el-tag>
                            <div v-if="item.recordType === 'game' && item.game_data" class="game-data">
                                {{ item.game_data }}
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
import { ref, reactive } from "vue";
import { useCool } from "/@/cool";

const { service } = useCool();

const visible = ref(false);
const loading = ref(false);
const finished = ref(false);
const list = ref<any[]>([]);
const pagination = reactive({
    page: 1,
    size: 50,
    total: 0,
});
const userId = ref<any>(null);

function open(row: any) {
    visible.value = true;
    userId.value = row.id;
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

        list.value.push(...res.list);
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

defineExpose({
    open,
});
</script>

<style lang="scss" scoped>
.list {
    height: 60vh;
    overflow-y: auto;
    padding: 10px;

    .row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        .game-data {
            color: #666;
            font-size: 13px;
            flex: 1;
            word-break: break-all;
        }
    }

    .loading,
    .finished {
        text-align: center;
        padding: 10px;
        color: #999;
        font-size: 12px;
    }
}
</style>