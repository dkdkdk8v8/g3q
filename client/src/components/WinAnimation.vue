<script setup>
import { onMounted, ref } from 'vue';

// Assets
import topLineImg from '@/assets/win/top_line.png';
import bottomLineImg from '@/assets/win/bottom_line.png';
import backColorImg from '@/assets/win/line_back_over_color.png';
import circleLightImg from '@/assets/win/circle_light.png';
import winTextImg from '@/assets/win/win_text.png';
import textBgIconImg from '@/assets/win/text_background_icon.png';
import bigDiamondImg from '@/assets/win/big_diamond.png';
import textLeftBottomIconImg from '@/assets/win/text_left_botton_icon.png';
import textRightTopIconImg from '@/assets/win/text_right_top_icon.png';
import textRightBottomIconImg from '@/assets/win/text_right_bottom_icon.png';

const showRibbons = ref(false);
const showBackEffects = ref(false);
const showTextGroup = ref(false);

onMounted(() => {
    // Sequence 1: Ribbons enter immediately
    showRibbons.value = true;

    // Sequence 2: Back effects (0.3s delay)
    setTimeout(() => {
        showBackEffects.value = true;
    }, 300);

    // Sequence 3: Text Smash (0.6s delay)
    setTimeout(() => {
        showTextGroup.value = true;
    }, 600);
});
</script>

<template>
    <div class="win-anim-container">
        <!-- Layer 1: Ribbons -->
        <div class="layer-ribbons" :class="{ 'active': showRibbons }">
            <img :src="bottomLineImg" class="ribbon-bottom" />
            <img :src="topLineImg" class="ribbon-top" />
        </div>

        <!-- Layer 2: Center Effects (Behind text, In front of ribbons) -->
        <!-- Note: User said "circle_light is above gray background, but blocked by ribbons". 
             This implies Z-order: BackColor < CircleLight < Ribbons < Text.
             Wait, "line_back_over_color ... behind the ribbons".
             "circle_light ... above gray, but also blocked by ribbons".
             So: BackColor < CircleLight < Ribbons.
        -->
        <div class="layer-back-effects" :class="{ 'active': showBackEffects }">
            <img :src="backColorImg" class="back-color" />
            <div class="light-circle-wrapper">
                <img :src="circleLightImg" class="light-circle" />
            </div>
        </div>

        <!-- Layer 3: Text & Decorations (Topmost) -->
        <div class="layer-text-group" :class="{ 'active': showTextGroup }">
            <div class="text-group-inner">
                <!-- Behind Text -->
                <img :src="textBgIconImg" class="text-bg-icon" />
                <img :src="bigDiamondImg" class="big-diamond" />

                <!-- The Text -->
                <img :src="winTextImg" class="win-text" />

                <!-- On Top of Text -->
                <img :src="textLeftBottomIconImg" class="text-lb-icon" />
                <div class="right-top-icons">
                    <img :src="textRightTopIconImg" class="text-rt-top" />
                    <img :src="textRightBottomIconImg" class="text-rt-bottom" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.win-anim-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9000; /* High z-index */
    overflow: hidden;
}

/* --- Layer 2: Back Effects (Lowest Z-Index relative to others here) --- */
.layer-back-effects {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1; /* Lowest */
    opacity: 0;
    transition: opacity 0.5s;
}
.layer-back-effects.active {
    opacity: 1;
}
.back-color {
    position: absolute;
    width: 80%; /* Adjust as needed */
    max-width: 600px;
    height: auto;
}
.light-circle-wrapper {
    position: absolute;
    width: 300px;
    height: 300px;
    display: flex;
    justify-content: center;
    align-items: center;
}
.light-circle {
    width: 100%;
    height: 100%;
    animation: rotateCircle 4s linear infinite;
}
@keyframes rotateCircle {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* --- Layer 1: Ribbons (Middle Z-Index) --- */
.layer-ribbons {
    position: absolute;
    width: 100%;
    height: 300px; /* Approximate height */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2; /* Above Back Effects */
}

.ribbon-top, .ribbon-bottom {
    position: absolute;
    width: 120%; /* Wider than screen to slide in */
    height: auto;
    max-height: 200px;
    transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.ribbon-top {
    transform: translateX(-100%);
    z-index: 2;
    top: 50%;
    margin-top: -60px; /* Adjust vertical overlap */
}

.ribbon-bottom {
    transform: translateX(100%);
    z-index: 1; /* Below Top Ribbon */
    top: 50%;
    margin-top: 10px; /* Adjust vertical overlap */
    /* "Only 30% visible" - usually implies it's mostly hidden by top or positioned such that only a strip shows.
       Let's try positioning. */
}

.layer-ribbons.active .ribbon-top {
    transform: translateX(0);
}
.layer-ribbons.active .ribbon-bottom {
    transform: translateX(0);
}

/* --- Layer 3: Text Group (Highest Z-Index) --- */
.layer-text-group {
    position: absolute;
    z-index: 3; /* Topmost */
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transform: scale(3);
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); /* Bounce/Smash effect */
}
.layer-text-group.active {
    opacity: 1;
    transform: scale(1);
}

.text-group-inner {
    position: relative;
    width: 400px; /* Base width reference */
    height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.win-text {
    position: relative;
    z-index: 10;
    width: 100%;
    height: auto;
}

/* Decorations */
.text-bg-icon {
    position: absolute;
    z-index: 5; /* Behind text */
    width: 120%;
    top: -20%;
}

.big-diamond {
    position: absolute;
    z-index: 6; /* Behind text? User said "half pressed by text". */
    top: -40px;
    left: -30px;
    width: 80px;
    height: auto;
    animation: pulseScale 2s infinite ease-in-out;
}
@keyframes pulseScale {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

.text-lb-icon {
    position: absolute;
    z-index: 11; /* On top of text */
    bottom: -10px;
    left: -20px;
    width: 60px;
    height: auto;
}

.right-top-icons {
    position: absolute;
    top: -30px;
    right: -20px;
    z-index: 11; /* On top */
    display: flex;
    flex-direction: column;
    align-items: center;
}

.text-rt-top {
    width: 40px;
    height: auto;
    animation: floatUp 3s ease-in-out infinite;
    margin-bottom: -10px;
}
.text-rt-bottom {
    width: 50px;
    height: auto;
    animation: floatLeft 3s ease-in-out infinite;
    margin-left: 20px;
}

@keyframes floatUp {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}
@keyframes floatLeft {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(10px); }
}
</style>