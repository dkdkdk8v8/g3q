<script setup>
import { watch } from 'vue';
import { computed, onMounted, ref, nextTick } from 'vue';

const props = defineProps({
  card: Object, // 如果没有card，显示背面
  isSmall: Boolean
});

// 控制卡片是否翻转显示正面
const isFlipped = ref(false);

onMounted(async () => {
    // 初始状态先为背面，延迟一小段时间后再翻转，以展示翻转动画
    if (props.card) {
        await nextTick();
        setTimeout(() => {
            isFlipped.value = true;
        }, 100);
    }
});

watch(() => props.card, async (newVal) => {
    if (newVal) {
        // 当card prop变为truthy时，先确保是背面，然后延迟翻转
        isFlipped.value = false;
        await nextTick();
        setTimeout(() => {
            isFlipped.value = true;
        }, 100);
    } else {
        // 当card prop变为falsy时，卡片翻转到背面
        isFlipped.value = false;
    }
}); // 移除 immediate: true，逻辑由 onMounted 接管初始状态

const isRed = computed(() => {
  return props.card && (props.card.suit === 'heart' || props.card.suit === 'diamond');
});

const suitSymbol = computed(() => {
  if (!props.card) return '';
  switch (props.card.suit) {
    case 'spade': return '♠';
    case 'heart': return '♥';
    case 'club': return '♣';
    case 'diamond': return '♦';
    default: return '';
  }
});
</script>

<template>
  <div 
    class="poker-card" 
    :class="{ 'is-small': isSmall }"
  >
    <div class="card-inner" :class="{ 'is-flipped': isFlipped }">
        <div class="card-face" :class="{ 'is-red': isRed }">
            <template v-if="card">
                <!-- 左上角标 -->
                <div class="corner-top-left">
                    <span class="rank">{{ card.label }}</span>
                    <span class="suit">{{ suitSymbol }}</span>
                </div>
                
                <!-- 右下角标 (旋转180度) -->
                <div class="corner-bottom-right">
                    <span class="corner-suit">{{ suitSymbol }}</span>
                </div>
            </template>
        </div>
        <div class="card-back-face">
            <div class="back-pattern"></div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.poker-card {
  width: 60px;
  height: 88px;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  position: relative;
  box-sizing: border-box;
  font-family: 'Times New Roman', serif;
  user-select: none;
  perspective: 1000px; /* 3D 效果支持 */
}

.poker-card.is-small {
  width: 40px;
  height: 60px;
  font-size: 0.8em;
}

.card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    text-align: center;
    transition: transform 0.6s; /* 翻转动画时长 */
    transform-style: preserve-3d; /* 保持子元素 3D 变换 */
    transform: rotateY(180deg); /* 默认显示背面 */
}

.card-inner.is-flipped {
    transform: rotateY(0deg); /* 当 isFlipped 为 true 时，显示正面 */
}

.card-face, .card-back-face {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden; /* 翻转时隐藏背面 */
    border-radius: 6px;
    box-sizing: border-box;
}

.card-face {
    background-color: white;
    border: 2px solid white; /* 和背面保持一致的边框 */
}

.card-back-face {
    background: url('@/assets/common/card_back.png') no-repeat center center;
    background-size: 100% 100%; /* Stretch to fit */
    border-radius: 6px; /* Match parent radius */
    transform: rotateY(180deg); /* 初始旋转180度，使其背面朝外 */
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1); /* Optional: subtle border */
}

.back-pattern {
  display: none; /* Hide old pattern */
}

/* 现有卡面样式调整 */
.card-face.is-red {
  color: #d40000;
}

.card-face:not(.is-red) {
  color: #000;
}

/* 角标通用样式 */
.corner-top-left, .corner-bottom-right {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  width: 24px; /* 限制宽度防止溢出 */
}

.corner-top-left {
  top: 4px;
  left: 4px;
}

.corner-bottom-right {
  bottom: 2px;
  right: 2px;
  /* transform: rotate(180deg); Removed per request */
}

.is-small .corner-top-left { top: 2px; left: 2px; }
.is-small .corner-bottom-right { bottom: 1px; right: 1px; }

.rank {
  font-weight: 800;
  font-size: 26px;
  letter-spacing: -2px;
}
.is-small .rank {
  font-size: 18px;
}

.suit {
  font-size: 22px;
  font-weight: bold;
  margin-top: -2px;
}
.is-small .suit {
  font-size: 16px;
  margin-top: -1px;
}

.corner-bottom-right {
  width: auto;
}

.corner-suit {
  font-size: 50px;
  font-weight: bold;
  line-height: 1;
}
.is-small .corner-suit {
  font-size: 32px;
}
</style>
