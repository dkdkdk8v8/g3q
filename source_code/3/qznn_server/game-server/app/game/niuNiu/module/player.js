/**
 * Created by Administrator on 2016/8/4.
 */
var def = require("../globalDefine");
var pomelo = require("pomelo");
var cardUtil = require('../module/cardUtils');
var utils = require('../../../util/utils');

var player = function (opts) {
    this.uid = opts.uid;
    this.nickName = opts.nickName;
    this.faceId = opts.faceId;
    this.sign = opts.sign;
    this.ip = opts.ip;
    this.gameId = opts.gameId;

    this.userData = {};

    this.userData.maxWinScore = opts.userData.maxWinScore;
    this.userData.maxLoseScore = opts.userData.maxLoseScore;
    this.userData.maxWinTime = opts.userData.maxWinTime;
    this.userData.maxCards = opts.userData.maxCards;

    // 分数
    this.score = 0;
    // 倍数
    this.point = -1;
    // 坐下的位置
    this.pos = opts.pos;
    // 围观or游戏
    this.playStatus = def.PlayStatus.watch;
    // 手上的牌
    this.cards = [];
    // 是否断线
    this.offlineFlag = false;
    // 是否准备
    this.isReady = false;
    // 是否托管
    this.isTrusttee = false;
    // 自动下注次数
    this.autoOperateCount = 0;
    //推注
    this.tuiZhuScore = 0;
    this.gameType = "gameNiuNiu";
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
        isReady: this.isReady,
        isTrusttee: this.isTrusttee,
        ip: this.ip,
        gameId: this.gameId
    };
};

player.prototype.getGameId = function () {
    return this.gameId;
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
    this.point = -1;
};

player.prototype.addScore = function (score) {
    this.score += score;
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
        }
    }
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        saveAttrs, function () {
        });
};

player.prototype.readyGame = function () {
    this.isReady = true;
};

player.prototype.isReadyGame = function () {
    return this.isReady;
};

player.prototype.setTrusttee = function (flag) {
    this.isTrusttee = flag;
};

player.prototype.isTrustee = function () {
    return this.isTrusttee;
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

player.prototype.addReBuyCount = function() {
    this.reBuyCount += 1;
};

player.prototype.getReBuyCount = function() {
    return this.reBuyCount;
};

player.prototype.getNickName = function () {
    return this.nickName;
};

// 加入活动场
player.prototype.joinGroupActive = function (gameType) {
    // 已经加入过
    // if (this.freeRoomInfo[gameType]) {
    //     return false;
    // }
    // else {
    //     this.freeRoomInfo[gameType] = true;
    //     var infoStr = JSON.stringify(this.freeRoomInfo);
    //     var sql = 'update userinfo set `freeRoomInfo`=? where `uid`=?';
    //     var args = [infoStr, this.uid];
    //     pomelo.app.get("dbclient").query(sql, args, function (err, res) {
    //         if (err) {
    //             console.log("player: joinGroupActive", err);
    //         }
    //     });
    //     pomelo.app.rpc.usersvr.userRemote.refreshUserInfo(null, {uid:this.uid, freeRoomInfo:this.freeRoomInfo}, function(){});
    //     return true;
    // }
    // TODO...
    return true;
};

player.prototype.costRoomCard = function (num, callback) {
    pomelo.app.rpc.usersvr.userRemote.costRoomCard(this.uid, {uid:this.uid, costNum:num}, callback);
};

player.prototype.addRoomCard = function (num, callback) {
    pomelo.app.rpc.usersvr.userRemote.addRoomCard(this.uid, {uid:this.uid, cardNum:num}, callback);
};

player.prototype.leaveGame = function (gameType, deskName) {
    pomelo.app.rpc.usersvr.userRemote.leaveGame(this.uid, {uid:this.uid, gameType:gameType, deskName:deskName}, function(){});
};

player.prototype.isNewPlayer = function (callback) {
    pomelo.app.rpc.usersvr.userRemote.newGamePlayer(this.uid, this.uid, function(err, res){
        utils.invokeCallback(callback, err);
    });
};

player.prototype.setTuizhuScore = function(bankUid,score) {
    var MaxCallPoint = 5;
    //输了或推注了或庄家，则下局不能推注。
    if(score < 0 || this.point > MaxCallPoint || bankUid == this.uid){
        this.tuiZhuScore = 0;
    }else{
        
        this.tuiZhuScore = score + MaxCallPoint;
    }
}

player.prototype.getTuizhuScore = function() {
    return this.tuiZhuScore;
}