<template>
    <div v-if="active && scoreObj" class="absolute inset-0 pointer-events-none z-20 overflow-visible">

        <template v-if="scoreObj.type === 'epic_flower'">
            <div
                class="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center animate-fade-in duration-500">
                <div
                    class="absolute inset-0 border border-yellow-500/40 rounded-xl animate-gold-pulse-fast shadow-[inset_0_0_20px_rgba(245,158,11,0.3)]">
                </div>
                <div class="animate-lion-glow">
                    <LionCrest />
                </div>
                <div class="absolute inset-0 overflow-hidden">
                    <div v-for="i in 12" :key="`ef-${i}`"
                        class="absolute bg-amber-400 rounded-full animate-particle-converge" :style="{
                            width: '2px', height: '15px',
                            left: '50%', top: '50%',
                            '--tw-rotate': `${(i - 1) * 30}deg`,
                            '--tw-distance': '100px'
                        }"></div>
                </div>
            </div>
        </template>

        <template v-else-if="scoreObj.type === 'bronze_high'">
            <div
                class="absolute inset-0 border-2 border-slate-200/60 animate-silver-pulse rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.4)]">
            </div>
        </template>

        <template v-else-if="scoreObj.type === 'gold_niuniu'">
            <div
                class="absolute inset-0 rounded-xl overflow-hidden border border-amber-500/30 shadow-[0_0_20px_rgba(217,119,6,0.2)]">
                <div
                    class="absolute inset-0 bg-gradient-to-br from-amber-900/40 via-amber-700/20 to-amber-900/40 animate-gold-breathe">
                </div>
                <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/10 to-transparent -translate-x-full animate-gold-sweep">
                </div>
                <div class="absolute inset-0 flex items-center justify-center opacity-[0.08]">
                    <svg class="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="white" stroke-width="0.5"
                            stroke-dasharray="5 5"></circle>
                    </svg>
                </div>
            </div>
        </template>

        <template v-else-if="scoreObj.type === 'epic_small'">
            <div class="absolute inset-0 bg-white/20 animate-rainbow-flow rounded-xl"></div>
        </template>

        <template v-else-if="scoreObj.type === 'epic_bomb'">
            <div class="absolute inset-0 border-2 border-red-600 animate-red-pulse rounded-xl overflow-hidden">
                <div v-for="i in 4" :key="`eb-${i}`"
                    class="absolute w-2 h-2 bg-yellow-500 rounded-full animate-mini-explode" :style="{
                        left: `${20 + Math.random() * 60}%`,
                        top: `${20 + Math.random() * 60}%`,
                        animationDelay: `${(i - 1) * 0.4}s`
                    }">
                </div>
            </div>
        </template>

    </div>
</template>

<script setup>
import { computed } from 'vue';
import LionCrest from './LionCrest.vue';

const props = defineProps({
    scoreObj: {
        type: Object,
        default: null
    },
    active: {
        type: Boolean,
        default: false
    }
});
</script>
