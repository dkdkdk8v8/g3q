/**
 * Created by Administrator on 2016/8/4.
 */
var utils = require("../../../util/utils");
var gDef = require("../globalDefine");
var CardUtils = require("./cardUtils");
pomelo = require("pomelo");
var util = require("util");
var EventEmitter = require('events').EventEmitter;

var desk = function (opts) {
    EventEmitter.call(this);

    this.maxPlayer = opts.maxPlayer;
    this.deskName = opts.deskName;
    this.deskType = opts.deskType;
    this.deskId = opts.deskId;
    this.costNum = opts.costNum;
    this.isReplace = opts.isReplace;
    this.clubId = opts.clubId;
    this.boxId = opts.boxId;
    this.isAntiCheating = opts.isAntiCheating;
    // 房主
    this.fangOwnerUid = 0;

    this.createUid = opts.createUid;
    this.flag = opts.flag;
    // 是不是活动房
    this.isActive = opts.isActive;

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
            res.push({uid:this.uidArr[i], point:player.getPoint()});
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
        bankPoint: this.bankPoint,
        isReplace: this.isReplace,
        fangOwnerUid: this.fangOwnerUid,
        clubId:this.clubId,
        isAntiCheating:this.isAntiCheating,
        totalGameCount:this.getGameCount(),
        gameCount: this.getGameCount() - (this.leftCount || 0)
    };
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

handler.getSid = function () {
    return this.sid;
};

handler.getDeskType = function () {
    return this.deskType;
};


handler.isPreBet = function () {
    return this.flag & 0x1;
};

handler.canReBuy = function () {
    return this.flag & 0x2;
};

handler.getEndTime = function () {
    if (this.flag & 0x4) {
        return 30*60*1000;
    }
    else {
        return 10*60*1000;
    }
};

handler.getCostCardNum = function () {
    if (utils.isInFreeTime()) {
        return 0;
    }
    if (this.flag.countType == 1) {
        return 2;
    }
    else if (this.flag.countType == 2) {
        return 4;
    }
    else if (this.flag.countType == 3) {
        return 6;
    }
    else {
        return 2;
    }
};


handler.getGameCount = function () {
    if (this.flag.countType == 1) {
        return 10;
    }
    else if (this.flag.countType == 2) {
        return 20;
    }
    else if (this.flag.countType == 3) {
        return 30;
    }
};

handler.isCreate = function (uid) {
    return (this.createUid == uid);
};

handler.infiniteThink = function () {
    return ! this.flag.thinkFlag;
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

handler.costRoomCard = function(num,callback){
    var clubId = this.clubId;
    var boxId = this.boxId;

    //从俱乐部里扣费
    if(!! clubId && !! boxId){
        pomelo.app.rpc.clubsvr.clubRemote.costRoomCard(this.createUid,
            {clubId:clubId,boxId:boxId,deskId:this.deskId,costNum:num},callback)
    }else{
        pomelo.app.rpc.usersvr.userRemote.costRoomCard(this.createUid, 
            {uid:this.createUid, deskId:this.deskId, costNum:num, isReplace:this.isReplace}, callback)
    }
}

//Quick enter desk
handler.getEmptySeatCount = function(){
    return this.maxPlayer - this.playerNum;
}

//推注
handler.getTuizhuInfo = function(){
    var tuiZhuInfo = {};
    var MaxTuiScore = 0;
    if(this.flag.tuiZhuType == 1){
        MaxTuiScore = 10;        
    }else if(this.flag.tuiZhuType == 2){
        MaxTuiScore = 20;
    }else if(this.flag.tuiZhuType == 3){
        MaxTuiScore = 50;
    }else if(this.flag.tuiZhuType == 4){
        MaxTuiScore = Number.MAX_SAFE_INTEGER;
    }

    for(var i = 0; i < this.uidArr.length; i++){
        var player = this.getPlayerByUid(this.uidArr[i]);
        if(! player) continue;
        if(MaxTuiScore != 0){
            tuiZhuInfo[player.uid] = Math.min(player.getTuizhuScore(),MaxTuiScore);
        }else{
            tuiZhuInfo[player.uid] = 0;
        }
    }
    return tuiZhuInfo;
}

//
handler.GetCardResult = function(cards){
    var res = CardUtils.GetCardResult(cards);
    //simple clone it
    res = JSON.parse(JSON.stringify(res));
    if(this.flag.niuType == 2){
        //牛9 牛牛 五花牛
        var weights = [0x0009,0x000A,0x000C];
        if(weights.indexOf(res.cardType.weight) != -1) {
            res.cardType.times -= 1
        }
        //银牛=>牛牛
        if(res.cardType.weight == 0x000B) {
            res.cardType.weight = 0x000A;
            res.cardType.name = "牛牛";
            res.cardType.times = 3;
        }
    }
    return res;
}