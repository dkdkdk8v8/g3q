<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// Backgrounds
import bg0 from '@/assets/common/game_bg.jpg';
import bg1 from '@/assets/common/game_bg_san.jpg';
import bg2 from '@/assets/common/game_bg_zise.jpg';

// Assets
import defaultAvatar from '@/assets/common/default_avatar.png';
import cardBack from '@/assets/common/card_back.png';
import goldImg from '@/assets/common/gold.png';
// Import some card images for showing
import card0 from '@/assets/card/card_0.png';
import card13 from '@/assets/card/card_13.png';
import card26 from '@/assets/card/card_26.png';
import card39 from '@/assets/card/card_39.png';
import card10 from '@/assets/card/card_10.png';

const props = defineProps({
    mode: {
        type: Number,
        default: 0
    }
});

const currentBg = computed(() => {
    if (props.mode === 1) return bg1;
    if (props.mode === 2) return bg2;
    return bg0;
});

const players = ref([]);

const generatePlayers = () => {
    const count = Math.floor(Math.random() * 4) + 2; // 2 to 5 players
    const newPlayers = [];
    for (let i = 0; i < count; i++) {
        // Distribute positions roughly in a semi-circle or random bottom area
        let x = Math.random() * 80 + 10; // 10% to 90%
        let y = Math.random() * 50 + 30; // 30% to 80% (keep away from top edge)
        newPlayers.push({
            id: i + Date.now(),
            x,
            y,
            avatar: defaultAvatar,
            action: null, // 'deal', 'show', 'gold'
            cards: [],
            golds: []
        });
    }
    players.value = newPlayers;
};

// Action loops
let animInterval;
const cardImages = [card0, card13, card26, card39, card10];

const triggerRandomAction = () => {
    if (players.value.length === 0) return;
    
    // Pick 1 or 2 random players to act
    const numActors = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < numActors; i++) {
        const playerIndex = Math.floor(Math.random() * players.value.length);
        const player = players.value[playerIndex];
        
        // Don't interrupt an ongoing action
        if (player.action) continue;
        
        const actions = ['deal', 'show', 'gold'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        player.action = action;
        
        if (action === 'deal') {
            player.cards = [1, 2, 3, 4, 5];
            setTimeout(() => { player.action = null; player.cards = []; }, 2000);
        } else if (action === 'show') {
            // Randomly pick 5 cards to show
            player.cards = Array.from({length: 5}, () => cardImages[Math.floor(Math.random() * cardImages.length)]);
            setTimeout(() => { player.action = null; player.cards = []; }, 2500);
        } else if (action === 'gold') {
            // Generate some random positions for gold
            player.golds = Array.from({length: 6}, (_, i) => ({
                id: i,
                delay: Math.random() * 0.5,
                x: Math.random() * 2 - 1, // -1 to 1
                y: Math.random() * 2 - 1
            }));
            setTimeout(() => { player.action = null; player.golds = []; }, 1500);
        }
    }
};

onMounted(() => {
    generatePlayers();
    animInterval = setInterval(() => {
        triggerRandomAction();
        // Randomly regenerate players (someone leaves/joins)
        if (Math.random() < 0.15) {
            generatePlayers();
        }
    }, 1500); // Check every 1.5 seconds
});

onUnmounted(() => {
    clearInterval(animInterval);
});

</script>

<template>
    <div class="lobby-anim-wrapper">
        <div class="bg-container" :style="{ backgroundImage: `url(${currentBg})` }">
            <div class="players-container">
                <!-- A subtle central 'dealer' or pot area implied by animation start point -->
                <div class="dealer-pos"></div>

                <div v-for="player in players" :key="player.id" class="player-pos" :style="{ left: player.x + '%', top: player.y + '%' }">
                    <img :src="player.avatar" class="avatar-img" />
                    
                    <!-- Dealing Cards (flying from center top to player) -->
                    <div v-if="player.action === 'deal'" class="anim-deal">
                        <img v-for="c in player.cards" :key="c" :src="cardBack" class="card-back flying-card" :style="{ animationDelay: (c * 0.1) + 's' }" />
                    </div>
                    
                    <!-- Showing Cards (fan out near player) -->
                    <div v-if="player.action === 'show'" class="anim-show">
                        <img v-for="(card, i) in player.cards" :key="i" :src="card" class="card-front" />
                    </div>
                    
                    <!-- Throwing Gold -->
                    <div v-if="player.action === 'gold'" class="anim-gold">
                        <img v-for="g in player.golds" :key="g.id" :src="goldImg" class="flying-gold" :style="{ animationDelay: g.delay + 's', '--rand-x': g.x, '--rand-y': g.y }" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.lobby-anim-wrapper {
    position: absolute;
    bottom: 20px; /* Slight offset from bottom */
    left: 50%;
    transform: translateX(-50%);
    width: 50vw;
    height: 30vh;
    border-radius: 15px;
    overflow: hidden;
    z-index: 0;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    border: 2px solid rgba(255, 255, 255, 0.1);
}

.bg-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
}

.players-container {
    position: relative;
    width: 100%;
    height: 100%;
}

.dealer-pos {
    position: absolute;
    top: -20%;
    left: 50%;
    width: 1px;
    height: 1px;
}

.player-pos {
    position: absolute;
    width: 36px;
    height: 36px;
    transform: translate(-50%, -50%);
    z-index: 10;
}

.avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid #e0e0e0;
    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
}

/* Animations */
.anim-deal {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 11;
}

.flying-card {
    position: absolute;
    width: 18px;
    height: auto;
    opacity: 0;
    /* Start position relative to player, simulating coming from top-center of container */
    /* Because parent is .player-pos, we use a fixed transform for origin to simulate a central dealer */
    transform: translate(calc(-1 * var(--x, 0px)), calc(-1 * var(--y, 0px))) scale(0.5);
    animation: flyInCard 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}

/* We'll calculate a pseudo origin for flyInCard in CSS by roughly assuming dealer is at 0, -150px relative to player */
@keyframes flyInCard {
    0% {
        transform: translate(0px, -150px) scale(0.5) rotate(180deg);
        opacity: 0;
    }
    50% {
        opacity: 1;
    }
    100% {
        transform: translate(10px, 10px) scale(1) rotate(0deg);
        opacity: 1;
    }
}

.anim-show {
    position: absolute;
    top: -15px;
    left: 20px;
    display: flex;
    z-index: 12;
}

.card-front {
    width: 18px;
    height: auto;
    margin-left: -12px; /* Overlap cards heavily */
    opacity: 0;
    transform-origin: bottom center;
    animation: popCard 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
.card-front:first-child { margin-left: 0; }
.card-front:nth-child(1) { animation-delay: 0.0s; transform: rotate(-20deg); }
.card-front:nth-child(2) { animation-delay: 0.1s; transform: rotate(-10deg); }
.card-front:nth-child(3) { animation-delay: 0.2s; transform: rotate(0deg); }
.card-front:nth-child(4) { animation-delay: 0.3s; transform: rotate(10deg); }
.card-front:nth-child(5) { animation-delay: 0.4s; transform: rotate(20deg); }

@keyframes popCard {
    0% { transform: translateY(10px) scale(0.5) rotate(0deg); opacity: 0; }
    100% { opacity: 1; } /* Uses base transform from nth-child */
}

.anim-gold {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 15;
}

.flying-gold {
    position: absolute;
    width: 16px;
    height: 16px;
    opacity: 0;
    animation: flyGold 0.8s ease-out forwards;
}

@keyframes flyGold {
    0% {
        transform: translate(0, 0) scale(0.5);
        opacity: 1;
    }
    100% {
        /* fly outwards based on random x/y variables */
        transform: translate(calc(var(--rand-x) * 60px), calc(var(--rand-y) * 60px - 20px)) scale(1.2);
        opacity: 0;
    }
}
</style>