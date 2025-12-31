/**
 * Created by Administrator on 2016/11/25.
 */
var pomelo = require('pomelo');
var redis = require("redis");
var gKanjiaDef = require('../../../game/common/kanjiaDefine');

module.exports = function(app) {
    return new Handler(app);
};

function getRedpackageTime() {
    var hour = new Date().getHours();
    if (hour >= 2 && hour < 12) {
        return 140;
    }
    if (hour >= 12 && hour < 18) {
        return 100;
    }
    return 60;
}

var Handler = function(app) {
    this.app = app;
    this.curTick = 0;
    this.nextTick = 10;
};

handle = Handler.prototype;

handle.scrollSystemMsg = function() {
    pomelo.app.rpc.lobbysvr.lobbyRemote.scrollSystemMsg(null, {}, function(){});
};

handle.scrollRedPackageMsg = function() {
    // this.curTick++;
    // if (this.curTick > this.nextTick) {
    //     this.curTick = 0;
    //     this.nextTick = Math.floor(Math.random()*getRedpackageTime());
    //     pomelo.app.rpc.lobbysvr.lobbyRemote.sysAddRedPackage(null, {}, function(){});
    // }
};

handle.deleteDailyScore = function() {
    pomelo.app.rpc.gmsvr.gmRemote.deleteDailyScore(null, {}, function(err, res){
        console.log("deleteDailyScore", res);
    });
};

handle.deleteGameRecord = function() {
    pomelo.app.rpc.gmsvr.gmRemote.deleteGameRecord(null, {}, function(err, res){
        console.log("deleteGameRecord", res);
    });
};

handle.deleteGameHistory = function() {
    pomelo.app.rpc.gmsvr.gmRemote.deleteGameHistory(null, {}, function(err, res){
        console.log("deleteGameHistory", res);
    });
};

handle.clearTotalScore = function() {
    var games = ["gameNiuNiu", "gameDDZ", "gameSSS", "gamePDK", "gameTexasPoker", "gameMaJiang_nd"];
    var svrs = this.app.getServersByType('usersvr');
    for (var i = 0; i < svrs.length; i++) {
        pomelo.app.rpc.usersvr.userRemote.clearUserTotalScore.toServer(svrs[i].id, {games:games}, function(){});
    }

    var models = ["NiuNiuUserInfo", "DDZUserInfo", "SSSUserInfo", "PDKUserInfo", "TexasPokerUserInfo","MaJiangNDUserInfo"];

    for (var i = 0; i < models.length; i++) {
        pomelo.app.get('models')[models[i]].update({totalScore:0}, {where:{}});
    }
};

handle.deleteCompetitionData= function() {
    pomelo.app.rpc.gmsvr.gmRemote.deleteCompetitionData(null, {}, function(err, res){
        console.log("deleteCompetitionData", res);
    });
};

handle.resetDiscountAcitivity= function() {
    var curTime = new Date().getTime();
    if(curTime < gKanjiaDef.startTime || curTime > gKanjiaDef.endTime + 5*60*1000){
        return;
    }
    if (!this.redisClient) {
        var redisConfig = pomelo.app.get('redis');
        this.redisClient = redis.createClient({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db
        });
    }
    var key = "discActivity";
    var self = this;

    this.redisClient.del(key, function(err, reply) {
        if(curTime < gKanjiaDef.endTime){
            //活动没结束
            self.redisClient.set(key, JSON.stringify({rewards:gKanjiaDef.maxNum, initID:117100}));
        }
    });
};