<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useUserStore } from '../stores/user.js';
import { formatCoins } from '../utils/format.js';
import { transformServerCard, calculateHandType } from '../utils/bullfight.js';
import HistoryPokerCard from './HistoryPokerCard.vue';
import bankerIcon from '@/assets/common/zhuang.png';
import { showToast } from 'vant';

// ... (imports)

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

// Status images (Rob Banker qz_)
import qzBetNo from '@/assets/beishu/qz_bet_no.png';
import qzBet1 from '@/assets/beishu/qz_bet_1.png';
import qzBet2 from '@/assets/beishu/qz_bet_2.png';
import qzBet3 from '@/assets/beishu/qz_bet_3.png';
import qzBet4 from '@/assets/beishu/qz_bet_4.png';
import qzBet5 from '@/assets/beishu/qz_bet_5.png';
import qzBet10 from '@/assets/beishu/qz_bet_10.png';
import qzBet15 from '@/assets/beishu/qz_bet_15.png';
import qzBet20 from '@/assets/beishu/qz_bet_20.png';

// Status images (Betting ya_)
import yaBet1 from '@/assets/beishu/ya_bet_1.png';
import yaBet2 from '@/assets/beishu/ya_bet_2.png';
import yaBet3 from '@/assets/beishu/ya_bet_3.png';
import yaBet4 from '@/assets/beishu/ya_bet_4.png';
import yaBet5 from '@/assets/beishu/ya_bet_5.png';
import yaBet10 from '@/assets/beishu/ya_bet_10.png';
import yaBet15 from '@/assets/beishu/ya_bet_15.png';
import yaBet20 from '@/assets/beishu/ya_bet_20.png';

// Status Maps (qz_ / ya_)
const robStatusImageMap = {
    0: qzBetNo,
    1: qzBet1,
    2: qzBet2,
    3: qzBet3,
    4: qzBet4,
    5: qzBet5,
    10: qzBet10,
    15: qzBet15,
    20: qzBet20,
};

const betStatusImageMap = {
    1: yaBet1,
    2: yaBet2,
    3: yaBet3,
    4: yaBet4,
    5: yaBet5,
    10: yaBet10,
    15: yaBet15,
    20: yaBet20,
};

const getRobStatusImageUrl = (multiplier) => {
    return robStatusImageMap[multiplier] || null;
};

const getBetStatusImageUrl = (multiplier) => {
    return betStatusImageMap[multiplier] || null;
};

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

const visualAreaRef = ref(null);
const visualContentScale = ref(1);

const updateVisualScale = () => {
    if (!visualAreaRef.value) return;

    // Design reference: The layout works well at ~400px height for the visual area
    // (60vh of 844px is ~506px total, minus header ~100px = ~400px)
    const designHeight = 400;
    const currentHeight = visualAreaRef.value.clientHeight;

    if (currentHeight < designHeight) {
        visualContentScale.value = currentHeight / designHeight;
    } else {
        visualContentScale.value = 1;
    }
};

onMounted(() => {
    window.addEventListener('resize', updateVisualScale);
});

onUnmounted(() => {
    window.removeEventListener('resize', updateVisualScale);
});

watch(() => props.visible, (val) => {
    if (val) {
        nextTick(() => {
            updateVisualScale();
        });
    }
});

const emit = defineEmits(['update:visible', 'close']);

const userStore = useUserStore();

const close = () => {
    emit('update:visible', false);
    emit('close');
};

const myId = computed(() => userStore.userInfo.user_id);

const gameId = computed(() => {
    if (props.data && props.data.rawRoom) {
        // Try different casing or properties if needed, usually GameID or id
        return props.data.rawRoom.GameID || props.data.rawRoom.id;
    }
    return '';
});

const copyGameId = async () => {
    if (!gameId.value) return;
    const text = String(gameId.value);

    // Try Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('复制成功');
            return;
        } catch (err) {
            console.warn('Clipboard API failed, trying fallback...', err);
        }
    }

    // Fallback: execCommand
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Ensure it's not visible but part of the DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
            showToast('复制成功');
        } else {
            showToast('复制失败');
        }
    } catch (err) {
        console.error('Fallback copy failed', err);
        showToast('复制失败');
    }
};

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

const processNickname = (name) => {
    if (name.length <= 1) return name;

    const first = name.charAt(0);
    const last = name.charAt(name.length - 1);

    if (/^[\u4e00-\u9fa5]/.test(name)) {
        const starCount = Math.max(0, name.length - 2);
        return `${first}${'*'.repeat(starCount)}${last}`;
    } else {
        return `${first}******${last}`;
    }
};

// Positioning Logic
const positionedPlayers = computed(() => {
    // Default to empty array if no data
    const players = (props.data && props.data.rawPlayers) ? props.data.rawPlayers : [];

    // Find my index/seat
    const myIndex = players.findIndex(p => p.ID === myId.value);

    // If myIndex is not found (shouldn't happen), assume 0
    const baseIndex = myIndex >= 0 ? myIndex : 0;

    let mySeat = baseIndex;
    if (myIndex >= 0 && players[myIndex].Seat !== undefined) {
        mySeat = players[myIndex].Seat;
    }

    // Helper to process a player
    const processPlayer = (p, idx) => {
        const seatIdx = (p.Seat !== undefined) ? p.Seat : idx;
        const diff = (seatIdx - mySeat + 5) % 5;

        // Prepare UI Cards
        let uiCards = [];
        let handTypeKey = 'NO_BULL';

        if (p.Cards && Array.isArray(p.Cards)) {
            const cardObjs = p.Cards.map(cId => transformServerCard(cId));
            const typeResult = calculateHandType(cardObjs);
            uiCards = typeResult.sortedCards;
            handTypeKey = typeResult.type;
        } else {
            uiCards = [];
        }

        // Determine Banker
        let isBanker = false;
        if (props.data.rawRoom) {
            const r = props.data.rawRoom;
            const bId = (r.BankerID !== undefined) ? r.BankerID : r.Banker;
            if (bId !== undefined) {
                isBanker = (p.ID === bId);
            }
        }
        if (!isBanker && p.IsBanker) isBanker = true;

        const getNum = (v, v2) => {
            if (v !== undefined && v !== null) return Number(v);
            if (v2 !== undefined && v2 !== null) return Number(v2);
            return 0;
        };

        const processedNickName = p.ID === myId.value ? '您的手牌' : processNickname(p.NickName || 'Unknown');

        return {
            ...p,
            viewPos: diff,
            uiCards,
            handTypeKey,
            isBanker: isBanker,
            BankerMulti: getNum(p.CallMult, p.robMultiplier),
            BetMulti: getNum(p.BetMult, p.betMultiplier),
            NickName: processedNickName,
            isObserver: p.IsOb || false,
            isEmpty: false,
            isMe: p.ID === myId.value
        };
    };

    // Map existing players to their view positions
    const posMap = {};
    players.forEach((p, idx) => {
        const processed = processPlayer(p, idx);
        posMap[processed.viewPos] = processed;
    });

    // Fill all 5 positions
    const result = [];
    for (let i = 0; i < 5; i++) {
        if (posMap[i]) {
            result.push(posMap[i]);
        } else {
            // Empty Seat
            result.push({
                ID: `empty_${i}`,
                viewPos: i,
                isEmpty: true,
                isObserver: false,
                isMe: false
            });
        }
    }

    return result;
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

                <div class="game-id-row" v-if="gameId" @click="copyGameId">
                    <span>本局游戏ID：{{ gameId }}</span>
                    <span class="copy-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </span>
                </div>


                <div class="summary-row">

                    <div class="sum-item">总输赢: <span :class="summaryData.total >= 0 ? 'win' : 'lose'">{{
                        formatCoins(summaryData.total) }}</span></div>

                    <div class="sum-item">税: <span :class="summaryData.total >= 0 ? 'lose' : 'lno-tax'">{{
                        summaryData.tax > 0 ? '-' + formatCoins(summaryData.tax) : "0"
                            }}</span></div>

                    <div class="sum-item">汇总: <span :class="summaryData.summary >= 0 ? 'win' : 'lose'">{{
                        formatCoins(summaryData.summary) }}</span></div>

                </div>



            </div>



            <div class="visual-area" ref="visualAreaRef">
                <div class="visual-scale-wrapper" :style="{ transform: `scale(${visualContentScale})` }">

                    <div v-for="p in positionedPlayers" :key="p.ID" class="player-seat" :class="'pos-' + p.viewPos">

                        <template v-if="!p.isEmpty && !p.isObserver">


                            <div class="multipliers-row">

                                <img v-if="getRobStatusImageUrl(p.BankerMulti)"
                                    :src="getRobStatusImageUrl(p.BankerMulti)" class="status-img-small" />

                                <img v-if="getBetStatusImageUrl(p.BetMulti)" :src="getBetStatusImageUrl(p.BetMulti)"
                                    class="status-img-small" />

                                <span class="score-text" :class="(p.BalanceChange || 0) >= 0 ? 'win' : 'lose'">
                                    ({{ (p.BalanceChange || 0) > 0 ? '+' : '' }}{{ formatCoins(p.BalanceChange || 0) }})
                                </span>

                            </div>



                            <div class="cards-row">



                                <div class="cards-container">



                                    <HistoryPokerCard v-for="(card, cIdx) in p.uiCards" :key="cIdx" :card="card"
                                        :isSmall="true" :simplified="true" :mini="true" :largeIcons="p.isMe"
                                        class="mini-card" />



                                </div>



                                <img v-if="getHandTypeImage(p.handTypeKey)" :src="getHandTypeImage(p.handTypeKey)"
                                    class="niu-type-img" />

                            </div>



                            <div class="info-row" :class="{ 'me': p.isMe }">

                                <span class="nickname" :class="{ 'me': p.isMe }">{{ p.NickName }}</span>

                                <img v-if="p.isBanker" :src="bankerIcon" class="banker-icon" />

                            </div>

                        </template>
                        <template v-else>
                            <!-- Placeholder to align text with cards area -->
                            <div class="multipliers-row" style="opacity: 0; pointer-events: none;">
                                <div style="height: 20px;"></div>
                            </div>

                            <div class="cards-row" style="align-items: center; justify-content: center;">
                                <div class="empty-seat-msg">
                                    <div>空座</div>
                                </div>
                            </div>
                        </template>

                    </div>

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
}

.detail-content {
    background: #1a1d26;
    width: 100%;
    height: 60vh;
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
    margin-bottom: 10px;
}

.header-divider {
    height: 1px;
    background-color: rgba(255, 255, 255, 0.1);
    margin-bottom: 10px;
    width: 100%;
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
    margin-top: 10px;
    display: flex;
    width: 100%;
    color: #cbd5e1;
    font-size: 13px;
}

.sum-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 4px;
    font-weight: 500;
    font-size: 13px;
}

.win {
    color: #22c55e;
}

.lose {
    color: #ef4444;
}

.detail-title {
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    color: rgb(244, 168, 4);
}

.visual-area {
    flex: 1;
    position: relative;
    background: #1a1d26;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}

.visual-scale-wrapper {
    position: relative;
    width: 100%;
    height: 400px;
    /* Base design height */
    transform-origin: center center;
    transition: transform 0.2s;
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
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
}

.pos-1 {
    top: 50%;
    right: 0;
    transform: translateY(-50%);
}

.pos-2 {
    top: 16px;
    right: 20px;
}

.pos-3 {
    top: 16px;
    left: 20px;
}

.pos-4 {
    top: 50%;
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
    align-items: center;
    /* Ensure vertical alignment */
}

.status-img-small {
    height: 15px;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
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

.info-row.me {
    background: linear-gradient(180deg, #dcfce7 0%, #22c55e 100%);
}

.nickname {
    font-size: 12px;
    color: white;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.nickname.me {
    color: #000000;
    font-weight: bold;
}

@keyframes banker-scale-pulse {
    0% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.2);
    }

    100% {
        transform: scale(1);
    }
}

.banker-icon {
    width: 14px;
    height: 14px;
    animation: banker-scale-pulse 1.5s infinite ease-in-out;
    /* Apply the animation */
}

.empty-seat-msg {
    color: #aaaaaa;
    font-size: 10px;
    text-align: center;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50%;
    width: 50px;
    height: 50px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    line-height: 1.3;
}

/* Specific adjustment for Pos 0 (Me) - make it slightly larger? */
.pos-0 .mini-card {
    width: 36px !important;
    height: 50px !important;
}

.game-id-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #64748b;
    cursor: pointer;
    padding: 4px 0;
    transition: opacity 0.2s;
}

.game-id-row:active {
    opacity: 0.6;
}

.copy-icon {
    cursor: pointer;
    display: flex;
    align-items: center;
    color: #94a3b8;
}

.copy-icon:active {
    color: #ffffff;
}
</style>
