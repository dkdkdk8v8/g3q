<template>
    <span :style="{ color }">
        {{ text }}
    </span>
</template>

<script lang="ts" name="format-money" setup>
import { computed } from "vue";

const props = defineProps({
    value: {
        type: [Number, String],
        default: 0,
    },
});

const numValue = computed(() => Number(props.value) || 0);

const color = computed(() => {
    if (numValue.value > 0) {
        return "var(--el-color-success)";
    } else if (numValue.value < 0) {
        return "var(--el-color-danger)";
    }
    return "";
});

const text = computed(() => {
    const num = (numValue.value / 100).toFixed(2);
    return numValue.value > 0 ? `+${num}` : num;
});
</script>