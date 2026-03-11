<template>
  <span class="poker-card" :class="[suitClass, { 'is-facedown': facedown, 'is-small': size === 'small' }]">
    <template v-if="!facedown && cardInfo">
      <span class="card-rank">{{ cardInfo.rank }}</span>
      <span class="card-suit">{{ cardInfo.suit }}</span>
    </template>
    <template v-else-if="facedown">
      <span class="card-back"></span>
    </template>
  </span>
</template>

<script lang="ts" setup>
import { computed } from "vue";

const props = withDefaults(defineProps<{
  value: number;
  facedown?: boolean;
  size?: "normal" | "small";
}>(), {
  facedown: false,
  size: "normal",
});

const rankMap = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suitSymbols = ["♠", "♥", "♣", "♦"];
const suitNames = ["spade", "heart", "club", "diamond"];

const cardInfo = computed(() => {
  const v = props.value;
  if (v === undefined || v === null || v < 0 || v > 51) return null;
  const rankIdx = Math.floor(v / 4);
  const suitIdx = v % 4;
  return {
    rank: rankMap[rankIdx],
    suit: suitSymbols[suitIdx],
    suitName: suitNames[suitIdx],
  };
});

const suitClass = computed(() => {
  if (!cardInfo.value) return "";
  return `suit-${cardInfo.value.suitName}`;
});
</script>

<style lang="scss" scoped>
.poker-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 42px;
  border-radius: 4px;
  background: linear-gradient(145deg, #ffffff, #f8f9fa);
  border: 1px solid #d0d5dd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
  position: relative;
  font-family: "Georgia", "Times New Roman", serif;
  cursor: default;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  flex-shrink: 0;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  // Dark mode
  :global(.dark) & {
    background: linear-gradient(145deg, #2c2c2e, #1c1c1e);
    border-color: #48484a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);

    &:hover {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }
  }

  .card-rank {
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: -1px;
  }

  .card-suit {
    font-size: 11px;
    line-height: 1;
  }

  // Suit colors
  &.suit-spade,
  &.suit-club {
    .card-rank,
    .card-suit {
      color: #1a1a2e;
    }

    :global(.dark) & {
      .card-rank,
      .card-suit {
        color: #e5e5ea;
      }
    }
  }

  &.suit-heart,
  &.suit-diamond {
    .card-rank,
    .card-suit {
      color: #dc2626;
    }

    :global(.dark) & {
      .card-rank,
      .card-suit {
        color: #ef4444;
      }
    }
  }

  // Small size variant
  &.is-small {
    width: 26px;
    height: 34px;
    border-radius: 3px;

    .card-rank {
      font-size: 11px;
    }

    .card-suit {
      font-size: 9px;
    }
  }

  // Facedown card
  &.is-facedown {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border-color: #1e40af;

    :global(.dark) & {
      background: linear-gradient(135deg, #2563eb, #1e3a8a);
      border-color: #1e3a8a;
    }

    .card-back {
      width: 70%;
      height: 75%;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 2px,
        rgba(255, 255, 255, 0.1) 2px,
        rgba(255, 255, 255, 0.1) 4px
      );
    }
  }
}
</style>
