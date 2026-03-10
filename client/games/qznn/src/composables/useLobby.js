import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { debounce } from '../utils/debounce.js';
import { formatCoins } from '../utils/format.js';
import { useUserStore } from '../stores/user.js';
import { useGameStore } from '../stores/game.js';
import { useSettingsStore } from '../stores/settings.js';
import { AudioUtils } from '../utils/audio.js';
import gameClient from '../socket.js';
import defaultAvatar from '@/assets/common/default_avatar.png';
import lobbyBgSound from '@/assets/sounds/lobby_bg.mp3';
import btnClickSound from '@/assets/sounds/btn_click.mp3';

export function useLobby() {
    const router = useRouter();
    const route = useRoute();
    const userStore = useUserStore();
    const gameStore = useGameStore();
    const settingsStore = useSettingsStore();

    const currentMode = ref(0);

    // --- User Info ---
    const userInfo = computed(() => {
        const rawName = userStore.userInfo.nick_name || userStore.userInfo.user_id || '---';
        let displayName = rawName;
        if (rawName.length > 11) {
            displayName = rawName.substring(0, 4) + '...' + rawName.substring(rawName.length - 4);
        }
        return {
            name: rawName,
            displayName: displayName,
            id: userStore.userInfo.user_id || '---',
            coins: formatCoins(userStore.userInfo.balance || 0),
            avatar: userStore.userInfo.avatar
                ? (userStore.userInfo.avatar.startsWith('http://') || userStore.userInfo.avatar.startsWith('https://') ? userStore.userInfo.avatar : `/${userStore.userInfo.avatar}`)
                : defaultAvatar
        };
    });

    // --- Rooms ---
    const generateParticles = () => {
        return Array.from({ length: 6 }, () => {
            const left = Math.random() * 80 + 10;
            const duration = Math.random() * 2 + 3;
            const delay = Math.random() * 4;
            const size = Math.random() * 2 + 1;
            return {
                left: `${left}%`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                width: `${size}px`,
                height: `${size}px`
            };
        });
    };

    const rooms = computed(() => {
        const configs = userStore.roomConfigs || [];
        return configs.map((cfg) => ({
            level: cfg.level,
            name: cfg.name,
            baseBet: (cfg.base_bet || 0) / 100,
            minBalance: (cfg.min_balance || 0) / 100,
            particles: generateParticles()
        }));
    });

    // --- Room Actions ---
    const clickedRoomLevel = ref(null);

    const playBtnSound = () => {
        if (settingsStore.soundEnabled) {
            AudioUtils.playEffect(btnClickSound);
        }
    };

    const handleEnterRoomClick = (level) => {
        if (clickedRoomLevel.value === level) return;
        playBtnSound();
        clickedRoomLevel.value = level;
        setTimeout(() => {
            clickedRoomLevel.value = null;
            executeEnterGame(level);
        }, 150);
    };

    const executeEnterGame = debounce(async (level) => {
        try {
            gameStore.gameMode = currentMode.value;
            await gameStore.joinRoom(level, currentMode.value);
            router.push({ path: '/game', query: { mode: currentMode.value } });
        } catch (error) {
            console.error("Failed to join room:", error);
        }
    }, 500);

    // --- Room text image helper (accepts a textMap object) ---
    const matchRoomName = (roomName, textMap) => {
        if (!roomName) return null;
        if (roomName.includes('体验')) return textMap.tiyan;
        if (roomName.includes('初级')) return textMap.chuji;
        if (roomName.includes('中级')) return textMap.zhongji;
        if (roomName.includes('高级')) return textMap.gaoji;
        if (roomName.includes('大师')) return textMap.dashi;
        if (roomName.includes('巅峰')) return textMap.dianfeng;
        return null;
    };

    // --- Modals ---
    const showHistory = ref(false);
    const showSettings = ref(false);
    const showHelp = ref(false);

    const openHistoryDebounced = debounce(() => {
        playBtnSound();
        showHistory.value = true;
    }, 200);

    const openSettingsDebounced = debounce(() => {
        playBtnSound();
        showSettings.value = true;
    }, 200);

    const openHelpDebounced = debounce(() => {
        playBtnSound();
        showHelp.value = true;
    }, 200);

    // --- Data & Music ---
    const fetchData = () => {
        gameClient.send("UserInfo");
        gameClient.send("QZNN.LobbyConfig");
    };

    const playMusic = () => {
        if (!settingsStore.musicEnabled) return;
        AudioUtils.playMusic(lobbyBgSound, 0.5);
    };

    const stopMusic = () => {
        AudioUtils.pauseMusic();
    };

    watch(() => settingsStore.musicEnabled, (val) => {
        if (val) playMusic();
        else stopMusic();
    });

    const goBack = () => {
        playBtnSound();
        console.log("Exit clicked");
    };

    // --- Lifecycle helpers ---
    const initLobby = (mode) => {
        currentMode.value = mode;
        if (route.query.mode !== undefined) {
            currentMode.value = Number(route.query.mode);
        }
        userStore.lastSelectedMode = currentMode.value;

        gameClient.on('QZNN.UserInfo', (msg) => {
            userStore.updateUserInfo({
                avatar: msg.data.Avatar,
                balance: msg.data.Balance,
                nick_name: msg.data.NickName,
                user_id: msg.data.UserId
            });
            settingsStore.updateFromServer(msg.data);
        });

        gameClient.on('QZNN.LobbyConfig', (msg) => {
            if (msg.code === 0 && msg.data?.LobbyConfigs) {
                userStore.updateRoomConfigs(msg.data.LobbyConfigs.map(cfg => ({
                    level: cfg.Level,
                    name: cfg.Name,
                    base_bet: cfg.BaseBet,
                    min_balance: cfg.MinBalance
                })));
            }
        });

        fetchData();
        playMusic();
    };

    const onLobbyActivated = () => {
        fetchData();
        playMusic();
    };

    return {
        currentMode,
        userInfo,
        rooms,
        clickedRoomLevel,
        handleEnterRoomClick,
        playBtnSound,
        matchRoomName,
        showHistory,
        showSettings,
        showHelp,
        openHistoryDebounced,
        openSettingsDebounced,
        openHelpDebounced,
        goBack,
        stopMusic,
        initLobby,
        onLobbyActivated,
    };
}
