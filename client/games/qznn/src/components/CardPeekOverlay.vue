<script setup>
import { ref, computed, nextTick } from 'vue';

const emit = defineEmits(['complete']);

const isActive = ref(false);
const phase = ref(''); // 'init', 'move-center', 'peek', 'flip', 'move-back'
const cardData = ref(null);
const originRect = ref(null);
const showBackdrop = ref(false);
const foldSize = ref(0);
const flipAngle = ref(0);

const cardImgUrl = computed(() => {
    if (!cardData.value || cardData.value.rawId === undefined) return null;
    return new URL(`../assets/card/card_${cardData.value.rawId}.png`, import.meta.url).href;
});

const targetWidth = computed(() => window.innerWidth / 3);
const targetHeight = computed(() => targetWidth.value * (21.4667 / 16));
const centerX = computed(() => (window.innerWidth - targetWidth.value) / 2);
const centerY = computed(() => (window.innerHeight - targetHeight.value) / 2);

const cardStyle = computed(() => {
    if (!originRect.value) return {};

    if (phase.value === 'move-center' || phase.value === 'peek' || phase.value === 'flip') {
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
    return {
        left: originRect.value.left + 'px',
        top: originRect.value.top + 'px',
        width: originRect.value.width + 'px',
        height: originRect.value.height + 'px',
        transition: 'none',
    };
});

// ===== 折角几何 =====
const k = computed(() => {
    const W = targetWidth.value, H = targetHeight.value;
    return (W * W) / (W * W + H * H);
});

const backClip = computed(() => {
    const fs = foldSize.value;
    return `polygon(0 0, ${100 - fs}% 0, 100% ${fs}%, 100% 100%, 0 100%)`;
});

const foldClip = computed(() => {
    const fs = foldSize.value / 100;
    const kv = k.value;
    const rx = (1 - 2 * fs * (1 - kv)) * 100;
    const ry = 2 * kv * fs * 100;
    return `polygon(${100 - foldSize.value}% 0%, 100% ${foldSize.value}%, ${rx}% ${ry}%)`;
});

const foldImgStyle = computed(() => {
    const W = targetWidth.value, H = targetHeight.value;
    const W2 = W * W, H2 = H * H, S = W2 + H2;
    const fs = foldSize.value / 100;
    const a = (H2 - W2) / S;
    const bc = 2 * W * H / S;
    const e = W * (1 - 2 * fs * (1 - k.value));
    const f = 2 * fs * W2 * H / S;
    return {
        transform: `matrix(${a}, ${-bc}, ${bc}, ${a}, ${e}, ${f})`,
        transformOrigin: '0 0',
    };
});

// ===== 动画工具 =====
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function tween(refObj, target, duration, easeFn) {
    return new Promise(resolve => {
        const from = refObj.value;
        const start = performance.now();
        const ease = easeFn || easeInOut;
        const tick = (now) => {
            let t = Math.min((now - start) / duration, 1);
            t = ease(t);
            refObj.value = from + (target - from) * t;
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
        };
        requestAnimationFrame(tick);
    });
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
}

// ===== 主流程 =====
const startPeekAnimation = async ({ card, rect }) => {
    cardData.value = card;
    originRect.value = rect;
    foldSize.value = 0;
    flipAngle.value = 0;
    phase.value = 'init';
    isActive.value = true;

    await nextTick();

    // 1. 移到屏幕中央 + 放大 + 遮罩渐入
    requestAnimationFrame(() => {
        phase.value = 'move-center';
        showBackdrop.value = true;
    });
    await delay(700);

    // 2. 咪牌：折开小角
    phase.value = 'peek';
    await tween(foldSize, 40, 1400);
    // 3. 折角变大
    await tween(foldSize, 70, 800);
    // 4. 停留让玩家看清
    await delay(400);
    // 5. 快速收回折角
    await tween(foldSize, 0, 300, easeOut);
    // 6. 整体3D翻转
    phase.value = 'flip';
    await tween(flipAngle, 180, 600, easeInOut);
    // 7. 展示完整牌面
    await delay(800);

    // 8. 移回手牌位置 + 缩小 + 遮罩渐出
    phase.value = 'move-back';
    showBackdrop.value = false;
    await delay(550);

    emit('complete');
    await nextTick();
    isActive.value = false;
    phase.value = '';
    cardData.value = null;
};

defineExpose({ startPeekAnimation });
</script>

<template>
    <Teleport to="body">
        <div v-if="isActive" class="peek-overlay">
            <div class="peek-backdrop" :class="{ visible: showBackdrop }"></div>

            <div class="peek-card" :style="cardStyle">
                <div class="card-flipper" :style="{ transform: `perspective(800px) rotateY(${flipAngle}deg)` }">
                    <!-- 牌背面（默认可见） -->
                    <div class="card-back-side">
                        <div class="peek-card-back" :style="{ clipPath: backClip }"></div>

                        <div v-if="foldSize > 0" class="fold-corner" :style="{ clipPath: foldClip }">
                            <img v-if="cardImgUrl"
                                :src="cardImgUrl"
                                class="fold-face-img"
                                :style="foldImgStyle" />
                            <div class="fold-shade"></div>
                        </div>
                    </div>

                    <!-- 牌正面（翻转后可见） -->
                    <div class="card-face-side">
                        <img v-if="cardImgUrl" :src="cardImgUrl" class="peek-card-img" />
                    </div>
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
    overflow: visible;
    will-change: left, top, width, height;
}

.card-flipper {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
}

.card-back-side {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
}

.card-face-side {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    transform: rotateY(180deg);
    border-radius: 2vw;
    overflow: hidden;
}

.peek-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    background: url('@/assets/common/card_back.png') no-repeat center center;
    background-size: 100% 100%;
    border-radius: 2vw;
}

.peek-card-img {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
}

.fold-corner {
    position: absolute;
    width: 100%;
    height: 100%;
    filter: drop-shadow(-2px 2px 4px rgba(0, 0, 0, 0.35));
}

.fold-face-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
}

.fold-shade {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.04);
    pointer-events: none;
}
</style>
