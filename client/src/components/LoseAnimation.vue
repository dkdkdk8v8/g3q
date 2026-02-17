<script setup>
import { onMounted, ref } from 'vue';

// Assets
import topLineImg from '@/assets/lose/top_line.png';
import bottomLineImg from '@/assets/lose/bottom_line.png';
import backColorImg from '@/assets/lose/line_back_over_color.png';
import loseTextLeftImg from '@/assets/lose/lose_text_left.png';
import loseTextRightImg from '@/assets/lose/lose_text_right.png';
import textRightTopIconImg from '@/assets/lose/text_right_top_icon.png';

const showRibbons = ref(false);
const showBackEffects = ref(false);
const showText = ref(false);
const showRightTextTilt = ref(false);

onMounted(() => {
    // Sequence 1: Ribbons enter immediately
    setTimeout(() => {
        showRibbons.value = true;
    }, 50);

    // Sequence 2: Back effects (0.3s delay)
    setTimeout(() => {
        showBackEffects.value = true;
    }, 350);

    // Sequence 3: Text appears (Scaling in)
    setTimeout(() => {
        showText.value = true;
    }, 550);

    // Sequence 4: Right text tilts (1s delay, after text appears)
    setTimeout(() => {
        showRightTextTilt.value = true;
    }, 1000);
});
</script>

<template>
    <div class="lose-anim-container">
        <!-- Layer 1: Ribbons -->
        <div class="layer-ribbons" :class="{ 'active': showRibbons }">
            <img :src="bottomLineImg" class="ribbon-bottom" />
            <img :src="topLineImg" class="ribbon-top" />
        </div>

        <!-- Layer 2: Center Effects -->
        <div class="layer-back-effects" :class="{ 'active': showBackEffects }">
            <img :src="backColorImg" class="back-color" />
        </div>

        <!-- Layer 3: Text & Icons -->
        <div class="layer-text-group">
            <div class="text-group-inner" :class="{ 'active': showText }">
                <!-- Text Container -->
                <div class="text-container">
                    <img :src="loseTextLeftImg" class="lose-text-left" />
                    <img :src="loseTextRightImg" class="lose-text-right" :class="{ 'tilt-active': showRightTextTilt }" />
                </div>
                <!-- Icon (Top Right) -->
                <img :src="textRightTopIconImg" class="text-rt-icon" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.lose-anim-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9000;
    overflow: hidden;
}

/* --- Layer 2: Back Effects --- */
.layer-back-effects {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.5s;
}

.layer-back-effects.active {
    opacity: 1;
}

.back-color {
    position: absolute;
    width: 80%;
    max-width: 600px;
    height: auto;
}

/* --- Layer 1: Ribbons --- */
.layer-ribbons {
    position: absolute;
    width: 100%;
    height: 300px;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2;
}

.ribbon-top,
.ribbon-bottom {
    position: absolute;
    width: 101%;
    height: auto;
    max-height: 200px;
    transition: transform 0.25s ease-out;
}

.ribbon-top {
    transform: translateX(-100%);
    z-index: 2;
    top: 60%;
    margin-top: -60px;
}

.ribbon-bottom {
    transform: translateX(100%);
    z-index: 1;
    top: 41.6%;
    margin-top: 10px;
}

.layer-ribbons.active .ribbon-top {
    transform: translateX(0);
}

.layer-ribbons.active .ribbon-bottom {
    transform: translateX(0);
}

/* --- Layer 3: Text Group --- */
.layer-text-group {
    position: absolute;
    z-index: 3;
    display: flex;
    justify-content: center;
    align-items: center;
}

.text-group-inner {
    position: relative;
    width: 400px;
    height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.text-group-inner.active {
    opacity: 1;
    transform: scale(1);
}

.text-container {
    display: flex;
    justify-content: center;
    align-items: center;
    /* Removed gap to allow overlap */
}

.lose-text-left {
    position: relative;
    z-index: 1;
    height: 68px;
    width: auto;
}

.lose-text-right {
    position: relative;
    z-index: 2;
    /* On top of left */
    height: 50px;
    width: auto;
    margin-left: -45px;
    margin-top: 10px;
    /* Adjust overlap amount */
    transform-origin: bottom left; /* Pivot point for tilt */
    transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.lose-text-right.tilt-active {
    transform: rotate(20deg);
}

.text-rt-icon {
    position: absolute;
    top: 70px;
    /* Adjust based on text position */
    right: 35%;
    /* Adjust based on text position */
    width: 18px;
    height: auto;
    /* User said "no animation needed" for this icon itself, 
       but it is inside text-group-inner so it scales with the group. 
       This fits "zoom out appearing" description for the whole group. */
}
</style>