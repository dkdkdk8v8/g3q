<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    visible: Boolean,
});

const emit = defineEmits(['update:visible', 'selectPhrase', 'selectEmoji']);

const activeTab = ref('emojis'); // 'phrases' or 'emojis'

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

const selectPhrase = (phrase, index) => {
    emit('selectPhrase', phrase, index);
    closeModal();
};

import emoji1 from '@/assets/emoji/emoji_0.png';
import emoji2 from '@/assets/emoji/emoji_1.png';
import emoji3 from '@/assets/emoji/emoji_2.png';
import emoji4 from '@/assets/emoji/emoji_3.png';
import emoji5 from '@/assets/emoji/emoji_4.png';
import emoji6 from '@/assets/emoji/emoji_5.png';
import emoji7 from '@/assets/emoji/emoji_6.png';
import emoji8 from '@/assets/emoji/emoji_7.png';
import emoji9 from '@/assets/emoji/emoji_8.png';
import emoji10 from '@/assets/emoji/emoji_9.png';
import emoji11 from '@/assets/emoji/emoji_10.png';
import emoji12 from '@/assets/emoji/emoji_11.png';
import emoji13 from '@/assets/emoji/emoji_12.png';
import emoji14 from '@/assets/emoji/emoji_13.png';
import emoji15 from '@/assets/emoji/emoji_14.png';
import emoji16 from '@/assets/emoji/emoji_15.png';

// Emojis
const emojis = ref([]);
onMounted(() => {
    emojis.value = [
        emoji1, emoji2, emoji3, emoji4, emoji5, emoji6, emoji7, emoji8,
        emoji9, emoji10, emoji11, emoji12, emoji13, emoji14, emoji15, emoji16
    ];
});

const selectEmoji = (emojiUrl, index) => {
    emit('selectEmoji', emojiUrl, index);
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
                    <div :class="{ 'tab-item': true, active: activeTab === 'emojis' }" @click="activeTab = 'emojis'">表情
                    </div>
                    <div :class="{ 'tab-item': true, active: activeTab === 'phrases' }" @click="activeTab = 'phrases'">
                        常用语</div>
                </div>
                <div class="close-btn" @click="closeModal">×</div>
            </div>
            <div class="modal-content">
                <div v-if="activeTab === 'phrases'" class="phrases-list">
                    <div v-for="(phrase, index) in commonPhrases" :key="index" class="phrase-item"
                        @click="selectPhrase(phrase, index)">
                        {{ phrase }}
                    </div>
                </div>
                <div v-if="activeTab === 'emojis'" class="emojis-grid">
                    <img v-for="(emoji, index) in emojis" :key="index" :src="emoji" alt="emoji" class="emoji-item"
                        @click="selectEmoji(emoji, index)">
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
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
    z-index: 10000;
}

.chat-selector-modal {
    background: #1e293b;
    border-radius: 16px;
    width: 85%;
    max-width: 400px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    height: 58vh;
    position: relative;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background-color: transparent;
    color: white;
    border-radius: 16px 16px 0 0;
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
    color: #94a3b8;
}

.tab-item.active {
    background-color: #007bff;
    color: #fff;
}

.close-btn {
    font-size: 24px;
    cursor: pointer;
    color: #94a3b8;
}

.modal-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 16px;
}

.phrases-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.phrase-item {
    padding: 10px;
    background-color: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    word-break: break-word;
}

.phrase-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

.emojis-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
    row-gap: 20px;
    justify-items: center;
    align-items: center;
}

.emoji-item {
    width: 50px;
    height: 50px;
    cursor: pointer;
    transition: transform 0.2s;
}

.emoji-item:hover {
    transform: scale(1.1);
}
</style>
