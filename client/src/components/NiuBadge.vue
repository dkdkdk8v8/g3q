<script setup>
import { computed, ref, onMounted, watch } from 'vue';

// Static Images (Fallback)
import niu1Img from '@/assets/niu/niu_1.png';
import niu2Img from '@/assets/niu/niu_2.png';
import niu3Img from '@/assets/niu/niu_3.png';
import niu4Img from '@/assets/niu/niu_4.png';
import niu5Img from '@/assets/niu/niu_5.png';
import niu6Img from '@/assets/niu/niu_6.png';
import niu7StaticImg from '@/assets/niu/niu_7.png';
import niu8StaticImg from '@/assets/niu/niu_8.png';
import niu9StaticImg from '@/assets/niu/niu_9.png';
import niuNiuStaticImg from '@/assets/niu/niu_niu.png';
import niuBoomImg from '@/assets/niu/niu_boom.png';
import niuSihuaImg from '@/assets/niu/niu_sihua.png';
import niuWuhuaImg from '@/assets/niu/niu_wuhua.png';
import niuWuxiaoImg from '@/assets/niu/niu_wuxiao.png';
import niuMeiImg from '@/assets/niu/niu_mei.png';

// Animation Assets
import bgImg from '@/assets/ani_niu/niu_bg.png';
import niuCharImg from '@/assets/ani_niu/niu_niu.png';
import n7CharImg from '@/assets/ani_niu/niu_7.png';
import n8CharImg from '@/assets/ani_niu/niu_8.png';
import n9CharImg from '@/assets/ani_niu/niu_9.png';
import iconLeftImg from '@/assets/ani_niu/niu_icon_left.png';
import iconRightImg from '@/assets/ani_niu/niu_icon_right.png';

const props = defineProps({
    type: String, // e.g. "牛7", "牛牛", "没牛"
});

const NO_BULL_TYPE_NAME = '没牛';

const staticMap = {
    '牛1': niu1Img,
    '牛2': niu2Img,
    '牛3': niu3Img,
    '牛4': niu4Img,
    '牛5': niu5Img,
    '牛6': niu6Img,
    // Note: We use static map as fallback for types without animation
    '牛7': niu7StaticImg,
    '牛8': niu8StaticImg,
    '牛9': niu9StaticImg,
    '牛牛': niuNiuStaticImg,
    '炸弹': niuBoomImg,
    '四花牛': niuSihuaImg,
    '五花牛': niuWuhuaImg,
    '五小牛': niuWuxiaoImg,
    [NO_BULL_TYPE_NAME]: niuMeiImg,
};

const normalizedType = computed(() => props.type ? props.type.trim() : '');

const isNiu789 = computed(() => ['牛7', '牛8', '牛9'].includes(normalizedType.value));
const isNiuNiu = computed(() => normalizedType.value === '牛牛');

const rightCharImg = computed(() => {
    if (normalizedType.value === '牛7') return n7CharImg;
    if (normalizedType.value === '牛8') return n8CharImg;
    if (normalizedType.value === '牛9') return n9CharImg;
    return null;
});

// Niu Niu Animation State
const showNiuNiuText = ref(false);

const resetAnimation = () => {
    if (isNiuNiu.value) {
        showNiuNiuText.value = false;
        setTimeout(() => {
            showNiuNiuText.value = true;
        }, 500); // Wait for collision to finish (match CSS 0.5s)
    }
};

onMounted(() => {
    resetAnimation();
});

watch(normalizedType, () => {
    resetAnimation();
});

</script>
<template>
    <div class="niu-badge">
        <!-- Animation for Niu 7-9 -->
        <div v-if="isNiu789" class="anim-container">
            <img :src="bgImg" class="anim-bg" />
            <div class="anim-content">
                <img :src="niuCharImg" class="char-anim char-left-anim" />
                <img :src="rightCharImg" class="char-anim char-right-anim" />
            </div>
        </div>

        <!-- Animation for Niu Niu -->
        <div v-else-if="isNiuNiu" class="anim-container">
            <img :src="bgImg" class="anim-bg" />

            <!-- Phase 1: Icons -->
            <div v-if="!showNiuNiuText" class="anim-content">
                <img :src="iconLeftImg" class="icon-move-right" />
                <img :src="iconRightImg" class="icon-move-left" />
            </div>

            <!-- Phase 2: Text -->
            <div v-else class="anim-content full-center">
                <img :src="niuCharImg" class="char-zoom-in delay-1" />
                <img :src="niuCharImg" class="char-zoom-in delay-2" />
            </div>
        </div>

        <!-- Static Fallback -->
        <img v-else-if="staticMap[normalizedType]" :src="staticMap[normalizedType]" class="static-img"
            :style="['五小牛', '五花牛', '四花牛', '炸弹'].includes(normalizedType) ? { height: '100%' } : {}" />

        <!-- Text Fallback -->
        <span v-else class="text-fallback">{{ normalizedType }}</span>
    </div>
</template>

<style scoped>
.niu-badge {
    height: 35px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
}

.static-img {
    height: 30px;
    width: auto;
    object-fit: contain;
}

.text-fallback {
    color: #fbbf24;
    font-size: 14px;
    font-weight: bold;
}

/* Animation Container */
.anim-container {
    position: relative;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.anim-bg {
    position: relative;
    /* Changed from absolute to relative to establish width */
    height: 100%;
    width: auto;
    z-index: 0;
}

.anim-content {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
}

.char-anim {
    height: 70%;
    width: auto;
    position: relative;
}

/* Niu 7-9 Animations */
.char-left-anim {
    animation: bounceInLeft 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    /* Overlap slightly or tight spacing */
}

.char-right-anim {
    animation: bounceInRight 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes bounceInLeft {
    0% {
        transform: translateX(-100%);
        opacity: 0;
    }

    60% {
        transform: translateX(10%);
        opacity: 1;
    }

    100% {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes bounceInRight {
    0% {
        transform: translateX(100%);
        opacity: 0;
    }

    60% {
        transform: translateX(-10%);
        opacity: 1;
    }

    100% {
        transform: translateX(0);
        opacity: 1;
    }
}

/* Niu Niu Phase 1 */
.icon-move-right {
    position: absolute;
    left: 0;
    height: 70%;
    animation: crashRight 0.5s ease-in forwards;
}

.icon-move-left {
    position: absolute;
    right: 0;
    height: 70%;
    animation: crashLeft 0.5s ease-in forwards;
}

@keyframes crashRight {
    0% {
        left: -30%;
        opacity: 0;
    }

    100% {
        left: 50%;
        transform: translateX(-60%);
        opacity: 1;
    }
}

@keyframes crashLeft {
    0% {
        right: -30%;
        opacity: 0;
    }

    100% {
        right: 50%;
        transform: translateX(60%);
        opacity: 1;
    }
}

/* Niu Niu Phase 2 */
.full-center {
    gap: 2px;
}

.char-zoom-in {
    height: 80%;
    width: auto;
    animation: zoomIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    opacity: 0;
}

.delay-1 {
    animation-delay: 0s;
}

.delay-2 {
    animation-delay: 0.15s;
}

@keyframes zoomIn {
    0% {
        transform: scale(0);
        opacity: 0;
    }

    80% {
        transform: scale(1.3);
        opacity: 1;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>
