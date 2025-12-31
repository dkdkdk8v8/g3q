/**
 * Created by Administrator on 2016/8/4.
 */
var utils = require("../../../util/utils");
var gDef = require("../globalDefine");
var cardUtil = require("./cardUtils");
pomelo = require("pomelo");
var util = require("util");
var EventEmitter = require('events').EventEmitter;

var desk = function (opts) {
    EventEmitter.call(this);
    this.maxPlayer = opts.maxPlayer;
    this.deskName = opts.deskName;
    this.deskType = opts.deskType;
    // this.deskId = opts.deskId;
    this.roomIndex = opts.roomIndex;
    this.flag = opts.flag;
    this.minCoin = opts.minCoin;
    this.maxCoin = opts.maxCoin;
    this.baseCoin = opts.baseCoin;
    this.mid = opts.mid;
    // 玩家信息
    this.players = [];
    // 桌子上玩家数
    this.playerNum = 0;
    // uid 和 pos 对应关系
    this.uidPosMap = {};
    this.bankUid = 0;
    this.bankPos = -1;
    this.maCards=[];
    // 玩家统计信息
    this.playerCountInfo = {};
    //玩家每局分数信息
    this.playerRoundScores = {};
    // 玩家最后一次杠信息
    this.lastGangInfo = {};
    // 最后一次摆牌信息
    //this.lastBaiInfo = {};
    // 玩家拿牌信息
    this.cardGetInfo = {};
    // 玩家出牌信息
    this.cardPutInfo = {};
    // 听牌状态 1:刚刚听牌 2:听牌
    this.tingFlag = {};

    this.zhangMao = 0;

    this.gameStatus = gDef.GameStatus.null;
    this.uidArr = [];

    this.startTime = 0;

    this.playerPopCard = {};
    //this.playerBaiInfo = {};
    //this.playerBaoUid = {};

    this.lastPopUid = 0;
    this.curPos = -1;
    //this.isDissolution = false;
    //this.isReplace = opts.isReplace;
    this.optTimer = null;
    this.delayUid = null;//TODO:考虑放到玩家属性里 哪个玩家被设置了延迟操作 而且宁都玩法只能有一个玩家可以操作
};

util.inherits(desk, EventEmitter);

module.exports = desk;

var handler = desk.prototype;

handler.getPosByUid = function (uid) {
    return this.uidPosMap[uid];
};

handler.getPlayersInfo = function () {
    var info = [];
    for (var i = 0; i < this.maxPlayer; i++) {
        if (this.players[i]) {
            info.push(this.players[i].getBasicInfo());
        }
    }
    return info;
};

handler.getDeskFee = function () {
    return Math.round(this.baseCoin * 0.08);
};

handler.getPlayerCards = function (uid) {
    var info = [];
    for (var i = 0; i < this.maxPlayer; i++) {
        var player = this.players[i];
        if (player) {
            var cards = {uid: player.getUid()};
            if ( uid == player.getUid()) {
                cards.handCards = player.getHandCards();
                cards.huanCards = player.getHuanCards();
            }
            else {
                cards.handCardLength = player.getHandCards().length;
            }
            if (uid == player.getUid()) {
                cards.lastGetCard = player.getLastCard();
            }
            cards.optCards = player.getOptCards();
            cards.popCards = this.getPlayerPopCard(player.getUid());
            info.push(cards);
        }
    }
    return info;
};

handler.getUidByPos = function (pos) {
    var player = this.players[pos];
    if (!player) {
        return undefined
    }
    else {
        return player.getUid();
    }
};

handler.getPlayerByUid = function (uid) {
    if (undefined == this.uidPosMap[uid]) {
        return undefined;
    }
    else {
        return this.players[this.uidPosMap[uid]];
    }
};

handler.addPlayerPopCard = function (uid, card) {
    if (!this.playerPopCard[uid]) {
        this.playerPopCard[uid] = {cards:[]};
    }
    this.playerPopCard[uid].cards.push(card);
    this.lastPopUid = uid;
};

handler.getPlayerPopCard = function (uid) {
    if (!this.playerPopCard[uid]) {
        return [];
    }
    return this.playerPopCard[uid].cards;
};

handler.deletLastPopCard = function () {
    if (this.lastPopUid) {
        this.playerPopCard[this.lastPopUid].cards.pop();
    }
};

handler.getPlayerBaoCount = function (uid) {
    if (!this.playerPopCard[uid]) {
        return 0;
    }
    return this.playerPopCard[uid].baoNum;
};


handler.getPlayCount = function () {
    return this.playerNum;
};

handler.canSitDown = function (info) {
    if (this.playerNum >= this.maxPlayer) {
        return false;
    }
    return this.uidPosMap[info.uid] == undefined;
};

handler.getDeskInfo = function() {
    return {
        isStart: this.isStart,
        flag: this.flag,
        deskName: this.deskName,
        deskType: this.deskType,
        startTime: this.startTime,
        matchId:this.mid
    };
};

handler.getMaxCoin = function () {
    if (this.maxCoin == 0) {
        return Number.MAX_VALUE;
    }
    return this.maxCoin
};

handler.getMinCoin = function () {
   return this.minCoin
};

handler.reset = function () {
    // 清空手牌和打出去的牌
    for (var i = 0; i < this.maxPlayer; i++) {
        var player = this.players[i];
        if (player) {
            player.reset();
            this.playerPopCard[player.getUid()] = {cards:[]};

            this.cardGetInfo[player.getUid()] = [];

            this.cardPutInfo[player.getUid()] = [];
        }
    }
    this.lastPopUid = 0;
    this.lastGangInfo = {};
    //this.lastBaiInfo = {};
    this.tingFlag = {};
    delete this.card;
    //this.playerBaiInfo = {};
    this.gameStatus = gDef.GameStatus.null;
    delete this.curCard;
    this.curPos = -1;
};

// 下一个玩家位置
handler.nextPos = function (curPos) {
    var self = this;
    function next(curPos) {
        var i;
        for (i = 0; i < self.uidArr.length; i++) {
            if (self.getPosByIndex(i) == curPos) {
                break;
            }
        }
        if (i + 1 >= self.uidArr.length) {
            return self.getPosByIndex(0);
        }
        else {
            return self.getPosByIndex(i + 1);
        }
    }
    var nextPos = next(curPos);
    return nextPos;
};

handler.getPosByIndex = function (index) {
    var uid = this.uidArr[index];
    if (undefined != uid) {
        return this.uidPosMap[uid];
    }
    else {
        return undefined;
    }
};

handler.deletePlayer = function(uid) {
    var pos = this.getPosByUid(uid);
    if (undefined != pos) {
        delete this.players[pos];
        delete this.uidPosMap[uid];
        this.playerNum -= 1;
    }
};

handler.getCurUid = function () {
    if (this.curPos < 0) {
        return undefined;
    }
    if (this.players[this.curPos]) {
        return this.players[this.curPos].getUid();
    }
    return undefined;
};

handler.getGameStatus = function () {
    return this.gameStatus;
};

handler.getDeskName = function () {
    return this.deskName;
};

handler.getDeskType = function () {
    return this.deskType;
};

handler.getGameCount = function () {
    if (this.flag.countType == 1) {
        return 6;
    }
    else if (this.flag.countType == 2) {
        return 12;
    }
    return 6;
};



handler.getCostCardNum = function () {
    if (utils.isInFreeTime()) {
        return 0;
    }
    if (this.flag.countType == 1) {
        return 2;
    }
    else if (this.flag.countType == 2) {
        return 3;
    }
    else if (this.flag.countType == 3) {
        return 6;
    }
    return 2;
};

handler.isChangMao = function () {
    return this.flag.isChangMao;
};

//换牌
handler.huanPaiType = function () {
    return this.flag.huanPaiType || 1;
};

//买马
handler.maiMaType = function () {
    return this.flag.maiMaType || 1;
};

handler.maiMaAmount = function () {
    if(this.flag.maiMaType==1)
        return 0;
    else
        return this.flag.maiMaType;
    return 0;
};

//可选项
handler.isJiaDa = function () {
    return true;//this.flag.isJiaDa;
};

handler.isGenZhuang = function () {
    return true;//this.flag.isGenZhuang;
};

handler.isHaiDiLao = function () {
    return true;//this.flag.isHaiDiLao;
};

//Quick enter desk
handler.getEmptySeatCount = function(){
    return this.maxPlayer - this.playerNum;
}

handler.setOptTimeout = function(callFunc,timeout){
    var self = this;

    if(!! self.optTimer){
        return;
    }

    self.optTimer = setTimeout(function(){
        self.clearOptTimeout();
        callFunc();
    },timeout);
}

handler.clearOptTimeout = function(){
    clearTimeout(this.optTimer);
    this.optTimer = null;
    this.delayUid = null;
}

handler.isMatch = function(){
    return !! this.mid;
}

