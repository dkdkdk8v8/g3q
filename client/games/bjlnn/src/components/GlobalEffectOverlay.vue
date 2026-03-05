<template>
    <div v-if="effect"
        class="fixed inset-0 z-[1000] pointer-events-none flex items-center justify-center overflow-hidden"
        :style="originStyle">

        <template v-if="effect.type === 'epic_flower'">
            <div :class="['w-full h-full relative flex items-center justify-center origin-center', phaseClass]">
                <div class="absolute inset-0 bg-amber-900/60 animate-flash-fast"></div>
                <div class="relative animate-flower-epic-popup group z-10">
                    <h1 class="text-[100px] font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-50 via-yellow-300 to-amber-700 drop-shadow-[0_20px_40px_rgba(217,119,6,0.8)] metallic-liquid"
                        style="-webkit-text-stroke: 2px rgba(255,255,255,0.5)">
                        五花牛
                    </h1>
                    <div class="absolute -inset-20 bg-amber-400/40 opacity-50 rounded-full animate-pulse-fast"></div>
                    <div class="absolute -inset-10 bg-white/30 rounded-full animate-ping"></div>
                </div>
                <div class="absolute inset-0 flex items-center justify-center z-0">
                    <div v-for="i in 20" :key="`flower-${i}`"
                        class="absolute h-[8px] bg-gradient-to-r from-transparent via-amber-200 to-transparent animate-beam-converge"
                        :style="{
                            width: '150vw',
                            transform: `rotate(${Math.random() * 360}deg)`,
                            animationDelay: `${Math.random() * 0.8}s`,
                            animationDuration: `${0.6 + Math.random() * 0.8}s`
                        }"></div>
                </div>
            </div>
        </template>

        <template v-else-if="effect.type === 'epic_small'">
            <div :class="['w-full h-full flex items-center justify-center origin-center', phaseClass]">
                <div class="absolute inset-0 bg-cyan-900/80 animate-flash-fast z-0"></div>
                <div class="relative z-10 animate-flower-epic-popup">
                    <h1 class="text-[100px] font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-50 via-cyan-300 to-blue-700 drop-shadow-[0_20px_40px_rgba(6,182,212,0.8)] metallic-liquid"
                        style="-webkit-text-stroke: 2px rgba(255,255,255,0.5)">
                        五小牛
                    </h1>
                    <div class="absolute -inset-20 bg-cyan-400/40 opacity-50 rounded-full animate-pulse-fast"></div>
                </div>
                <div class="w-full flex justify-center absolute inset-0 z-0">
                    <div
                        class="w-[400px] h-full bg-gradient-to-r from-transparent via-cyan-100 to-transparent opacity-90 animate-heavenly-beam">
                    </div>
                    <div
                        class="w-[200px] h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-100 animate-heavenly-beam">
                    </div>
                </div>
                <div class="absolute inset-0 bg-white/30 animate-flash-fast pointer-events-none"></div>
            </div>
        </template>

        <template v-else-if="effect.type === 'epic_bomb'">
            <div :class="['w-full h-full relative flex items-center justify-center origin-center', phaseClass]">
                <div class="absolute inset-0 bg-red-950/90 animate-flash-red pointer-events-none z-0"></div>
                <div class="absolute inset-0 bg-orange-600/40 animate-pulse z-0"></div>
                <div class="relative z-20 animate-flower-epic-popup">
                    <h1 class="text-[120px] font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-red-100 via-red-500 to-red-950 drop-shadow-[0_20px_50px_rgba(220,38,38,1)] metallic-liquid"
                        style="-webkit-text-stroke: 3px rgba(255,215,0,0.8)">
                        四炸
                    </h1>
                    <div class="absolute -inset-32 bg-red-600/60 opacity-60 rounded-full animate-pulse-fast"></div>
                </div>
                <div class="absolute inset-0 z-10 overflow-hidden">
                    <div v-for="i in 16" :key="`bomb-${i}`"
                        class="absolute text-[80px] animate-bomb-fly drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" :style="{
                            left: `${-20}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 0.5}s`,
                            animationDuration: `${0.4 + Math.random() * 0.4}s`
                        }">
                        💣
                    </div>
                </div>
            </div>
        </template>

    </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue';

const props = defineProps({
    effect: {
        type: Object,
        default: null
    }
});

const phase = ref('idle');
let timeoutId = null;
let originStyleData = ref({});

const phaseClass = computed(() => {
    if (phase.value === 'expanding') return 'animate-epic-expand';
    if (phase.value === 'retracting') return 'animate-epic-retract';
    return '';
});

const originStyle = computed(() => originStyleData.value);

watch(() => props.effect, (newEffect) => {
    if (timeoutId) clearTimeout(timeoutId);

    if (newEffect && newEffect.type) {
        calculateOriginStyle(newEffect.originId);
        phase.value = 'expanding';
        timeoutId = setTimeout(() => {
            phase.value = 'retracting';
        }, 2500);
    } else {
        phase.value = 'idle';
        originStyleData.value = {};
    }
}, { deep: true, immediate: true });

const calculateOriginStyle = (originId) => {
    if (!originId) {
        originStyleData.value = {};
        return;
    }

    const el = document.getElementById(originId);
    if (el) {
        const rect = el.getBoundingClientRect();
        const vW = window.innerWidth / 2;
        const vH = window.innerHeight / 2;
        const cX = rect.left + rect.width / 2;
        const cY = rect.top + rect.height / 2;
        const diffX = cX - vW;
        const diffY = cY - vH;

        originStyleData.value = {
            '--origin-x': `${diffX}px`,
            '--origin-y': `${diffY}px`,
            transformOrigin: `${cX}px ${cY}px`
        };
    }
};

onBeforeUnmount(() => {
    if (timeoutId) clearTimeout(timeoutId);
});
</script>
