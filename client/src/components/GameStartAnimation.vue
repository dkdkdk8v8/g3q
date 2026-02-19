<script setup>
import { onMounted, ref, onUnmounted } from 'vue';

import bgImg from '@/assets/game_start/bg.png';
import textImg from '@/assets/game_start/text.png';
import bgStarImg from '@/assets/game_start/bg_star.png';
import flashTextImg from '@/assets/game_start/flash_text.png';

const animState = ref('enter'); // 'enter', 'idle', 'leave'
let timers = [];

onMounted(() => {
    // Total animation time matches the GameView 2.5s duration
    // 0ms -> 400ms: Slide in to center
    timers.push(setTimeout(() => {
        animState.value = 'idle';
    }, 50));

    // Wait in center for ~1.5s, then leave
    timers.push(setTimeout(() => {
        animState.value = 'leave';
    }, 1550));
});

onUnmounted(() => {
    timers.forEach(t => clearTimeout(t));
});
</script>

<template>
    <div class="game-start-container">
        <div class="anim-wrapper" :class="animState">
            <div class="content-box">
                <img :src="bgImg" class="gs-bg" />
                
                <div class="star-wrapper">
                    <img :src="bgStarImg" class="gs-star" />
                </div>
                
                <div class="text-wrapper">
                    <img :src="textImg" class="gs-text" />
                    <div class="flash-container">
                        <img :src="flashTextImg" class="gs-flash-image" :class="{ 'flash-active': animState === 'idle' }" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.game-start-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 8500;
    overflow: hidden;
}

.anim-wrapper {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    transform: translateX(-120vw);
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.anim-wrapper.enter {
    transform: translateX(-120vw);
}

.anim-wrapper.idle {
    transform: translateX(0);
}

.anim-wrapper.leave {
    transform: translateX(120vw);
    transition: transform 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53);
}

.content-box {
    position: relative;
    width: 85vw;
    max-width: 600px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.gs-bg {
    width: 100%;
    height: auto;
    display: block;
    z-index: 1;
}

.star-wrapper {
    position: absolute;
    top: 5%;
    left: 0;
    width: 100%;
    display: flex;
    justify-content: center;
    z-index: 2;
}

.gs-star {
    width: 12%;
    height: auto;
    animation: rotateStar 6s linear infinite;
}

@keyframes rotateStar {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.text-wrapper {
    position: absolute;
    z-index: 3;
    width: 50%; /* Text is slightly larger to look good */
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.gs-text {
    width: 100%;
    height: auto;
    display: block;
}

.flash-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    -webkit-mask-image: url('@/assets/game_start/text.png');
    -webkit-mask-size: 100% 100%;
    mask-image: url('@/assets/game_start/text.png');
    mask-size: 100% 100%;
}

.gs-flash-image {
    position: absolute;
    top: -50%;
    left: -150%;
    height: 200%;
    width: auto;
    mix-blend-mode: screen; /* brightens the text */
    opacity: 0.8;
}

.gs-flash-image.flash-active {
    animation: flashMove 0.8s ease-in forwards;
    animation-delay: 0.4s; /* wait for slide-in to finish */
}

@keyframes flashMove {
    0% { left: -100%; }
    100% { left: 100%; }
}
</style>
