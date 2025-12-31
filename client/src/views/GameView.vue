<script setup>
import { onMounted, computed, onUnmounted, ref, watch } from 'vue';
import { useGameStore } from '../stores/game.js';
import PlayerSeat from '../components/PlayerSeat.vue';
import CoinLayer from '../components/CoinLayer.vue';
import { useRouter } from 'vue-router';

const store = useGameStore();
const router = useRouter();
const coinLayer = ref(null);
const seatRefs = ref({}); // 存储所有座位的引用 key: playerId
const tableCenterRef = ref(null); // 桌面中心元素引用

// 辅助函数：设置座位 Ref
const setSeatRef = (el, playerId) => {
    if (el) {
        // PlayerSeat 是组件，我们需要它的根 DOM 元素
        // 如果 PlayerSeat 没有 expose $el，我们可以通过 $el 属性获取（Vue 3 组件实例通常有 $el）
        // 或者给 PlayerSeat 组件根 div 加 ref
        seatRefs.value[playerId] = el.$el || el; 
    }
};

// 简单的布局计算：将玩家数组拆分为 自己、左、上、右
const myPlayer = computed(() => store.players.find(p => p.id === store.myPlayerId));
const otherPlayers = computed(() => {
    const meIndex = store.players.findIndex(p => p.id === store.myPlayerId);
    if (meIndex === -1) return [];
    const others = [];
    for(let i = 1; i < store.players.length; i++) {
        others.push(store.players[(meIndex + i) % store.players.length]);
    }
    return others;
});
const topPlayers = computed(() => otherPlayers.value); 

// 监听下注：玩家下注时，金币从玩家飞向中心
// 记录上一次的下注状态，防止重复触发
const lastBetStates = ref({});

watch(() => store.players.map(p => ({ id: p.id, bet: p.betMultiplier })), (newVals) => {
    if (!tableCenterRef.value || !coinLayer.value) return;
    
    const centerRect = tableCenterRef.value.getBoundingClientRect();

    newVals.forEach(p => {
        const oldBet = lastBetStates.value[p.id] || 0;
        // 如果下注倍数从 0 变为 > 0，说明下注了
        if (oldBet === 0 && p.bet > 0) {
            const seatEl = seatRefs.value[p.id];
            if (seatEl) {
                const seatRect = seatEl.getBoundingClientRect();
                
                // 动态计算金币数量：基础 3 个，每多 1 倍增加 2 个，上限 15 个
                let count = 3 + (p.bet - 1) * 2;
                if (count > 15) count = 15;

                // 播放动画：玩家 -> 中心
                coinLayer.value.throwCoins(seatRect, centerRect, count); 
            }
        }
        lastBetStates.value[p.id] = p.bet;
    });
}, { deep: true });

// 监听结算：结算开始时，金币流动
// 1. 输家 -> 中心
// 2. 中心 -> 赢家
watch(() => store.currentPhase, (newPhase) => {
    if (newPhase === 'SETTLEMENT' && tableCenterRef.value && coinLayer.value) {
        const centerRect = tableCenterRef.value.getBoundingClientRect();
        
        // 1. 输家给钱 (立即执行)
        store.players.forEach(p => {
            if (p.roundScore < 0) {
                const seatEl = seatRefs.value[p.id];
                if (seatEl) {
                    const seatRect = seatEl.getBoundingClientRect();
                    
                    // 根据输的分数计算金币数量
                    // 假设底分 100，输 100 分飞 5 个，输 500 分飞 10 个，上限 20
                    let count = Math.ceil(Math.abs(p.roundScore) / 20); // 粗略估算
                    if (count < 5) count = 5;
                    if (count > 20) count = 20;

                    coinLayer.value.throwCoins(seatRect, centerRect, count);
                }
            }
        });

        // 2. 赢家收钱 (延迟 0.8秒 执行)
        setTimeout(() => {
            store.players.forEach(p => {
                if (p.roundScore > 0) {
                    const seatEl = seatRefs.value[p.id];
                    if (seatEl) {
                        const seatRect = seatEl.getBoundingClientRect();
                        
                        // 赢家拿到的金币稍微多一点，更有满足感
                        let count = Math.ceil(p.roundScore / 15);
                        if (count < 8) count = 8;
                        if (count > 30) count = 30; // 爆金币特效上限

                        // 动画：中心 -> 赢家
                        coinLayer.value.throwCoins(centerRect, seatRect, count);
                    }
                }
            });
        }, 800);
    } else if (newPhase === 'IDLE') {
        // 重置下注状态记录，为下一局做准备
        lastBetStates.value = {};
    }
});

onMounted(() => {
    store.initGame();
    setTimeout(() => {
        if(store.currentPhase === 'IDLE') store.startGame();
    }, 1000);
});

onUnmounted(() => {
});

const onRob = (multiplier) => {
    store.playerRob(multiplier);
};

const onBet = (multiplier) => {
    store.playerBet(multiplier);
};

const quitGame = () => {
    router.push('/');
};
</script>

<template>
  <div class="game-table">
    <!-- 金币动画层 -->
    <CoinLayer ref="coinLayer" />

    <!-- 顶部栏 -->
    <div class="top-bar">
        <div class="menu-btn" @click="quitGame">
             <van-icon name="wap-nav" size="24" color="white" />
        </div>
        <div class="room-info-box">
            <div>底分: 200</div>
            <div>模式: 初级房</div>
        </div>
    </div>

    <!-- 其他玩家区域 -->
    <div class="opponents">
        <PlayerSeat 
            v-for="p in topPlayers" 
            :key="p.id" 
            :player="p" 
            :ref="(el) => setSeatRef(el, p.id)"
            class="opponent-seat"
        />
    </div>

    <!-- 桌面中心信息 (作为金币飞行的中转点) -->
    <div class="table-center" ref="tableCenterRef">
        <!-- 倒计时闹钟 -->
        <div class="alarm-clock" v-if="store.countdown > 0">
            <div class="alarm-body">
                <div class="alarm-time">{{ store.countdown < 10 ? '0' + store.countdown : store.countdown }}</div>
            </div>
            <div class="alarm-ears left"></div>
            <div class="alarm-ears right"></div>
        </div>

        <!-- 阶段提示文字 -->
        <div class="phase-banner" v-if="store.currentPhase !== 'IDLE' && store.currentPhase !== 'SETTLEMENT'">
            <span v-if="store.currentPhase === 'ROB_BANKER'">看牌抢庄</span>
            <span v-else-if="store.currentPhase === 'BETTING'">闲家下注</span>
            <span v-else-if="store.currentPhase === 'SHOWDOWN'">摊牌比拼</span>
        </div>
        
        <div v-if="store.currentPhase === 'SETTLEMENT'" class="phase-tip">
            结算中...
        </div>
    </div>

    <!-- 自己区域 -->
    <div class="my-area" v-if="myPlayer">
        <!-- 操作按钮组 -->
        <div class="controls-container">
            <!-- 抢庄阶段 -->
            <div v-if="store.currentPhase === 'ROB_BANKER' && myPlayer.robMultiplier === -1" class="btn-group">
                <div class="game-btn orange" @click="onRob(1)">1倍</div>
                <div class="game-btn orange" @click="onRob(2)">2倍</div>
                <div class="game-btn orange" @click="onRob(3)">3倍</div>
                <div class="game-btn blue" @click="onRob(0)">不抢</div>
            </div>

            <!-- 下注阶段 -->
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
        </div>

        <!-- 自己的座位组件 -->
        <PlayerSeat 
            :player="myPlayer" 
            :is-me="true" 
            :ref="(el) => setSeatRef(el, myPlayer.id)"
        />
    </div>
</div>
</template>

<style scoped>
.game-table {
  width: 100vw;
  height: 100vh;
  /* 青绿色背景 */
  background: radial-gradient(circle at center, #0d9488 0%, #115e59 100%);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: system-ui, sans-serif;
}

/* 顶部栏 */
.top-bar {
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    z-index: 100;
}

.menu-btn {
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
    padding: 4px 8px;
    border: 1px solid rgba(255,255,255,0.2);
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

.opponents {
    flex: 1;
    display: flex;
    justify-content: space-around;
    padding-top: 40px;
    align-items: flex-start;
}

.table-center {
    position: absolute;
    top: 35%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    /* 移除 pointer-events: none 以便获取getBoundingClientRect，但如果不点击可以不移。
       不过为了安全获取位置，保持块级显示即可。子元素可以接收点击。
       这里父级如果挡住下面的元素点击可能不好，但这里是中心区域，通常没按钮。
    */
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 200px; /* 给一个固定宽度，方便金币飞向这个区域 */
    height: 100px;
    pointer-events: none; /* 让点击穿透过去 */
}

/* 闹钟倒计时样式 */
.alarm-clock {
    position: relative;
    width: 60px;
    height: 60px;
    pointer-events: auto; 
}
.alarm-body {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 30% 30%, #fff 0%, #e5e5e5 100%);
    border-radius: 50%;
    border: 4px solid #f97316; /* 橙色边框 */
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
    top: -5px;
    width: 20px;
    height: 20px;
    background: #f97316;
    border-radius: 50%;
    z-index: 1;
}
.alarm-ears.left { left: 0; transform: rotate(-30deg); }
.alarm-ears.right { right: 0; transform: rotate(30deg); }

.phase-banner {
    color: rgba(255,255,255,0.2);
    font-size: 40px;
    font-weight: 900;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(2);
    white-space: nowrap;
    z-index: 0;
    pointer-events: none;
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
</style>
