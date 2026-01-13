<script setup>
import { computed, ref, onMounted } from 'vue';
import { useGameStore } from '../stores/game.js';
import { useUserStore } from '../stores/user.js';
import { formatCoins } from '../utils/format.js';
import { transformServerCard, calculateHandType } from '../utils/bullfight.js';
import goldImg from '@/assets/common/gold.png';

const props = defineProps({
    visible: Boolean
});

const emit = defineEmits(['update:visible', 'close']);

const store = useGameStore();
const userStore = useUserStore();

const close = () => {
    emit('update:visible', false);
    emit('close');
};

// Date Filter Logic
const showFilterMenu = ref(false);
const filterType = ref('all'); // 'all', 'today', 'yesterday', 'week', 'custom'
const showDatePicker = ref(false);
const currentDate = ref([]); // Vant 4 DatePicker uses array of strings
const minDate = new Date(new Date().getFullYear() - 2, 0, 1);
const maxDate = new Date();

const filterLabel = computed(() => {
    if (filterType.value === 'all') return '全部';
    if (currentDate.value.length === 3) {
        return `${currentDate.value[0]}-${currentDate.value[1]}-${currentDate.value[2]}`;
    }
    return '自定义';
});

const toggleFilterMenu = () => {
    showFilterMenu.value = !showFilterMenu.value;
};

const selectFilter = (type) => {
    let dateStr = '';
    const now = new Date();

    if (type === 'custom') {
        if (currentDate.value.length === 0) {
            currentDate.value = [
                now.getFullYear().toString(),
                (now.getMonth() + 1).toString().padStart(2, '0'),
                now.getDate().toString().padStart(2, '0')
            ];
        }
        showDatePicker.value = true;
        // Do not fetch yet
    } else {
        // Assume 'all'
        filterType.value = type;
        dateStr = ''; // Empty string for All
        store.fetchHistory({ reset: true, date: dateStr });
    }

    if (typeof showFilterMenu !== 'undefined') {
        showFilterMenu.value = false;
    }
};

const onConfirmDate = ({ selectedValues }) => {
    currentDate.value = selectedValues;
    filterType.value = 'custom';
    showDatePicker.value = false;

    // selectedValues is [year, month, day] strings
    const [y, m, d] = selectedValues;
    // Ensure padding
    const dateStr = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
    store.fetchHistory({ reset: true, date: dateStr });
};

const onCancelDate = () => {
    showDatePicker.value = false;
};

// History Logic
const historyGrouped = computed(() => {
    const groups = [];
    let currentGroup = null;

    // Iterate through store.history which contains mixed Type 0 (Summary) and Type 1 (Record) items
    for (const item of store.history) {
        if (item.Type === 0) {
            // New Group Summary (Daily Header)
            currentGroup = {
                dateStr: item.Date, // e.g., "12月02周5"
                totalBet: item.TotalBet,
                totalValid: item.TotalWinBalance, 
                items: []
            };
            groups.push(currentGroup);
        } else if (item.Type === 1) {
            // Game Record Item
            if (!currentGroup) continue;

            const gdObj = item.GameDataObj;
            // The structure is GameDataObj -> Room -> Players
            // or sometimes direct if not nested (but based on log it is nested under Room)
            const roomData = gdObj.Room || gdObj;

            if (!roomData || !roomData.Players) continue;

            // Use myPlayerId from store or userStore
            const myId = store.myPlayerId === 'me' ? userStore.userInfo.user_id : store.myPlayerId;
            const myData = roomData.Players.find(p => p.ID === myId);
            // If not found, try userStore ID explicitly if store.myPlayerId might be stale/default
             const fallbackData = roomData.Players.find(p => p.ID === userStore.userInfo.user_id);
            
            const playerRec = myData || fallbackData;

            const bet = playerRec ? (playerRec.ValidBet || 0) : 0;
            const score = playerRec ? (playerRec.BalanceChange || 0) : 0; // Win/Loss

            // Calculate Hand Type
            let handTypeName = '未知';
            if (playerRec && playerRec.Cards && Array.isArray(playerRec.Cards)) {
                const cardObjs = playerRec.Cards.map(id => transformServerCard(id));
                const typeResult = calculateHandType(cardObjs);
                handTypeName = typeResult.typeName;
            } else if (roomData.State === 'StateBankerConfirm') {
                // If cards are not shown yet (incomplete game in history?), maybe show state
                handTypeName = '未摊牌';
            }

            // Room Name Construction
            let roomName = '抢庄牛牛';
            if (roomData.Config && roomData.Config.Name) {
                roomName += ` | ${roomData.Config.Name}`;
            }

            currentGroup.items.push({
                timestamp: item.CreateAt || item.Time, // GameStore uses CreateAt or Time depending on mapping
                roomName: roomName,
                handType: handTypeName,
                score: score, // This is Win/Loss
                bet: bet
            });
        }
    }

    return groups;
});

const formatHistoryTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${m}-${d} ${h}:${min}:${s}`;
};

const historyListRef = ref(null);

const handleHistoryScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
        if (!store.isLoadingHistory && !store.isHistoryEnd) {
            store.fetchHistory();
        }
    }
};

// Fetch initial data when visible
import { watch } from 'vue';
watch(() => props.visible, (val) => {
    if (val) {
        selectFilter('all');
    }
});
</script>

<template>
    <div v-if="visible" class="modal-overlay" style="z-index: 8000;">
        <div class="modal-content history-modal">
            <div class="modal-header">
                <h3>投注记录</h3>
                <div class="filter-chip" @click.stop="toggleFilterMenu">
                    {{ filterLabel }} <span class="down-triangle" :class="{ 'rotate-180': showFilterMenu }">▼</span>

                    <!-- Filter Menu -->
                    <div v-if="showFilterMenu" class="filter-menu" @click.stop>
                        <div class="filter-menu-item" :class="{ active: filterType === 'all' }"
                            @click="selectFilter('all')">全部</div>
                        <div class="filter-menu-item" :class="{ active: filterType === 'custom' }"
                            @click="selectFilter('custom')">自定义</div>
                    </div>
                </div>

                <div class="header-right">
                    <div class="close-icon" @click="close">×</div>
                </div>
            </div>

            <div class="history-list-new" ref="historyListRef" @scroll="handleHistoryScroll">
                <div v-if="!store.isLoadingHistory && historyGrouped.length === 0" class="empty-tip">暂无记录</div>

                <div v-for="group in historyGrouped" :key="group.dateStr" class="history-group">
                    <div class="group-header">
                        <div class="gh-date">{{ group.dateStr }} <span class="down-triangle">▼</span></div>
                        <div class="gh-totals">
                            投注 <span class="coin-amount-text">{{
                                formatCoins(group.totalBet) }}</span> &nbsp;
                            输赢 <span class="coin-amount-text">{{
                                formatCoins(group.totalValid) }}</span>
                        </div>
                    </div>

                    <div v-for="(item, idx) in group.items" :key="idx" class="history-card">
                        <div class="hc-content">
                            <div class="hc-top-row">
                                <span class="hc-title">{{ item.roomName }}</span>
                                <span class="hc-hand">
                                    {{ item.handType }}
                                </span>
                            </div>
                            <div class="hc-bottom-row">
                                <span class="hc-time">{{ formatHistoryTime(item.timestamp) }}</span>
                            </div>
                        </div>
                        <div class="hc-right">
                            <div class="hc-score" :class="item.score >= 0 ? 'win' : 'lose'">
                                {{ item.score > 0 ? '+' : '' }}{{ formatCoins(item.score) }}
                            </div>
                            <div class="hc-bet-amt">
                                投注: <img :src="goldImg" class="coin-icon-text" /><span class="coin-amount-text">{{
                                    formatCoins(item.bet)
                                }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="store.isLoadingHistory" class="loading-more">
                    <van-loading type="spinner" size="24px" color="#cbd5e1">加载中...</van-loading>
                </div>
                <div v-if="store.isHistoryEnd && historyGrouped.length > 0" class="loading-more"
                    style="color: #64748b; font-size: 13px;">
                    没有更多了
                </div>
            </div>

            <!-- Date Picker Popup -->
            <van-popup v-model:show="showDatePicker" position="bottom" :style="{ height: '40%' }" teleport="body"
                z-index="9000" class="dark-theme-popup">
                <van-date-picker v-model="currentDate" title="选择日期" :min-date="minDate" :max-date="maxDate"
                    @confirm="onConfirmDate" @cancel="onCancelDate" />
            </van-popup>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 8000;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.modal-content {
    width: 85%;
    max-width: 400px;
    max-height: 70vh;
    background: #1e293b;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
}

.close-icon {
    font-size: 24px;
    cursor: pointer;
    color: #94a3b8;
}

/* History Specific Styles */
.history-modal {
    height: 80vh;
}

.filter-chip {
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
}

.down-triangle {
    font-size: 10px;
    transition: transform 0.2s;
}

.rotate-180 {
    transform: rotate(180deg);
}

.filter-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: #334155;
    border-radius: 8px;
    overflow: hidden;
    min-width: 80px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 10;
}

.filter-menu-item {
    padding: 8px 12px;
    color: #cbd5e1;
    font-size: 12px;
}

.filter-menu-item.active {
    background: #475569;
    color: white;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 10px;
}

.history-list-new {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #1e293b;
}

.history-group {
    margin-bottom: 16px;
}

.group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #334155;
    padding: 8px 12px;
    border-radius: 8px 8px 0 0;
    font-size: 12px;
    color: #cbd5e1;
}

.gh-date {
    display: flex;
    align-items: center;
    gap: 4px;
}

.gh-totals {
    display: flex;
    gap: 8px;
}

.history-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-top: none;
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.history-card:last-child {
    border-radius: 0 0 8px 8px;
}

.hc-content {
    flex: 1;
}

.hc-top-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.hc-title {
    font-size: 13px;
    color: #f1f5f9;
    font-weight: bold;
}

.hc-hand {
    font-size: 12px;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 4px;
    border-radius: 4px;
}

.hc-bottom-row {
    font-size: 11px;
    color: #64748b;
}

.hc-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}

.hc-score {
    font-size: 16px;
    font-weight: bold;
}

.hc-score.win {
    color: #ef4444;
}

.hc-score.lose {
    color: #22c55e;
}

.hc-bet-amt {
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 2px;
}

.coin-icon-text {
    width: 12px;
    height: 12px;
}

.coin-amount-text {
    font-family: monospace;
}

.empty-tip {
    text-align: center;
    color: #64748b;
    padding: 40px;
}

.loading-more {
    text-align: center;
    padding: 10px;
    display: flex;
    justify-content: center;
}
</style>
