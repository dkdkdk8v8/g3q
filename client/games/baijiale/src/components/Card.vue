<template>
    <div :class="['relative', { 'animate-float-card': float }]"
        :style="{ width: dim.w + 'px', height: dim.h + 'px', perspective: '800px' }">
        <div :style="wrapperStyle">
            <!-- Card Back -->
            <div :style="cardBackStyle">
                <Crown v-if="CrownIcon" :size="dim.w * 0.6" class="text-amber-400 opacity-60 relative z-10" />
            </div>

            <!-- Card Front -->
            <div :style="cardFrontStyle">
                <div
                    class="absolute top-0 left-0 w-full h-full flex flex-col items-start pt-[2px] pl-[3px] z-10 leading-none">
                    <span class="tracking-tighter" :style="rankStyle">{{ rank || '?' }}</span>
                    <svg viewBox="0 0 100 100" :style="suitSmallStyle">
                        <path :d="SUIT_ICONS[suit || 'spade']" :fill="color" />
                    </svg>
                </div>
                <div class="absolute inset-0 flex items-end justify-center pb-1.5 opacity-90">
                    <svg viewBox="0 0 100 100" style="width: 60%; height: 60%;">
                        <path :d="SUIT_ICONS[suit || 'spade']" :fill="color" />
                    </svg>
                </div>

                <!-- Base Mask -->
                <div
                    :style="{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', opacity: isBase ? 0.8 : 0, transition: 'opacity 500ms ease' }">
                </div>

                <!-- Lightning Effect -->
                <svg v-if="lightning" class="absolute inset-0 w-full h-full pointer-events-none z-20"
                    viewBox="0 0 100 100">
                    <path d="M10 20 L40 50 L10 80" stroke="rgba(168,85,247,0.8)" fill="none" class="animate-arc-jumping"
                        stroke-width="2" />
                    <path d="M90 20 L60 50 L90 80" stroke="rgba(245,158,11,0.8)" fill="none" class="animate-arc-jumping"
                        style="animation-delay: 0.1s" stroke-width="2" />
                    <path d="M20 10 L50 40 L80 10" stroke="white" fill="none" class="animate-arc-jumping"
                        style="animation-delay: 0.2s" stroke-width="1" />
                </svg>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { Crown } from 'lucide-vue-next';
import { CARD_SIZES, SUIT_ICONS } from '../utils/gameLogic';

const props = defineProps({
    revealed: Boolean,
    size: { type: String, default: 'xs' },
    suit: String,
    rank: String,
    isBase: Boolean,
    float: Boolean,
    lightning: Boolean,
    skipAnim: Boolean
});

const CrownIcon = Crown;

const dim = computed(() => CARD_SIZES[props.size] || CARD_SIZES.xs);
const isRed = computed(() => ['heart', 'diamond'].includes(props.suit));
const color = computed(() => isRed.value ? "#b91c1c" : "#09090b");

const wrapperStyle = computed(() => ({
    width: '100%',
    height: '100%',
    position: 'relative',
    transition: props.skipAnim ? 'none' : 'transform 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
    transformStyle: 'preserve-3d',
    transform: props.revealed ? 'rotateY(180deg)' : 'rotateY(0deg)'
}));

const cardBackStyle = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    backgroundColor: '#1e40af',
    borderRadius: '3px',
    border: '1.5px solid #ffffff',
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05)), linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05))',
    backgroundSize: '6px 6px, 12px 12px, 12px 12px'
};

const cardFrontStyle = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    background: 'linear-gradient(to bottom, #fafafa 0%, #e4e4e7 100%)',
    transform: 'rotateY(180deg)',
    borderRadius: '3px',
    border: '1px solid #d4d4d8',
    boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
    overflow: 'hidden'
};

const rankStyle = computed(() => ({
    fontSize: dim.value.font,
    color: color.value,
    fontFamily: "'Arial Narrow', 'Helvetica Condensed', sans-serif",
    fontWeight: '500',
    transform: 'scaleY(1.3)',
    transformOrigin: 'top left'
}));

const suitSmallStyle = computed(() => ({
    width: parseInt(dim.value.font) * 0.6 + 'px',
    height: parseInt(dim.value.font) * 0.6 + 'px',
    marginTop: '2px',
    marginLeft: '0.5px'
}));
</script>
