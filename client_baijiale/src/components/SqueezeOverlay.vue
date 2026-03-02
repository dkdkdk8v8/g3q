<template>
    <div class="absolute z-[100] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        :style="{ width: squeezeW + 'px', height: squeezeH + 'px' }">
        <div class="w-full h-full rounded-[3px] shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden relative border border-white"
            style="background: linear-gradient(to bottom, #fafafa 0%, #e4e4e7 100%)">

            <!-- Squeeze Front Content -->
            <div
                class="absolute top-0 left-0 w-full h-full flex flex-col items-start pt-[3px] pl-[4px] z-20 leading-none">
                <span class="tracking-tighter" :style="rankStyle">{{ card.rank || '?' }}</span>
                <svg viewBox="0 0 100 100" :style="suitSmallStyle">
                    <path :d="SUIT_ICONS[card.suit || 'spade']" :fill="color" />
                </svg>
            </div>
            <div class="absolute inset-0 flex items-end justify-center pb-2 opacity-90 z-10">
                <svg viewBox="0 0 100 100" style="width: 60%; height: 60%;">
                    <path :d="SUIT_ICONS[card.suit || 'spade']" :fill="color" />
                </svg>
            </div>

            <!-- Squeeze Slide Covering layer -->
            <div class="absolute inset-0 flex items-center justify-center animate-slide-reveal z-30"
                :style="slideStyle">
                <Crown v-if="CrownIcon" :size="squeezeW * 0.5" class="text-amber-400 opacity-60 relative z-20" />
                <div
                    class="absolute right-0 top-0 bottom-0 w-2.5 bg-gradient-to-l from-black/40 via-black/10 to-transparent">
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { Crown } from 'lucide-vue-next';
import { CARD_SIZES, SUIT_ICONS } from '../utils/gameLogic';

const props = defineProps({
    card: { type: Object, required: true },
    size: { type: String, default: 'xs' },
    duration: { type: Number, default: 1200 }
});

const CrownIcon = Crown;

const dim = computed(() => CARD_SIZES[props.size] || CARD_SIZES.xs);
const squeezeW = computed(() => dim.value.w * 1.4);
const squeezeH = computed(() => dim.value.h * 1.4);

const isRed = computed(() => ['heart', 'diamond'].includes(props.card.suit));
const color = computed(() => isRed.value ? "#b91c1c" : "#09090b");

const rankStyle = computed(() => ({
    fontSize: `${parseInt(dim.value.font) * 1.5}px`,
    color: color.value,
    fontFamily: "'Arial Narrow', 'Helvetica Condensed', sans-serif",
    fontWeight: '500',
    transform: 'scaleY(1.3)',
    transformOrigin: 'top left'
}));

const suitSmallStyle = computed(() => ({
    width: parseInt(dim.value.font) * 0.9 + 'px',
    height: parseInt(dim.value.font) * 0.9 + 'px',
    marginTop: '3px',
    marginLeft: '1px'
}));

const slideStyle = computed(() => ({
    animationDuration: `${props.duration}ms`,
    backgroundColor: '#1e40af',
    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05)), linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05))',
    backgroundSize: '6px 6px, 12px 12px, 12px 12px',
    borderRight: '1.5px solid #ffffff'
}));
</script>
