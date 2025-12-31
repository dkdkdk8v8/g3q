/**
 * Created by Administrator on 2016/12/27.
 */

var HuType = require('../globalDefine').HuType;
var HuTypeInfo = require('../globalDefine').HuTypeInfo;
var CardType = require('../globalDefine').CardType;
var OptCardCode = require('../globalDefine').OptCardCode;
var CardUtils = require('./cardUtils');

var HuPai = module.exports;

/*
* 七对胡
*/
HuPai.CanQiDui = function(handCards, optCards, card) {
    if (optCards && optCards.length > 0) {
        return {huType:HuType.Null};
    }
    var tempCards = handCards.concat(card || []);
    if (tempCards.length != 14) {
        return {huType:HuType.Null};
    }
    tempCards.sort(function (a, b) {
        return a - b;
    });
    var cardSet = {};
    for (var i = 0; i < tempCards.length; i++) {
        cardSet[tempCards[i]] = cardSet[tempCards[i]] || 0;
        cardSet[tempCards[i]] += 1;
    }
    var wasteCard = [];
    var threeCard = [];
    for (var c in cardSet) {
        c = Number(c);
        if (cardSet[c] == 2) {

        }
        else if (cardSet[c] == 1) {
            wasteCard.push(c);
        }
        else if (cardSet[c] == 3) {
            threeCard.push(c);
        }
        else {
            return {huType:HuType.Null};
        }
    }
    if (wasteCard.length + threeCard.length > 2) {
        return {huType:HuType.Null};
    }
    if (wasteCard.length == 0 && threeCard.length == 0) {
        return {huType:HuType.QiDui, score:HuTypeInfo[HuType.QiDui].score, name:HuTypeInfo[HuType.QiDui].name};
    }
    // /*
    //  检查听牌
    //  */
    // if (!card) {
    //     wasteCard = wasteCard.concat(threeCard);
    //     return {huType:HuType.QiDui, score:HuTypeInfo[HuType.QiDui].score, name:HuTypeInfo[HuType.QiDui].name, wasteCard:wasteCard};
    // }
    return {huType:HuType.Null};
};
/*
 * 豪华七对
 */
HuPai.CanHaoHuaQiDui = function(handCards, optCards, card) {
    if (optCards && optCards.length > 0) {
        return {huType:HuType.Null};
    }
    var tempCards = handCards.concat(card || []);
    if (tempCards.length != 14) {
        return {huType:HuType.Null};
    }
    tempCards.sort(function (a, b) {
        return a - b;
    });
    var cardSet = {};
    for (var i = 0; i < tempCards.length; i++) {
        cardSet[tempCards[i]] = cardSet[tempCards[i]] || 0;
        cardSet[tempCards[i]] += 1;
    }
    var wasteCard = [];
    var haoHuaCard = [];
    var threeCard = [];
    for (var c in cardSet) {
        c = Number(c);
        if (cardSet[c] == 2) {

        }
        else if (cardSet[c] == 1) {
            wasteCard.push(c);
        }
        else if (cardSet[c] == 3) {
            threeCard.push(c);
        }
        else if (cardSet[c] == 4) {
            haoHuaCard.push(c);
        }
    }
    if (wasteCard.length + threeCard.length > 2) {
        return {huType:HuType.Null};
    }
    if (wasteCard.length == 0 && threeCard.length == 0 && haoHuaCard.length == 1) {
        return {huType:HuType.HaoHuaQidui, score:HuTypeInfo[HuType.HaoHuaQidui].score, name:HuTypeInfo[HuType.HaoHuaQidui].name};
    }
    /*
     检查听牌
     */
    // if (!card) {
    //     if (haoHuaCard.length == 1) {
    //         wasteCard = wasteCard.concat(threeCard);
    //         return {huType:HuType.HaoHuaQidui, score:HuTypeInfo[HuType.HaoHuaQidui].score, name:HuTypeInfo[HuType.HaoHuaQidui].name, wasteCard:wasteCard};
    //     }
    // }
    return {huType:HuType.Null};
};
/*
 * 双豪华七对
 */
HuPai.CanShuangHaoHuaQiDui = function(handCards, optCards, card) {
    if (optCards && optCards.length > 0) {
        return {huType:HuType.Null};
    }
    var tempCards = handCards.concat(card || []);
    if (tempCards.length != 14) {
        return {huType:HuType.Null};
    }
    tempCards.sort(function (a, b) {
        return a - b;
    });
    var cardSet = {};
    for (var i = 0; i < tempCards.length; i++) {
        cardSet[tempCards[i]] = cardSet[tempCards[i]] || 0;
        cardSet[tempCards[i]] += 1;
    }
    var wasteCard = [];
    var haoHuaCard = [];
    var threeCard = [];
    for (var c in cardSet) {
        c = Number(c);
        if (cardSet[c] == 2) {

        }
        else if (cardSet[c] == 1) {
            wasteCard.push(c);
        }
        else if (cardSet[c] == 3) {
            threeCard.push(c);
        }
        else if (cardSet[c] == 4) {
            haoHuaCard.push(c);
        }
    }
    if (wasteCard.length + threeCard.length > 2) {
        return {huType:HuType.Null};
    }
    if (wasteCard.length == 0 && threeCard.length == 0 && haoHuaCard.length == 2) {
        return {huType:HuType.ShuangHaoHuaQidui, score:HuTypeInfo[HuType.ShuangHaoHuaQidui].score, name:HuTypeInfo[HuType.ShuangHaoHuaQidui].name};
    }
    /*
     检查听牌
     */
    // if (!card) {
    //     if (haoHuaCard.length == 2) {
    //         wasteCard = wasteCard.concat(threeCard);
    //         return {huType:HuType.ShuangHaoHuaQidui, score:HuTypeInfo[HuType.ShuangHaoHuaQidui].score, name:HuTypeInfo[HuType.ShuangHaoHuaQidui].name, wasteCard:wasteCard};
    //     }
    // }
    return {huType:HuType.Null};
};
/*
 * 三豪华七对
 */
HuPai.CanSanHaoHuaQiDui = function(handCards, optCards, card) {
    if (optCards && optCards.length > 0) {
        return {huType:HuType.Null};
    }
    var tempCards = handCards.concat(card || []);
    if (tempCards.length != 14) {
        return {huType:HuType.Null};
    }
    tempCards.sort(function (a, b) {
        return a - b;
    });
    var cardSet = {};
    for (var i = 0; i < tempCards.length; i++) {
        cardSet[tempCards[i]] = cardSet[tempCards[i]] || 0;
        cardSet[tempCards[i]] += 1;
    }
    var wasteCard = [];
    var haoHuaCard = [];
    var threeCard = [];
    for (var c in cardSet) {
        c = Number(c);
        if (cardSet[c] == 2) {
        }
        else if (cardSet[c] == 1) {
            wasteCard.push(c);
        }
        else if (cardSet[c] == 3) {
            threeCard.push(c);
        }
        else if (cardSet[c] == 4) {
            haoHuaCard.push(c);
        }
    }
    if (wasteCard.length + threeCard.length > 2) {
        return {huType:HuType.Null};
    }
    if (wasteCard.length == 0 && haoHuaCard.length == 3) {
        return {huType:HuType.ShuangHaoHuaQidui, score:HuTypeInfo[HuType.ShuangHaoHuaQidui].score, name:HuTypeInfo[HuType.ShuangHaoHuaQidui].name};
    }
    // /*
    //  检查听牌
    //  */
    // if (!card) {
    //     if (haoHuaCard.length == 3) {
    //         wasteCard = wasteCard.concat(threeCard);
    //         return {huType:HuType.ShuangHaoHuaQidui, score:HuTypeInfo[HuType.ShuangHaoHuaQidui].score, name:HuTypeInfo[HuType.ShuangHaoHuaQidui].name, wasteCard:wasteCard};
    //     }
    // }
    return {huType:HuType.Null};
};
/*
 * 十三烂
 */
// HuPai.CanShiSanLan = function(handCards, optCards, card) {
//     if (optCards && optCards.length > 0) {
//         return {huType:HuType.Null};
//     }
//     var tempCards = handCards.concat(card || []);
//     if (tempCards.length != 14) {
//         return {huType:HuType.Null};
//     }
//     tempCards.sort(function (a, b) {
//         return a - b;
//     });
//     for (var i = 0; i < tempCards.length-1; i++) {
//         var color = CardUtils.getCardColor(tempCards[i]);
//         if (color == CardUtils.getCardColor(tempCards[i+1])) {
//             if (color == CardType.Wan || color == CardType.Tiao || color == CardType.Tong) {
//                 if (tempCards[i+1] - tempCards[i] < 3) {
//                     return {huType:HuType.Null};
//                 }
//             }
//             else {
//                 if (tempCards[i+1] == tempCards[i]) {
//                     return {huType:HuType.Null};
//                 }
//             }
//         }
//     }
//     return {huType:HuType.ShiSanLan, score:HuTypeInfo[HuType.ShiSanLan].score, name:HuTypeInfo[HuType.ShiSanLan].name};
// };
/*
 * 字一色
 */
// HuPai.CanZiYiSe = function(handCards, optCards, card) {
//     var tempCards = handCards.concat(card || []);
//     for (var i = 0 ; i < optCards.length; i++) {
//         tempCards = tempCards.concat(optCards[i].cards);
//     }
//         return {huType:HuType.Null};
//     if (tempCards.length < 14) {
//     }
//     tempCards.sort(function (a, b) {
//         return a - b;
//     });
//     var wasteCard = [];
//     for (var i = 0; i < tempCards.length; i++) {
//         var color = CardUtils.getCardColor(tempCards[i]);
//         if (color != CardType.Feng && color != CardType.Zhi) {
//             wasteCard.push(tempCards[i]);
//         }
//     }
//     if (wasteCard.length >= 2) {
//         return {huType: HuType.Null};
//     }
//     if (wasteCard.length == 0) {
//         return {huType:HuType.ZiYiSe, score:HuTypeInfo[HuType.ZiYiSe].score, name:HuTypeInfo[HuType.ZiYiSe].name};
//     }
//     if (!card) {
//         return {huType: HuType.ZiYiSe, score: HuTypeInfo[HuType.ZiYiSe].score, name:HuTypeInfo[HuType.ZiYiSe].name, wasteCard:wasteCard};
//     }
//     return {huType: HuType.Null};
// };
/*
 * 十四幺
 */
// HuPai.CanShiSiYao = function(handCards, optCards, card) {
//     var tempCards = handCards.concat(card || []);
//     for (var i = 0; i < optCards.length; i++) {
//         tempCards = tempCards.concat(optCards[i].cards);
//     }
//     if (tempCards.length < 14) {
//         return {huType:HuType.Null};
//     }
//     tempCards.sort(function (a, b) {
//         return a - b;
//     });
//     for (var i = 0; i < tempCards.length-1; i++) {
//         var color = CardUtils.getCardColor(tempCards[i]);
//         if (color == CardType.Wan || color == CardType.Tiao || color == CardType.Tong) {
//             var value = CardUtils.getCardValue(tempCards[i]);
//             if (value != 9 && value != 1) {
//                 return {huType: HuType.Null};
//             }
//         }
//     }
//     return {huType: HuType.ShiSiYao, score: HuTypeInfo[HuType.ShiSiYao].score, name:HuTypeInfo[HuType.ShiSiYao].name};
// };

HuPai.checkFuncArr = [
    // HuPai.CanShiSiYao,
    // HuPai.CanZiYiSe,
    // HuPai.CanShiSanLan,
    HuPai.CanSanHaoHuaQiDui,
    HuPai.CanShuangHaoHuaQiDui,
    HuPai.CanHaoHuaQiDui,
    HuPai.CanQiDui
];