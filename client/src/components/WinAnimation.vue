<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

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
import goldImg from '@/assets/common/gold.png';

const showRibbons = ref(false);
const showBackEffects = ref(false);
const showDecorations = ref(false); // Decorations appear first
const showTextSmash = ref(false);   // Text smashes later
const explosionParticles = ref([]); // For gold explosion
let animFrameId = null; // Store frame ID for cleanup

onMounted(() => {
    // Sequence 1: Ribbons enter immediately
    setTimeout(() => {
        showRibbons.value = true;
    }, 50);

    // Sequence 2: Back effects (0.3s delay)
    setTimeout(() => {
        showBackEffects.value = true;
    }, 350);

    // Sequence 3: Decorations appear (0.5s delay) - BEFORE Text
    setTimeout(() => {
        showDecorations.value = true;
    }, 500);

    // Sequence 4: Text Smash (0.7s delay) - Triggers explosion
    setTimeout(() => {
        showTextSmash.value = true;
        triggerExplosion();
    }, 700);
});

onUnmounted(() => {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
    }
});

const triggerExplosion = () => {
    // Generate 15-20 particles
    const count = 15 + Math.floor(Math.random() * 6);
    const newParticles = [];

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * 360; // Random rotation
        // Spread horizontally (-10 to 10 speed)
        const vx = (Math.random() - 0.5) * 20;

        // Initial upward velocity: 50-100 height equivalent roughly corresponds to negative Y velocity
        // Assuming ~60fps, gravity 0.8:
        // Peak height H = vy^2 / (2g). If H=100, vy = sqrt(200*0.8) ~ 12.6.
        // Let's try vy = -15 to -25 for significant jump.
        const vy = -15 - Math.random() * 10;

        newParticles.push({
            id: i,
            x: 0, // Start at center (relative to container center)
            y: 0,
            rotation: angle,
            vx: vx,
            vy: vy,
            opacity: 1
        });
    }
    explosionParticles.value = newParticles;

    // Animation Loop
    const animate = () => {
        let active = false;
        // Use functional update or map to trigger reactivity efficiently
        explosionParticles.value = explosionParticles.value.map(p => {
            // Update physics
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.8; // Gravity
            p.rotation += 5; // Spin

            // Fade out if fallen far below (e.g., > 300px from center)
            if (p.y > 400) {
                p.opacity = 0;
            } else {
                active = true;
            }
            return p;
        });

        if (active) {
            animFrameId = requestAnimationFrame(animate);
        }
    };
    animFrameId = requestAnimationFrame(animate);
};
</script>

<template>
    <div class="win-anim-container">
        <!-- Layer 1: Ribbons -->
        <div class="layer-ribbons" :class="{ 'active': showRibbons }">
            <img :src="bottomLineImg" class="ribbon-bottom" />
            <img :src="topLineImg" class="ribbon-top" />
        </div>

        <!-- Layer 2: Center Effects -->
        <div class="layer-back-effects" :class="{ 'active': showBackEffects }">
            <img :src="backColorImg" class="back-color" />
            <div class="light-circle-wrapper">
                <img :src="circleLightImg" class="light-circle" />
            </div>
        </div>

        <!-- Layer 3: Text & Decorations -->
        <div class="layer-text-group">
            <div class="text-group-inner">
                <!-- Decorations Behind Text -->
                <div class="decorations-group" :class="{ 'decor-active': showDecorations }">
                    <img :src="textBgIconImg" class="text-bg-icon" />
                    <img :src="bigDiamondImg" class="big-diamond" />
                </div>

                <!-- Explosion Particles -->
                <div class="explosion-container">
                    <img v-for="p in explosionParticles" :key="p.id" v-show="p.opacity > 0" :src="goldImg"
                        class="explosion-particle" :style="{
                            transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`,
                            opacity: p.opacity
                        }" />
                </div>

                <!-- The Text: Smash In -->
                <div class="smash-text-wrapper" :class="{ 'smash-active': showTextSmash }">
                    <img :src="winTextImg" class="win-text" />
                </div>

                <!-- Decorations On Top -->
                <div class="decorations-group" :class="{ 'decor-active': showDecorations }">
                    <img :src="textLeftBottomIconImg" class="text-lb-icon" />
                    <div class="right-top-icons">
                        <img :src="textRightTopIconImg" class="text-rt-top" />
                        <img :src="textRightBottomIconImg" class="text-rt-bottom" />
                    </div>
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
    z-index: 9000;
    /* High z-index */
    overflow: hidden;
}

/* ... (Keep previous styles for Layer 1 & 2) ... */
/* --- Layer 2: Back Effects (Lowest Z-Index relative to others here) --- */
.layer-back-effects {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1;
    /* Lowest */
    opacity: 0;
    transition: opacity 0.5s;
}

.layer-back-effects.active {
    opacity: 1;
}

.back-color {
    position: absolute;
    width: 80%;
    /* Adjust as needed */
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
    width: 30%;
    height: 30%;
    margin-bottom: 20px;
    animation: rotateCircle 16s linear infinite;
}

@keyframes rotateCircle {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

/* --- Layer 1: Ribbons (Middle Z-Index) --- */
.layer-ribbons {
    position: absolute;
    width: 100%;
    height: 300px;
    /* Approximate height */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2;
    /* Above Back Effects */
}

.ribbon-top,
.ribbon-bottom {
    position: absolute;
    width: 101%;
    /* Wider than screen to slide in */
    height: auto;
    max-height: 200px;
    transition: transform 0.25s ease-out;
}

.ribbon-top {
    transform: translateX(-100%);
    z-index: 2;
    top: 60%;
    margin-top: -60px;
    /* Adjust vertical overlap */
}

.ribbon-bottom {
    transform: translateX(100%);
    z-index: 1;
    /* Below Top Ribbon */
    top: 41.6%;
    margin-top: 10px;
    /* Adjust vertical overlap */
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
    z-index: 3;
    /* Topmost */
    display: flex;
    justify-content: center;
    align-items: center;
    /* Remove transform/opacity from parent, manage children separately */
}

/* Decorations: Scale & Fade In */
.decorations-group {
    position: absolute;
    /* They need to be absolute to layer correctly with text */
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.5s ease-out;
    pointer-events: none;
    /* Let text smash through visually */
}

.decorations-group.decor-active {
    opacity: 1;
    transform: scale(1);
}

/* Text: Smash In */
.smash-text-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transform: scale(3);
    /* Start huge */
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    /* Bounce/Smash */
}

.smash-text-wrapper.smash-active {
    opacity: 1;
    transform: scale(1);
}

.text-group-inner {
    position: relative;
    width: 400px;
    /* Base width reference */
    height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.win-text {
    position: relative;
    z-index: 10;
    width: 28%;
    height: auto;
}

/* Explosion Particles */
.explosion-container {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    z-index: 8;
    /* Behind text (10) but in front of bg icon (5) */
}

.explosion-particle {
    position: absolute;
    width: 25px;
    /* Adjust coin size */
    height: 25px;
    object-fit: contain;
    /* Centered on 0,0 originally */
    top: -12px;
    left: -12px;
}

/* Decorations */
.text-bg-icon {
    position: absolute;
    z-index: 5;
    /* Behind text */
    width: 18%;
    top: 75px;
    left: 48%;
}

.big-diamond {
    position: absolute;
    z-index: 6;
    /* Behind text? User said "half pressed by text". */
    top: 50px;
    left: 31%;
    width: 55px;
    height: auto;
    animation: pulseScale 2s infinite ease-in-out;
}

@keyframes pulseScale {

    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.05);
    }
}

.text-lb-icon {
    position: absolute;
    z-index: 11;
    /* On top of text */
    bottom: 70px;
    left: 30%;
    width: 40px;
    height: auto;
}

.right-top-icons {
    position: absolute;
    top: 35px;
    right: 30%;
    z-index: 11;
    /* On top */
    display: flex;
    flex-direction: column;
    align-items: center;
}

.text-rt-top {
    width: 33px;
    height: auto;
    animation: floatUp 3s ease-in-out infinite;
    margin-bottom: -10px;
}

.text-rt-bottom {
    width: 38px;
    height: auto;
    animation: floatLeft 3s ease-in-out infinite;
    margin-left: 20px;
}

@keyframes floatUp {

    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-10px);
    }
}

@keyframes floatLeft {

    0%,
    100% {
        transform: translateX(0);
    }

    50% {
        transform: translateX(10px);
    }
}
</style>