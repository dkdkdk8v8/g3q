<template>
  <div
    class="flex justify-center items-center h-[100dvh] w-full font-sans select-none overflow-hidden text-slate-200 bg-black">
    <div
      class="relative w-full h-full sm:max-w-[430px] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border border-blue-900/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950 via-slate-900 to-black">

      <GlobalEffectOverlay :effect="globalEffect" />

      <!-- Top Section: Dealer -->
      <div class="flex-none px-4 pt-1 pb-1 z-20 border-b border-indigo-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div
          class="relative pt-1 pb-1 flex flex-col items-center flex-none border-b border-indigo-400/20 bg-gradient-to-b from-blue-900/40 to-transparent shadow-md transition-all duration-700">
          <SeatEffectLayer :scoreObj="scores.banker" :active="spotlightKey === 'banker' && revealed.banker[4]" />
          <div class="flex items-center gap-2 mb-1 z-30">
            <div
              class="px-3 py-0.5 bg-indigo-950/80 border border-indigo-500/30 shadow-sm rounded-full flex items-center gap-2">
              <Crown v-if="CrownIcon" :size="12" class="text-amber-400" />
              <span
                class="text-[10px] font-black tracking-widest whitespace-nowrap text-[#ef4444] drop-shadow-md">庄家</span>
            </div>
            <ScoreBadge v-if="revealed.banker[4] && scores.banker" :scoreObj="scores.banker" small />
          </div>

          <div class="flex justify-center gap-1 z-30" id="hand-banker">
            <div v-for="(card, i) in (hands.banker.length > 0 ? hands.banker : Array(5).fill({}))" :key="`banker-${i}`"
              class="relative">
              <Card :revealed="revealed.banker[i]" size="xs" :suit="card.suit" :rank="card.rank"
                :isBase="shouldShowMask('banker', i)" :float="isHighTierHand('banker')"
                :lightning="spotlightKey === 'banker' && scores.banker?.type === 'epic_flower' && revealed.banker[4]"
                :skipAnim="skipAnimKeys['banker'] && i === 4" />
              <SqueezeOverlay v-if="i === 4 && squeezeKey === 'banker'" :card="card" size="xs" :duration="1200" />
            </div>
          </div>
        </div>

        <!-- Players Area -->
        <div class="px-2 py-0.5 z-10 flex-none scale-[0.94] origin-top">
          <div class="grid grid-cols-3 gap-1">
            <div v-for="p in PLAYER_CONFIG" :key="p.key" :class="[
              'relative flex flex-col items-center py-1 rounded-2xl shadow-lg border border-indigo-500/20 bg-blue-950/40 backdrop-blur-md transition-all duration-700',
              spotlightKey === p.key ? 'scale-105 z-50 bg-indigo-950/60 shadow-[0_0_30px_rgba(251,191,36,0.3)] border-amber-400/60' : ''
            ]">
              <SeatEffectLayer :scoreObj="scores[p.key]" :active="spotlightKey === p.key && revealed[p.key][4]" />
              <div class="flex items-center justify-center gap-1 mb-1 w-full px-1 z-30">
                <span :class="['text-[12px] font-black drop-shadow-md whitespace-nowrap', p.text]">{{ p.name.replace('', '') }}</span>
                <ScoreBadge v-if="revealed[p.key][4] && scores[p.key]" :scoreObj="scores[p.key]" small />
              </div>

              <div class="relative z-30 flex justify-center w-full h-[54px]" :id="`hand-${p.key}`">
                <div class="relative" :style="{ width: `${CARD_SIZES.xxs.w + (4 * (CARD_SIZES.xxs.w * 0.4))}px` }">
                  <div v-for="(card, i) in (hands[p.key].length > 0 ? hands[p.key] : Array(5).fill({}))"
                    :key="`${p.key}-${i}`" class="absolute top-0 shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                    :style="{ left: `${i * (CARD_SIZES.xxs.w * 0.4)}px`, zIndex: i }">
                    <Card :revealed="revealed[p.key][i]" size="xxs" :suit="card.suit" :rank="card.rank"
                      :isBase="shouldShowMask(p.key, i)" :float="isHighTierHand(p.key)"
                      :lightning="spotlightKey === p.key && scores[p.key]?.type === 'epic_flower' && revealed[p.key][4]"
                      :skipAnim="skipAnimKeys[p.key] && i === 4" />
                    <SqueezeOverlay v-if="i === 4 && squeezeKey === p.key" :card="card" size="xxs" :duration="1200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timer Strip -->
      <div
        class="px-6 py-2 flex flex-col justify-center z-20 bg-indigo-950/80 shadow-inner border-y border-indigo-500/20 relative h-[36px]">
        <div class="flex justify-between items-center w-full px-1">
          <div class="flex items-center gap-2">
            <template v-if="gameState === 'betting' && totalBet === 0">
              <Timer v-if="TimerIcon" :size="18" class="text-amber-500 animate-pulse" />
              <span
                class="text-[13px] font-black text-amber-500 tracking-widest whitespace-nowrap animate-pulse">请下注<span
                  class="animate-dot-1">.</span><span class="animate-dot-2">.</span><span
                  class="animate-dot-3">.</span></span>
            </template>
            <template v-else-if="gameState === 'betting' && totalBet > 0">
              <span class="text-[11px] font-black whitespace-nowrap text-amber-500 tracking-widest">即将结束投注</span>
            </template>
            <template v-else-if="gameState === 'dealing'">
              <Zap v-if="ZapIcon" :size="14" class="text-cyan-500" />
              <span class="text-[11px] font-black whitespace-nowrap text-cyan-400 tracking-widest">结算中</span>
            </template>
            <template v-else>
              <span class="text-[11px] font-black whitespace-nowrap text-slate-400 tracking-widest">即将开始下一局</span>
            </template>
          </div>

          <span v-if="((gameState === 'betting' && totalBet > 0) || gameState === 'result') && countdown !== null"
            :class="['text-xl font-black italic tabular-nums leading-none', countdown <= 3 ? 'text-red-500 animate-bounce' : 'text-slate-200']">
            {{ countdown }}
          </span>
        </div>

        <div v-if="((gameState === 'betting' && totalBet > 0) || gameState === 'result') && countdown !== null"
          class="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-900 overflow-hidden shadow-inner">
          <div
            :class="['h-full transition-all duration-1000 linear', countdown <= 3 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]']"
            :style="{ width: `${(countdown / (gameState === 'betting' ? 7 : 5)) * 100}%` }">
          </div>
        </div>
      </div>

      <!-- Betting Areas -->
      <div
        class="flex-1 px-2 pt-1 pb-1 flex flex-col justify-start gap-1 overflow-hidden z-10 mt-0 bg-[#0f4d34] border-t border-emerald-500/30 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">

        <div class="flex items-center gap-2 px-2 opacity-70 mb-0.5">
          <Map v-if="MapIcon" :size="10" class="text-emerald-300" />
          <span class="text-[10px] font-bold whitespace-nowrap text-emerald-200 uppercase tracking-wider">席位投注</span>
          <div class="flex-1 h-[1px] bg-gradient-to-r from-emerald-500/50 to-transparent"></div>
        </div>

        <div class="flex flex-col border border-emerald-500/40 rounded-sm">
          <div class="grid grid-cols-3">
            <div v-for="(p, idx) in PLAYER_CONFIG" :key="p.key"
              :class="['flex flex-col', idx !== PLAYER_CONFIG.length - 1 ? 'border-r border-emerald-500/40' : '']">
              <div class="grid grid-rows-2 h-full">
                <BetButton :id="`bet-${p.key}_flat`" :label="p.name.replace(' ', '')" odds="1:1"
                  :active="(bets[`${p.key}_flat`] || 0) > 0" :amount="bets[`${p.key}_flat`]"
                  @bet="(e) => handleBet(e, `${p.key}_flat`)" :accent="p.accent" :disabled="gameState !== 'betting'"
                  groupType="top" :placedChips="placedChips[`${p.key}_flat`]" />

                <BetButton :id="`bet-${p.key}_double`" :label="`闲${idx + 1}-翻倍`" odds="1:5"
                  :active="(bets[`${p.key}_double`] || 0) > 0" :amount="bets[`${p.key}_double`]"
                  @bet="(e) => handleBet(e, `${p.key}_double`)" :accent="p.accent" :disabled="gameState !== 'betting'"
                  groupType="bottom" :placedChips="placedChips[`${p.key}_double`]" hasInfoClick
                  @infoClick="showDoubleRules = true" />
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 px-2 opacity-70 mt-0.5 mb-0.5">
          <Search v-if="SearchIcon" :size="10" class="text-amber-300" />
          <span class="text-[10px] font-bold whitespace-nowrap text-amber-200 uppercase tracking-wider">全局投注</span>
          <div class="flex-1 h-[1px] bg-gradient-to-r from-amber-500/50 to-transparent"></div>
        </div>

        <div class="flex flex-col border border-emerald-500/40 rounded-sm">
          <div class="grid grid-cols-2">
            <div class="grid grid-rows-2 flex-1 border-r border-emerald-500/30">
              <BetButton id="bet-banker_all" label="庄家通杀" odds="1:7" special="gold"
                :active="(bets['banker_all'] || 0) > 0" :amount="bets['banker_all']"
                @bet="(e) => handleBet(e, 'banker_all')" :disabled="gameState !== 'betting'" groupType="top"
                :placedChips="placedChips['banker_all']" :isWinningGlobal="globalWinningKeys.includes('banker_all')"
                :winningStampText="['通', '杀']" />

              <BetButton id="bet-any_niuniu" label="牛牛" odds="1:2" special="gold"
                :active="(bets['any_niuniu'] || 0) > 0" :amount="bets['any_niuniu']"
                @bet="(e) => handleBet(e, 'any_niuniu')" :disabled="gameState !== 'betting'" groupType="bottom"
                :placedChips="placedChips['any_niuniu']" :isWinningGlobal="globalWinningKeys.includes('any_niuniu')"
                :winningStampText="['牛', '牛']" />
            </div>
            <div class="grid grid-rows-2 flex-1">
              <BetButton id="bet-players_all" label="三闲全胜" odds="1:7" special="gold"
                :active="(bets['players_all'] || 0) > 0" :amount="bets['players_all']"
                @bet="(e) => handleBet(e, 'players_all')" :disabled="gameState !== 'betting'" groupType="top"
                :placedChips="placedChips['players_all']" :isWinningGlobal="globalWinningKeys.includes('players_all')"
                :winningStampText="['全', '胜']" />

              <BetButton id="bet-any_epic" label="四炸/五花/五小牛" odds="1:150" special="gold"
                :active="(bets['any_epic'] || 0) > 0" :amount="bets['any_epic']" @bet="(e) => handleBet(e, 'any_epic')"
                :disabled="gameState !== 'betting'" groupType="bottom" :placedChips="placedChips['any_epic']"
                :isWinningGlobal="globalWinningKeys.includes('any_epic')" :winningStampText="['神', '牌']" />
            </div>
          </div>
        </div>
      </div>

      <!-- User Area / Chips -->
      <div class="relative z-40 px-3 py-3 border-t border-indigo-500/50 w-full flex-none bg-slate-950">
        <div class="flex items-center justify-between h-full">
          <div id="user-avatar-area" class="flex items-center gap-2">
            <div
              class="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-500 flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.8)] overflow-hidden">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" class="w-5 h-5 text-slate-300 transform translate-y-1">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div
              class="flex flex-col justify-center bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 shadow-inner">
              <span class="text-amber-400 font-bold text-base tabular-nums tracking-wider drop-shadow-md leading-none">
                {{ balance.toLocaleString() }}
              </span>
            </div>
          </div>

          <div class="flex justify-end items-end gap-1.5 h-[40px] pr-1 pb-1 flex-1" style="perspective: 500px">
            <button v-for="c in CHIP_DATA" :key="c.val" @click="selectedChip = c.val" :class="['relative rounded-full cursor-pointer transition-transform duration-300 flex-none',
              selectedChip === c.val ? 'chip-active shadow-[0_15px_30px_rgba(0,0,0,0.6)]' : 'chip-idle shadow-[0_5px_10px_rgba(0,0,0,0.4)] hover:brightness-125'
            ]" style="width: 30px; height: 30px; transform-origin: bottom center">

              <div
                :class="['absolute inset-0 rounded-full overflow-hidden', selectedChip === c.val ? 'animate-spin-slow ring-1 ring-white/60' : 'ring-1 ring-white/10']"
                :style="{ background: `conic-gradient(#fff 0deg 30deg, ${c.color} 30deg 60deg, #fff 60deg 90deg, ${c.color} 90deg 120deg, #fff 120deg 150deg, ${c.color} 150deg 180deg, #fff 180deg 210deg, ${c.color} 210deg 240deg, #fff 240deg 270deg, ${c.color} 270deg 300deg, #fff 300deg 330deg, ${c.color} 330deg 360deg)`, padding: '2px' }">
                <div class="absolute inset-[3px] rounded-full bg-slate-900 shadow-inner" />
                <div class="absolute inset-[4px] rounded-full"
                  :style="{ background: `radial-gradient(circle at 50% 30%, ${c.color}, #000)` }" />
              </div>
              <span
                class="absolute inset-0 flex items-center justify-center font-black text-[10px] text-white drop-shadow-[0_2px_1px_rgba(0,0,0,1)] tracking-tighter w-full h-full align-middle leading-none"
                :style="{ transform: selectedChip !== c.val ? 'translateZ(1px)' : 'none' }">
                {{ c.val >= 1000 ? `${c.val / 1000}k` : c.val }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Roadmap -->
      <div
        class="bg-gradient-to-t from-slate-950 to-indigo-950/80 backdrop-blur-md grid grid-cols-3 h-[85px] flex-none relative z-20 border-t border-indigo-900/60 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
        <PlayerRoadmap :history="history.p1" label="闲1 对 庄" accentColor="text-cyan-400" />
        <PlayerRoadmap :history="history.p2" label="闲2 对 庄" accentColor="text-purple-400" />
        <PlayerRoadmap :history="history.p3" label="闲3 对 庄" accentColor="text-orange-400" />
      </div>
    </div>

  </div>

  <!-- Flying Bet Chips -->
  <div class="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
    <div v-for="chip in flyingChips" :key="chip.id" class="absolute" :style="{
      left: 0, top: 0,
      transform: `translate(${chip.endX - 18}px, ${chip.endY - 18}px) scale(0.4)`,
      transition: 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
    }" @vue:mounted="(vnode) => {
      const el = vnode.el;
      if (el) {
        el.style.transition = 'none';
        el.style.transform = `translate(${chip.startX - 18}px, ${chip.startY - 18}px) scale(1)`;
        void el.offsetHeight; // trigger reflow
        el.style.transition = 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)';
        el.style.transform = `translate(${chip.endX - 18}px, ${chip.endY - 18}px) scale(0.4)`;
      }
    }">
      <div class="opacity-90 shadow-2xl drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
        <div class="relative rounded-full chip-active flex-none w-[30px] h-[30px]"
          :style="{ backgroundColor: getChipColor(chip.val) }">
          <div class="absolute inset-0 rounded-full overflow-hidden ring-1 ring-white/60">
            <div class="w-full h-[30%] bg-white/20 absolute top-0 left-0" />
            <div
              class="w-full h-full bg-[repeating-conic-gradient(from_0deg,transparent_0deg_15deg,rgba(0,0,0,0.3)_15deg_30deg)] opacity-40 mix-blend-overlay" />
          </div>
          <div class="absolute inset-[3px] rounded-full border border-white/30 bg-black/20" />
          <span
            class="absolute inset-0 flex items-center justify-center font-black text-[10px] text-white drop-shadow-[0_2px_1px_rgba(0,0,0,1)] tracking-tighter w-full h-full align-middle leading-none">
            {{ chip.val >= 1000 ? `${chip.val / 1000}k` : chip.val }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Flying Reward Chips -->
  <div class="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
    <div v-for="chip in flyingRewardChips" :key="chip.id" class="absolute" :style="{
      left: 0, top: 0,
      transform: `translate(${chip.endX - 18}px, ${chip.endY - 18}px) scale(0.6)`,
      transition: `transform 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${chip.delay}ms`,
    }" @vue:mounted="(vnode) => {
      const el = vnode.el;
      if (el) {
        el.style.transition = 'none';
        el.style.transform = `translate(${chip.startX - 18}px, ${chip.startY - 18}px) scale(0)`;
        void el.offsetHeight; // trigger reflow
        el.style.transition = `transform 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${chip.delay}ms`;
        el.style.transform = `translate(${chip.endX - 18}px, ${chip.endY - 18}px) scale(0.6)`;
      }
    }">
      <div class="opacity-90 shadow-[0_10px_20px_rgba(251,191,36,0.6)] animate-spin-slow">
        <div class="relative rounded-full chip-active flex-none w-[30px] h-[30px]">
          <div class="absolute inset-0 rounded-full overflow-hidden ring-1 ring-white/10"
            :style="{ background: getChipConicGradient(chip.val), padding: '2px' }">
            <div class="absolute inset-[3px] rounded-full bg-slate-900 shadow-inner" />
            <div class="absolute inset-[4px] rounded-full"
              :style="{ background: `radial-gradient(circle at 50% 30%, ${getChipColor(chip.val)}, #000)` }" />
          </div>
          <span
            class="absolute inset-0 flex items-center justify-center font-black text-[10px] text-white drop-shadow-[0_2px_1px_rgba(0,0,0,1)] tracking-tighter w-full h-full align-middle leading-none">
            {{ chip.val >= 1000 ? `${chip.val / 1000}k` : chip.val }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Double Rules Modal -->
  <div v-if="showDoubleRules"
    class="fixed inset-0 z-[1001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    @click="showDoubleRules = false">
    <div class="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-6 max-w-sm w-full relative"
      @click.stop>
      <button @click="showDoubleRules = false"
        class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
        <X v-if="XIcon" :size="20" />
      </button>

      <h2 class="text-xl font-black text-amber-400 mb-6 tracking-wider flex items-center gap-2">
        <Info v-if="InfoIcon" :size="24" class="text-amber-500" />
        翻倍区玩法说明
      </h2>

      <div class="space-y-4 text-sm text-slate-300">
        <div class="bg-amber-900/20 p-3 rounded-lg border border-amber-500/30">
          <h3 class="font-bold text-amber-400 mb-1 flex items-center gap-1">核心规则：动态倍率赔付</h3>
          <p class="text-amber-100/80 mb-2">翻倍区是按照“牛牛”的牌型规则结算，<strong>牌面为“几牛”即按几倍的赔率进行派彩</strong>。</p>
          <div class="text-xs text-amber-300/60 bg-black/20 p-2 rounded">
            <span class="text-red-400 font-bold">⚠️ 注意：</span>
            为保障高倍率赔付，下注翻倍区时，系统会额外锁定相匹配的高倍筹码金额，避免用户资金不足卡BUG。
          </div>
        </div>

        <div class="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
          <h3 class="font-bold text-white mb-1">阶梯赔率 (最高1:5)</h3>
          <p class="text-slate-400">极强爆发与高回报，提供显著的区别于平倍的兴奋感。</p>
        </div>

        <div class="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
          <h3 class="font-bold text-white mb-1">作为进攻仓搭配</h3>
          <p class="text-slate-400">建议与平倍区搭配下注，构建“主防守 + 辅进攻”的立体赢钱策略。</p>
        </div>

        <div class="bg-emerald-900/20 p-3 rounded-lg border border-emerald-500/20">
          <h3 class="font-bold text-emerald-400 mb-1">关于下注决策的降维</h3>
          <p class="text-emerald-200/80">核心是解决“下多少、下在哪”的问题，让看路的经验累积转化为实际的胜率提升。</p>
        </div>
      </div>

      <div class="mt-6">
        <button @click="showDoubleRules = false"
          class="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-900 font-bold rounded-xl transition-all shadow-lg active:scale-95">
          我知道了
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, onMounted } from 'vue';
import { useGameLoop } from './composables/useGameLoop';
import { Crown, Timer, Zap, Map, Search, X, Info } from 'lucide-vue-next';
import { CARD_SIZES, CHIP_DATA, PLAYER_CONFIG } from './utils/gameLogic';

import GlobalEffectOverlay from './components/GlobalEffectOverlay.vue';
import SeatEffectLayer from './components/SeatEffectLayer.vue';
import ScoreBadge from './components/ScoreBadge.vue';
import Card from './components/Card.vue';
import SqueezeOverlay from './components/SqueezeOverlay.vue';
import BetButton from './components/BetButton.vue';
import PlayerRoadmap from './components/PlayerRoadmap.vue';

const CrownIcon = Crown;
const TimerIcon = Timer;
const ZapIcon = Zap;
const MapIcon = Map;
const SearchIcon = Search;
const XIcon = X;
const InfoIcon = Info;

const {
  balance, selectedChip, bets, gameState, gameResultMsg,
  hands, scores, revealed, squeezeKey, skipAnimKeys, activeHandEffects,
  globalEffect, globalWinningKeys, history, showDoubleRules, countdown,
  flyingChips, flyingRewardChips, placedChips, totalBet, spotlightKey,
  isHighTierHand, handleBet, startDeal, resetGame, shouldShowMask
} = useGameLoop();

// Watch loop equivalent
let timerObj = null;

watch([gameState, countdown, totalBet], ([gState, cDown, tBet]) => {
  if (timerObj) clearTimeout(timerObj);

  if (gState === 'betting' && tBet > 0) {
    if (cDown > 0) {
      timerObj = setTimeout(() => { countdown.value = cDown - 1; }, 1000);
    } else if (cDown === 0) {
      startDeal();
    }
  } else if (gState === 'result') {
    if (cDown === null || cDown > 5) {
      countdown.value = 5;
    } else if (cDown > 0) {
      timerObj = setTimeout(() => { countdown.value = cDown - 1; }, 1000);
    } else if (cDown === 0) {
      resetGame();
    }
  }
}, { immediate: true });

const getChipColor = (val) => {
  const cd = CHIP_DATA.find(c => c.val === val);
  return cd ? cd.color : '#fbbf24';
}

const getChipConicGradient = (val) => {
  const color = getChipColor(val);
  return `conic-gradient(#fff 0deg 30deg, ${color} 30deg 60deg, #fff 60deg 90deg, ${color} 90deg 120deg, #fff 120deg 150deg, ${color} 150deg 180deg, #fff 180deg 210deg, ${color} 210deg 240deg, #fff 240deg 270deg, ${color} 270deg 300deg, #fff 300deg 330deg, ${color} 330deg 360deg)`;
}
</script>
