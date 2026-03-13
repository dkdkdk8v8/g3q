<script setup>
/**
 * 咪牌动画测试 — 精确物理折叠
 *
 * 模拟真实扑克牌：牌背朝上，从右上角捻起一角，折过来的部分显示牌面。
 * 所有折叠几何（clip-path + 图片变换矩阵）基于实际像素尺寸精确计算。
 */
import { ref, computed, nextTick } from 'vue';

const isActive = ref(false);
const cardId = ref(0);
const showBackdrop = ref(false);
const foldSize = ref(0); // 0~75，代表折叠深度（百分比）

const cardModules = import.meta.glob('../assets/card/card_*.png', { eager: true, import: 'default' });
const cardImages = {};
for (const path in cardModules) {
    const match = path.match(/card_(\d+)\.png$/);
    if (match) cardImages[Number(match[1])] = cardModules[path];
}
const cardImgUrl = computed(() => cardImages[cardId.value] || null);

// 卡牌尺寸
const targetWidth = computed(() => window.innerWidth / 3);
const targetHeight = computed(() => targetWidth.value * (21.4667 / 16));
const centerX = computed(() => (window.innerWidth - targetWidth.value) / 2);
const centerY = computed(() => (window.innerHeight - targetHeight.value) / 2);

const cardStyle = computed(() => ({
    left: centerX.value + 'px',
    top: centerY.value + 'px',
    width: targetWidth.value + 'px',
    height: targetHeight.value + 'px',
}));

// ===== 核心几何计算 =====
// k = W²/(W²+H²)，决定了折线角度的宽高比修正系数
const k = computed(() => {
    const W = targetWidth.value, H = targetHeight.value;
    return (W * W) / (W * W + H * H);
});

// 牌背 clip-path：裁掉右上角三角
// 折线从 (100-fs)% 的顶边 到 100% 的右边 fs%
const backClip = computed(() => {
    const fs = foldSize.value;
    return `polygon(0 0, ${100 - fs}% 0, 100% ${fs}%, 100% 100%, 0 100%)`;
});

// 折角三角形 clip-path：精确的镜像三角形
// 角 (100%,0) 沿折线反射后的位置 R = (rx%, ry%)
const foldClip = computed(() => {
    const fs = foldSize.value / 100;
    const kv = k.value;
    const rx = (1 - 2 * fs * (1 - kv)) * 100;
    const ry = 2 * kv * fs * 100;
    return `polygon(${100 - foldSize.value}% 0%, 100% ${foldSize.value}%, ${rx}% ${ry}%)`;
});

// 折角内牌面图片的 CSS matrix 变换
// 复合变换：scaleX(-1)（牌面朝下）+ 沿折线镜像反射
const foldImgStyle = computed(() => {
    const W = targetWidth.value, H = targetHeight.value;
    const W2 = W * W, H2 = H * H, S = W2 + H2;
    const fs = foldSize.value / 100;

    // 反射矩阵分量（仅由宽高比决定，与折叠深度无关）
    const a = (H2 - W2) / S;
    const bc = 2 * W * H / S; // b = -bc, c = bc

    // 平移分量（随折叠深度变化）
    const e = W * (1 - 2 * fs * (1 - k.value));
    const f = 2 * fs * W2 * H / S;

    return {
        transform: `matrix(${a}, ${-bc}, ${bc}, ${a}, ${e}, ${f})`,
        transformOrigin: '0 0',
    };
});

// ===== 动画 =====
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function tweenTo(target, duration) {
    return new Promise(resolve => {
        const from = foldSize.value;
        const start = performance.now();
        const tick = (now) => {
            let t = Math.min((now - start) / duration, 1);
            // ease-in-out
            t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            foldSize.value = from + (target - from) * t;
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
        };
        requestAnimationFrame(tick);
    });
}

const startTest = async () => {
    if (isActive.value) return;

    const ids = Object.keys(cardImages).map(Number);
    cardId.value = ids[Math.floor(Math.random() * ids.length)];

    foldSize.value = 0;
    isActive.value = true;
    showBackdrop.value = true;

    await nextTick();
    await delay(100);

    // 慢慢折开
    await tweenTo(40, 1400);
    // 继续折更大
    await tweenTo(70, 800);
    // 停留
    await delay(800);

    showBackdrop.value = false;
    await delay(300);
    isActive.value = false;
    foldSize.value = 0;
};

defineExpose({ startTest });
</script>

<template>
    <Teleport to="body">
        <div v-if="isActive" class="test-overlay" @click="isActive = false">
            <div class="test-backdrop" :class="{ visible: showBackdrop }"></div>

            <div class="test-card" :style="cardStyle" @click.stop>
                <!-- 牌背：裁掉右上角 -->
                <div class="card-back" :style="{ clipPath: backClip }"></div>

                <!-- 折角：叠在牌背上，里面是精确变换的牌面 -->
                <div class="fold-corner" :style="{ clipPath: foldClip }">
                    <img v-if="cardImgUrl"
                        :src="cardImgUrl"
                        class="fold-face-img"
                        :style="foldImgStyle" />
                    <div class="fold-shade"></div>
                </div>
            </div>

            <div class="test-hint">点击空白处关闭 | 牌ID: {{ cardId }}</div>
        </div>
    </Teleport>
</template>

<style scoped>
.test-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
}

.test-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0);
    transition: background 0.3s ease;
}

.test-backdrop.visible {
    background: rgba(0, 0, 0, 0.6);
}

.test-card {
    position: absolute;
    overflow: visible;
}

.card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    background: url('@/assets/common/card_back.png') no-repeat center center;
    background-size: 100% 100%;
    border-radius: 2vw;
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

.test-hint {
    position: absolute;
    bottom: 10%;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    pointer-events: none;
}
</style>
