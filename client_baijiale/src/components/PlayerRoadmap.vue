<template>
    <div
        class="flex flex-col w-full border-r border-white/10 last:border-0 h-full backdrop-blur-sm bg-black/20 relative">
        <span
            class="absolute bottom-1 left-2 text-white/10 text-xl font-black italic select-none pointer-events-none tracking-widest leading-none z-0">
            大路
        </span>
        <div class="flex items-center justify-center h-[14px] bg-black/40 border-b border-white/5 relative z-10">
            <span :class="['text-[7px] font-black uppercase tracking-tighter', accentColor]">{{ label }}</span>
        </div>

        <div ref="containerRef" class="flex-1 flex overflow-x-auto custom-scrollbar p-1 gap-0.5">
            <div v-for="(col, cIdx) in roadData" :key="cIdx" class="flex flex-col gap-0.5 min-w-[12px]">
                <div v-for="(cell, rIdx) in col" :key="rIdx" class="w-3 h-3 flex items-center justify-center relative">
                    <div :class="[
                        'w-2.5 h-2.5 rounded-full border-[1.2px] relative bg-transparent animate-pulse-slow',
                        cell.winner === 'banker' ? 'border-red-500 shadow-[0_0_4px_#ef4444]' : 'border-blue-500 shadow-[0_0_4px_#3b82f6]'
                    ]">
                        <div v-if="cell.isSpecial" class="absolute inset-0 flex items-center justify-center">
                            <div class="w-[85%] h-[1px] bg-emerald-400 rotate-45"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps({
    history: {
        type: Array,
        default: () => []
    },
    label: {
        type: String,
        required: true
    },
    accentColor: {
        type: String,
        default: 'text-white'
    }
});

const containerRef = ref(null);

watch(() => props.history, async () => {
    await nextTick();
    if (containerRef.value) {
        containerRef.value.scrollLeft = containerRef.value.scrollWidth;
    }
}, { deep: true });

const roadData = computed(() => {
    if (!props.history || props.history.length === 0) return [];

    let matrix = [];
    let curCol = [];
    let prevType = null;

    props.history.forEach((res) => {
        const type = res.winner === 'banker' ? 'red' : 'blue';
        if (type !== prevType || curCol.length === 6) {
            if (curCol.length > 0) matrix.push(curCol);
            curCol = [];
        }
        curCol.push(res);
        prevType = type;
    });

    if (curCol.length > 0) matrix.push(curCol);
    return matrix;
});
</script>
