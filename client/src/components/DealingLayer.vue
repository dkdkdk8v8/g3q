<script setup>
import { ref, nextTick } from 'vue';

// 飞行的卡片列表
const flyingCards = ref([]);

// 执行发牌动画：针对单个玩家的一组牌
// targets: Array<{ x, y, id, isMe }> 该玩家这一组牌的最终位置列表
// callback: () => void  整组发完后的回调
const dealToPlayer = async (targets, callback, forceBulkAnimation = false) => {
    if (!targets || targets.length === 0) return;

    const startX = window.innerWidth / 2; 
    const startY = window.innerHeight / 2; 

    // 判断是单张补牌还是批量发牌
    const isBulk = targets.length > 1 || forceBulkAnimation;

    // 批量发牌时，"最左侧"位置作为跳水目标
    // 注意：这里的 targets[0] 是这批牌里的第一张
    
    // Viewport Scaling
    const viewportRatio = window.innerWidth / 375;
    const offsetMeX = 30 * viewportRatio;
    const offsetOtherX = 24 * viewportRatio;
    const offsetMeY = 44 * viewportRatio;
    const offsetOtherY = 30 * viewportRatio;

    const jumpTargetX = targets[0].x - (targets[0].isMe ? offsetMeX : offsetOtherX); // 居中修正 (width/2)
    const jumpTargetY = targets[0].y - (targets[0].isMe ? offsetMeY : offsetOtherY); // 居中修正 (height/2)

    // 创建这组卡片
    const newCards = targets.map((t, index) => {
            const targetWidth = (t.isMe ? 60 : 48) * viewportRatio;
            const targetHeight = (t.isMe ? 88 : 60) * viewportRatio;        const finalScale = t.scale || 1; // 获取目标缩放比例
        
        return {
            id: `deal-${Date.now()}-${index}-${Math.random()}`,
            // 初始状态：屏幕中心
            x: startX - targetWidth / 2,
            y: startY - targetHeight / 2,
            width: targetWidth,
            height: targetHeight,
            rotation: Math.random() * 60 - 30, 
            scale: 1, // 初始大小为 1，无缩放动画
            opacity: 0,
            
            // 目标参数
            finalX: t.x - targetWidth / 2,
            finalY: t.y - targetHeight / 2,
            finalScale: finalScale, // 存储目标缩放
            
            // 批量模式下的中间跳点 (全部飞到第一张牌的位置)
            jumpX: jumpTargetX,
            jumpY: jumpTargetY,
            
            isMe: t.isMe,
            index: index,
            
            transition: 'none',
            zIndex: 100 + index
        };
    });

    flyingCards.value.push(...newCards);
    await nextTick(); // 确保 DOM 渲染，初始位置生效

    // 关键修复：获取 flyingCards 数组中对应的响应式代理对象
    // push 进去的是普通对象，newCards 依然是普通对象引用
    // 必须操作 flyingCards.value 里的 Proxy 才能触发视图更新
    const startIndex = flyingCards.value.length - newCards.length;
    const reactiveCards = flyingCards.value.slice(startIndex);

    if (isBulk) {
        // === 批量发牌模式：依次跳水到最左侧 -> 展开 ===
        
        // 1. 依次跳水 (Jump)
        const jumpInterval = 60; // 每张间隔
        const jumpDuration = 350; // 飞行时长

        const jumpPromises = reactiveCards.map((card, idx) => {
            return new Promise(resolve => {
                // 增加 50ms 基础延迟，确保第一张牌的初始位置先被渲染出来，避免瞬移
                const delay = idx * jumpInterval + 50;
                setTimeout(() => {
                    card.transition = `all ${jumpDuration/1000}s cubic-bezier(0.18, 0.89, 0.32, 1.28)`;
                    card.x = card.jumpX;
                    card.y = card.jumpY;
                    card.scale = card.finalScale; // 动画缩放到目标大小
                    card.opacity = 1;
                    card.rotation = 0; // 摆正
                    setTimeout(resolve, jumpDuration);
                }, delay);
            });
        });

        // 等待所有牌都跳到了最左侧
        await Promise.all(jumpPromises);

        // 2. 展开 (Spread)
        // 需求：跳水完成后，所有牌"同时"开始展开，无需每张牌之间的延迟
        // 视觉上就是一叠牌直接散开
        const spreadPromises = reactiveCards.map((card, idx) => {
            return new Promise(resolve => {
                // 不再使用 idx * 80 的延迟，直接开始
                // 为了确保 transition 切换生效，还是保留 nextTick 逻辑
                
                (async () => {
                    // 1. 设置移动的 transition
                    card.transition = 'transform 0.3s ease-out';
                    
                    // 等待 DOM 更新
                    await nextTick();
                        
                    // 2. 执行移动
                    card.x = card.finalX;
                    card.y = card.finalY;
                    // scale 保持 finalScale

                    // 监听 transitionend 事件 或者用 setTimeout 确保移动完成
                    const moveDuration = 300;

                    setTimeout(() => {
                        // 移动完成
                        resolve();
                    }, moveDuration);
                })();
            });
        });
        
        await Promise.all(spreadPromises);

    } else {
        // === 单张发牌模式：直接飞到目标 ===
        // 类似之前的效果
        const card = reactiveCards[0];
        
        card.transition = 'all 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        card.x = card.finalX;
        card.y = card.finalY;
        card.scale = card.finalScale; // 动画缩放到目标大小
        card.opacity = 1;
        card.rotation = 0; // Ensures no rotation

        await new Promise(r => setTimeout(r, 400));
    }

    // 清理
    // await new Promise(r => setTimeout(r, 200)); // Remove this delay
    
    // 1. 先触发回调，让真实手牌显示出来 (此时真实手牌是不透明度1，背面)
    if (callback) callback();
    
    // 2. 等待一帧，确保 Vue 更新了真实手牌的 DOM
    await nextTick();
    
    // 3. 移除飞行的卡片 (此时真实手牌已经在下面了)
    const removeIds = reactiveCards.map(c => c.id);
    flyingCards.value = flyingCards.value.filter(c => !removeIds.includes(c.id));
};

defineExpose({
    dealToPlayer
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
            opacity: card.opacity,
            transition: card.transition,
            zIndex: card.zIndex
        }"
    >
        <div class="card-back">
            <div class="back-pattern"></div>
        </div>
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
  background: url('@/assets/common/card_back.png') no-repeat center center;
  background-size: 100% 100%;
  border-radius: 6px; /* Match PokerCard radius */
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.2); /* Match PokerCard inset border + drop shadow */
  position: relative; /* Ensure child absolute positioning works if needed */
  box-sizing: border-box;
}

.back-pattern {
  display: none;
}
</style>
