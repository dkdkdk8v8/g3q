import { ref, reactive, computed, watch } from 'vue';
import { SUITS, RANKS, calculateNiu, drawAdvancedHand } from '../utils/gameLogic';

export function useGameLoop() {
    const balance = ref(100000);
    const selectedChip = ref(10);
    const bets = reactive({});
    const gameState = ref('betting');
    const gameResultMsg = ref(null);

    const hands = reactive({ p1: [], p2: [], p3: [], banker: [] });
    const scores = reactive({ p1: null, p2: null, p3: null, banker: null });
    const revealed = reactive({
        p1: Array(5).fill(false),
        p2: Array(5).fill(false),
        p3: Array(5).fill(false),
        banker: Array(5).fill(false)
    });

    const squeezeKey = ref(null);
    const skipAnimKeys = reactive({});
    const activeHandEffects = reactive({ p1: false, p2: false, p3: false, banker: false });
    const globalEffect = ref(null);
    const globalWinningKeys = ref([]);
    const history = reactive({ p1: [], p2: [], p3: [] });

    const showDoubleRules = ref(false);
    const countdown = ref(15);

    const flyingChips = ref([]);
    const flyingRewardChips = ref([]);
    const placedChips = reactive({});

    const totalBet = computed(() => {
        return Object.values(bets).reduce((a, b) => a + b, 0);
    });

    const spotlightKey = computed(() => {
        let winK = null;
        ['p1', 'p2', 'p3', 'banker'].forEach(k => {
            if (revealed[k]?.[4] && activeHandEffects[k]) {
                if (!winK || (scores[k]?.score || 0) > (scores[winK]?.score || 0)) winK = k;
            }
        });
        return winK;
    });

    const isHighTierHand = (key) => {
        if (!revealed[key]?.[4] || !activeHandEffects[key]) return false;
        const type = scores[key]?.type;
        return ['gold_niuniu', 'epic_flower', 'epic_small', 'epic_bomb'].includes(type);
    };

    const handleBet = (e, areaId) => {
        if (gameState.value !== 'betting' || balance.value < selectedChip.value || countdown.value === 0) return;

        if (totalBet.value === 0) countdown.value = 7;

        balance.value -= selectedChip.value;
        bets[areaId] = (bets[areaId] || 0) + selectedChip.value;

        const targetRect = e.currentTarget.getBoundingClientRect();
        const dx = (Math.random() - 0.5) * 36;
        const dy = (Math.random() - 0.5) * 20;
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;

        const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 20;
        const startY = window.innerHeight - 50;

        const chipId = Date.now() + Math.random();

        flyingChips.value.push({ id: chipId, startX, startY, endX, endY, val: selectedChip.value });

        setTimeout(() => {
            flyingChips.value = flyingChips.value.filter(c => c.id !== chipId);
            if (!placedChips[areaId]) {
                placedChips[areaId] = [];
            }
            placedChips[areaId].push({ id: chipId, val: selectedChip.value, dx, dy });
        }, 400);
    };

    const resetGame = () => {
        Object.keys(bets).forEach(k => delete bets[k]);
        Object.keys(placedChips).forEach(k => delete placedChips[k]);

        gameState.value = 'betting';
        gameResultMsg.value = null;
        countdown.value = 15;

        Object.keys(activeHandEffects).forEach(k => activeHandEffects[k] = false);
        Object.keys(revealed).forEach(k => revealed[k] = Array(5).fill(false));
        Object.keys(hands).forEach(k => hands[k] = []);
        Object.keys(scores).forEach(k => scores[k] = null);
        Object.keys(skipAnimKeys).forEach(k => delete skipAnimKeys[k]);

        globalWinningKeys.value = [];
        globalEffect.value = null;
    };

    const setRevealStatus = (key, idxs) => {
        revealed[key] = revealed[key].map((v, i) => idxs.includes(i) ? true : v);
    };

    const startDeal = async () => {
        if (gameState.value !== 'betting') return;

        const deck = [];
        SUITS.forEach(s => RANKS.forEach(r => deck.push({ suit: s, rank: r })));
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        const luckyKeys = ['p1', 'p2', 'p3', 'banker'];
        const epicTypes = ['epic_bomb', 'epic_small', 'epic_flower'];

        luckyKeys.forEach(k => {
            if (Math.random() < 0.25) {
                const randomEpicType = epicTypes[Math.floor(Math.random() * epicTypes.length)];
                hands[k] = drawAdvancedHand(deck, randomEpicType);
            } else {
                hands[k] = deck.splice(0, 5);
            }
        });

        luckyKeys.forEach(k => { scores[k] = calculateNiu(hands[k]); });

        gameState.value = 'dealing';

        await new Promise(r => setTimeout(r, 800));
        luckyKeys.forEach(k => setRevealStatus(k, [0, 1, 2]));

        await new Promise(r => setTimeout(r, 1000));
        for (let k of luckyKeys) {
            setRevealStatus(k, [3]);
            await new Promise(r => setTimeout(r, 300));
        }

        for (let k of ['p1', 'p2', 'p3', 'banker']) {
            squeezeKey.value = k;
            await new Promise(r => setTimeout(r, 1200));

            skipAnimKeys[k] = true;
            setRevealStatus(k, [4]);
            squeezeKey.value = null;

            const currentScore = scores[k];
            if (currentScore.type === 'epic_flower' || currentScore.type === 'epic_small' || currentScore.type === 'epic_bomb') {
                if (!globalWinningKeys.value.includes('any_epic')) globalWinningKeys.value.push('any_epic');
                globalEffect.value = { type: currentScore.type, originId: `hand-${k}` };
                await new Promise(r => setTimeout(r, 4000));
                globalEffect.value = null;
            }
            if (currentScore.type === 'gold_niuniu' || currentScore.score === 10) {
                if (!globalWinningKeys.value.includes('any_niuniu')) globalWinningKeys.value.push('any_niuniu');
            }
            activeHandEffects[k] = true;
            await new Promise(r => setTimeout(r, 400));
        }

        history.p1.push({ winner: scores.p1.score > scores.banker.score ? 'player' : 'banker', isSpecial: scores.p1.score >= 11 });
        history.p2.push({ winner: scores.p2.score > scores.banker.score ? 'player' : 'banker', isSpecial: scores.p2.score >= 11 });
        history.p3.push({ winner: scores.p3.score > scores.banker.score ? 'player' : 'banker', isSpecial: scores.p3.score >= 11 });

        countdown.value = 5;
        gameState.value = 'result';

        handlePayout();
    };

    const handlePayout = () => {
        const pW = [scores.p1, scores.p2, scores.p3].filter(x => x.score > scores.banker.score).length;
        let payout = 0;
        let winningAreas = [];
        let hitAreas = [];

        if (pW === 3) hitAreas.push('players_all');
        if (pW === 0) hitAreas.push('banker_all');

        if (pW === 3 && bets['players_all']) { payout += bets['players_all'] * 8; winningAreas.push('players_all'); }
        if (pW === 0 && bets['banker_all']) { payout += bets['banker_all'] * 8; winningAreas.push('banker_all'); }

        const hasNiuniu = Object.values(scores).some(score => score.type === 'gold_niuniu' || score.score === 10);
        if (hasNiuniu) hitAreas.push('any_niuniu');
        if (hasNiuniu && bets['any_niuniu']) { payout += bets['any_niuniu'] * 3; winningAreas.push('any_niuniu'); }

        const hasEpic = Object.values(scores).some(score => ['epic_flower', 'epic_bomb', 'epic_small'].includes(score.type));
        if (hasEpic) hitAreas.push('any_epic');
        if (hasEpic && bets['any_epic']) { payout += bets['any_epic'] * 151; winningAreas.push('any_epic'); }

        ['p1', 'p2', 'p3'].forEach(k => {
            if (scores[k].score > scores.banker.score) {
                if (bets[`${k}_flat`]) { payout += bets[`${k}_flat`] * 2; winningAreas.push(`${k}_flat`); }
                if (bets[`${k}_double`]) { payout += bets[`${k}_double`] * 6; winningAreas.push(`${k}_double`); }
            }
        });

        const newKeys = hitAreas.filter(area => ['players_all', 'banker_all', 'any_niuniu', 'any_epic'].includes(area));
        newKeys.forEach(k => {
            if (!globalWinningKeys.value.includes(k)) globalWinningKeys.value.push(k);
        });

        const avatarRect = document.getElementById('user-avatar-area')?.getBoundingClientRect();
        const dealerRect = document.getElementById('hand-banker')?.getBoundingClientRect();
        let newChips = [];
        let delayMod = 0;

        const endXWin = avatarRect ? avatarRect.left + avatarRect.width / 2 : window.innerWidth / 2;
        const endYWin = avatarRect ? avatarRect.top + avatarRect.height / 2 : window.innerHeight;
        const endXLose = dealerRect ? dealerRect.left + dealerRect.width / 2 : window.innerWidth / 2;
        const endYLose = dealerRect ? dealerRect.top : 0;

        Object.entries(placedChips).forEach(([areaId, chipsArr]) => {
            const betButton = document.getElementById(`bet-${areaId}`);
            if (betButton) {
                const betRect = betButton.getBoundingClientRect();
                const startX = betRect.left + betRect.width / 2;
                const startY = betRect.top + betRect.height / 2;
                const isWin = winningAreas.includes(areaId);
                const targetX = isWin ? endXWin : endXLose;
                const targetY = isWin ? endYWin : endYLose;

                chipsArr.forEach((c) => {
                    newChips.push({
                        id: `settle-${areaId}-${c.id}`,
                        val: c.val,
                        startX: startX + c.dx * 0.35,
                        startY: startY + c.dy * 0.35,
                        endX: targetX,
                        endY: targetY,
                        delay: delayMod * 15,
                        isWin: isWin
                    });
                    delayMod++;
                });
            }
        });

        // Clear placed chips immediately
        Object.keys(placedChips).forEach(k => delete placedChips[k]);

        if (payout > 0) {
            const flourishOriginRect = winningAreas.includes('any_epic')
                ? document.getElementById('bet-any_epic')?.getBoundingClientRect()
                : null;

            const fStartX = flourishOriginRect ? flourishOriginRect.left + flourishOriginRect.width / 2 : endXLose;
            const fStartY = flourishOriginRect ? flourishOriginRect.top + flourishOriginRect.height / 2 : endYLose;

            for (let i = 0; i < 5; i++) {
                newChips.push({
                    id: `payout-${Date.now()}-${i}`,
                    val: [100, 500, 1000][Math.floor(Math.random() * 3)],
                    startX: fStartX + (Math.random() - 0.5) * 50,
                    startY: fStartY + (Math.random() - 0.5) * 50,
                    endX: endXWin,
                    endY: endYWin,
                    delay: delayMod * 15 + 200 + i * 50,
                    isWin: true
                });
            }
        }

        if (newChips.length > 0) {
            flyingRewardChips.value = newChips;
            setTimeout(() => {
                balance.value += payout;
                flyingRewardChips.value = [];
            }, 2000 + (newChips.length * 15) + (payout > 0 ? 300 : 0));
        } else {
            balance.value += payout;
        }
    };

    const shouldShowMask = (pk, ci) => {
        const s = scores[pk];
        return s && s.baseIndices && s.baseIndices.includes(ci) && s.baseIndices.every(idx => revealed[pk][idx]);
    };

    return {
        balance, selectedChip, bets, gameState, gameResultMsg,
        hands, scores, revealed, squeezeKey, skipAnimKeys, activeHandEffects,
        globalEffect, globalWinningKeys, history, showDoubleRules, countdown,
        flyingChips, flyingRewardChips, placedChips, totalBet, spotlightKey,
        isHighTierHand, handleBet, startDeal, resetGame, shouldShowMask
    };
}
