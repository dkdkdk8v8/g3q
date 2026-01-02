<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    visible: Boolean,
});

const emit = defineEmits(['update:visible', 'selectPhrase', 'selectEmoji']);

const activeTab = ref('phrases'); // 'phrases' or 'emojis'

// Common Phrases
const commonPhrases = [
    "猜猜我是牛几呀",
    "风水轮流转，底裤都要输光了",
    "辛苦这么多年，一夜回到解放前",
    "我又赢了，谢谢大家送钱",
    "快点开牌，我是牛牛",
    "唉，一手烂牌臭到底",
    "快点吧，我等的花都谢了",
    "吐了个槽的，整个一个杯具啊",
    "你的牌也太好啦",
    "不要吵啦，有什么好吵的，专心玩牌吧",
    "作孽啊"
];

const phraseSounds = [
    new URL('@/assets/sounds/talk_0.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_1.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_2.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_3.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_4.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_5.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_6.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_7.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_8.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_9.mp3', import.meta.url).href,
    new URL('@/assets/sounds/talk_10.mp3', import.meta.url).href,
];

const playAudio = (index) => {
    if (index >= 0 && index < phraseSounds.length) {
        const audio = new Audio(phraseSounds[index]);
        audio.play().catch(e => console.error("Error playing sound:", e));
    }
};

const selectPhrase = (phrase, index) => {
    // playAudio(index); // Moved to GameView.vue
    emit('selectPhrase', phrase, index); // Emit index for sound playback
    closeModal();
};

import emoji1 from '@/assets/emoji/emoji_1.png';
import emoji2 from '@/assets/emoji/emoji_2.png';
import emoji3 from '@/assets/emoji/emoji_3.png';
import emoji4 from '@/assets/emoji/emoji_4.png';
import emoji5 from '@/assets/emoji/emoji_5.png';
import emoji6 from '@/assets/emoji/emoji_6.png';
import emoji7 from '@/assets/emoji/emoji_7.png';
import emoji8 from '@/assets/emoji/emoji_8.png';
import emoji9 from '@/assets/emoji/emoji_9.png';
import emoji10 from '@/assets/emoji/emoji_10.png';
import emoji11 from '@/assets/emoji/emoji_11.png';
import emoji12 from '@/assets/emoji/emoji_12.png';
import emoji13 from '@/assets/emoji/emoji_13.png';
import emoji14 from '@/assets/emoji/emoji_14.png';
import emoji15 from '@/assets/emoji/emoji_15.png';
import emoji16 from '@/assets/emoji/emoji_16.png';

// Emojis
const emojis = ref([]);
onMounted(() => {
    emojis.value = [
        emoji1, emoji2, emoji3, emoji4, emoji5, emoji6, emoji7, emoji8,
        emoji9, emoji10, emoji11, emoji12, emoji13, emoji14, emoji15, emoji16
    ];
});

const selectEmoji = (emojiUrl) => {
    emit('selectEmoji', emojiUrl);
    closeModal();
};

const closeModal = () => {
    emit('update:visible', false);
};

// Click outside to close
const modalRef = ref(null);
const handleClickOutside = (event) => {
    if (modalRef.value && !modalRef.value.contains(event.target)) {
        closeModal();
    }
};

watch(() => props.visible, (newVal) => {
    if (newVal) {
        // Add a small delay to prevent the initial click event from immediately closing the modal
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 50); 
    } else {
        document.removeEventListener('click', handleClickOutside);
    }
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
    <div v-if="visible" class="chat-selector-overlay" @click.self="closeModal">
        <div class="chat-selector-modal" ref="modalRef">
            <div class="modal-header">
                <div class="tabs">
                    <div :class="{ 'tab-item': true, active: activeTab === 'phrases' }" @click="activeTab = 'phrases'">常用语</div>
                    <div :class="{ 'tab-item': true, active: activeTab === 'emojis' }" @click="activeTab = 'emojis'">表情</div>
                </div>
                <div class="close-btn" @click="closeModal">×</div>
            </div>
            <div class="modal-content">
                <div v-if="activeTab === 'phrases'" class="phrases-list">
                    <div v-for="(phrase, index) in commonPhrases" :key="index" class="phrase-item" @click="selectPhrase(phrase, index)">
                        {{ phrase }}
                    </div>
                </div>
                <div v-if="activeTab === 'emojis'" class="emojis-grid">
                    <img v-for="(emoji, index) in emojis" :key="index" :src="emoji" alt="emoji" class="emoji-item" @click="selectEmoji(emoji)">
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.chat-selector-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7); /* Darker overlay */
    display: flex;
    justify-content: center;
    align-items: center; /* Center vertically */
    backdrop-filter: blur(4px);
    z-index: 10000; /* Higher than CoinLayer (9999) */
}

.chat-selector-modal {
    background: #1e293b; /* Dark background */
    border-radius: 16px; /* All corners rounded */
    width: 85%;
    max-width: 400px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1);
    display: flex;
    flex-direction: column;
    height: 58vh; /* Fixed height of 58% of viewport height */
    position: relative;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px; /* Match history modal padding */
    border-bottom: 1px solid rgba(255,255,255,0.1);
    background-color: transparent; /* No specific background for header */
    color: white; /* White text */
    border-radius: 16px 16px 0 0; /* Keep top corners rounded */
}

.tabs {
    display: flex;
    gap: 10px;
}

.tab-item {
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 5px;
    font-weight: bold;
    color: #94a3b8; /* Lighter gray text for tabs */
}

.tab-item.active {
    background-color: #007bff; /* Still use blue for active */
    color: #fff;
}

.close-btn {
    font-size: 24px;
    cursor: pointer;
    color: #94a3b8; /* Match history close icon color */
}

.modal-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 16px; /* Match history modal padding */
}

.phrases-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.phrase-item {
    padding: 10px;
    background-color: rgba(255,255,255,0.05); /* Lighter background for items */
    color: #cbd5e1; /* Light gray text */
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    word-break: break-word;
}

.phrase-item:hover {
    background-color: rgba(255,255,255,0.1); /* Slightly lighter on hover */
}

.emojis-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px; /* Increased gap for both rows and columns */
    row-gap: 20px; /* Explicitly increase row gap */
    justify-items: center;
    align-items: center;
}

.emoji-item {
    width: 50px; /* Adjust size as needed */
    height: 50px;
    cursor: pointer;
    transition: transform 0.2s;
}

.emoji-item:hover {
    transform: scale(1.1);
}
</style>
