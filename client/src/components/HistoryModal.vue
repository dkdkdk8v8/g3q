<script setup>
import { computed, ref, onMounted } from 'vue';
import { useGameStore } from '../stores/game.js';
import { useUserStore } from '../stores/user.js';
import { formatCoins } from '../utils/format.js';
import { transformServerCard, calculateHandType } from '../utils/bullfight.js';
import goldImg from '@/assets/common/gold.png';
import menuBetHistoryImg from '@/assets/common/menu_bet_history.png';

// Import Bet History Images
import niu1 from '@/assets/niu/niu_1.png';
import niu2 from '@/assets/niu/niu_2.png';
import niu3 from '@/assets/niu/niu_3.png';
import niu4 from '@/assets/niu/niu_4.png';
import niu5 from '@/assets/niu/niu_5.png';
import niu6 from '@/assets/niu/niu_6.png';
import niu7 from '@/assets/niu/niu_7.png';
import niu8 from '@/assets/niu/niu_8.png';
import niu9 from '@/assets/niu/niu_9.png';
import niuNiu from '@/assets/niu/niu_niu.png';
import niuMei from '@/assets/niu/niu_mei.png';
import niuBoom from '@/assets/niu/niu_boom.png';
import niuWuhua from '@/assets/niu/niu_wuhua.png';
import niuWuxiao from '@/assets/niu/niu_wuxiao.png';
import niuSihua from '@/assets/niu/niu_sihua.png';

import roomChuji from '@/assets/bethistory/room_chuji.png';
import roomGaoji from '@/assets/bethistory/room_gaoji.png';
import roomTiyan from '@/assets/bethistory/room_tiyan.png';
import roomDashi from '@/assets/bethistory/room_dashi.png';
import roomZhongji from '@/assets/bethistory/room_zhongji.png';
import roomDianfeng from '@/assets/bethistory/room_dianfeng.png';
import HistoryDetailModal from './HistoryDetailModal.vue';
import { AudioUtils } from '../utils/audio.js';
import btnClickSound from '@/assets/sounds/btn_click.mp3';
import { useSettingsStore } from '../stores/settings.js';

const handTypeImages = {
    'BULL_1': niu1,
    'BULL_2': niu2,
    'BULL_3': niu3,
    'BULL_4': niu4,
    'BULL_5': niu5,
    'BULL_6': niu6,
    'BULL_7': niu7,
    'BULL_8': niu8,
    'BULL_9': niu9,
    'BULL_BULL': niuNiu,
    'NO_BULL': niuMei,
    'BOMB': niuBoom,
    'FIVE_FLOWER': niuWuhua,
    'FIVE_SMALL': niuWuxiao,
    'FOUR_FLOWER': niuSihua
};

const roomLevelImages = {
    '初级场': roomChuji,
    '高级场': roomGaoji,
    '体验场': roomTiyan,
    '大师场': roomDashi,
    '中级场': roomZhongji,
    '中级场': roomZhongji,
    '巅峰场': roomDianfeng
};

const getHandTypeImage = (type) => handTypeImages[type];
const getRoomLevelImage = (name) => {
    if (!name) return null;
    return roomLevelImages[name] || roomLevelImages[name.trim()];
};

const props = defineProps({
    visible: Boolean
});

const emit = defineEmits(['update:visible', 'close']);

const store = useGameStore();
const userStore = useUserStore();
const settingsStore = useSettingsStore();

const showDetail = ref(false);
const currentDetailItem = ref(null);

const openDetail = (item) => {
    if (settingsStore.soundEnabled) {
        AudioUtils.playEffect(btnClickSound);
    }
    currentDetailItem.value = item;
    showDetail.value = true;
};

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
            let handTypeKey = ''; // For Image
            if (playerRec && playerRec.Cards && Array.isArray(playerRec.Cards)) {
                const cardObjs = playerRec.Cards.map(id => transformServerCard(id));
                const typeResult = calculateHandType(cardObjs);
                handTypeName = typeResult.typeName;
                handTypeKey = typeResult.type;
            } else if (roomData.State === 'StateBankerConfirm') {
                // If cards are not shown yet (incomplete game in history?), maybe show state
                handTypeName = '未摊牌';
            }

            // Room Name Construction
            let roomModeText = '抢庄牛牛';
            let roomLevelName = '';

            if (roomData.Config) {
                const bt = roomData.Config.BankerType;
                if (bt === 0) roomModeText = '不看牌';
                else if (bt === 1) roomModeText = '看三张';
                else if (bt === 2) roomModeText = '看四张';

                if (roomData.Config.Name) {
                    roomLevelName = roomData.Config.Name;
                }
            }

            // Fallback for roomName text (legacy support if needed, or constructed display)
            const roomName = roomLevelName ? `${roomModeText} | ${roomLevelName}` : roomModeText;

            currentGroup.items.push({
                timestamp: item.CreateAt || item.Time, // GameStore uses CreateAt or Time depending on mapping
                roomName: roomName, // Keep full string as fallback or title
                roomModeText: roomModeText,
                roomLevelName: roomLevelName,
                handType: handTypeName,
                handTypeKey: handTypeKey,
                score: score, // This is Win/Loss
                bet: bet,
                rawPlayers: roomData.Players,
                rawRoom: roomData
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
    <div v-if="visible" class="modal-overlay" style="z-index: 8500;" @click="close">
        <div class="modal-content history-modal" @click.stop>
            <div class="modal-header">
                <div class="modal-header-top">
                    <div class="modal-header-left-spacer"></div>
                    <img :src="menuBetHistoryImg" alt="投注记录" class="modal-title-img" />
                    <div class="modal-header-right">
                        <div class="close-icon" @click="close">×</div>
                    </div>
                </div>

                <div class="modal-header-bottom">
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
                    <span class="hint-text">点击记录查看详情</span>
                </div>
            </div>

            <div class="history-list-new" ref="historyListRef" @scroll="handleHistoryScroll">
                <div v-if="!store.isLoadingHistory && historyGrouped.length === 0" class="empty-tip">暂无记录</div>

                <div v-for="group in historyGrouped" :key="group.dateStr" class="history-group">
                    <div class="group-header">
                        <div class="gh-date">{{ group.dateStr }} </div>
                        <div class="gh-totals">
                            投注 <span class="coin-amount-text">{{
                                formatCoins(group.totalBet) }}</span> &nbsp;
                            输赢 <span class="coin-amount-text">{{
                                formatCoins(group.totalValid) }}</span>
                        </div>
                    </div>

                    <div v-for="(item, idx) in group.items" :key="idx" class="history-card" @click="openDetail(item)">
                        <div class="hc-content">
                            <div class="hc-top-row">
                                <span class="hc-title">
                                    {{ item.roomModeText }}
                                    <img v-if="getRoomLevelImage(item.roomLevelName)"
                                        :src="getRoomLevelImage(item.roomLevelName)" class="room-level-img" />
                                    <span v-else-if="item.roomLevelName"> | {{ item.roomLevelName }}</span>
                                </span>
                                <div class="hand-container">
                                    <img v-if="getHandTypeImage(item.handTypeKey)"
                                        :src="getHandTypeImage(item.handTypeKey)" class="hand-type-img" />
                                    <span v-else class="hc-hand">
                                        {{ item.handType }}
                                    </span>
                                </div>
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

        <HistoryDetailModal v-model:visible="showDetail" :data="currentDetailItem" />
    </div>
</template>

<style scoped>
::v-deep(.van-picker) {
    background-color: red;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 8500;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.modal-content {
    width: 85%;
    max-width: 400px;
    max-height: 70vh;
    background: rgba(32, 35, 45, 1);
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
    flex-direction: column;
    gap: 10px;
    color: white;
}

.modal-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.modal-header-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 10px;
}

.hint-text {
    font-size: 13px;
    color: #505d6f;
    font-weight: bold;
}

/* New styles for the modal header title image and layout */
.modal-header-left-spacer,
.modal-header-right {
    flex: 1;
    /* Take up available space to push title image to center */
    display: flex;
    align-items: center;
}

.modal-header-left-spacer {
    /* For alignment, can be empty or used for other left-aligned elements */
}

.modal-header-right {
    justify-content: flex-end;
    /* Push content to the right */
}

.modal-title-img {
    width: auto;
    height: 33px;
    /* Adjust width to fit nicely */

    object-fit: contain;
    flex-shrink: 0;
    /* Prevent image from shrinking */
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
    background: #2c333d;
    padding: 4px 12px;
    border-radius: 4px;
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
    border-radius: 10px;
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
}

.group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(32, 35, 45, 1);
    padding: 10px 15px;
    border-radius: 8px 8px 0 0;
    font-size: 12px;
    color: #cbd5e1;
    position: sticky;
    top: 0;
    z-index: 5;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
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
    border-radius: 10px;
    margin: 8px 10px;
    background: rgba(38, 43, 58, 1);
    border-top: none;
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 1px 1px 1px 1px #16161633;
}

.hc-content {
    flex: 1;
}

.hc-top-row {
    display: flex;
    justify-content: flex-start;
    /* Spread title and hand result */
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.room-level-img {
    height: 15px;
    vertical-align: middle;
    margin-left: 4px;
}

.hand-container {
    display: flex;
    align-items: center;
}

.hand-type-img {
    height: 18px;
    /* Slightly larger for visibility */
    object-fit: contain;
}

.hc-title {
    font-size: 15px;
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

.hc-time {
    font-size: 11px;
    color: #94a3b8;
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
    color: #22c55e;
}

.hc-score.lose {
    color: #ef4444;
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

/* DatePicker Dark Theme Overrides */
:deep(.van-picker__columns) {
    background-color: rgba(38, 43, 58, 1);
}

:deep(.van-picker) {
    background-color: rgba(32, 35, 45, 1);
}
</style>
