<template>
    <div v-if="scoreObj" :class="[
        `px-2 py-0.5 bg-gradient-to-b font-black uppercase whitespace-nowrap border rounded-sm shadow-lg z-[60]`,
        styles[scoreObj.type] || 'from-gray-700 to-gray-900',
        small ? 'text-[8px]' : 'text-[10px]'
    ]">
        {{ scoreObj.label }}
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    scoreObj: {
        type: Object,
        default: null
    },
    small: {
        type: Boolean,
        default: false
    }
});

const styles = {
    epic_bomb: "from-red-600 to-red-950 text-white border-red-400 shadow-red-900/50",
    epic_small: "from-blue-400 to-indigo-900 text-white border-cyan-300",
    epic_flower: "from-purple-600 to-amber-900 text-yellow-200 border-yellow-400",
    gold_niuniu: "from-amber-500 to-amber-800 text-amber-50 border-amber-300/50",
    bronze_high: "from-slate-300 to-slate-500 text-slate-900 border-white",
    niu_1_6: "from-emerald-600 to-emerald-950 text-emerald-100 border-emerald-500/50",
    no_niu: "from-slate-700 to-slate-900 text-slate-400 border-slate-600/30",
};
</script>
