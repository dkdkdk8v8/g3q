/**
 * Created by Administrator on 2016/8/4.
 */
var utils = require("../../../util/utils");
var gDef = require("../../../coin/niuNiu/globalDefine");
var cardUtil = require("../../../coin/niuNiu/module/cardUtils");
pomelo = require("pomelo");
var util = require("util");
var EventEmitter = require('events').EventEmitter;

var desk = function (opts) {
    EventEmitter.call(this);
    this.maxPlayer = opts.maxPlayer;
    this.deskName = opts.deskName;
    this.deskType = opts.deskType;
    this.roomIndex = opts.roomIndex;
    this.flag = opts.flag;
    this.flag.isShuff = true;
    this.minCoin = opts.minCoin;
    this.maxCoin = opts.maxCoin;
    this.baseCoin = opts.baseCoin;
    // 玩家信息
    this.players = [];
    // 桌子上玩家数
    this.playerNum = 0;
    // uid 和 pos 对应关系
    this.uidPosMap = [];
    // 一轮的最大下注
    this.bankPoint = 0;

    this.gameStatus = gDef.GameStatus.null;
    this.uidArr = [];

    this.startTime = 0;
    this.bankUid = 0;
};

util.inherits(desk, EventEmitter);

module.exports = desk;

var handler = desk.prototype;

handler.getPosByUid = function (uid) {
    return this.uidPosMap[uid];
};

handler.getEmptySeatCount = function(){
    return this.maxPlayer - this.playerNum;
}

handler.getPlayersInfo = function () {
    var info = [];
    for (var i = 0; i < this.maxPlayer; i++) {
        if (this.players[i]) {
            info.push(this.players[i].getBasicInfo());
        }
    }
    return info;
};

handler.getPlayerByUid = function (uid) {
    if (undefined == this.uidPosMap[uid]) {
        return undefined;
    }
    else {
        return this.players[this.uidPosMap[uid]];
    }
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

handler.getPointInfo = function () {
    var res = [];
    for (var i = 0; i < this.uidArr.length; i++) {
        var player = this.getPlayerByUid(this.uidArr[i]);
        if (player) {
            res.push({uid:this.uidArr[i], point:player.getPoint(),minPoint:player.minPoint});
        }
    }
    return res;
};

handler.getDeskInfo = function() {
    return {bankPos: this.bankPos,
        bankUid: this.bankUid,
        gameStatus: this.gameStatus,
        flag: this.flag,
        createUid: this.createUid,
        deskName: this.deskName,
        deskType: this.deskType,
        isStart: this.isStart,
        startTime: this.startTime,
        bankPoint: this.bankPoint};
};

handler.reset = function () {
    for (var i = 0; i < this.maxPlayer; i++) {
        var player = this.players[i];
        if (player) {
            player.reset();
        }
    }
    this.gameStatus = gDef.GameStatus.null;
    this.bankPoint = 0;
};

handler.getPlayerCards = function () {
    var res = [];
    for (var i = 0; i < this.uidArr.length; i++) {
        var player = this.getPlayerByUid(this.uidArr[i]);
        if (player) {
            res.push({pos: player.getPos(), uid: player.getUid(), cards: player.getCards()});
        }
    }
    return res;
};

// 游戏是否结束
// 0 未结束
// 1 弃牌结束
// 2 发牌结束
handler.isGameEnd = function () {
    var foldCount = 0;
    var allInCount = 0;
    var checkCount = 0;
    if (this.uidArr.length <= 1) {
        return 1;
    }
    for (var i = 0; i < this.uidArr.length; i++) {
        var pos = this.getPosByIndex(i);
        if (undefined != pos) {
            var player = this.players[pos];
            if (player.getBetStatus() == gDef.BetStatus.Fold || player.getPlayStatus() == gDef.PlayStatus.out) {
                foldCount += 1;
            }
            if (player.getBetStatus() == gDef.BetStatus.AllIn) {
                allInCount += 1;
            }
        }
    }
    // 只有一个人未弃牌
    if (foldCount + 1 >= this.uidArr.length) {
        return 1;
    }
    // 所有人都AllIn或者其他人弃牌
    if (allInCount >= this.uidArr.length || foldCount+allInCount >= this.uidArr.length) {
        return 2;
    }
    // 有一个人没有Allin and 剩下那个人跟注
    if (foldCount+allInCount + 1 >= this.uidArr.length && checkCount+foldCount+allInCount >= this.uidArr.length) {
        return 2;
    }
    return 0;
};

handler.getPosByIndex = function (index) {
    // console.log(index, this.uidArr, this.uidPosMap[this.uidArr[index]]);
    var uid = this.uidArr[index];
    if (undefined != uid) {
        return this.uidPosMap[uid];
    }
    else {
        return undefined;
    }
};

handler.getPlayerCardsByUid = function (uid) {
    var pos = this.uidPosMap[uid];
    if (undefined != pos) {
        return this.players[pos].getCards();
    }
};

handler.disConnect = function (uid) {
    var pos = this.getPosByUid(uid);
    if (undefined != pos) {
        this.players[pos].setOfflineFlag(true);
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

handler.getGameStatus = function () {
    return this.gameStatus;
};

handler.getDeskName = function () {
    return this.deskName;
};

handler.getDeskType = function () {
    return this.deskType;
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

handler.getBaseScore = function () {
    return this.baseCoin;
};

handler.getDeskFee = function () {
    return Math.round(this.baseCoin * 0.08);
};

handler.getSysFee = function () {
    return 0;
};

handler.getZhuangType = function () {
    return this.flag.zhuangType || gDef.ZhuangType.Lose;
};

// 下一个玩家位置
handler.nextPos = function (curPos) {
    var self = this;
    function next(curPos) {
        if (curPos + 1 >= self.maxPlayer) {
            return 0;
        }
        else {
            if (self.players[curPos+1]) {
                return curPos + 1;
            }
            return next(curPos+1);
        }
    }
    return next(curPos);
};

