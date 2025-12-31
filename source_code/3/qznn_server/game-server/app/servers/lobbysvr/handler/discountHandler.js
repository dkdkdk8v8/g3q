/**
 * Created by kudoo on 2018/5/4.
 */
var async = require("async");
var utils = require("../../../util/utils");
var redis = require("redis");
var gKanjiaDef = require('../../../game/common/kanjiaDefine');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;


handler.getInfo = function(msg, session, next) {
    // next(null, gDef.LotteryRewards);
    if (!this.redisClient) {
        var redisConfig = pomelo.app.get('redis');
        this.redisClient = redis.createClient({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db
        });
    }
    var self = this;
    var rewards = {
        maxNum : gKanjiaDef.maxNum,
        roomCard : gKanjiaDef.cards,
        startTime: 1525412560,
    };
    var ret = {
        sentCount:0,
        curRewards: utils.clone(rewards),
        nextRewards:utils.clone(rewards),
        userlist:{}
    };
    var key = "discActivity";
    this.redisClient.get(key, function(err, reply) {
        if (err) {
            console.log("key err:" + err);
            return next(null, {err:true, msg: '活动未开始!'});
        }
        var info = JSON.parse(reply);
        if(!!info){
            var date = new Date();
            date.setHours(9);
            date.setMinutes(0);
            date.setSeconds(0);
            date.setMilliseconds(0);
            ret.curRewards.startTime = date.getTime();
            ret.nextRewards.startTime = ret.curRewards.startTime + 24*60*60*1000;
            ret.sentCount = info.sentCount||0;
            ret.userlist = info.userlist || {};
            next(null, ret);
        } else {
            return next(null, {err:true, msg: '活动未开始!'});
        }
    });
};