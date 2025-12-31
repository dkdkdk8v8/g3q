/**
 * Created by mofanjun on 2017/10/26.
 */

var CardUtils = module.exports;

var PAI_XING = require("./define").PAI_XING;
var COW_RES = require("./define").COW_RES;

CardUtils.GetCardResult = function (cardList) {
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
}

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

CardUtils.compareCards = function(wLeft,wRight){
    var bLogicValue1 = CardUtils.getCardValue(wLeft);
    var bLogicValue2 = CardUtils.getCardValue(wRight);
    if( bLogicValue1 != bLogicValue2 )
        return bLogicValue1 > bLogicValue2;
    else
        return CardUtils.getCardColor(wLeft) > CardUtils.getCardColor(wRight);
};

// 得到牌id
CardUtils.getCardValue = function(id){
    return id&0x00FF;
};

// 得到花色
CardUtils.getCardColor = function(id){
    return (id&0xFF00)>>8;
};

CardUtils.isManPai = function (cardList) {
    var values = [];
    for (var i = 0; i < 5; i++) {
        var value =  CardUtils.getCardValue(cardList[i]);
        if (value > 10) {
            value = 10;
        }
        values.push(value);
    }

    for (var i = 0; i < 2; i++) {
        for (var j = i + 1; j < 3; j++) {
            for (var k = j + 1; k < 4; k++) {
                if ((values[i] + values[j] + values[k]) % 10 == 0) {
                    return true;
                }
            }
        }
    }

    return false;
}


