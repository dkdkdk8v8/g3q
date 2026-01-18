<script setup>
import menuHelpImg from '@/assets/common/menu_help.png';
import flowerLeft from '@/assets/common/flower_left.png';
import flowerRight from '@/assets/common/flower_right.png';

const props = defineProps({
    visible: Boolean,
    mode: {
        type: Number,
        default: 0
    }
});

const emit = defineEmits(['update:visible', 'close']);

const close = () => {
    emit('update:visible', false);
    emit('close');
};
</script>

<template>
    <div v-if="visible" class="modal-overlay" style="z-index: 8000;" @click="close">
        <div class="modal-content help-modal" @click.stop>
            <div class="modal-header">
                <div class="modal-header-left-spacer"></div>

                <img :src="menuHelpImg" alt="游戏帮助" class="modal-title-img" />

                <div class="modal-header-right">
                    <div class="close-icon" @click="close">×</div>
                </div>
            </div>
            <div class="help-content">
                <!-- 这个是不看牌抢庄牛牛的基本规则 -->
                <section v-if="mode === 0">
                    <h4 class="flower-header">
                        <img :src="flowerLeft" class="flower-icon" />
                        基本规则
                        <img :src="flowerRight" class="flower-icon" />
                    </h4>
                    <p>• <b>抢庄阶段：</b>玩家可以选择“1倍”、“2倍”、“3倍”、“4倍”、“不抢”。抢庄倍数最高的玩家做庄。若多名玩家抢庄最高倍数相同，则携带金币越多的玩家坐庄几率越大，如果所有玩家都不叫分，则系统随机选择一个玩家作为庄家，倍率默认为“1倍”。
                    </p>
                    <p>• <b>加倍阶段：</b>确定庄家后，闲家可以选择“1倍”、“5倍”、“10倍”、“15倍”、“20倍”倍率进行加倍。不选则默认以最小的“1倍”进行加倍。</p>
                    <p>• <b>拼点阶段：</b>发牌之后，玩家可以计算自己的牌型，并选择摊牌。</p>
                    <p>• <b>比牌阶段：</b>每位闲家分别和庄家比较大小，闲家和闲家之间不进行比较。</p>
                </section>

                <!-- 这个是看三张抢庄牛牛的基本规则 -->
                <section v-else-if="mode === 1">
                    <h4 class="flower-header">
                        <img :src="flowerLeft" class="flower-icon" />
                        基本规则
                        <img :src="flowerRight" class="flower-icon" />
                    </h4>
                    <p>• <b>发牌阶段</b>游戏开始，系统会发给所有玩家三张手牌，并先翻开给玩家看。翻开的三张牌只有玩家自己能看见，无法看见其他人先翻开的三张牌。</p>
                    <p>• <b>抢庄阶段：</b>玩家可以选择“1倍”、“2倍”、“3倍”、“4倍”、“不抢”。抢庄倍数最高的玩家做庄。若多名玩家抢庄最高倍数相同，则携带金币越多的玩家坐庄几率越大，如果所有玩家都不叫分，则系统随机选择一个玩家作为庄家，倍率默认为“1倍”。
                    </p>
                    <p>• <b>加倍阶段：</b>确定庄家后，闲家可以选择“1倍”、“5倍”、“10倍”、“15倍”、“20倍”倍率进行加倍。不选则默认以最小的“1倍”进行加倍。</p>
                    <p>• <b>拼点阶段：</b>投注结束后，系统会发出最后2张牌给各玩家，玩家可以计算自己的牌型，并选择摊牌。</p>
                    <p>• <b>比牌阶段：</b>每位闲家分别和庄家比较大小，闲家和闲家之间不进行比较。</p>
                </section>

                <!-- 这个是看四张抢庄牛牛的基本规则 -->
                <section v-else-if="mode === 2">
                    <h4 class="flower-header">
                        <img :src="flowerLeft" class="flower-icon" />
                        基本规则
                        <img :src="flowerRight" class="flower-icon" />
                    </h4>
                    <p>• <b>发牌阶段</b>游戏开始，系统会发给所有玩家四张手牌，并先翻开给玩家看。翻开的四张牌只有玩家自己能看见，无法看见其他人先翻开的四张牌。</p>
                    <p>• <b>抢庄阶段：</b>玩家可以选择“1倍”、“2倍”、“3倍”、“4倍”、“不抢”。抢庄倍数最高的玩家做庄。若多名玩家抢庄最高倍数相同，则携带金币越多的玩家坐庄几率越大，如果所有玩家都不叫分，则系统随机选择一个玩家作为庄家，倍率默认为“1倍”。
                    </p>
                    <p>• <b>加倍阶段：</b>确定庄家后，闲家可以选择“1倍”、“5倍”、“10倍”、“15倍”、“20倍”倍率进行加倍。不选则默认以最小的“1倍”进行加倍。</p>
                    <p>• <b>拼点阶段：</b>投注结束后，系统会发出最后1张牌给各玩家，玩家可以计算自己的牌型，并选择摊牌。</p>
                    <p>• <b>比牌阶段：</b>每位闲家分别和庄家比较大小，闲家和闲家之间不进行比较。</p>
                </section>

                <section>
                    <h4 class="flower-header">
                        <img :src="flowerLeft" class="flower-icon" />
                        牌型
                        <img :src="flowerRight" class="flower-icon" />
                    </h4>
                    <p>抢庄牛牛游戏中采用一副52张牌，没有大小王。J、Q、K都是10点，其他按照排面的点数计算。</p>
                    <p>• <b>无牛：</b>没有任意三张牌能加起来成为10的倍数。</p>
                    <p>• <b>有牛：</b>从牛一到牛九。任意三张牌相加是10的倍数，剩余两张牌相加不是10的倍数，然后取个位数，各位数是几，就是牛几。</p>
                    <p>• <b>牛牛：</b>任意三张牌相加是10的倍数，剩余2张牌相加也是10的倍数。</p>
                    <p>• <b>四花牛：</b>五张牌中有四张为花牌（J、Q、K）中的任意牌，且第五张为10。</p>
                    <p>• <b>四炸：</b>五张牌中有四张一样的牌即为四炸，此时不需要有牛。</p>
                    <p>• <b>五花牛：</b>手上五张牌全都是J、Q、K组成的特殊牛牛牌型为五花牛。</p>
                    <p>• <b>五小牛：</b>五张牌点数都小于5，且点数之和小于等于10。</p>
                </section>

                <section>
                    <h4 class="flower-header">
                        <img :src="flowerLeft" class="flower-icon" />
                        牌型比较
                        <img :src="flowerRight" class="flower-icon" />
                    </h4>
                    <p>• <b>单张大小：</b>从大到小排序为：K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2 > A。</p>
                    <p>• <b>花色大小：</b>花色由大到小排序为：黑桃 <span
                            style="color: black; font-size: 1.3em; text-shadow: 1px 0 0 #aaa, 0 1px 0 #aaa, -1px 0 0 #aaa, 0 -1px 0 #aaa;">♠</span>
                        > 红桃 <span
                            style="color: #ef4444; font-size: 1.3em; text-shadow: 1px 0 0 #aaa, 0 1px 0 #aaa, -1px 0 0 #aaa, 0 -1px 0 #aaa;">♥</span>
                        > 梅花 <span
                            style="color: black; font-size: 1.3em; text-shadow: 1px 0 0 #aaa, 0 1px 0 #aaa, -1px 0 0 #aaa, 0 -1px 0 #aaa;">♣</span>
                        > 方片 <span
                            style="color: #ef4444; font-size: 1.3em; text-shadow: 1px 0 0 #aaa, 0 1px 0 #aaa, -1px 0 0 #aaa, 0 -1px 0 #aaa;">♦</span>。
                    </p>
                    <p>• <b>牌型大小：</b>从大到小排序为：五小牛 > 五花牛 > 四炸 > 四花牛 > 牛牛 > 有牛 > 无牛。</p>
                    <p>• <b>有牛大小：</b>当都为有牛时，从大到小排序为：牛九 > 牛八 > 牛七 > 牛六 > 牛五 > 牛四 > 牛三 > 牛二 > 牛一。</p>
                    <p>• <b>牌型相同：</b>当庄和闲相同牌型时，挑出最大的一张牌进行比较，如果最大牌点数一样，则按花色进行比较。（特例：当有多个四炸时，比较四张相同的牌的点数大小）</p>
                </section>


                <section>
                    <h4 class="flower-header">
                        <img :src="flowerLeft" class="flower-icon" />
                        结算说明
                        <img :src="flowerRight" class="flower-icon" />
                    </h4>

                    <h3>赔率</h3>
                    <p>• 无牛到牛六：1倍</p>
                    <p>• 牛七到牛九：2倍</p>
                    <p>• 牛牛：3倍</p>
                    <p>• 四花牛：4倍</p>
                    <p>• 四炸：4倍</p>
                    <p>• 五花牛：5倍</p>
                    <p>• 五小牛：5倍</p>

                    <h3>计算公式</h3>
                    <p>• <b>庄家胜利：</b>房间底注 × 庄家牌型倍数 × 庄家抢庄倍数 × 闲家下注倍数。</p>
                    <p>• <b>庄家失败：</b>房间底注 × 闲家牌型倍数 × 庄家抢庄倍数 × 闲家下注倍数。</p>
                    <p>• <b>闲家胜利：</b>房间底注 × 闲家牌型倍数 × 庄家抢庄倍数 × 闲家下注倍数。</p>
                    <p>• <b>闲家失败：</b>房间底注 × 庄家牌型倍数 × 庄家抢庄倍数 × 闲家下注倍数。</p>

                    <h4 class="flower-header">
                        <img :src="flowerLeft" class="flower-icon" />
                        结算
                        <img :src="flowerRight" class="flower-icon" />
                    </h4>
                    <p>• 为了游戏公平，玩家在一局游戏胜利后，赢得的金币总额不会超过身上携带的金币，如某玩家按照游戏规则计算应该赢100金币，但是因为它身上值携带了30金币，所以本局该玩家最多只能赢取30金币，输家按照对应比例相应减少所输的金币。所以如果玩家携带很少的金币进行游戏，很可能会出现赢到的金币低于预期，不够赔付输掉的金币甚至输掉本金的情况，所以强烈建议您携带足够的金币进行游戏。
                    </p>
                    <p>• 在每局游戏中获胜后，系统会收取本局总赢钱金额的5%作为税收。</p>

                </section>
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
    z-index: 8000;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.modal-content {
    width: 85%;
    max-width: 400px;
    max-height: 70vh;
    background: rgba(32, 35, 45, 1);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    /* To push title image to center and close button to right */
    align-items: center;
    color: white;
}

/* New styles for the modal header title image and layout */
.modal-header-left-spacer,
.modal-header-right {
    flex: 1;
    /* Take up available space to push title image to center */
    display: flex;
    align-items: center;
}

.modal-header-left-spacer {
    /* For alignment, can be empty or used for other left-aligned elements */
}

.modal-header-right {
    justify-content: flex-end;
    /* Push content to the right */
    gap: 10px;
    /* Space between close button and potential other elements */
}

.modal-title-img {
    width: 70%;
    /* 50% of the modal's width */
    height: auto;
    object-fit: contain;
    flex-shrink: 0;
    /* Prevent image from shrinking */
}

.close-icon {
    font-size: 24px;
    cursor: pointer;
    color: #94a3b8;
}

.help-modal {
    height: 80vh;
}

.help-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    color: #cbd5e1;
    font-size: 14px;
    line-height: 1.6;
}

.help-content section {
    margin-bottom: 20px;
}

.help-content h4 {
    /* Base styles, potentially overridden by .flower-header */
    color: #fff;
    margin-bottom: 10px;
    /* border-left removed here for safety, will be overridden */
    /* padding-left removed here for safety */
}

.flower-header {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    /* Space between text and flowers */
    color: #fff;
    font-weight: bold;
    margin-bottom: 15px;
    /* Increased margin for better look */
    border-left: none !important;
    /* Force remove left border */
    padding-left: 0 !important;
    font-size: 1.2em;
    /* Force remove left padding */
}

.flower-icon {
    height: 10px;
    /* Adjust size as needed */
    width: auto;
    object-fit: contain;
}

.help-content p {
    margin-bottom: 8px;
}

.help-content b {
    color: #facc15;
}
</style>
