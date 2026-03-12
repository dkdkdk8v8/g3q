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

    // Phase 2: 右上角翻起
    phase.value = 'peel';
    await delay(1500);

    // Phase 3: 整体翻开
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
                <!-- 底层：牌面 -->
                <div class="peek-card-face">
                    <img v-if="cardImgUrl" :src="cardImgUrl" class="peek-card-img" />
                </div>
                <!-- 顶层：牌背 -->
                <div class="peek-card-back" :class="{
                    'phase-peel': phase === 'peel',
                    'phase-flip': phase === 'flip',
                    'phase-done': phase === 'move-back'
                }">
                    <!-- 翻角阴影 -->
                    <div v-if="phase === 'peel'" class="peel-shadow"></div>
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
    will-change: transform, left, top, width, height;
}

.peek-card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 2vw;
    overflow: hidden;
    background: white;
}

.peek-card-img {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
}

.peek-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    background: url('@/assets/common/card_back.png') no-repeat center center;
    background-size: 100% 100%;
    border-radius: 2vw;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transform-origin: 100% 0%;
    /* 右上角为旋转锚点 */
    will-change: transform, clip-path;
}

/* Phase 2: 右上角慢慢翻起 */
.peek-card-back.phase-peel {
    animation: corner-peel 1.4s ease-in-out forwards;
}

@keyframes corner-peel {
    0% {
        transform: perspective(800px) rotateY(0deg) rotateX(0deg);
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    }

    100% {
        transform: perspective(800px) rotateY(-30deg) rotateX(15deg);
        clip-path: polygon(0 0, 55% 0, 100% 55%, 100% 100%, 0 100%);
    }
}

/* 翻角下的三角形阴影 */
.peel-shadow {
    position: absolute;
    top: 0;
    right: 0;
    width: 50%;
    height: 50%;
    background: linear-gradient(135deg, transparent 40%, rgba(0, 0, 0, 0.08) 100%);
    pointer-events: none;
    animation: shadow-appear 1.4s ease-in-out forwards;
    clip-path: polygon(100% 0, 100% 100%, 0 0);
}

@keyframes shadow-appear {
    0% {
        opacity: 0;
    }

    100% {
        opacity: 1;
    }
}

/* Phase 3: 整体翻开 */
.peek-card-back.phase-flip {
    animation: full-flip 0.8s ease-in forwards;
}

@keyframes full-flip {
    0% {
        transform: perspective(800px) rotateY(-30deg) rotateX(15deg);
        clip-path: polygon(0 0, 55% 0, 100% 55%, 100% 100%, 0 100%);
        opacity: 1;
    }

    60% {
        transform: perspective(800px) rotateY(-90deg) rotateX(0deg);
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
        opacity: 1;
    }

    100% {
        transform: perspective(800px) rotateY(-180deg) rotateX(0deg);
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
        opacity: 0;
    }
}

/* Phase 4: 移回时牌背隐藏 */
.peek-card-back.phase-done {
    display: none;
}
</style>
