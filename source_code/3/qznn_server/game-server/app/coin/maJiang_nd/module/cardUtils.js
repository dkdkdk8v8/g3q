var CardUtils = module.exports;

var OptType = require("../globalDefine").OptCardCode;
var CardType = require("../globalDefine").CardType;
var HuType = require("../globalDefine").HuType;
var HuTypeInfo = require("../globalDefine").HuTypeInfo;
var HuPai = require('./huPai');

// 得到牌id
CardUtils.getCardValue = function(id){
	return id&0x00FF;
};

// 得到花色
CardUtils.getCardColor = function(id){
	return (id&0xFF00)>>8;
};

/**
 * 能不能操作出牌(吃碰杠胡) 传入的牌是已经排序好的
 */
CardUtils.CanOptCard = function(handCards, optCards, card, lastGetCard,firstRound,qiangGang) {
    //console.log("handCards",handCards,"optCards",optCards,"card",card,"lastGetCard",lastGetCard);
	var cardSet = {};
	var huTypes = [];
	var optCode = 0;
	for (var i = 0; i < handCards.length; i++) {
		cardSet[handCards[i]] = cardSet[handCards[i]] || 0;
		cardSet[handCards[i]] += 1;
	}
	// 先判断胡牌
	//除了抢杠，宁都麻将不能点炮
	if((!card)||qiangGang) {
        var huRes = CardUtils.CanHu(handCards, optCards, card, lastGetCard);
        if (huRes.length > 0) {
            for (var i = 0; i < huRes.length; i++) {
                    optCode |= OptType.Hu;
                    huTypes.push(huRes[i]);
            }
        }
    }

	// 别人出牌的时候
	if (card) {

		// 碰
		if (cardSet[card] && cardSet[card] >= 2) {
			optCode |= OptType.Peng;
		}
		// 明杠
		if (cardSet[card] && cardSet[card] == 3) {
			optCode |= OptType.MingGang;
		}
	}
	// 自己摸牌的时候
	else {
		if(firstRound){
		for (var c in cardSet) {
			if (cardSet[c] == 4) {
				optCode |= OptType.MingGang;
				optCode |= OptType.AnGang;
				break;
			}
		}

		// 可以杠已经碰过的牌
		for (var i = 0; i < optCards.length; i++) {
			if (optCards[i].optCode == OptType.Peng) {
				if (cardSet[optCards[i].cards[0]] == 1) {
					optCode |= OptType.MingGang;
					break;
				}
			}
		}
        }
        else{
			for (var c in cardSet) {
				if (cardSet[c] == 4) {
					optCode |= OptType.MingGang;
					optCode |= OptType.AnGang;
					break;
				}
			}

            if (cardSet[lastGetCard] == 4) {
                optCode |= OptType.MingGang;
                optCode |= OptType.AnGang;
            }
            for (var i = 0; i < optCards.length; i++) {
                if (optCards[i].cards[0]==lastGetCard) {
                        optCode |= OptType.MingGang;
                        break;
                }
            }
		}
	}
	return {optCode:optCode, huTypes:huTypes};
};

/**
 * 给定牌 确定是吃还是碰杠
 */
CardUtils.OptCardCode = function(cards, optCards, card) {
	// 在已经碰的牌里面杠
	if (cards.length == 1) {
		for (var i = 0 ; i < optCards.length; i++) {
			if (optCards[i].optCode == OptType.Peng && optCards[i].cards[0] == cards[0]) {
				return OptType.MingGang;
			}
		}
		return OptType.Null;
	}
	else {
		var tmpCards = cards.concat(card || []);
		if (tmpCards.length < 3) {
			return OptType.Null;
		}
		tmpCards.sort(function (a, b) {
			return a - b;
		});
		var cardType = CardUtils.getCardColor(tmpCards[0]);
		for (var i = 1; i < tmpCards.length; i++) {
			if (cardType != CardUtils.getCardColor(tmpCards[i])) {
				return OptType.Null;
			}
		}

		// 碰 杠
		if (tmpCards[tmpCards.length - 1] - tmpCards[0] == 0) {
			if (tmpCards.length == 3) {
				return OptType.Peng;
			}
			// 别人出牌 只能明杠
			if (tmpCards.length == 4 && card) {
				return OptType.MingGang;
			}
			// 自己摸牌 才能明杠或者暗杠
			if (tmpCards.length == 4 && !card) {
				return OptType.MingGang | OptType.AnGang;
			}
		}

		// 自己不能吃自己的牌 只有是三张才算是吃牌
		if (!card || tmpCards.length != 3) {
			return OptType.Null;
		}

		if (cardType == CardType.Wan || cardType == CardType.Tiao || cardType == CardType.Tong || cardType == CardType.Zhi) {
			if (tmpCards[tmpCards.length - 1] - tmpCards[0] == 2) {
				return OptType.Chi;
			}
		}
		else if (cardType == CardType.Feng) {
			for (var i = 0; i < tmpCards.length - 1; i++) {
				if (tmpCards[i] == tmpCards[i + 1]) {
					return OptType.Null;
				}
			}
			return OptType.Chi;
		}
		return OptType.Null;
	}
};

/**
 * 能不能胡牌
 */
CardUtils.CanHu = function(handCards, optCards, card, lastGetCard) {
    //console.log("handCards",handCards,"optCards",optCards,"card",card,"lastGetCard",lastGetCard);
	var checkRes = [];
	var hasHu = false;
	var lastCard = card || lastGetCard;
	for (var i = 0; i < HuPai.checkFuncArr.length; i++) {
		var res = HuPai.checkFuncArr[i](handCards, optCards, card, lastGetCard);
		if (res.huType != HuType.Null) {
			if (!res.wasteCard) {

				checkRes.push({huType: HuType.PingHu,
					score: HuTypeInfo[HuType.PingHu].score,
					name: HuTypeInfo[HuType.PingHu].name});
			}
			checkRes.push(res);
		}
	}
	var pingRes = CardUtils.CanPingHu(handCards, optCards, card, lastGetCard);
	checkRes = checkRes.concat(pingRes);
	if (checkRes.length == 0) {
		return checkRes;
	}

	// 去重
	checkRes.sort(function (a, b) {
		if (a.huType == b.huType) {
			if (a.wasteCard) {
				return 1;
			}
			else if (b.wasteCard) {
				return -1;
			}
			else {
				return 0;
			}
		}
		else {
			return a.huType - b.huType;
		}
	});
	var now = checkRes[0];
	if (!now.wasteCard) {
		hasHu = true;
	}
	var tmp = [now];
	for (var i = 1; i < checkRes.length; i++) {
		if (!checkRes[i].wasteCard) {
			hasHu = true;
		}
		// 两种摆牌
		if (now.huType == checkRes[i].huType) {

		}
		else {
			tmp.push(checkRes[i]);
			now = checkRes[i];
		}
	}
	checkRes = tmp;

	if (hasHu) {
		// // 不求人
		// if (!card && optCards.length == 0) {
		// 	checkRes.push({
		// 		huType: HuType.BuQiuRen,
		// 		score: HuTypeInfo[HuType.BuQiuRen].score,
		// 		name: HuTypeInfo[HuType.BuQiuRen].name
		// 	});
		// }
		// 全求人
		if (optCards.length == 4) {
			checkRes.push({
				huType: HuType.QuanQiuRen,
				score: HuTypeInfo[HuType.QuanQiuRen].score,
				name: HuTypeInfo[HuType.QuanQiuRen].name
			});
		}
	}
	return checkRes;
};

CardUtils.CanPingHu = function(handCards, optCards, card, lastGetCard) {
	var huRes = [];
	var res = CardUtils.GetPlan(handCards, card);
	var hasHu = false;
	var lastCard = card || lastGetCard;
	//console.log("handCards",handCards,"optCards",optCards,"card",card,"lastGetCard",lastGetCard);
	for (var i = 0 ; i < res.waste.length; i++) {
		for (var j = 0; j < CardUtils.checkFuncArr.length; j++) {
			var huTmp = CardUtils.checkFuncArr[j](res.plan[i].concat(optCards), res.waste[i], card, lastGetCard);
			// 胡牌或摆牌
			if (huTmp.huType != HuType.Null) {
				huRes.push(huTmp);
			}
		}
		if (!hasHu) {
			var waste = CardUtils.formatWasteCard(res.waste[i]);
			if (waste && waste.length == 0) {
				hasHu = true;
				huRes.push({
					huType: HuType.PingHu,
					score: HuTypeInfo[HuType.PingHu].score,
					name: HuTypeInfo[HuType.PingHu].name
				});

			}
		}
	}
	return huRes;
};

/**
 * 选出三张刻子或顺子
 */
CardUtils.GetThree = function(cards, start) {
    if (cards.length < 3 || start >= cards.length) {
        return;
    }

    var i = start;
    var first = cards[i];
    var second;
    var third;
    if (cards.length - start >= 3) {
        second = cards[i + 1];
        third = cards[i + 2];
        // 检测刻牌
        if (first == second && first == third) {
            cards.splice(i, 3);
            return {cards: [first, second, third], optCode: OptType.Peng, cardType: CardUtils.getCardColor(first)};
        }
    }

    if (CardUtils.getCardColor(first) == CardType.Feng || CardUtils.getCardColor(first) == CardType.Zhi) {
        return;
    }

    for (var j = i + 1; j < cards.length; j++) {
        if (cards[j] != first && cards[j] == first + 1) {
            second = cards[j];
            for (var k = j + 1; k < cards.length; k++) {
                if (cards[k] != second && cards[k] == second + 1) {
                    third = cards[k];
                    cards.splice(k, 1);
                    cards.splice(j, 1);
                    cards.splice(i, 1);
                    return {
                        cards: [first, second, third],
                        optCode: OptType.Chi,
                        cardType: CardUtils.getCardColor(first)
                    };
                }
                else if (cards[k] != second) {
                    break;
                }
            }
        }
        else if (cards[j] != second) {
            break;
        }
    }
};


CardUtils.GetPlan = function(handCards, card) {
	//console.log("handCards",handCards,"card",card);

	var tmpP = {};
	var tmpW = {};
	var tempCard = handCards.concat(card || []);
	tempCard.sort(function (a, b) {
		return a - b;
	});
	var wasteCount = 5;
	if (card) {
		wasteCount = 4;
	}
	// 获取所有组合
	CardUtils.SpreadCard(tempCard, tmpP, tmpW, 0, wasteCount, 0);
	var plan = [];
	var waste = [];

	for (var index in tmpP) {
		plan.push(tmpP[index].concat([]));
		waste.push(tmpW[index].concat([]));
		var sc;
		var itmp = plan.length-1;
		for (var i = 0 ; i < tmpW[index].length; i++) {
			var wtmp = tmpW[index].concat([]);
			sc = CardUtils.GetThree(wtmp, i);
			if (sc) {
				plan.push(plan[itmp].concat([sc]));
				waste.push(wtmp);
			}
		}
	}

	// 排序 排重
	for (var i = 0; i < plan.length; i++) {
		plan[i].sort(function (a, b) {
			if (a.cards[0] == b.cards[0]) {
				return a.optCode - b.optCode;
			}
			else {
				if (a.cards[0] == b.cards[0]) {
					if (a.cards[1] == b.cards[1]) {
						return a.cards[2] - b.cards[2];
					}
					else {
						return a.cards[1] - b.cards[1]
					}
				}
				else {
					return a.cards[0] - b.cards[0];
				}
			}
		});
		waste[i].sort(function (a, b) {
			return a- b;
		});
	}
	for (var i = 0; i < plan.length; i++) {
		for (var j = i+1; j < plan.length; j++) {
			if (waste[i].length != waste[j].length) {
				break;
			}
			else {
				var sameCount = 0;
				for (var k = 0; k < plan[i].length; k++) {
					if (plan[i][k].cards[0] == plan[j][k].cards[0] &&
						plan[i][k].cards[1] == plan[j][k].cards[1] &&
						plan[i][k].cards[2] == plan[j][k].cards[2] &&
						plan[i][k].optCode == plan[j][k].optCode) {
						sameCount += 1;
					}
					else {
						break;
					}
				}
				if (sameCount == plan[i].length) {
					plan.splice(j, 1);
					waste.splice(j, 1);
					j--;
				}
			}
		}
	}
	//console.log("plan",plan,"waste")
	return {plan:plan, waste:waste};
};

CardUtils.SpreadCard = function(cards, plan, waste, deep, maxWaste, start) {
	plan[deep] = plan[deep] || [];
	waste[deep] = waste[deep] || [];
	if (cards.length < 3) {
		waste[deep].push.apply(waste[deep], cards);
		if (waste[deep].length > maxWaste) {
			delete plan[deep];
			delete waste[deep];
		}
		return;
	}
	var tmpCard = cards.concat([]);

	var sc = CardUtils.GetThree(cards, start);
	if (sc) {
		var index = 0;
		while (plan[index]) {
			index += 1;
		}
		plan[index] = plan[deep].concat([]);
		waste[index] = waste[deep].concat([]);

		plan[deep].push(sc);

		if (waste[index].length > maxWaste) {
			delete plan[index];
		}
		else {
			CardUtils.SpreadCard(tmpCard, plan, waste, index, maxWaste, start+1);
		}
		start = 0;
	}
	else {
		waste[deep].push(cards.splice(0,1)[0]);
		if (waste[deep].length > maxWaste) {
			delete plan[deep];
		}
	}
	CardUtils.SpreadCard(cards, plan, waste, deep, maxWaste, start);
};

// 废牌数量超过五张的话就没有办法组成听牌或者胡牌了
CardUtils.formatWasteCard = function(cards) {
	if (cards.length == 2) {
		if (cards[0] == cards[1]) {
			return [];
		}
		else {
			return [cards[0], cards[1]];
		}
	}
	else if (cards.length == 5) {
		var single = [];
		var double = {};
		var doubleCount = 0;
		for (var i = 0; i < cards.length; i++) {
			single.push(cards[i]);
			if (i+1 < cards.length) {
				if (cards[i] == cards[i + 1]) {
					double[cards[i]] = true;
					doubleCount += 1;
					i++;
				}
			}
		}
		var waste = [];
		if (doubleCount == 1) {
			// 排除掉对子
			for (var i = 0; i < single.length; i++) {
				if (double[single[i]]) {
					single.splice(i, 1);
					break;
				}
			}
			var c1 = single[0];
			var c2 = single[1];
			var c3 = single[2];
			var offset = 2;
			if (CardType.Feng == CardUtils.getCardColor(c1)) {
				offset = 3;
			}
			if (c2 - c1 <= offset) {
				waste.push(c3);
			}
			offset = 2;
			if (CardType.Feng == CardUtils.getCardColor(c2)) {
				offset = 3;
			}
			if (c3 - c2 <= offset) {
				waste.push(c1);
			}
			if (waste.length > 0) {
				return waste;
			}
		}
		else if (doubleCount == 2) {
			var alone;
			for (var i = 0; i < single.length; i++) {
				if (!double[single[i]]) {
					alone = single[i];
					break;
				}
			}
			// 单牌的一张肯定可以打出去听牌
			waste.push(alone);

			var c1 = single[0];
			var c2 = single[1];
			var c3 = single[2];

			var offset = 2;
			if (CardType.Feng == CardUtils.getCardColor(c1)) {
				offset = 3;
			}
			if (c2 - c1 <= offset && c3 != alone) {
				waste.push(c2 == alone ? c1 : c2);
			}
			offset = 2;
			if (CardType.Feng == CardUtils.getCardColor(c2)) {
				offset = 3;
			}
			if (c3 - c2 <= offset && c1 != alone) {
				waste.push(c2 == alone ? c3 : c2);
			}
			return waste;
		}
	}
};

/*
 * 碰碰胡 (要考虑摆牌)
 */
CardUtils.isPengPengHu = function(plan, waste, card, lastGetCard) {


	for (var i = 0; i < plan.length; i++) {
		if (plan[i].optCode != OptType.Peng && plan[i].optCode != OptType.MingGang && plan[i].optCode != OptType.AnGang) {
			return {huType: HuType.Null};
		}
	}
	var w = CardUtils.formatWasteCard(waste);
	if (w && w.length == 0) {
		return {huType: HuType.PengPenghu,
			score: HuTypeInfo[HuType.PengPenghu].score,
			name: HuTypeInfo[HuType.PengPenghu].name}
	}
	// if (!card && w) {
	// 	var doubleCount = 0;
	// 	var wasteCard = [];
	// 	if (waste.length == 5) {
	// 		for (var i = 0; i < waste.length; i++) {
	// 			if (i + 1 < waste.length) {
	// 				if (waste[i] == waste[i + 1]) {
	// 					doubleCount++;
	// 					i++;
	// 					continue;
	// 				}
	// 				else {
	// 					wasteCard.push(waste[i]);
	// 				}
	// 			}
	// 			wasteCard.push(waste[i]);
	// 		}
	// 		if (doubleCount == 2) {
	// 			return {
	// 				huType: HuType.PengPenghu,
	// 				score: HuTypeInfo[HuType.PengPenghu].score,
	// 				name: HuTypeInfo[HuType.PengPenghu].name,
	// 				wasteCard: wasteCard
	// 			};
	// 		}
	// 	}
	// 	else if (waste.length == 2) {
	// 		return {
	// 			huType: HuType.PengPenghu,
	// 			score: HuTypeInfo[HuType.PengPenghu].score,
	// 			name: HuTypeInfo[HuType.PengPenghu].name,
	// 			wasteCard: waste
	// 		};
	// 	}
	// }
	return {huType: HuType.Null};
};



/*
 * 死掐
 */
CardUtils.isSiQia = function(plans, wastes, card, lastGetCard) {
	var isSiQia = false;
	var isLiangdui = false;
	lastGetCard = card || lastGetCard;

	for (var i = 0; i < plans.length; i++) {
		var waste = CardUtils.formatWasteCard(wastes[i]);
		if (waste && waste.length == 0) {
			if (wastes[i][0] == lastGetCard) {
				isSiQia = true;
			}
			for (var l = 0; l < plans[i].length; l++) {
				if (plans[i][l].optCode == OptType.Peng && plans[i][l].cards[0] == lastGetCard) {
					isLiangdui = true;
				}
				if (plans[i][l].optCode == OptType.Chi) {
					if (CardUtils.getCardColor(lastGetCard) != CardType.Feng) {
						if (CardUtils.getCardColor(lastGetCard) == CardType.Zhi) {
							isSiQia = true;
						}
						if (plans[i][l].cards[1] == lastGetCard) {
							isSiQia = true;
						}
						else if (CardUtils.getCardValue(plans[i][l].cards[0]) == 7 && plans[i][l].cards[0] == lastGetCard) {
							isSiQia = true;
						}
						else if (CardUtils.getCardValue(plans[i][l].cards[2]) == 3 && plans[i][l].cards[2] == lastGetCard) {
							isSiQia = true;
						}
					}
				}
			}
		}
	}
	if (isSiQia) {
		return {
			huType: HuType.SiQia,
			score: HuTypeInfo[HuType.SiQia].score,
			name: HuTypeInfo[HuType.SiQia].name
		};
	}
	if (isLiangdui) {
		return {
			huType: HuType.LiangDuiHu,
			score: HuTypeInfo[HuType.LiangDuiHu].score,
			name: HuTypeInfo[HuType.LiangDuiHu].name
		};
	}
	return {huType: HuType.Null};
};
/*
 * 七对清一色
 */
CardUtils.qingYise = function(cards) {
	var color = CardUtils.getCardColor(cards[0]);
	if (color != CardType.Wan && color != CardType.Tiao && color != CardType.Tong) {
		return false;
	}
	for (var i = 0; i < cards.length; i++) {
		if (color != cards[i].cardType) {
			return false;
		}
	}
	return true;
};

CardUtils.checkFuncArr = [
	// CardUtils.isQingYise,
	CardUtils.isPengPengHu,
	// CardUtils.isYaoRen,
	// CardUtils.isYiTiaoLong
];