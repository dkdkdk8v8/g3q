import { defineStore } from 'pinia'
import { ref } from 'vue'
import gameClient from '../socket.js'
import { useUserStore } from './user.js'

/**
 * BRNN (百人牛牛) Pinia Store
 *
 * Manages all client-side state for the BRNN game mode.
 * Server push types:
 *   - BRNN.PushRoomState   — full room state sync
 *   - BRNN.PushBetUpdate   — area bet totals + my bets update
 *   - BRNN.PushSettlement  — round settlement results
 *   - BRNN.PushPlayerCount — player count update
 */

const AREA_NAMES = ['天', '地', '玄', '黄'];

function createDefaultAreas() {
  return AREA_NAMES.map(name => ({
    name,
    totalBet: 0,
    myBet: 0,
    cards: [],
    niuType: '',
    niuMult: 0,
    win: null, // null = unknown, true = win, false = lose
  }));
}

function createDefaultDealer() {
  return {
    cards: [],
    niuType: '',
    niuMult: 0,
  };
}

/**
 * Map server state string to client phase string.
 */
function mapServerState(serverState) {
  if (!serverState) return null;
  const normalized = serverState.replace('BRNN.', '');
  switch (normalized) {
    case 'StateBetting':  return 'BETTING';
    case 'StateDealing':  return 'DEALING';
    case 'StateShowCard': return 'SHOW_CARD';
    case 'StateSettling': return 'SETTLEMENT';
    default:              return null;
  }
}

export const useBrnnStore = defineStore('brnn', () => {
  // --- State ---
  const currentPhase = ref('IDLE');
  const countdown = ref(0);
  const gameCount = ref(0);
  const playerCount = ref(0);
  const chips = ref([100, 1000, 5000, 10000, 50000]);
  const maxBetPerArea = ref(500000);
  const minBalance = ref(0);
  const selectedChip = ref(100);
  const areas = ref(createDefaultAreas());
  const dealer = ref(createDefaultDealer());
  const lastWin = ref(0);
  const dealerWin = ref(0);
  const trend = ref([]);
  let lastWinTimer = null;

  // --- History ---
  const history = ref([]);
  const historyLastId = ref(0);
  const historyLastTimestamp = ref(0);
  const isLoadingHistory = ref(false);
  const isHistoryEnd = ref(false);

  // --- Online Players ---
  const onlinePlayers = ref([]);
  const isLoadingPlayers = ref(false);

  // --- Handlers (called by push handlers) ---

  /**
   * Handle full room state push from server.
   * data: {State, LeftSec, GameCount, PlayerCount,
   *        Areas[4]{Index,Name,Cards,NiuType,NiuMult,TotalBet,Win},
   *        Dealer{Cards,NiuType,NiuMult},
   *        MyBets[4], Config{Chips,MaxBetPerArea,MinBalance}, Trend[]}
   */
  const handleRoomState = (data) => {
    if (!data) return;

    // Phase
    const phase = mapServerState(data.State);
    if (phase) {
      currentPhase.value = phase;

      // New round: clear previous round's visual state
      if (phase === 'BETTING') {
        areas.value.forEach(area => {
          area.win = null;
          area.cards = [];
          area.niuType = '';
          area.niuMult = 0;
        });
        dealer.value = createDefaultDealer();
        lastWin.value = 0;
        dealerWin.value = 0;
      }
    }

    // Countdown
    if (data.LeftSec !== undefined) {
      countdown.value = parseInt(data.LeftSec) || 0;
    }

    // Counts
    if (data.GameCount !== undefined) gameCount.value = data.GameCount;
    if (data.PlayerCount !== undefined) playerCount.value = data.PlayerCount;

    // Areas
    if (data.Areas && Array.isArray(data.Areas)) {
      data.Areas.forEach((areaData, i) => {
        if (i < areas.value.length && areaData) {
          const area = areas.value[i];
          if (areaData.Name) area.name = areaData.Name;
          if (areaData.Cards) area.cards = areaData.Cards;
          if (areaData.NiuType !== undefined) area.niuType = areaData.NiuType;
          if (areaData.NiuMult !== undefined) area.niuMult = areaData.NiuMult;
          if (areaData.TotalBet !== undefined) area.totalBet = areaData.TotalBet;
          if (areaData.Win !== undefined) area.win = areaData.Win;
        }
      });
    }

    // Dealer
    if (data.Dealer) {
      if (data.Dealer.Cards) dealer.value.cards = data.Dealer.Cards;
      if (data.Dealer.NiuType !== undefined) dealer.value.niuType = data.Dealer.NiuType;
      if (data.Dealer.NiuMult !== undefined) dealer.value.niuMult = data.Dealer.NiuMult;
    }

    // My Bets
    if (data.MyBets && Array.isArray(data.MyBets)) {
      data.MyBets.forEach((bet, i) => {
        if (i < areas.value.length) {
          areas.value[i].myBet = bet || 0;
        }
      });
    }

    // Balance
    if (data.MyBalance !== undefined) {
      useUserStore().userInfo.balance = data.MyBalance;
    }

    // Config
    if (data.Config) {
      if (data.Config.Chips && Array.isArray(data.Config.Chips)) {
        chips.value = data.Config.Chips;
        // Reset selectedChip to first chip if current selection is not in new chips
        if (!chips.value.includes(selectedChip.value)) {
          selectedChip.value = chips.value[0] || 10;
        }
      }
      if (data.Config.MaxBetPerArea !== undefined) {
        maxBetPerArea.value = data.Config.MaxBetPerArea;
      }
      if (data.Config.MinBalance !== undefined) {
        minBalance.value = data.Config.MinBalance;
      }
    }

    // Trend
    if (data.Trend && Array.isArray(data.Trend)) {
      trend.value = data.Trend;
    }
  };

  /**
   * Handle bet update push from server.
   * data: {AreaBets[4], MyBets[4]}
   */
  const handleBetUpdate = (data) => {
    if (!data) return;

    if (data.AreaBets && Array.isArray(data.AreaBets)) {
      data.AreaBets.forEach((bet, i) => {
        if (i < areas.value.length) {
          areas.value[i].totalBet = bet || 0;
        }
      });
    }

    if (data.MyBets && Array.isArray(data.MyBets)) {
      data.MyBets.forEach((bet, i) => {
        if (i < areas.value.length) {
          areas.value[i].myBet = bet || 0;
        }
      });
    }

    if (data.MyBalance !== undefined) {
      useUserStore().userInfo.balance = data.MyBalance;
    }
  };

  /**
   * Handle settlement push from server.
   * data: {AreaWin[4], AreaMult[4], MyWin, MyBalance}
   */
  const handleSettlement = (data) => {
    if (!data) return;

    // Update area win status
    if (data.AreaWin && Array.isArray(data.AreaWin)) {
      data.AreaWin.forEach((win, i) => {
        if (i < areas.value.length) {
          areas.value[i].win = !!win;
        }
      });
    }

    // Dealer win
    if (data.DealerWin !== undefined) {
      dealerWin.value = data.DealerWin;
    }

    // Last win amount
    if (data.MyWin !== undefined) {
      lastWin.value = data.MyWin;
    }

    // Update user balance
    if (data.MyBalance !== undefined) {
      useUserStore().userInfo.balance = data.MyBalance;
    }

    // Update trend
    if (data.Trend && Array.isArray(data.Trend)) {
      trend.value = data.Trend;
    }

    // Auto-dismiss settlement overlay after 3 seconds
    if (lastWinTimer) clearTimeout(lastWinTimer);
    lastWinTimer = setTimeout(() => {
      lastWin.value = 0;
      dealerWin.value = 0;
      lastWinTimer = null;
    }, 3000);
  };

  /**
   * Handle player count push from server.
   * data: {PlayerCount} or just a number
   */
  const handlePlayerCount = (data) => {
    if (!data) return;
    if (typeof data === 'number') {
      playerCount.value = data;
    } else if (data.PlayerCount !== undefined) {
      playerCount.value = data.PlayerCount;
    }
  };

  // --- Actions ---

  const joinRoom = () => {
    gameClient.send('BRNN.PlayerJoin');
  };

  const leaveRoom = () => {
    gameClient.send('BRNN.PlayerLeave');
  };

  const placeBet = (areaIndex) => {
    gameClient.send('BRNN.PlaceBet', {
      Area: areaIndex,
      Chip: selectedChip.value,
    });
  };

  const selectChipValue = (chipValue) => {
    selectedChip.value = chipValue;
  };

  const fetchHistory = ({ reset = false } = {}) => {
    if (isLoadingHistory.value) return;
    if (!reset && isHistoryEnd.value) return;

    if (reset) {
      history.value = [];
      historyLastId.value = 0;
      historyLastTimestamp.value = 0;
      isHistoryEnd.value = false;
    }

    isLoadingHistory.value = true;
    gameClient.send('GameRecord', {
      Limit: 20,
      LastId: historyLastId.value,
      LastTimestamp: historyLastTimestamp.value,
      Date: '',
    });
  };

  const handleGameRecord = (msg) => {
    isLoadingHistory.value = false;
    if (msg.code !== 0 || !msg.data) return;

    const data = msg.data;
    if (data.LastId) historyLastId.value = data.LastId;
    if (data.LastTimestamp) historyLastTimestamp.value = data.LastTimestamp;

    const list = data.List || [];
    if (list.length < 20) isHistoryEnd.value = true;

    for (const item of list) {
      if (item.Type === 1 && item.GameData) {
        try { item.GameDataObj = JSON.parse(item.GameData); } catch (_) {}
      }
      history.value.push(item);
    }
  };

  // --- Online Players ---

  const fetchOnlinePlayers = () => {
    if (isLoadingPlayers.value) return;
    isLoadingPlayers.value = true;
    gameClient.send('BRNN.GetPlayers');
  };

  const handleGetPlayers = (msg) => {
    isLoadingPlayers.value = false;
    if (msg.code !== 0 || !msg.data) return;
    onlinePlayers.value = msg.data.Players || [];
  };

  // --- Lifecycle ---

  const registerPushHandlers = () => {
    gameClient.onServerPush('BRNN.PushRoomState', handleRoomState);
    gameClient.onServerPush('BRNN.PushBetUpdate', handleBetUpdate);
    gameClient.onServerPush('BRNN.PushSettlement', handleSettlement);
    gameClient.onServerPush('BRNN.PushPlayerCount', handlePlayerCount);
    gameClient.on('GameRecord', handleGameRecord);
    gameClient.on('BRNN.GetPlayers', handleGetPlayers);
  };

  const unregisterPushHandlers = () => {
    gameClient.offServerPush('BRNN.PushRoomState');
    gameClient.offServerPush('BRNN.PushBetUpdate');
    gameClient.offServerPush('BRNN.PushSettlement');
    gameClient.offServerPush('BRNN.PushPlayerCount');
    gameClient.off('GameRecord');
    gameClient.off('BRNN.GetPlayers');
  };

  const resetState = () => {
    currentPhase.value = 'IDLE';
    countdown.value = 0;
    gameCount.value = 0;
    playerCount.value = 0;
    chips.value = [100, 1000, 5000, 10000, 50000];
    maxBetPerArea.value = 500000;
    minBalance.value = 0;
    selectedChip.value = chips.value[0];
    areas.value = createDefaultAreas();
    dealer.value = createDefaultDealer();
    lastWin.value = 0;
    dealerWin.value = 0;
    trend.value = [];
    if (lastWinTimer) {
      clearTimeout(lastWinTimer);
      lastWinTimer = null;
    }
  };

  return {
    // State
    currentPhase,
    countdown,
    gameCount,
    playerCount,
    chips,
    maxBetPerArea,
    minBalance,
    selectedChip,
    areas,
    dealer,
    lastWin,
    dealerWin,
    trend,

    // Handlers
    handleRoomState,
    handleBetUpdate,
    handleSettlement,
    handlePlayerCount,

    // History
    history,
    isLoadingHistory,
    isHistoryEnd,

    // Online Players
    onlinePlayers,
    isLoadingPlayers,

    // Actions
    joinRoom,
    leaveRoom,
    placeBet,
    selectChipValue,
    fetchHistory,
    fetchOnlinePlayers,

    // Lifecycle
    registerPushHandlers,
    unregisterPushHandlers,
    resetState,
  };
});
