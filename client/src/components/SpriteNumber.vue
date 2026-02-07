<template>
    <div class="sprite-number" :style="{ gap: gap + 'px' }">
        <img v-for="(char, index) in displayChars" :key="index" :src="getAsset(char)" :style="{ height: height + 'px' }"
            class="digit-img" />
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { getNumberAsset } from '../utils/numberAssets.js';

const props = defineProps({
    value: {
        type: [Number, String],
        required: true
    },
    type: {
        type: String,
        default: 'white', // 'white' or 'yellow'
        validator: (val) => ['white', 'yellow'].includes(val)
    },
    height: {
        type: Number,
        default: 20
    },
    gap: {
        type: Number,
        default: -2 // Default slight overlap or tight spacing usually looks better for numbers
    }
});

const displayChars = computed(() => {
    return String(props.value).split('').filter(c => /[0-9]/.test(c));
});

const getAsset = (char) => {
    // Only map digits, ignore other chars or return null
    if (/[0-9]/.test(char)) {
        return getNumberAsset(char, props.type);
    }
    return null; // Or placeholder
};
</script>

<style scoped>
.sprite-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.digit-img {
    width: auto;
    object-fit: contain;
    display: block;
}
</style>