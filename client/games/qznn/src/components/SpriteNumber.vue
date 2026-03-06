<template>
    <div class="sprite-number" :style="{ gap: gap + 'px' }">
        <template v-for="(char, index) in displayChars" :key="index">
            <img v-if="getAsset(char)" :src="getAsset(char)" :style="{ height: height + 'px' }" class="digit-img"
                :class="type" />
            <span v-else class="text-char" :class="type" :style="{ fontSize: height * 0.8 + 'px' }">{{ char }}</span>
        </template>
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
        default: 'white', // 'white', 'yellow', 'red'
        validator: (val) => ['white', 'yellow', 'red'].includes(val)
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
    return String(props.value).split('');
});

const getAsset = (char) => {
    // For red, we use yellow images as base and apply CSS filter
    const baseType = props.type === 'red' ? 'yellow' : props.type;
    return getNumberAsset(char, baseType);
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

.digit-img.red {
    /* Tint yellow image to red */
    /* filter: sepia(1) hue-rotate(-50deg) saturate(5) brightness(1.2); */
}

.text-char {
    font-weight: bold;
    font-family: monospace;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-bottom: 2px;
}

.text-char.yellow {
    color: #fde047;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.text-char.red {
    color: #ff3b30;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.text-char.white {
    color: #ffffff;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}
</style>