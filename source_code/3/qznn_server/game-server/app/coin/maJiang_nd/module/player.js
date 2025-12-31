/**
 * Created by Administrator on 2016/8/4.
 */
var def = require("../globalDefine");
var pomelo = require("pomelo");
var dispatch = require('../../../util/dispatcher');
var cardUtil = require('../module/cardUtils');
var utils = require('../../../util/utils');

var player = function (opts) {
    this.uid = opts.uid;
    this.nickName = opts.nickName;
    this.faceId = opts.faceId;
    this.sign = opts.sign;
    this.ip = opts.ip;
    this.gameId = opts.gameId;
    this.sex = opts.sex;
    // 分数
    this.score = opts.coin;
    // 坐下的位置
    this.pos = opts.pos;
    //用户数据
    this.userData = opts.userData;
    // 围观or游戏
    this.playStatus = def.PlayStatus.ready;
    //
    this.isMatcher = opts.isMatcher;
    // 手上的牌
    this.cards = [];
    // 是否断线
    this.offlineFlag = false;
    // 是否托管
    this.isTrusttee = false;

    // 刚刚获得的牌
    this.lastGetCard = 0;
    // 吃碰的牌型
    this.optCards = [];
    this.huanCards= [];
    this.gameType = "coinMaJiang_nd";
    this.optTimer = null;
};

module.exports = player;

player.prototype.addHandCards = function (cards, flag) {
    if (cards.length == 1) {
        if (!flag) {
            this.lastGetCard = cards[0];
        }

        for (var i = -1; i < this.cards.length; i++) {
            var flag1 = 0;
            if (i >= 0) {
                flag1 = flag1 | 0x1;
            }
            if (i+1 < this.cards.length) {
                flag1 = flag1 | 0x2;
            }
            var flag2 = 0;
            if (flag1 & 0x01) {
                if (cards[0] > this.cards[i]) {
                    flag2 = flag2 | 0x1;
                }
            }
            if (flag1 & 0x02) {
                if (cards[0] <= this.cards[i+1]) {
                    flag2 = flag2 | 0x2;
                }
            }
            if (flag1 == flag2) {
                this.cards.splice(i+1, 0, cards[0]);
                break;
            }
        }
    }
    else {
        this.cards = this.cards.concat(cards);
        this.cards.sort(function (a, b) {
            return a-b;
        });
    }
};

player.prototype.getLastCard = function() {
    return this.lastGetCard;
};

player.prototype.getHandCards = function () {
    return this.cards.concat([]);
};

player.prototype.addOptCards = function (optCards) {
    if (optCards.cards.length == 1) {
        for (var i = 0; i < this.optCards.length; i++) {
            if (this.optCards[i].optCode == def.OptCardCode.Peng && this.optCards[i].cards[0] == optCards.cards[0]) {
                this.optCards[i].optCode = def.OptCardCode.MingGang;
                this.optCards[i].cards.push(optCards.cards[0]);
                this.optCards[i].isBuGang=true;
                break;
            }
        }
    }
    else {
        this.optCards.push(utils.clone(optCards));
    }
};

//抢杠胡的时候把之前玩家杠出去的改回来
player.prototype.qiangGangRollback = function (card) {
    console.log("qiangGangRollback card:",card);
    for (var i = 0; i < this.optCards.length; i++) {
        if (this.optCards[i].optCode == def.OptCardCode.MingGang && this.optCards[i].cards[0] == card) {
            this.optCards[i].optCode = def.OptCardCode.Peng;
            this.optCards[i].cards.pop();
            break;
        }
    }
}

player.prototype.getOptCards = function () {
    return this.optCards.concat([]);
};

player.prototype.popHandCards = function (cards) {
    if (cards.length == 0) {
        return false;
    }
    var tmpCards = this.cards.concat([]);
    var start = 0;
    for (var i = 0; i < cards.length; i++) {
        var has = false;
        for (var j = start; j < tmpCards.length; j++) {
            if (tmpCards[j] == cards[i]) {
                tmpCards.splice(j, 1);
                has = true;
                start = j;
                break;
            }
        }
        if (!has) {
            return false;
        }
    }
    this.cards = tmpCards;
    delete this.lastGetCard;
    return true;
};

player.prototype.checkCards = function(cards) {
    if (cards.length == 0) {
        return true;
    }
    var tmpCards = this.cards.concat([]);
    var start = 0;
    for (var i = 0; i < cards.length; i++) {
        var has = false;
        for (var j = start; j < tmpCards.length; j++) {
            if (tmpCards[j] == cards[i]) {
                tmpCards.splice(j, 1);
                has = true;
                start = j;
                break;
            }
        }
        if (!has) {
            return false;
        }
    }
    return true;
};

player.prototype.getUid = function () {
    return this.uid;
};

player.prototype.getBasicInfo = function () {
    return {
        uid: this.uid,
        nickName: this.nickName,
        pos: this.pos,
        faceId: this.faceId,
        playStatus: this.playStatus,
        isTrusttee: this.isTrusttee,
        score: this.score,
        ip: this.ip,
        gameId: this.gameId,
        sex: this.sex
    };
};

player.prototype.setPlayStatus = function (status) {
    this.playStatus = status;
};

player.prototype.getPlayStatus = function () {
    return this.playStatus;
};

// 清空一局信息
player.prototype.reset = function () {
    this.cards = [];
    this.optCards = [];
    this.huanCards = [];
    delete this.lastGetCard;
    this.playStatus = def.PlayStatus.null;
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

player.prototype.getScore = function () {
    return this.score;
};

player.prototype.addScore = function (coin,callback) {
    var self = this;
    if(self.isMatcher){
        pomelo.app.rpc.matchsvr.matchRemote.addMatchScore(null,{uid:this.uid,score:coin},function(err,res){
            if(!! err){
                return callback(err);
            }
            self.score = res.coin;
            callback();
        });
    }else{
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
    }
};

player.prototype.addWinCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'winCount', deltaValue:1}], function () {
            
        });
};
player.prototype.addHuCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'huCount', deltaValue:1}], function () {
        });
};


player.prototype.addLiuCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'liuCount', deltaValue:1}], function () {

        });
};



player.prototype.addGameCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'totalCount', deltaValue:1}], function () {
            
        });
};

player.prototype.addZiMoCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'ziMoCount', deltaValue:1}], function () {
        });
};
player.prototype.addDaHuCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'daHuCount', deltaValue:1}], function () {
        });
};
player.prototype.addQiDuiCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'qiDuiCount', deltaValue:1}], function () {
        });
};
player.prototype.addDaDiaoCheCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'daDiaoCheCount', deltaValue:1}], function () {
        });
};
player.prototype.addHaiDiLaoCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'haiDiLaoCount', deltaValue:1}], function () {
        });
};
player.prototype.addGenZhuangCount = function () {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'genZhuangCount', deltaValue:1}], function () {
        });
};

player.prototype.setMaxWinScore = function (args) {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'maxWinScore', value:args}], function () {
        });
};
player.prototype.setMaxLoseScore = function (args) {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'maxLoseScore', value:args}], function () {
        });
};
player.prototype.setMaxWinTime = function (args) {
    pomelo.app.rpc.usersvr.userRemote.refreshUserData(this.uid,
        {uid:this.uid, gameType:this.gameType},
        [{key:'maxWinTime', value:args}], function () {
        });
};

player.prototype.setHuanCards = function (args) {
    this.huanCards=args;
};
player.prototype.getHuanCards = function () {
    return this.huanCards;
};

player.prototype.setTrusttee = function (flag) {
    this.isTrusttee = flag;
};

player.prototype.isTrusted = function () {
    return this.isTrusttee;
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
    pomelo.app.rpc.usersvr.userRemote.newGamePlayer(this.uid, this.uid, function(err, res) {
        utils.invokeCallback(callback, err);
    });
};

player.prototype.setFengWei = function(f){
    this.fengWei = f;
}

player.prototype.getFengWei = function(){
    return this.fengWei;
}
player.prototype.setFirstRound = function(f){
    this.firstRound = f;
}

player.prototype.isFirstRound = function(){
    return this.firstRound;
}

player.prototype.canOptCard = function(card) {
    var result=cardUtil.CanOptCard(this.cards, this.optCards, card, this.lastGetCard,this.firstRound,false);
    if(!card){this.setFirstRound(false);}
    return result;
};
player.prototype.canOptCardQiangGang = function(card) {
    return cardUtil.CanOptCard(this.cards, this.optCards, card, this.lastGetCard,this.firstRound,true);
};