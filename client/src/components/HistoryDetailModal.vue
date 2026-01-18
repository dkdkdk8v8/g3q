<script setup>
import { computed } from 'vue';
import { useUserStore } from '../stores/user.js';
import { formatCoins } from '../utils/format.js';
import { transformServerCard, calculateHandType } from '../utils/bullfight.js';
import HistoryPokerCard from './HistoryPokerCard.vue';
import bankerIcon from '@/assets/common/zhuang.png';

// Import Bet History Images
import niu1 from '@/assets/bethistory/niu_1.png';
import niu2 from '@/assets/bethistory/niu_2.png';
import niu3 from '@/assets/bethistory/niu_3.png';
import niu4 from '@/assets/bethistory/niu_4.png';
import niu5 from '@/assets/bethistory/niu_5.png';
import niu6 from '@/assets/bethistory/niu_6.png';
import niu7 from '@/assets/bethistory/niu_7.png';
import niu8 from '@/assets/bethistory/niu_8.png';
import niu9 from '@/assets/bethistory/niu_9.png';
import niuNiu from '@/assets/bethistory/niu_niu.png';
import niuMei from '@/assets/bethistory/niu_mei.png';
import niuBoom from '@/assets/bethistory/niu_boom.png';
import niuWuhua from '@/assets/bethistory/niu_wuhua.png';
import niuWuxiao from '@/assets/bethistory/niu_wuxiao.png';
import niuSihua from '@/assets/bethistory/niu_sihua.png';

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

const getHandTypeImage = (type) => handTypeImages[type];

const props = defineProps({
    visible: Boolean,
    data: Object
});

const emit = defineEmits(['update:visible', 'close']);

const userStore = useUserStore();

const close = () => {
    emit('update:visible', false);
    emit('close');
};

const myId = computed(() => userStore.userInfo.user_id);

const summaryData = computed(() => {
    if (!props.data) return { total: 0, tax: 0, summary: 0 };

    // Check if we have my specific player data in the raw data
    // The props.data passed from HistoryModal should contain the simplified summary AND the raw details if possible
    // But HistoryModal constructs props.data from store.history.
    // I need to make sure HistoryModal passes the FULL 'rawItem' (the object from store.history item).

    // Assuming props.data IS the full raw item with 'score' being the BalanceChange

    const summary = props.data.score || 0;
    let total = summary;
    let tax = 0;

    if (summary > 0) {
        // Assume 5% tax. summary = total * 0.95 => total = summary / 0.95
        total = summary / 0.95;
        tax = total - summary;
    }

    return {
        total: total,
        tax: tax,
        summary: summary
    };
});

// Positioning Logic
const positionedPlayers = computed(() => {
    if (!props.data || !props.data.rawPlayers) return [];

    const players = props.data.rawPlayers;
    const myIndex = players.findIndex(p => p.ID === myId.value);
    const playerCount = 5; // Fixed 5 positions for UI

    // If myIndex is not found (shouldn't happen), assume 0
    const baseIndex = myIndex >= 0 ? myIndex : 0;

    // We want to map players to View Positions:
    // 0: Me (Bottom)
    // 1: Right (Mid Right)
    // 2: Top Right
    // 3: Top Left
    // 4: Left (Mid Left)

    // Formula: viewPos = (seatIndex - mySeatIndex + playerCount) % playerCount
    // This assumes seatIndices are 0..4. If server uses random IDs or non-sequential, we might need seat IDs.
    // Usually game logic provides 'Seat' index. Let's check rawPlayers data structure later.
    // If 'Seat' property exists, use it. If not, use array index?
    // Let's assume array index IS seat index for now or 'Seat' property is available.
    // If we just use array relative index:

    return players.map((p, idx) => {
        // Determine Seat Index. If p.Seat is available use it, else idx.
        // History data might not have Seat. If not, we can't position accurately relative to table.
        // But usually History data preserves player order or Seat.
        const seatIdx = (p.Seat !== undefined) ? p.Seat : idx;

        // Calculate relative view position
        // If we don't know MaxPlayers, assume 5.
        // Correct relative calculation:
        // (seatIdx - mySeatIdx + 5) % 5

        let mySeat = baseIndex;
        if (myIndex >= 0 && players[myIndex].Seat !== undefined) {
            mySeat = players[myIndex].Seat;
        }

        const diff = (seatIdx - mySeat + 5) % 5;

        // Map diff to visual position
        // Diff 0 -> Bottom (Me)
        // Diff 1 -> Right
        // Diff 2 -> Top Right
        // Diff 3 -> Top Left
        // Diff 4 -> Left

        // Prepare UI Cards
        let uiCards = [];
        let handTypeKey = 'NO_BULL';

        if (p.Cards && Array.isArray(p.Cards)) {
            // Transform cards
            const cardObjs = p.Cards.map(cId => transformServerCard(cId));

            // Calculate Type (to get sorted cards)
            const typeResult = calculateHandType(cardObjs);
            uiCards = typeResult.sortedCards;
            handTypeKey = typeResult.type;
        } else {
            // Placeholder back cards if hidden? Or usually history shows all.
            uiCards = [];
        }

        // Determine Banker
        // Try rawRoom.BankerID first, then rawRoom.Banker, then p.IsBanker
        let isBanker = false;
        if (props.data.rawRoom) {
            const r = props.data.rawRoom;
            const bId = (r.BankerID !== undefined) ? r.BankerID : r.Banker;
            if (bId !== undefined) {
                isBanker = (p.ID === bId);
            }
        }
        if (!isBanker && p.IsBanker) isBanker = true;

        // Helper to safely get number
        const getNum = (v, v2) => {
            if (v !== undefined && v !== null) return Number(v);
            if (v2 !== undefined && v2 !== null) return Number(v2);
            return 0;
        };

        return {

            ...p,

            viewPos: diff,

            uiCards,

            handTypeKey,

            isBanker: isBanker,

            BankerMulti: getNum(p.CallMult, p.robMultiplier),

            BetMulti: getNum(p.BetMult, p.betMultiplier),

            NickName: p.NickName || 'Unknown',

            isObserver: p.IsOb || false

        };

    });

});



</script>



<template>

    <div v-if="visible" class="detail-overlay" @click.stop="close">

        <div class="detail-content" @click.stop>

            <div class="detail-header">

                <div class="title-row">

                    <div class="detail-title">注单详情</div>

                    <div class="close-btn" @click="close">×</div>

                </div>

                <div class="summary-row">

                    <div class="sum-item">本局总输赢: <span :class="summaryData.total >= 0 ? 'win' : 'lose'">{{
                        formatCoins(summaryData.total) }}</span></div>

                    <div class="sum-item">税: {{ formatCoins(summaryData.tax) }}</div>

                    <div class="sum-item">汇总: <span :class="summaryData.summary >= 0 ? 'win' : 'lose'">{{
                        formatCoins(summaryData.summary) }}</span></div>

                </div>

            </div>



            <div class="visual-area">

                <div v-for="p in positionedPlayers" :key="p.ID" class="player-seat" :class="'pos-' + p.viewPos">

                    <template v-if="!p.isObserver">

                        <div class="multipliers-row">

                            <span v-if="p.BankerMulti > 0" class="rob-tag">抢{{ p.BankerMulti }}倍</span>

                            <span v-else-if="p.BankerMulti === 0" class="rob-tag" style="color: #cbd5e1;">不抢</span>

                            <span v-if="p.BetMulti > 0" class="bet-tag">押{{ p.BetMulti }}倍</span>

                            <span class="score-text" :class="(p.BalanceChange || 0) >= 0 ? 'win' : 'lose'">
                                ({{ (p.BalanceChange || 0) > 0 ? '+' : '' }}{{ formatCoins(p.BalanceChange || 0) }})
                            </span>

                        </div>



                        <div class="cards-row">



                            <div class="cards-container">



                                <HistoryPokerCard v-for="(card, cIdx) in p.uiCards" :key="cIdx" :card="card"
                                    :isSmall="true" :simplified="true" :mini="true" class="mini-card" />



                            </div>



                            <img v-if="getHandTypeImage(p.handTypeKey)" :src="getHandTypeImage(p.handTypeKey)"
                                class="niu-type-img" />

                        </div>



                        <div class="info-row">

                            <span class="nickname">{{ p.NickName }}</span>

                            <img v-if="p.isBanker" :src="bankerIcon" class="banker-icon" />

                        </div>

                    </template>

                </div>

            </div>

        </div>

    </div>

</template>

<style scoped>
.detail-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 9000;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    /* Bottom Sheet style or center? User said "from bottom appear a window". */
    /* Using center for now or bottom sheet? "appear a window from bottom" usually means BottomSheet. */
}

.detail-content {
    background: rgba(32, 35, 45, 1);
    width: 100%;
    height: 60vh;
    /* "Half the screen high" */
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
    }

    to {
        transform: translateY(0);
    }
}

.detail-header {
    padding: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
}

.title-row {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 15px;
}

.close-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    font-size: 24px;
    color: #94a3b8;
    cursor: pointer;
    line-height: 1;
    padding: 5px;
}

.summary-row {
    display: flex;
    justify-content: space-around;
    color: #cbd5e1;
    font-size: 13px;
    /* margin-bottom: 10px; removed */
}

.sum-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.win {
    color: #22c55e;
}

.lose {
    color: #ef4444;
}

.detail-title {
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    color: white;
}

.visual-area {
    flex: 1;
    position: relative;
    background: #1a1d26;
    /* Darker bg for table feel */
    overflow: hidden;
    /* No scroll, fixed positions */
}

/* Player Positions */
.player-seat {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 160px;
    /* Adjust based on card size */
}

/* 
  Pos 0: Bottom Center (Me)
  Pos 1: Mid Right
  Pos 2: Top Right
  Pos 3: Top Left
  Pos 4: Mid Left
*/

.pos-0 {
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
}

.pos-1 {
    top: 55%;
    right: 0;
    transform: translateY(-50%);
}

.pos-2 {
    top: 40px;
    right: 20px;
}

.pos-3 {
    top: 40px;
    left: 20px;
}

.pos-4 {
    top: 55%;
    left: 0;
    transform: translateY(-50%);
}

/* Content Styles */
.multipliers-row {
    margin-bottom: 4px;
    font-size: 12px;
    color: #ffd700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    display: flex;
    gap: 4px;
    justify-content: center;
}

.rob-tag {
    color: #ffab00;
}

.bet-tag {
    color: white;
    margin-left: 5px;
}

.score-text {
    margin-left: 5px;
}

.cards-row {
    position: relative;
    height: 40px;
    /* Compact height, cards overlap */
    width: 100px;
    /* Reduced width */
    display: flex;
    justify-content: center;
    margin-bottom: 13px;
    /* Space for overlay */
}

.cards-container {
    display: flex;
    justify-content: center;
    /* Overlap cards */
}

/* Override PokerCard styles to be even smaller if needed and overlap */
.mini-card {
    width: 30px !important;
    height: 42px !important;
    margin-left: -10px;
    /* Reduced overlap */
    box-shadow: -1px 0 2px rgba(0, 0, 0, 0.3);
}

.mini-card:first-child {
    margin-left: 0;
}

.niu-type-img {
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 60px;
    height: auto;
    z-index: 20;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.info-row {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.4);
    padding: 2px 8px;
    border-radius: 10px;
    margin-top: 4px;
    /* Reduced margin */
}

.nickname {
    font-size: 12px;
    color: white;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.banker-icon {
    width: 14px;
    height: 14px;
}

/* Specific adjustment for Pos 0 (Me) - make it slightly larger? */
.pos-0 .mini-card {
    width: 36px !important;
    height: 50px !important;
}
</style>
