<script setup>
import { ref, nextTick } from 'vue';

const coins = ref([]);
let coinIdCounter = 0;

// 抛洒金币方法
// startRect: { left, top } 起点坐标
// endRect: { left, top } 终点坐标
// count: 金币数量
const throwCoins = async (startRect, endRect, count = 10) => {
    const newCoins = [];
    
    // 桌面中心稍微随机一点，不要全部聚集成一个点
    const centerRandom = 40; 
    const coinDelayStep = 0.02; // Faster staggered start: 0.02s

    for (let i = 0; i < count; i++) {
        const id = coinIdCounter++;
        const duration = 0.4 + Math.random() * 0.2; // Faster flight: 0.4s - 0.6s
        const delay = i * coinDelayStep + Math.random() * 0.05; // 线性延迟 + 少量随机
        
        // 初始位置 (起点)
        // 稍微加一点随机偏移，让金币看起来不是一条线
        const startX = startRect.left + startRect.width / 2 - 10 + (Math.random() * 40 - 20); // 增加起点随机范围
        const startY = startRect.top + startRect.height / 2 - 10 + (Math.random() * 40 - 20);

        // 目标位置 (终点)
        const endX = endRect.left + endRect.width / 2 - 10 + (Math.random() * centerRandom - centerRandom/2);
        const endY = endRect.top + endRect.height / 2 - 10 + (Math.random() * centerRandom - centerRandom/2);

        newCoins.push({
            id,
            x: startX,
            y: startY,
            style: {
                transform: `translate(${startX}px, ${startY}px) scale(0.5)`,
                opacity: 0,
                transition: 'none' // 初始无过渡，瞬间定位
            },
            endX,
            endY,
            duration,
            delay
        });
    }

    // 将新金币加入数组
    coins.value.push(...newCoins);

    // 等待 DOM 渲染下一帧，然后设置终点位置，触发 CSS transition
    await nextTick();
    
    // 强制重绘 (虽然 nextTick 通常够了，但在某些浏览器可能需要 double RAF，这里简单处理)
    requestAnimationFrame(() => {
        newCoins.forEach(coin => {
            const target = coins.value.find(c => c.id === coin.id);
            if (target) {
                target.style = {
                    transform: `translate(${coin.endX}px, ${coin.endY}px) scale(1)`,
                    opacity: 1,
                    // 增加 delay 参数
                    transition: `all ${coin.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${coin.delay}s` 
                };

                // Add Absorption Effect after flight
                const flightTimeMs = (coin.delay + coin.duration) * 1000;
                setTimeout(() => {
                    const absorbedTarget = coins.value.find(c => c.id === coin.id);
                    if (absorbedTarget) {
                        absorbedTarget.style = {
                            transform: `translate(${coin.endX}px, ${coin.endY}px) scale(0)`, // Shrink to 0
                            opacity: 0, // Fade out
                            transition: 'all 0.3s ease-out' // Fast absorption
                        };
                    }
                }, flightTimeMs);
            }
        });
    });

    // 动画结束后清理金币 DOM，防止内存泄漏
    // 计算最大总耗时 = 最大延迟 + 最大飞行时间 (0.8s) + 吸收时间(0.3s) + 安全余量
    const maxTotalTime = (count * coinDelayStep + 0.1) + 0.8 + 0.3 + 0.2; 
    
    setTimeout(() => {
        coins.value = coins.value.filter(c => !newCoins.find(nc => nc.id === c.id));
    }, maxTotalTime * 1000);
};

defineExpose({
    throwCoins
});
</script>

<template>
    <div class="coin-layer">
        <div 
            v-for="coin in coins" 
            :key="coin.id" 
            class="coin" 
            :style="coin.style"
        >
            $
        </div>
    </div>
</template>

<style scoped>
.coin-layer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none; /* 穿透点击，不影响游戏操作 */
    z-index: 7000;
}

.coin {
    position: absolute;
    top: 0;
    left: 0;
    width: 28px;
    height: 28px;
    background: radial-gradient(circle at 30% 30%, #fcd34d 0%, #d97706 100%);
    border: 1px solid #b45309;
    border-radius: 50%;
    color: #92400e;
    font-size: 18px;
    font-weight: bold;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 1px 1px 3px rgba(0,0,0,0.5);
    will-change: transform, opacity;
}
</style>
