/**
 * Created by Administrator on 2016/8/4.
 */
var def = require("../../../coin/niuNiu/globalDefine");
var pomelo = require("pomelo");
var cardUtil = require("../../../coin/niuNiu/module/cardUtils");
var utils = require('../../../util/utils');

var player = function (opts) {
    this.uid = opts.uid;
    this.nickName = opts.nickName;
    this.faceId = opts.faceId;
    this.sign = opts.sign;
    this.userData = opts.userData;
    this.score = opts.coin;
    this.ownGoods = opts.ownGoods;
    this.vipLevel = opts.vipLevel;
    // 倍数
    this.point = -1;
    // 坐下的位置
    this.pos = opts.pos;
    // 围观or游戏
    this.playStatus = def.PlayStatus.watch;
    // 手上的牌
    this.cards = [];
    this.selectedCardList = [];
    // 是否断线
    this.offlineFlag = false;
    // 是否托管
    this.trustteeFlag = false;
    // 自动下注次数
    this.autoOperateCount = 0;

    this.gameType = "coinNiuNiu4";

    this.hasCal = false;
    this.minPoint = 1;
    this.userData = {};
    this.userData.maxWinScore = opts.userData.maxWinScore;
    this.userData.maxLoseScore = opts.userData.maxLoseScore;
    this.userData.maxWinTime = opts.userData.maxWinTime;
    this.userData.maxCards = opts.userData.maxCards;

    this.readyTimer = null;
};

module.exports = player;

// 叫分
player.prototype.callPoint = function (point) {
    // 筹码不够 当allin处理
    this.point = point;
};

player.prototype.addCard = function (cards) {
    this.cards = this.cards.concat(cards);
};

player.prototype.getUid = function () {
    return this.uid;
};

player.prototype.getBasicInfo = function () {
    return {
        uid: this.uid,
        faceId: this.faceId,
        nickName: this.nickName,
        pos: this.pos,
        point: this.point,
        score: this.score,
        ownGoods: this.ownGoods,
        playStatus: this.playStatus,
        isTrusttee: this.trustteeFlag,
        hasCal: this.hasCal,
        vipLevel:this.vipLevel
    };
};

player.prototype.getPoint = function () {
    return this.point;
};

player.prototype.clearPoint = function () {
    this.point = -1;
};

player.prototype.setPlayStatus = function (status) {
    this.playStatus = status;
};

player.prototype.getCards = function () {
    return this.cards;
};

player.prototype.getPlayStatus = function () {
    return this.playStatus;
};

// 清空一局信息
player.prototype.reset = function () {
    this.cards = [];
    this.selectedCardList = [];
    this.point = -1;
    this.hasCal = false;
};

player.prototype.hasCalCards = function() {
    return this.hasCal;
}

player.prototype.calCard = function () {
    this.hasCal = true;
};

player.prototype.addScore = function (coin, callback) {
    var self = this;
    if (coin > 0) {
        pomelo.app.rpc.usersvr.userRemote.addCoin(this.uid, {uid:this.uid, deltaCoin:coin}, function(err, res){
            if (err) {
                callback(err);
            }
            else {
                self.score = res.coin;
                callback();
            }
        });
    }
    else {
        pomelo.app.rpc.usersvr.userRemote.costCoin(this.uid, {uid:this.uid, deltaCoin:coin}, function(err, res){
            if (err) {
                callback(err);
            }
            else {
                self.score = res.coin;
                callback();
            }
        });
    }
};

player.prototype.getScore = function () {
    return this.score;
};

player.prototype.isOffline = function () {
    return this.offlineFlag;
};

player.prototype.setOfflineFlag = function (flag) {
    this.offlineFlag = flag;
};

player.prototype.getPos = function () {
    return this.pos;
};

player.prototype.setTrusttee = function (flag) {
    this.trustteeFlag = flag;
};

player.prototype.isTrusttee = function () {
    return this.trustteeFlag;
};

player.prototype.addAutoOperateCount = function () {
    this.autoOperateCount += 1;
};

player.prototype.clearAutoOperateCount = function () {
    this.autoOperateCount = 0;
};

player.prototype.getAutoOperateCount = function () {
    return this.autoOperateCount;
};

player.prototype.getNickName = function () {
    return this.nickName;
};

player.prototype.leaveGame = function (gameType, deskName) {
    pomelo.app.rpc.usersvr.userRemote.leaveGame(this.uid, {uid:this.uid, gameType:gameType, deskName:deskName}, function(){});
};

player.prototype.flushMaxCard = function (cards) {
    var old = JSON.parse(this.userData.maxCards);

    if (old.length == 0 || cardUtil.CompareCardType(cards, old) > 0) {
        var cardsInfo = cardUtil.GetCardResult(cards);
        this.userData.maxCards = JSON.stringify(cardsInfo.cardList);
        pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
            {uid:this.uid, gameType:this.gameType},
            [{key:'maxCards', value:this.userData.maxCards}], function () {
                
            });
    }
};

player.prototype.addUserDataCount = function (key, value) {
    this.userData[key] = this.userData[key] || 0;
    this.userData[key] += value;
};

player.prototype.flushWinScore = function (score) {
    if (score >= 0) {
        if (score > this.userData.maxWinScore) {
            this.userData.maxWinScore = score;
            var now = Math.floor(new Date().getTime()/1000);
            pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
                {uid: this.uid, gameType: this.gameType},
                [{key: 'maxWinScore', value: this.userData.maxWinScore},
                    {key: 'maxWinTime', value: now}], function () {
                });
        }
    }
    else if (score < 0) {
        if (score < this.userData.maxLoseScore) {
            this.userData.maxLoseScore = score;
            pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
                {uid: this.uid, gameType: this.gameType},
                [{key: 'maxLoseScore', value: this.userData.maxLoseScore}], function () {
                });
        }
    }
    this.saveGameCount();
};

player.prototype.saveGameCount = function () {
    var saveAttrs = [];
    if (this.score) {
        saveAttrs.push({key:'totalScore', deltaValue:this.score});
    }
    for (var key in this.userData) {
        if (key != "maxWinScore" && key != "maxLoseScore" && key != "maxWinTime" && key != "maxCards") {
            saveAttrs.push({key: key, deltaValue: this.userData[key]});
            this.userData[key] = 0; // 发送增量后重置本地计数，防止重复统计
        }
    }
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        saveAttrs, function () {
        });
};

//玩家准备倒计时
player.prototype.startReadyCount = function(desk,time){
    var self = this
    time = !! time ? time : 7000;
    this.readyTimer = setTimeout(function(){
        if(!! desk){
            desk.emit('ready',{uid:self.uid});
        }
    },time);
}

player.prototype.stopReadyCount = function(){
    clearTimeout(this.readyTimer);
    this.readyTimer = null;
}