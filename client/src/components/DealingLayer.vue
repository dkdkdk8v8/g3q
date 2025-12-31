<script setup>
import { ref } from 'vue';

// 飞行的卡片列表
const flyingCards = ref([]);

// 执行发牌动画
// targets: Array<{ x, y, id, isMe }> 目标位置列表
// count: 每人发几张
// callback: (seatIndex, cardIndex) => void  单张卡片到达回调
const deal = async (targets, count, callback) => {
    const startX = window.innerWidth / 2; 
    const startY = window.innerHeight / 2; 

    // 发牌顺序：每人一张，轮流发
    for (let c = 0; c < count; c++) {
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            
            // 目标尺寸
            const targetWidth = target.isMe ? 60 : 40;
            const targetHeight = target.isMe ? 84 : 56;
            
            // 创建一个飞行的卡片
            const flyId = `fly-${Date.now()}-${c}-${i}`;
            const card = {
                id: flyId,
                x: startX - targetWidth / 2, // 居中生成
                y: startY - targetHeight / 2,
                width: targetWidth,
                height: targetHeight,
                rotation: Math.random() * 60 - 30, // 初始随机角度
                scale: 0.5, // 初始大小
                opacity: 0,
                targetX: target.x - targetWidth / 2, // 目标左上角
                targetY: target.y - targetHeight / 2,
            };
            flyingCards.value.push(card);

            // 强制重绘后开始动画 (下一帧)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    card.x = card.targetX;
                    card.y = card.targetY;
                    card.rotation = 360; // 转一圈
                    card.scale = 1;
                    card.opacity = 1;
                });
            });

            // 等待动画结束
            setTimeout(() => {
                // 移除该飞行卡片
                const idx = flyingCards.value.findIndex(f => f.id === flyId);
                if (idx > -1) flyingCards.value.splice(idx, 1);
                
                // 触发回调：第 i 个座位的 第 c 张牌到了
                if (callback) callback(i, c);
            }, 400); // 飞行时间 0.4s

            // 间隔发下一张 (如果人多，发快点)
            await new Promise(r => setTimeout(r, targets.length > 3 ? 50 : 100));
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
            width: card.width + 'px',
            height: card.height + 'px',
            transform: `translate(${card.x}px, ${card.y}px) rotate(${card.rotation}deg) scale(${card.scale})`,
            opacity: card.opacity
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
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.1s;
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
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}
</style>