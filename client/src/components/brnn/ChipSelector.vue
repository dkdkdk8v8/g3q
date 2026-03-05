<script setup>
const props = defineProps({
  chips: Array,
  selected: Number,
})

const emit = defineEmits(['select'])

function formatChip(value) {
  if (value >= 10000) return (value / 10000) + 'w'
  if (value >= 1000) return (value / 1000) + 'k'
  return value.toString()
}

function onSelect(chipValue) {
  emit('select', chipValue)
}
</script>

<template>
  <div class="chip-selector">
    <div class="chip-label">筹码</div>
    <div class="chip-row">
      <button
        v-for="chip in chips"
        :key="chip"
        class="chip-btn"
        :class="{ 'chip-selected': chip === selected }"
        @click="onSelect(chip)"
      >
        {{ formatChip(chip) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.chip-selector {
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.chip-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  margin-bottom: 6px;
  text-align: center;
}

.chip-row {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.chip-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, #4a4a5a, #2a2a3a);
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.chip-btn:active {
  transform: scale(0.92);
}

.chip-btn.chip-selected {
  border-color: #ffd700;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
  background: linear-gradient(135deg, #5a5a2a, #3a3a1a);
  color: #ffd700;
}
</style>
