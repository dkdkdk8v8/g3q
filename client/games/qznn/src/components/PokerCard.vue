<script setup>
import { watch, computed, onMounted, ref, nextTick } from 'vue';

const props = defineProps({
  card: Object, // 如果没有card，显示背面
  isSmall: Boolean,
  peekReveal: Boolean // 咪牌模式：牌背从左往右折叠翻开
});

// 控制卡片是否翻转显示正面
const isFlipped = ref(false);
// 控制咪牌动画
const isPeeking = ref(false);

const cardImgUrl = computed(() => {
    if (!props.card || props.card.rawId === undefined) return null;
    return new URL(`../assets/card/card_${props.card.rawId}.png`, import.meta.url).href;
});

onMounted(async () => {
  // 初始状态先为背面，延迟一小段时间后再翻转，以展示翻转动画
  if (props.card) {
    await nextTick();
    if (props.peekReveal) {
      setTimeout(() => { isPeeking.value = true; }, 300);
    } else {
      setTimeout(() => { isFlipped.value = true; }, 100);
    }
  }
});

watch(() => props.card, async (newVal) => {
  if (newVal) {
    if (props.peekReveal) {
      // 咪牌模式：先确保背面覆盖，然后延迟触发折叠动画
      isPeeking.value = false;
      await nextTick();
      setTimeout(() => { isPeeking.value = true; }, 300);
    } else {
      // 当card prop变为truthy时，先确保是背面，然后延迟翻转
      isFlipped.value = false;
      await nextTick();
      setTimeout(() => { isFlipped.value = true; }, 100);
    }
  } else {
    // 当card prop变为falsy时，重置状态
    isFlipped.value = false;
    isPeeking.value = false;
  }
});

</script>

<template>
  <div class="poker-card" :class="{ 'is-small': isSmall }">
    <!-- 标准翻牌模式 -->
    <div v-if="!peekReveal" class="card-inner" :class="{ 'is-flipped': isFlipped }">
      <div class="card-face">
        <img v-if="cardImgUrl" :src="cardImgUrl" class="card-img" />
        <div v-else class="card-placeholder">
            {{ card ? card.label : '?' }}
        </div>
      </div>
      <div class="card-back-face">
        <div class="back-pattern"></div>
      </div>
    </div>

    <!-- 咪牌模式：牌背从左边慢慢折叠翻开，露出正面 -->
    <div v-else class="card-peek-container">
      <div class="peek-face">
        <img v-if="cardImgUrl" :src="cardImgUrl" class="card-img" />
        <div v-else class="card-placeholder">
            {{ card ? card.label : '?' }}
        </div>
      </div>
      <div class="peek-back" :class="{ 'is-peeking': isPeeking }"></div>
    </div>
  </div>
</template>

<style scoped>
.poker-card {
  width: 16vw;
  height: 21.4667vw;
  border-radius: 1.6vw;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  position: relative;
  box-sizing: border-box;
  user-select: none;
  perspective: 1000px;
}

.poker-card.is-small {
  width: 11vw;
  height: 15vw;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s;
  transform-style: preserve-3d;
  transform: rotateY(180deg); /* Start flipped */
}

.card-inner.is-flipped {
  transform: rotateY(0deg);
}

.card-face,
.card-back-face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 1.6vw;
  box-sizing: border-box;
  overflow: hidden; /* Ensure image doesn't bleed */
}

.card-face {
  background-color: white;
  /* Removed border to allow full bleed image if desired, or keep thin border */
}

.card-img {
    width: 100%;
    height: 100%;
    object-fit: fill; /* Use fill to match card dimensions exactly */
    display: block;
}

.card-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    font-size: 20px;
}

.card-back-face {
  background: url('@/assets/common/card_back.png') no-repeat center center;
  background-size: 100% 100%;
  transform: rotateY(180deg);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.back-pattern {
  display: none;
}

/* === 咪牌模式样式 === */
.card-peek-container {
  position: relative;
  width: 100%;
  height: 100%;
  perspective: 800px;
}

.peek-face {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 1.6vw;
  overflow: hidden;
  background-color: white;
  box-sizing: border-box;
}

.peek-back {
  position: absolute;
  width: 100%;
  height: 100%;
  background: url('@/assets/common/card_back.png') no-repeat center center;
  background-size: 100% 100%;
  border-radius: 1.6vw;
  box-sizing: border-box;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
  /* 左下角偏右上一点为旋转锚点 */
  transform-origin: 20% 80%;
}

.peek-back.is-peeking {
  animation: peek-reveal 3.2s forwards;
}

@keyframes peek-reveal {
  /* 第一段：缓慢旋转到 20°（~1.6s） */
  0% {
    transform: rotate(0deg) translateX(0);
    opacity: 1;
  }
  50% {
    transform: rotate(10deg) translateX(0);
    opacity: 1;
  }
  /* 第二段：稍快旋转到 38°（~0.72s） */
  72.5% {
    transform: rotate(28deg) translateX(0);
    opacity: 1;
  }
  /* 第三段：向右平移消失（~0.88s） */
  100% {
    transform: rotate(28deg) translateX(130%);
    opacity: 0;
  }
}
</style>