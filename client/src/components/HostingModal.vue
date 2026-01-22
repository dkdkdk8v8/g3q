<script setup>
import { ref, watch, computed } from 'vue';
import { useGameStore } from '../stores/game.js';
import menuTuoGuanImg from '@/assets/common/menu_tuoguan.png';
const props = defineProps({
    visible: Boolean,
    robOptions: {
        type: Array,
        default: () => [0, 1, 2, 3, 4]
    },
    betOptions: {
        type: Array,
        default: () => [1, 2, 3, 5, 10]
    }
});

const emit = defineEmits(['update:visible', 'confirm']);

const store = useGameStore();

// Local state for selections
const selectedRob = ref(0);
const selectedBet = ref(props.betOptions[0] || 1);

// Initialize selections when modal opens or options change
watch(() => props.visible, (val) => {
    if (val) {
        // Ensure defaults are valid
        if (!props.robOptions.includes(selectedRob.value)) {
            selectedRob.value = props.robOptions[0] || 0;
        }
        if (!props.betOptions.includes(selectedBet.value)) {
            selectedBet.value = props.betOptions[0] || 1;
        }
    }
});

const close = () => {
    emit('update:visible', false);
};

const confirm = () => {
    emit('confirm', {
        rob: selectedRob.value,
        bet: selectedBet.value
    });
    close();
};

const getRobLabel = (val) => {
    return val === 0 ? '不抢' : `抢${val}倍`;
};

const getBetLabel = (val) => {
    return `${val}倍`;
};

</script>

<template>
    <div v-if="visible" class="modal-overlay" @click="close">
        <div class="modal-content hosting-modal" @click.stop>
            <div class="modal-header">
                <div class="header-left"></div>
                <img :src="menuTuoGuanImg" alt="托管设置" class="modal-title-img" />
                <div class="header-right">
                    <div class="close-icon" @click="close">×</div>
                </div>
            </div>

            <div class="modal-body">
                <div class="setting-group">
                    <div class="group-title">选择抢庄倍数</div>
                    <div class="options-grid">
                        <div v-for="opt in robOptions" :key="opt" class="option-btn"
                            :class="{ active: selectedRob === opt }" @click="selectedRob = opt">
                            {{ getRobLabel(opt) }}
                        </div>
                    </div>
                </div>

                <div class="setting-group">
                    <div class="group-title">选择压注倍数</div>
                    <div class="options-grid">
                        <div v-for="opt in betOptions" :key="opt" class="option-btn"
                            :class="{ active: selectedBet === opt }" @click="selectedBet = opt">
                            {{ getBetLabel(opt) }}
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <div class="cancel-btn" @click="close">暂不托管</div>
                <div style="width:50px" />
                <div class="confirm-btn" @click="confirm">确认托管</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9000;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.hosting-modal {
    width: 85%;
    max-width: 360px;
    background: rgba(32, 35, 45, 1);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    color: white;
}

.modal-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* background: #0f172a; Removed to match SettingsModal */
}

.header-left,
.header-right {
    flex: 1;
    display: flex;
    align-items: center;
}

.header-right {
    justify-content: flex-end;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
    color: #facc15;
}

.close-icon {
    font-size: 24px;
    cursor: pointer;
    color: #94a3b8;
}

.modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.group-title {
    font-size: 14px;
    color: #ccc;
    margin-bottom: 10px;
    font-weight: bold;
}

.options-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.option-btn {
    flex: 1;
    min-width: 60px;
    text-align: center;
    padding: 8px 4px;
    background: #262d38;
    border-radius: 10px;
    font-size: 14px;
    cursor: pointer;
    color: #aaaaaa;
}

.option-btn.active {
    font-weight: bold;
    border-color: #fbbf24;
    color: #e2e8f0;
    background: linear-gradient(to bottom, #596274, #2f3a4a);
}

.modal-footer {
    padding: 16px 20px 24px 20px;
    display: flex;
    justify-content: center;
}

.modal-title-img {
    width: 80%;
    /* 50% of the modal's width */
    height: auto;
    object-fit: contain;
    flex-shrink: 0;
    /* Prevent image from shrinking */
}

.cancel-btn {
    width: 100%;
    color: rgb(167, 167, 167);
    text-align: center;
    border-radius: 6.4vw;
    font-size: 16px;
    cursor: pointer;
    padding: 1.6vw 1.4vw;

    border-radius: 6.4vw;


    display: flex;

    align-items: center;

    align-self: center;

    justify-content: center;

    backdrop-filter: blur(1.06667vw);

    border: 0.2667vw solid rgba(255, 255, 253, 0.3);
}

.confirm-btn {
    width: 100%;

    color: #fef0c7;

    font-size: 4.26667vw;

    font-weight: bold;


    padding: 1.6vw 6.4vw;

    border-radius: 6.4vw;

    border: 0.2667vw solid rgba(255, 255, 253, 0.3);


    display: flex;

    align-items: center;

    align-self: center;

    justify-content: center;

    backdrop-filter: blur(1.06667vw);

    background: linear-gradient(180deg, #cd9403 0%, #cb6d01 100%);

}

.confirm-btn:active {
    transform: scale(0.98);
}
</style>