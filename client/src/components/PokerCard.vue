<script setup>
import { computed } from 'vue';

const props = defineProps({
  card: Object, // 如果没有card，显示背面
  isSmall: Boolean
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
    :class="{ 'card-back': !card, 'is-red': isRed, 'is-small': isSmall }"
  >
    <template v-if="card">
      <div class="card-top">
        <span class="rank">{{ card.label }}</span>
        <span class="suit">{{ suitSymbol }}</span>
      </div>
      <div class="card-center">
        {{ suitSymbol }}
      </div>
      <div class="card-bottom">
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
  box-shadow: 1px 1px 4px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 4px;
  box-sizing: border-box;
  font-family: 'Times New Roman', serif;
  user-select: none;
  position: relative;
}

.poker-card.is-small {
  width: 40px;
  height: 56px;
  padding: 2px;
  font-size: 0.8em;
}

.poker-card.is-red {
  color: #d40000;
}

.poker-card:not(.is-red) {
  color: #000;
}

.card-top, .card-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}

.card-bottom {
  transform: rotate(180deg);
}

.rank {
  font-weight: bold;
  font-size: 16px;
}
.is-small .rank {
  font-size: 12px;
}

.suit {
  font-size: 14px;
}
.is-small .suit {
  font-size: 10px;
}

.card-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
}
.is-small .card-center {
  font-size: 16px;
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
