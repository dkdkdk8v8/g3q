<script setup>
import { onMounted, computed, onUnmounted, ref, watch } from 'vue';
import { useGameStore } from '../stores/game.js';
import PlayerSeat from '../components/PlayerSeat.vue';
import CoinLayer from '../components/CoinLayer.vue';
import DealingLayer from '../components/DealingLayer.vue'; 
import { useRouter, useRoute } from 'vue-router';

const store = useGameStore();
const router = useRouter();
const route = useRoute();
const coinLayer = ref(null);
const dealingLayer = ref(null); 
const seatRefs = ref({}); // 存储所有座位的引用 key: playerId
const tableCenterRef = ref(null); // 桌面中心元素引用

// 菜单和弹窗控制
const showMenu = ref(false);
const showHistory = ref(false);

// 控制每个玩家当前可见的手牌数量 (用于发牌动画)
const visibleCounts = ref({});

// 当前玩法模式名称
const modeName = computed(() => {
    const m = parseInt(route.query.mode);
    if (m === 0) return '不看牌抢庄';
    if (m === 1) return '看三张抢庄';
    return '看四张抢庄';
});

// 辅助函数：设置座位 Ref
const setSeatRef = (el, playerId) => {
    if (el) {
        seatRefs.value[playerId] = el.$el || el; 
    }
};

// 简单的布局计算：将玩家数组拆分为 自己 和 其他人
const myPlayer = computed(() => store.players.find(p => p.id === store.myPlayerId));
const otherPlayers = computed(() => {
    const meIndex = store.players.findIndex(p => p.id === store.myPlayerId);
    if (meIndex === -1) return [];
    const others = [];
    // 从自己下家开始顺时针找
    for(let i = 1; i < store.players.length; i++) {
        others.push(store.players[(meIndex + i) % store.players.length]);
    }
    return others;
});

// 计算对手的位置布局类型
const getLayoutType = (index) => {
    const totalOthers = otherPlayers.value.length;
    if (totalOthers === 4) {
        if (index === 0) return 'right'; // 右侧玩家
        if (index === 3) return 'left';  // 左侧玩家
    }
    return 'top'; // 顶部玩家
};

// 计算对手的位置 Class
const getOpponentClass = (index) => {
    const totalOthers = otherPlayers.value.length;
    if (totalOthers === 4) {
        if (index === 0) return 'seat-right';
        if (index === 1) return 'seat-right-top';
        if (index === 2) return 'seat-left-top';
        if (index === 3) return 'seat-left';
    }
    return '';
};

// 监听下注：玩家下注时，金币从玩家飞向中心
const lastBetStates = ref({});

watch(() => store.players.map(p => ({ id: p.id, bet: p.betMultiplier })), (newVals) => {
    if (!tableCenterRef.value || !coinLayer.value) return;
    
    const centerRect = tableCenterRef.value.getBoundingClientRect();

    newVals.forEach(p => {
        const oldBet = lastBetStates.value[p.id] || 0;
        if (oldBet === 0 && p.bet > 0) {
            const seatEl = seatRefs.value[p.id];
            if (seatEl) {
                const seatRect = seatEl.getBoundingClientRect();
                let count = 3 + (p.bet - 1) * 2;
                if (count > 15) count = 15;
                coinLayer.value.throwCoins(seatRect, centerRect, count); 
            }
        }
        lastBetStates.value[p.id] = p.bet;
    });
}, { deep: true });

// 监听游戏阶段，触发发牌动画及结算动画
watch(() => store.currentPhase, async (newPhase) => {
    if (newPhase === 'IDLE' || newPhase === 'GAME_OVER') {
        visibleCounts.value = {};
        lastBetStates.value = {};
    } else if (newPhase === 'ROB_BANKER') {
        // 确保状态清空 (防止直接从 GAME_OVER 跳过来时状态残留)
        visibleCounts.value = {};
        lastBetStates.value = {};
        
        setTimeout(() => {
             startDealingAnimation();
        }, 100);
    } else if (newPhase === 'SHOWDOWN') {
        setTimeout(() => {
             startDealingAnimation(true); 
        }, 100);
    }
    
    if (newPhase === 'SETTLEMENT' && tableCenterRef.value && coinLayer.value) {
        // 找到庄家位置
        const banker = store.players.find(p => p.isBanker);
        let bankerRect = null;
        if (banker) {
            const bankerEl = seatRefs.value[banker.id];
            if (bankerEl) bankerRect = bankerEl.getBoundingClientRect();
        }
        
        // 如果找不到庄家位置（理论上不应该），降级为使用中心点
        if (!bankerRect) {
            bankerRect = tableCenterRef.value.getBoundingClientRect();
        }
        
        // 1. 输家 -> 庄家
        store.players.forEach(p => {
            if (!p.isBanker && p.roundScore < 0) {
                const seatEl = seatRefs.value[p.id];
                if (seatEl) {
                    const seatRect = seatEl.getBoundingClientRect();
                    let count = Math.ceil(Math.abs(p.roundScore) / 20);
                    if (count < 5) count = 5;
                    if (count > 20) count = 20;
                    // 飞向庄家
                    coinLayer.value.throwCoins(seatRect, bankerRect, count);
                }
            }
        });

        // 2. 庄家 -> 赢家 (延迟执行)
        setTimeout(() => {
            store.players.forEach(p => {
                if (!p.isBanker && p.roundScore > 0) {
                    const seatEl = seatRefs.value[p.id];
                    if (seatEl) {
                        const seatRect = seatEl.getBoundingClientRect();
                        let count = Math.ceil(p.roundScore / 15);
                        if (count < 8) count = 8;
                        if (count > 30) count = 30;
                        // 从庄家飞向赢家
                        coinLayer.value.throwCoins(bankerRect, seatRect, count);
                    }
                }
            });
        }, 1200); // 增加延迟，让第一波飞完
    }
});

// 执行发牌动画
const startDealingAnimation = (isSupplemental = false) => {
    if (!dealingLayer.value) return;

    const targets = [];
    store.players.forEach(p => {
        if (!p.hand || p.hand.length === 0) return;
        
        const currentVisible = visibleCounts.value[p.id] || 0;
        const total = p.hand.length;
        const toDeal = total - currentVisible;

        if (toDeal > 0) {
            const seatEl = seatRefs.value[p.id];
            if (seatEl) {
                // 尝试获取 .hand-area 元素以获得更准确的 Y 轴位置
                const handArea = seatEl.querySelector('.hand-area');
                const rect = handArea ? handArea.getBoundingClientRect() : seatEl.getBoundingClientRect();
                
                // 判断是否是自己
                const isMe = p.id === store.myPlayerId;
                
                targets.push({
                    id: p.id,
                    x: rect.left + rect.width / 2, // 区域中心 X
                    y: rect.top + rect.height / 2, // 区域中心 Y
                    count: toDeal,
                    startIdx: currentVisible,
                    total: total,
                    isMe: isMe
                });
            }
        }
    });

    if (targets.length === 0) return;

    if (targets.length === 0) return;

    // 对每个玩家执行发牌 (并发或稍微错开)
    targets.forEach((t, pIndex) => {
        // 构建该玩家所有需要发的牌的位置信息
        const cardTargets = [];
        const scale = t.isMe ? 1 : 0.85; // 引入缩放比例
        const spacing = (t.isMe ? 40 : 20) * scale; // 调整间距
        const totalWidth = (t.total - 1) * spacing;
        const startX = t.x - (totalWidth / 2);

        for (let i = 0; i < t.count; i++) {
            const cardIndex = t.startIdx + i;
            const targetX = startX + cardIndex * spacing;
            cardTargets.push({ 
                x: targetX, 
                y: t.y, 
                isMe: t.isMe,
                scale: scale, // 传递缩放比例
                index: cardIndex
            });
        }

        // 稍微错开不同玩家的发牌时间 (比如每人间隔 0.08s)
        setTimeout(() => {
            dealingLayer.value.dealToPlayer(cardTargets, () => {
                // 回调：更新可见数量 (一次性加完，或者在 dealToPlayer 内部做更细致的回调)
                // 这里为了简单，动画做完后更新计数
                if (!visibleCounts.value[t.id]) visibleCounts.value[t.id] = 0;
                visibleCounts.value[t.id] += t.count;
            });
        }, pIndex * 80);
    });
};

onMounted(() => {
    const gameMode = route.query.mode !== undefined ? route.query.mode : 0;
    store.initGame(gameMode);
    setTimeout(() => {
        if(store.currentPhase === 'IDLE') store.startGame();
    }, 1000);
});

const onRob = (multiplier) => {
    store.playerRob(multiplier);
};

const onBet = (multiplier) => {
    store.playerBet(multiplier);
};

const openHistory = () => {
    console.log("Opening history modal");
    showMenu.value = false;
    showHistory.value = true;
};

const quitGame = () => {
    console.log("Quitting game, returning to lobby");
    router.replace('/lobby');
};
</script>

<template>
  <div class="game-table">
    <DealingLayer ref="dealingLayer" />
    <CoinLayer ref="coinLayer" />
    
    <!-- 顶部栏 -->
    <div class="top-bar">
        <div class="menu-container">
            <div class="menu-btn" @click.stop="showMenu = !showMenu">
                <van-icon name="wap-nav" size="20" color="white" />
                <span style="margin-left:4px;font-size:14px;">菜单</span>
            </div>
            <!-- 下拉菜单 -->
            <transition name="fade">
                <div v-if="showMenu" class="menu-dropdown" @click.stop>
                    <div class="menu-item" @click="openHistory">
                        <van-icon name="balance-list-o" /> 投注记录
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-item danger" @click="quitGame">
                        <van-icon name="close" /> 退出游戏
                    </div>
                </div>
            </transition>
        </div>

        <div class="room-info-box">
            <div>底分: 200</div>
            <div>模式: {{ modeName }}</div>
        </div>
    </div>

    <div class="opponents-layer">
        <PlayerSeat 
            v-for="(p, index) in otherPlayers" 
            :key="p.id" 
            :player="p" 
            :ref="(el) => setSeatRef(el, p.id)"
            class="opponent-seat-abs"
            :class="getOpponentClass(index)"
            :position="getLayoutType(index)"
            :visible-card-count="visibleCounts[p.id] !== undefined ? visibleCounts[p.id] : 0"
        />
    </div>

    <div class="table-center" ref="tableCenterRef">
        <!-- 闹钟和阶段提示信息的容器 -->
        <div v-if="store.countdown > 0 && ['ROB_BANKER', 'BETTING', 'SHOWDOWN'].includes(store.currentPhase)" class="clock-and-info-wrapper">
            <!-- 倒计时闹钟 -->
            <div class="alarm-clock">
                <div class="alarm-body">
                    <div class="alarm-time">{{ store.countdown < 10 ? '0' + store.countdown : store.countdown }}</div>
                </div>
                <div class="alarm-ears left"></div>
                <div class="alarm-ears right"></div>
            </div>

            <!-- 阶段提示信息，统一显示在倒计时下方并样式类似“结算中...” -->
            <div class="phase-info">
                <span v-if="store.currentPhase === 'ROB_BANKER'">看牌抢庄</span>
                <span v-else-if="store.currentPhase === 'BETTING'">闲家下注</span>
                <span v-else-if="store.currentPhase === 'SHOWDOWN'">摊牌比拼</span>
            </div>
        </div>

        <!-- 仅当闹钟不显示时，显示结算中 -->
        <div v-if="store.currentPhase === 'SETTLEMENT' && store.countdown === 0" class="phase-info settlement-info">结算中...</div>

        <!-- 重新开始按钮 -->
        <div v-if="store.currentPhase === 'GAME_OVER'" class="restart-btn" @click="store.startGame()">
            继续游戏
        </div>
    </div>

    <!-- 自己区域 -->

    <div class="my-area" v-if="myPlayer">
        <div class="controls-container">
            <div v-if="store.currentPhase === 'ROB_BANKER' && myPlayer.robMultiplier === -1" class="btn-group">
                <div class="game-btn blue" @click="onRob(0)">不抢</div>
                <div class="game-btn orange" @click="onRob(1)">1倍</div>
                <div class="game-btn orange" @click="onRob(2)">2倍</div>
                <div class="game-btn orange" @click="onRob(3)">3倍</div>
            </div>

            <div v-if="store.currentPhase === 'BETTING' && !myPlayer.isBanker && myPlayer.betMultiplier === 0" class="btn-group">
                <div class="game-btn orange" @click="onBet(1)">1倍</div>
                <div class="game-btn orange" @click="onBet(2)">2倍</div>
                <div class="game-btn orange" @click="onBet(5)">5倍</div>
            </div>
            
            <div v-if="myPlayer.robMultiplier > -1 && store.currentPhase === 'ROB_BANKER'" class="waiting-text">
                已选择，等待其他玩家...
            </div>
            <div v-if="myPlayer.betMultiplier > 0 && store.currentPhase === 'BETTING'" class="waiting-text">
                已下注，等待开牌...
            </div>
            
            <!-- 摊牌按钮 -->
            <div v-if="store.currentPhase === 'SHOWDOWN' && !myPlayer.isShowHand && store.countdown > 0" class="btn-group">
                <div class="game-btn orange" style="width: 100px" @click="store.playerShowHand(myPlayer.id)">摊牌</div>
            </div>
        </div>

        <PlayerSeat 
            :player="myPlayer" 
            :is-me="true" 
            :ref="(el) => setSeatRef(el, myPlayer.id)"
            position="bottom"
            :visible-card-count="visibleCounts[myPlayer.id] !== undefined ? visibleCounts[myPlayer.id] : 0"
        />
    </div>

    <!-- 全局点击关闭菜单 -->
    <div v-if="showMenu" class="mask-transparent" @click="showMenu = false"></div>

    <!-- 押注记录弹窗 -->
    <div v-if="showHistory" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3>投注记录</h3>
                <div class="close-icon" @click="showHistory = false">×</div>
            </div>
            <div class="history-list">
                <div v-if="store.history.length === 0" class="empty-tip">暂无记录</div>
                <div v-for="(item, idx) in store.history" :key="idx" class="history-item">
                    <div class="h-row top">
                        <span class="h-time">{{ new Date(item.timestamp).toLocaleTimeString() }}</span>
                        <span class="h-role" :class="{ banker: item.isBanker }">{{ item.isBanker ? '庄' : '闲' }}</span>
                    </div>
                    <div class="h-row main">
                        <span class="h-result" :class="item.score >= 0 ? 'win' : 'lose'">
                            {{ item.score >= 0 ? '赢' : '输' }}
                        </span>
                        <span class="h-score" :class="item.score >= 0 ? 'win' : 'lose'">
                            {{ item.score >= 0 ? '+' : '' }}{{ item.score }}
                        </span>
                        <span class="h-hand">{{ item.handType }}</span>
                    </div>
                    <div class="h-row bottom">
                        <span>余额: {{ item.balance }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.game-table {
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at center, #0d9488 0%, #115e59 100%);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: system-ui, sans-serif;
}

/* 菜单样式 */
.menu-container {
    position: relative;
    z-index: 200;
}
.menu-dropdown {
    position: absolute;
    top: 40px;
    left: 0;
    width: 140px;
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    overflow: hidden;
    animation: fadeIn 0.2s ease;
}
.menu-item {
    padding: 12px 16px;
    font-size: 14px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
}
.menu-item:active {
    background: rgba(255,255,255,0.1);
}
.menu-item.danger {
    color: #f87171;
}
.menu-divider {
    height: 1px;
    background: rgba(255,255,255,0.1);
    margin: 0 8px;
}
.mask-transparent {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 150;
}

/* 弹窗样式 */
.modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 2000;
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
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1);
}
.modal-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
}
.modal-header h3 { margin: 0; font-size: 18px; }
.close-icon { font-size: 24px; cursor: pointer; color: #94a3b8; }

.history-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
.empty-tip { text-align: center; color: #64748b; padding: 20px; }

.history-item {
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 10px;
    color: #cbd5e1;
    font-size: 12px;
}
.h-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.h-row.bottom { margin-bottom: 0; color: #64748b; }
.h-time { font-family: monospace; }
.h-role {
    background: #334155; padding: 2px 6px; border-radius: 4px; font-weight: bold;
}
.h-role.banker { background: #d97706; color: white; }
.h-score { font-size: 16px; font-weight: bold; }
.h-score.win { color: #facc15; }
.h-score.lose { color: #ef4444; }

.h-result { font-weight: bold; margin-right: 6px; }
.h-result.win { color: #facc15; }
.h-result.lose { color: #ef4444; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

/* 顶部栏 */
.top-bar {
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    z-index: 200;
}

.menu-btn {
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
    padding: 4px 8px;
    border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer;
    display: flex;
    align-items: center;
}

.room-info-box {
    background: linear-gradient(to bottom, rgba(13, 148, 136, 0.8), rgba(17, 94, 89, 0.8));
    border: 1px solid rgba(255,255,255,0.4);
    border-radius: 8px;
    padding: 4px 12px;
    color: #ccfbf1;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    text-align: right;
}

.opponents-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none; 
}

.opponent-seat-abs {
    position: absolute;
    pointer-events: auto;
    transform: scale(0.85); 
}

.seat-right {
    top: 45%; /* 向上调整位置 */
    right: 10px;
    transform: translateY(-50%) scale(0.85);
}

.seat-right-top {
    top: 15%;
    right: 15%;
}

.seat-left-top {
    top: 15%;
    left: 15%;
}

.seat-left {
    top: 45%; /* 向上调整位置 */
    left: 10px;
    transform: translateY(-50%) scale(0.85);
}

.table-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Removed gap: 10px; as it will be managed by clock-and-info-wrapper */
    width: 200px;
    min-height: 120px; /* 允许高度自适应，防止挤压 */
    height: auto;
    pointer-events: none;
    z-index: 1000; /* 确保在金币层之下，但需要在发牌层之上吗？不需要，只有闹钟需要 */
}

.clock-and-info-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px; /* This handles the 3px distance between clock and phase info */
    pointer-events: auto; /* Allow interaction with children if needed */
}

.alarm-clock {
    position: relative;
    width: 60px;
    height: 60px;
    /* pointer-events: auto; moved to wrapper */
    z-index: 1002; /* 必须高于发牌层(999) */
}
.alarm-body {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 30% 30%, #fff 0%, #e5e5e5 100%);
    border-radius: 50%;
    border: 4px solid #f97316;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    z-index: 2;
    position: relative;
}
.alarm-time {
    font-size: 24px;
    font-weight: bold;
    color: #333;
    font-family: monospace;
}
.alarm-ears {
    position: absolute;
    /* top: -6px; Removed to allow individual positioning */
    width: 16px;
    height: 16px;
    background: #f97316;
    border-radius: 50%;
    z-index: 1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.alarm-ears.left { top: -6px; left: 2px; transform: rotate(-15deg); } /* Keep original top for left ear */
.alarm-ears.right { top: -5px; right: -5px; transform: rotate(15deg); } /* Move right 5px, up 2px */

.phase-info {
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
    margin-top: 10px;
}

.phase-info.settlement-info { /* Added for the independent settlement info */
    margin-top: 10px; /* To maintain some distance from other elements if not in wrapper */
}

.phase-tip {
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
}

.my-area {
    margin-top: auto;
    padding-bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
    width: 100%;
}

.controls-container {
    margin-bottom: 20px;
    min-height: 50px;
    display: flex;
    justify-content: center;
    width: 100%;
}

.btn-group {
    display: flex;
    gap: 12px;
}

.game-btn {
    width: 70px;
    height: 36px;
    border-radius: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    font-size: 14px;
    color: white;
    box-shadow: 0 4px 0 rgba(0,0,0,0.2);
    cursor: pointer;
    transition: transform 0.1s;
}
.game-btn:active {
    transform: translateY(4px);
    box-shadow: none;
}
.game-btn.orange {
    background: linear-gradient(to bottom, #fbbf24, #d97706);
    border: 1px solid #f59e0b;
}
.game-btn.blue {
    background: linear-gradient(to bottom, #60a5fa, #2563eb);
    border: 1px solid #3b82f6;
}

.waiting-text {
    color: #cbd5e1;
    font-size: 14px;
    background: rgba(0,0,0,0.5);
    padding: 4px 12px;
    border-radius: 12px;
}

.restart-btn {
    pointer-events: auto;
    background: linear-gradient(to bottom, #22c55e, #15803d);
    color: white;
    font-size: 20px;
    font-weight: bold;
    padding: 10px 32px;
    border-radius: 25px;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.5);
    border: 2px solid rgba(255,255,255,0.3);
    cursor: pointer;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}
</style>