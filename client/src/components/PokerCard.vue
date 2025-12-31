<script setup>
import { watch } from 'vue';
import { computed, onMounted, ref } from 'vue';

const props = defineProps({
  card: Object, // 如果没有card，显示背面
  isSmall: Boolean
});

// 是否触发翻转动画
const animateFlip = ref(false);

const triggerFlip = () => {
    animateFlip.value = false;
    setTimeout(() => {
        animateFlip.value = true;
    }, 10);
};

onMounted(() => {
    // 如果挂载时就有牌面（通常是自己的牌），播放翻转动画
    if (props.card) {
        animateFlip.value = true;
    }
});

watch(() => props.card, (newVal) => {
    if (newVal) {
        triggerFlip();
    }
});

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
    :class="{ 'card-back': !card, 'is-red': isRed, 'is-small': isSmall, 'animate-flip': animateFlip }"
  >
    <template v-if="card">
      <!-- 左上角标 -->
      <div class="corner-top-left">
        <span class="rank">{{ card.label }}</span>
        <span class="suit">{{ suitSymbol }}</span>
      </div>
      
      <!-- 中间大花色 -->
      <div class="card-center">
        {{ suitSymbol }}
      </div>
      
      <!-- 右下角标 (旋转180度) -->
      <div class="corner-bottom-right">
        <span class="rank">{{ card.label }}</span>
        <span class="suit">{{ suitSymbol }}</span>
      </div>
    </template>
    <template v-else>
      <div class="back-pattern"></div>
    </template>
  </div>
</template>

<style scoped>
.poker-card {
  width: 60px;
  height: 84px;
  background-color: white;
  border-radius: 6px;
  /* 优化阴影效果 */
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  position: relative; /* 绝对定位基准 */
  box-sizing: border-box;
  font-family: 'Times New Roman', serif;
  user-select: none;
  /* 3D 效果支持 */
  backface-visibility: hidden; 
}

.animate-flip {
    animation: flipEnter 0.6s ease-out;
}

@keyframes flipEnter {
    0% { transform: rotateY(180deg); }
    100% { transform: rotateY(0); }
}

.poker-card.is-small {
  width: 40px;
  height: 56px;
  /* 小牌字体缩小 */
  font-size: 0.8em;
}

.poker-card.is-red {
  color: #d40000;
}

.poker-card:not(.is-red) {
  color: #000;
}

/* 角标通用样式 */
.corner-top-left, .corner-bottom-right {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  width: 15px; /* 限制宽度防止溢出 */
}

.corner-top-left {
  top: 4px;
  left: 4px;
}

.corner-bottom-right {
  bottom: 4px;
  right: 4px;
  transform: rotate(180deg);
}

.is-small .corner-top-left { top: 2px; left: 2px; }
.is-small .corner-bottom-right { bottom: 2px; right: 2px; }

.rank {
  font-weight: bold;
  font-size: 16px;
  letter-spacing: -1px;
}
.is-small .rank {
  font-size: 12px;
}

.suit {
  font-size: 14px;
  margin-top: 2px;
}
.is-small .suit {
  font-size: 10px;
  margin-top: 0;
}

.card-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 32px; /* 更大的中间花色 */
}
.is-small .card-center {
  font-size: 20px;
}

.card-back {
  background: #3b5bdb; /* 蓝色背景 */
  border: 2px solid white;
}

.back-pattern {
  width: 100%;
  height: 100%;
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
  opacity: 0.5;
  border-radius: 4px;
}
</style>
