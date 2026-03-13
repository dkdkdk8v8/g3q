<script setup>
import { ref, computed, nextTick } from 'vue';

const emit = defineEmits(['complete']);

const isActive = ref(false);
const phase = ref(''); // 'move-center', 'peel', 'flip', 'move-back'
const cardData = ref(null);
const originRect = ref(null);
const showBackdrop = ref(false);

const cardImgUrl = computed(() => {
    if (!cardData.value || cardData.value.rawId === undefined) return null;
    return new URL(`../assets/card/card_${cardData.value.rawId}.png`, import.meta.url).href;
});

// 目标尺寸：屏幕1/3宽度，保持扑克牌比例
const targetWidth = computed(() => window.innerWidth / 3);
const targetHeight = computed(() => targetWidth.value * (21.4667 / 16));

// 屏幕中心坐标
const centerX = computed(() => (window.innerWidth - targetWidth.value) / 2);
const centerY = computed(() => (window.innerHeight - targetHeight.value) / 2);

const cardStyle = computed(() => {
    if (!originRect.value) return {};

    if (phase.value === 'move-center' || phase.value === 'peel' || phase.value === 'flip') {
        return {
            left: centerX.value + 'px',
            top: centerY.value + 'px',
            width: targetWidth.value + 'px',
            height: targetHeight.value + 'px',
            transition: 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        };
    }
    if (phase.value === 'move-back') {
        return {
            left: originRect.value.left + 'px',
            top: originRect.value.top + 'px',
            width: originRect.value.width + 'px',
            height: originRect.value.height + 'px',
            transition: 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        };
    }
    // 初始：在手牌位置
    return {
        left: originRect.value.left + 'px',
        top: originRect.value.top + 'px',
        width: originRect.value.width + 'px',
        height: originRect.value.height + 'px',
        transition: 'none',
    };
});

// 外部调用：启动咪牌动画
const startPeekAnimation = async ({ card, rect }) => {
    cardData.value = card;
    originRect.value = rect;
    phase.value = 'init';
    isActive.value = true;

    await nextTick();

    // Phase 1: 移到屏幕中央 + 放大 + 遮罩渐入
    requestAnimationFrame(() => {
        phase.value = 'move-center';
        showBackdrop.value = true;
    });

    await delay(700);

    // Phase 2: 右上角折起
    phase.value = 'peel';
    await delay(1500);

    // Phase 3: 牌背继续折叠消失
    phase.value = 'flip';
    await delay(900);

    // Phase 4: 移回手牌位置 + 缩小 + 遮罩渐出
    phase.value = 'move-back';
    showBackdrop.value = false;
    await delay(550);

    // 先让真实手牌显示，再隐藏遮罩，避免闪烁
    emit('complete');
    await nextTick();
    isActive.value = false;
    phase.value = '';
    cardData.value = null;
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

defineExpose({ startPeekAnimation });
</script>

<template>
    <Teleport to="body">
        <div v-if="isActive" class="peek-overlay">
            <!-- 全屏灰色遮罩 -->
            <div class="peek-backdrop" :class="{ visible: showBackdrop }"></div>

            <!-- 动画卡牌 -->
            <div class="peek-card" :style="cardStyle">
                <!-- 唯一的牌面（不是"另一张牌"，就是牌的正面） -->
                <div class="peek-card-face">
                    <img v-if="cardImgUrl" :src="cardImgUrl" class="peek-card-img" />
                </div>

                <!-- 牌背（通过 clip-path 裁掉右上角，模拟折起） -->
                <div class="peek-card-back" :class="{
                    'phase-peel': phase === 'peel',
                    'phase-flip': phase === 'flip',
                    'phase-done': phase === 'move-back'
                }"></div>

                <!--
                    折起的角：显示牌面图片的镜像（纸张翻折后看到的是牌的正面）
                    折线从 (60%,0) 到 (100%,40%)，45度角
                    原始角 (100%,0) 沿折线镜像后落在 (60%,40%)
                    所以折角三角形 = (60%,0) → (100%,40%) → (60%,40%)
                -->
                <div v-if="phase === 'peel' || phase === 'flip'" class="fold-corner"
                    :class="{ 'fold-peel': phase === 'peel', 'fold-flip': phase === 'flip' }">
                    <!-- 镜像的牌面图片 -->
                    <img v-if="cardImgUrl" :src="cardImgUrl" class="fold-corner-img" />
                    <!-- 折角上的轻微阴影，增加纸张折叠的立体感 -->
                    <div class="fold-corner-shade"></div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.peek-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9000;
    pointer-events: none;
}

.peek-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0);
    transition: background 0.5s ease;
}

.peek-backdrop.visible {
    background: rgba(0, 0, 0, 0.55);
}

.peek-card {
    position: absolute;
    border-radius: 2vw;
    overflow: visible;
    will-change: left, top, width, height;
}

/* 牌面（牌的正面，点数/花色） */
.peek-card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 2vw;
    overflow: hidden;
}

.peek-card-img {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
}

/* ===== 牌背：用 clip-path 裁剪，不做3D旋转 ===== */
.peek-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    background: url('@/assets/common/card_back.png') no-repeat center center;
    background-size: 100% 100%;
    border-radius: 2vw;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    will-change: clip-path, opacity;
}

/*
 * Phase 2: 牌背右上角被裁剪掉
 * 5个顶点从完整矩形过渡到缺角五边形：
 *
 *   (0,0)------(60%,0)
 *     |               \
 *     |                (100%,40%)
 *     |                |
 *   (0,100%)---(100%,100%)
 */
.peek-card-back.phase-peel {
    animation: back-fold-clip 1.4s ease-in-out forwards;
}

@keyframes back-fold-clip {
    0% {
        clip-path: polygon(0 0, 100% 0, 100% 0%, 100% 100%, 0 100%);
    }
    100% {
        clip-path: polygon(0 0, 60% 0, 100% 40%, 100% 100%, 0 100%);
    }
}

/* Phase 3: 牌背继续折叠直到完全消失 */
.peek-card-back.phase-flip {
    animation: back-fold-away 0.8s ease-in forwards;
}

@keyframes back-fold-away {
    0% {
        clip-path: polygon(0 0, 60% 0, 100% 40%, 100% 100%, 0 100%);
        opacity: 1;
    }
    70% {
        clip-path: polygon(0 0, 0% 0%, 80% 100%, 100% 100%, 0 100%);
        opacity: 0.7;
    }
    100% {
        clip-path: polygon(0 0, 0% 0%, 0% 100%, 0% 100%, 0 100%);
        opacity: 0;
    }
}

/* Phase 4: 牌背隐藏 */
.peek-card-back.phase-done {
    display: none;
}

/* ===== 折起的角（显示镜像牌面） ===== */
.fold-corner {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
}

/*
 * 牌面图片沿折线做镜像变换
 * 折线: (60%,0) → (100%,40%)，45度角，中点 (80%,20%)
 * 变换: rotate(-90deg) + scaleY(-1)，以折线中点为原点
 * 数学验证:
 *   (100%,0) → (60%,40%) ✓ 角尖镜像到对面
 *   (60%,0)  → (60%,0)   ✓ 折线上的点不动
 *   (100%,40%) → (100%,40%) ✓ 折线上的点不动
 */
.fold-corner-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    transform-origin: 80% 20%;
    transform: rotate(-90deg) scaleY(-1);
}

/* 折角上的半透明阴影，模拟纸张折叠后背光面 */
.fold-corner-shade {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        315deg,
        rgba(0, 0, 0, 0.08) 0%,
        rgba(0, 0, 0, 0.03) 50%,
        transparent 100%
    );
}

/* Phase 2: 折角从右上角一个点逐渐展开成三角形 */
.fold-corner.fold-peel {
    animation: fold-triangle-grow 1.4s ease-in-out forwards;
}

@keyframes fold-triangle-grow {
    0% {
        clip-path: polygon(100% 0%, 100% 0%, 100% 0%);
    }
    100% {
        clip-path: polygon(60% 0%, 100% 40%, 60% 40%);
    }
}

/* Phase 3: 折角继续扩大然后消失 */
.fold-corner.fold-flip {
    animation: fold-triangle-away 0.8s ease-in forwards;
}

@keyframes fold-triangle-away {
    0% {
        clip-path: polygon(60% 0%, 100% 40%, 60% 40%);
        opacity: 1;
    }
    70% {
        clip-path: polygon(0% 0%, 80% 100%, 0% 100%);
        opacity: 0.7;
    }
    100% {
        clip-path: polygon(0% 0%, 0% 100%, 0% 100%);
        opacity: 0;
    }
}
</style>
