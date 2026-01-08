<template>
    <span :style="{ color }">
        {{ text }}
    </span>
</template>

<script lang="ts" name="format-money" setup>
import { computed } from "vue";

const props = defineProps({
    value: {
        type: Number,
        default: 0,
    },
});

const color = computed(() => {
    if (props.value > 0) {
        return "var(--el-color-success)";
    } else if (props.value < 0) {
        return "var(--el-color-danger)";
    }
    return "";
});

const text = computed(() => {
    return (props.value / 100).toFixed(2);
});
</script>