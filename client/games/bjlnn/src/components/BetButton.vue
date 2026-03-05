<template>
    <button :id="id" @click="(e) => $emit('bet', e)" :disabled="disabled" :class="[
        'relative w-full flex flex-col items-center justify-center py-2 h-full transition-all duration-300 overflow-hidden bg-transparent',
        borderClass,
        active ? 'bg-white/10' : 'hover:bg-white/5',
        isWinningGlobal ? 'z-20' : '',
        disabled && !active && !isWinningGlobal ? 'opacity-50 cursor-not-allowed' : ''
    ]">

        <div v-if="hasInfoClick"
            class="absolute top-1 left-1 p-1 z-30 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            @click.stop="$emit('infoClick')">
            <div
                class="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center bg-black/40 text-[10px] font-bold text-slate-200">
                ?</div>
        </div>

        <!-- Active Glow Box -->
        <div v-if="active && !isWinningGlobal"
            class="absolute inset-0 border-[1.5px] border-amber-400/60 shadow-[inset_0_0_15px_rgba(251,191,36,0.3)] pointer-events-none z-0">
        </div>

        <!-- Winning Stamp -->
        <div v-if="isWinningGlobal && winningStampText"
            class="absolute bottom-[4px] left-[4px] z-20 pointer-events-none animate-stamp-pop">
            <div
                class="relative w-[40px] h-[40px] p-[2px] flex items-center justify-center border-[2px] border-[#ef4444] shadow-sm bg-[#b91c1c]/10 rounded-[4px] overflow-hidden">
                <div class="absolute inset-[1px] border-[1.5px] border-[#ef4444]/60 rounded-[2px]" />
                <div
                    class="absolute top-0 right-0 w-2.5 h-2.5 border-l-2 border-b-2 border-[#ef4444]/50 transform rotate-45 -translate-y-[2px] translate-x-[2px]" />
                <div
                    class="absolute bottom-0 left-0 w-2 h-2 border-t-2 border-r-2 border-[#ef4444]/50 transform rotate-45 translate-y-[1px] -translate-x-[1px]" />
                <div class="absolute inset-0 opacity-[0.35] mix-blend-overlay"
                    style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')">
                </div>
                <div
                    class="relative z-10 flex flex-col items-center justify-center text-[#ef4444] space-y-[-4px] mt-[-1px]">
                    <span class="font-extrabold text-[15px] leading-none"
                        style="font-family: 'STKaiti', 'KaiTi', '楷体', serif; text-shadow: 0px 0.5px 0px rgba(0,0,0,0.5)">
                        {{ winningStampText[0] }}
                    </span>
                    <span class="font-extrabold text-[15px] leading-none"
                        style="font-family: 'STKaiti', 'KaiTi', '楷体', serif; text-shadow: 0px 0.5px 0px rgba(0,0,0,0.5)">
                        {{ winningStampText[1] }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Text Labels -->
        <div class="flex flex-col items-center justify-center w-full z-10 leading-none gap-1.5 opacity-90">
            <span :class="[
                'text-[16px] font-black tracking-widest whitespace-nowrap transition-transform duration-500',
                selColor,
                isWinningGlobal ? 'scale-110 drop-shadow-[0_0_10px_rgba(251,191,36,1)]' : ''
            ]">{{ label }}</span>
            <span :class="[
                'text-[10px] font-bold whitespace-nowrap',
                active ? 'text-amber-400' : 'text-emerald-400/60',
                isWinningGlobal ? 'text-amber-300' : ''
            ]">{{ odds }}</span>
        </div>

        <!-- Bet Amount Tag -->
        <div v-if="amount"
            class="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] font-black px-2 py-[3px] rounded-bl-lg shadow-sm border-b border-l border-amber-300 animate-bounce-in z-20 flex items-center justify-center leading-none">
            {{ amount }}
        </div>

        <!-- Placed Chips Container (Visual) -->
        <div class="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <div v-for="c in placedChips" :key="c.id" class="absolute transition-transform"
                :style="{ transform: `translate(${c.dx}px, ${c.dy}px) scale(0.35)` }">
                <div class="shadow-[0_4px_10px_rgba(0,0,0,0.6)] rounded-full">
                    <div class="relative rounded-full flex-none w-[45px] h-[45px]">
                        <div class="absolute inset-0 rounded-full overflow-hidden ring-1 ring-white/10" :style="{
                            background: getChipConicGradient(c.val),
                            padding: '3px'
                        }">
                            <div class="absolute inset-[4px] rounded-full bg-slate-900 shadow-inner" />
                            <div class="absolute inset-[5px] rounded-full"
                                :style="{ background: `radial-gradient(circle at 50% 30%, ${getChipColor(c.val)}, #000)` }" />
                        </div>
                        <span
                            class="absolute inset-0 flex items-center justify-center font-black text-[15px] text-white drop-shadow-[0_2px_1px_rgba(0,0,0,1)] tracking-tighter w-full h-full align-middle leading-none">
                            {{ c.val >= 1000 ? `${c.val / 1000}k` : c.val }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

    </button>
</template>

<script setup>
import { computed } from 'vue';
import { CHIP_DATA } from '../utils/gameLogic';

const props = defineProps({
    id: String,
    label: String,
    odds: String,
    active: Boolean,
    amount: Number,
    accent: String,
    special: String,
    disabled: Boolean,
    groupType: String,
    placedChips: {
        type: Array,
        default: () => []
    },
    hasInfoClick: Boolean,
    isWinningGlobal: Boolean,
    winningStampText: Array
});

defineEmits(['bet', 'infoClick']);

const getChipColor = (val) => {
    const cd = CHIP_DATA.find(c => c.val === val);
    return cd ? cd.color : '#fbbf24';
}

const getChipConicGradient = (val) => {
    const color = getChipColor(val);
    return `conic-gradient(#fff 0deg 30deg, ${color} 30deg 60deg, #fff 60deg 90deg, ${color} 90deg 120deg, #fff 120deg 150deg, ${color} 150deg 180deg, #fff 180deg 210deg, ${color} 210deg 240deg, #fff 240deg 270deg, ${color} 270deg 300deg, #fff 300deg 330deg, ${color} 330deg 360deg)`;
}

const colors = {
    cyan: "text-cyan-400",
    purple: "text-purple-400",
    orange: "text-orange-400",
    red: "text-red-400",
    gold: "text-amber-400",
    "": "text-slate-300"
};

const selColor = computed(() => {
    return props.special ? colors[props.special] : (colors[props.accent] || colors[""]);
});

const borderClass = computed(() => {
    if (props.groupType === 'top') return "border-b border-emerald-500/40";
    return "";
});
</script>
