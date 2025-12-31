var CardUtils = module.exports;

var PAI_XING = require("../globalDefine").PAI_XING;
var COW_RES = require("../globalDefine").COW_RES;

// 得到牌id
CardUtils.getCardValue = function(id){
	return id&0x00FF;
};

// 得到花色
CardUtils.getCardColor = function(id){
	return (id&0xFF00)>>8;
};

/**
*  比较大小
*  1.先比较牌id  
*  2.如果牌ID 相同 ，则比较花色
*/
CardUtils.compareCards = function(wLeft,wRight){
	var bLogicValue1 = CardUtils.getCardValue(wLeft);
	var bLogicValue2 = CardUtils.getCardValue(wRight);
	if( bLogicValue1 != bLogicValue2 )
		return bLogicValue1 > bLogicValue2;
	else
		return CardUtils.getCardColor(wLeft) > CardUtils.getCardColor(wRight);
};

/**
*  冒泡排序(从大到小)
*/
CardUtils.sortCardListByValue = function(cardList) {
	var temp=0;  
	for(var i=0;i<cardList.length;i++){
       	for(var j=i+1;j<cardList.length;j++){
       		if(!CardUtils.compareCards(cardList[i],cardList[j])) {
	            temp=cardList[i];  
	            cardList[i]=cardList[j];  
	            cardList[j]=temp;  
	        }  
       	}
   	}
};

CardUtils.GetCardResult = function(cardList) {
	if (cardList.length != 5) {
		return {cardType:PAI_XING.NoCow};
	}
	var res = {};
	res.cardList = cardList.concat([]);
	CardUtils.sortCardListByValue(res.cardList);

	var values = [];
	for (var i = 0; i < 5; i++) {
		var value =  CardUtils.getCardValue(cardList[i]);
		if (value > 10) {
			value = 10;
		}
		values.push(value);
	}

	// 五小牛
	if (values[0] < 10) {
		var total = values[0] + values[1] + values[2] + values[3] + values[4];
		// 五小牛
		if (total <= 10) {
			res.cardType = PAI_XING.CowLittle;
			return res;
		}
	}
	// 炸弹
	if (CardUtils.getCardValue(res.cardList[0]) == CardUtils.getCardValue(res.cardList[3])
		|| CardUtils.getCardValue(res.cardList[1]) == CardUtils.getCardValue(res.cardList[4])) {
		res.cardType = PAI_XING.CowBoom;
		return res;
	}
	// 五花牛
	if (CardUtils.getCardValue(res.cardList[4]) > 10) {
		res.cardType = PAI_XING.CowFace;
		return res;
	}
	function cow_Res() {
		var cow = 0;
		for (var i = 0; i < 3; i++) {
			for (var j = i + 1; j < 4; j++) {
				for (var k = j + 1; k < 5; k++) {
					if ((values[i] + values[j] + values[k]) % 10 == 0) {
						for (var a = 0; a < 5; a++) {
							if (a != i && a != j && a != k) {
								cow += values[a];
							}
						}
						return cow;
					}
				}
			}
		}
		return cow;
	}
	var cow = cow_Res();
	if (cow == 0) {
		res.cardType = PAI_XING.NoCow;
	}
	else {
		cow = cow%10;
		res.cardType = COW_RES[cow];
	}
	return res;
};

CardUtils.CompareCardType = function(card1, card2) {
	var result1 = CardUtils.GetCardResult(card1);
	var result2 = CardUtils.GetCardResult(card2);
	if(result1.cardType!=result2.cardType){
		return result1.cardType.weight > result2.cardType.weight;
	}
	else {
		return CardUtils.compareCards(result1.cardList[0], result2.cardList[0]);
	}
};

CardUtils.sortCard = function(cardList) {
	if(cardList.length<1)
		return;

	var sort = [];

	for (var i = 0; i < cardList.length; i++) {
		for(var j = i+1; j < cardList.length; j++) {
			var tempCard;
			if(!CardUtils.CompareCardType(cardList[i].card,cardList[j].card)) {
				tempCard=cardList[i];
				cardList[i]=cardList[j];
				cardList[j]=tempCard;
			}
		}
	}
	for (var i = 0; i < cardList.length; i++) {
		sort.push(cardList[i].uid);
	}
	return sort;
};

CardUtils.sortCardByType = function(cardList) {
	if(cardList.length<1)
		return;

	var sort = cardList.concat([]);

	for (var i = 0; i < sort.length; i++) {
		for(var j = i+1; j < sort.length; j++) {
			var tempCard;
			var res = sort[i].cardType.weight - sort[j].cardType.weight;
			if(res < 0) {
				tempCard=sort[i];
				sort[i]=sort[j];
				sort[j]=tempCard;
			}
			else if (res == 0) {
				CardUtils.sortCardListByValue(sort[i].card);
				CardUtils.sortCardListByValue(sort[j].card);
				if (!CardUtils.compareCards(sort[i].card[0], sort[j].card[0])) {
					tempCard=sort[i];
					sort[i]=sort[j];
					sort[j]=tempCard;
				}
			}
		}
	}
	return sort;
};

CardUtils.CompareCardByType = function (card1, card2) {
	var res = card1.cardType.weight - card2.cardType.weight;
	if (res != 0) {
		return res > 0;
	}
	else {
		CardUtils.sortCardListByValue(card1.card);
		CardUtils.sortCardListByValue(card2.card);
		return CardUtils.compareCards(card1.card[0], card2.card[0]);
	}
};

CardUtils.formatCard = function (id) {
	var value = CardUtils.getCardValue(id);
	var color = CardUtils.getCardColor(id);
	var colorMap = ["♦️", "♣️", "♥️", "♠️"];
	var valueMap = {1: 'A', 11: 'J', 12: 'Q', 13: 'K'};
	var vStr = valueMap[value] || value;
	return colorMap[color] + ' ' + vStr;
};

CardUtils.formatCards = function (cards) {
	if (!cards || !Array.isArray(cards)) return "";
	return cards.map(CardUtils.formatCard).join(' ');
};
