<script setup>
import { ref } from 'vue';

// 飞行的卡片列表
const flyingCards = ref([]);

// 执行发牌动画
// targets: Array<{ x, y, id }> 目标位置列表
// count: 每人发几张
// callback: (seatIndex, cardIndex) => void  单张卡片到达回调
const deal = async (targets, count, callback) => {
    const startX = window.innerWidth / 2 - 20; // 中心 X (卡片宽40的一半)
    const startY = window.innerHeight / 2 - 28; // 中心 Y (卡片高56的一半)

    // 发牌顺序：每人一张，轮流发
    for (let c = 0; c < count; c++) {
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            
            // 创建一个飞行的卡片
            const flyId = `fly-${Date.now()}-${c}-${i}`;
            const card = {
                id: flyId,
                x: startX,
                y: startY,
                rotation: 0,
                targetX: target.x,
                targetY: target.y,
                done: false
            };
            flyingCards.value.push(card);

            // 强制重绘后开始动画 (下一帧)
            requestAnimationFrame(() => {
                card.x = target.x;
                card.y = target.y;
                // 简单的旋转效果
                card.rotation = 360; 
            });

            // 等待动画结束
            setTimeout(() => {
                // 移除该飞行卡片
                const idx = flyingCards.value.findIndex(f => f.id === flyId);
                if (idx > -1) flyingCards.value.splice(idx, 1);
                
                // 触发回调：第 i 个座位的 第 c 张牌到了
                if (callback) callback(i, c);
            }, 400); // 飞行时间 0.4s

            // 间隔发下一张
            await new Promise(r => setTimeout(r, 100));
        }
    }
};

defineExpose({
    deal
});
</script>

<template>
  <div class="dealing-layer">
    <div 
        v-for="card in flyingCards" 
        :key="card.id"
        class="flying-card"
        :style="{ 
            transform: `translate(${card.x}px, ${card.y}px) rotate(${card.rotation}deg)` 
        }"
    >
        <div class="card-back"></div>
    </div>
  </div>
</template>

<style scoped>
.dealing-layer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999; /* 最上层 */
}

.flying-card {
    position: absolute;
    top: 0;
    left: 0;
    width: 40px;
    height: 56px;
    transition: transform 0.4s ease-out;
    will-change: transform;
}

.card-back {
  width: 100%;
  height: 100%;
  background: #3b5bdb;
  border: 2px solid white;
  border-radius: 4px;
  background-image: repeating-linear-gradient(
    45deg,
    #60a5fa 25%,
    transparent 25%,
    transparent 75%,
    #60a5fa 75%,
    #60a5fa
  ),
  repeating-linear-gradient(
    45deg,
    #60a5fa 25%,
    #3b5bdb 25%,
    #3b5bdb 75%,
    #60a5fa 75%,
    #60a5fa
  );
  background-position: 0 0, 10px 10px;
  background-size: 20px 20px;
  opacity: 1;
}
</style>