/**
 * Created by kudoo on 2018/4/17.
 */
var async = require("async");
var gDef = require('../../../game/common/SigninDefine');
var pomelo = require("pomelo");
var log = pomelo.app.get("mongodb");

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

function getCurDays(){
    var time = new Date().getTime();
    return Math.floor(time/(1000*3600*24));
}

handler.getSigninReward = function(msg, session, next) {
    next(null, gDef.SigninData);
};

// 获取签到信息: 0:不可领取 1：可领取 2：已经领取
handler.getSigninInfo = function(msg, session, next) {
    var uid = session.uid;
    var ret = [1,0,0,0,0,0,0];

    var UserSiginin = this.app.get('models').UserSiginin;
    UserSiginin.findOne({where:{uid:uid}}).then(function (res) {
        if (res) {
            var info = JSON.parse(res.info);//[151,152]
            if(info && info.length > 0){
                if(info.length >= 7){
                    //重新开始签到
                    return UserSiginin.destroy({where:{uid:uid}}).then(function(count){
                        next(null, ret);
                    });
                }
                var cur = info[info.length-1];
                var curDay = getCurDays();
                console.log("--->", cur, curDay);
                if(cur == curDay){
                    for(var i=0;i<info.length;i++){
                        ret[i] = 2;
                    }
                } else if(cur == curDay-1){
                    var i=0;
                    for(;i<info.length;i++){
                        ret[i] = 2;
                    }
                    ret[i] = 1;
                }
                next(null, ret);
            }else {
                next(null, ret);
            }
        }
        else {
            next(null, ret);
        }
    });
};

handler.signin = function(msg, session, next) {
    var uid = session.uid;

    var curDay = getCurDays();
    var self = this;
    async.waterfall([
        function(cb){
            self.app.get('models').UserSiginin.findOrCreate({where:{uid:uid},defaults:{uid:uid}}).spread(function(info, bcreate) {
                if(bcreate){
                    var ret = [curDay];
                    info.info = JSON.stringify(ret);
                    info.save().then(function(data){
                        //领取奖励
                        cb(null, 1);
                    });
                } else {
                    var days = JSON.parse(info.info);
                    var cur = days[days.length-1];
                    console.log("--->", cur, curDay);
                    if(cur == curDay){
                        cb({err:true, coce:101, msg:"已经签到！"});
                    } else if(cur == curDay-1){
                        days.push(curDay);
                        info.info = JSON.stringify(days);
                        info.save().then(function(data){
                            //领取奖励
                            cb(null, days.length);
                        });
                    } else {
                        var ret = [curDay];
                        info.info = JSON.stringify(ret);
                        info.save().then(function(data){
                            //领取奖励
                            cb(null,1);
                        });
                    }
                }
            });
        },
        function(day, cb){
            var sinfo = gDef.SigninData[day-1];
            cb(null, sinfo);
        },
        function(sinfo, cb){
            if(sinfo.coin > 0){
                self.app.rpc.usersvr.userRemote.addCoin(session, {uid:uid, deltaCoin:sinfo.coin}, function(err,res){
                    if(err){
                        cb(err);
                    } else {
                        log.insert({cmd:"coin_sign_award",uid:uid,coin:sinfo.coin,roomCard:0,coupon:0})
                        cb(null, sinfo);
                    }
                });
            } else {  
                cb(null, sinfo);
            }
        },
        function(sinfo, cb){
            if(sinfo.roomCard > 0){
                self.app.rpc.usersvr.userRemote.addRoomCard(session, {uid:uid, cardNum:sinfo.roomCard}, function(err,res){
                    if(err){
                        cb(err);
                    } else {
                        log.insert({cmd:"roomCard_sign_award",uid:uid,coin:0,roomCard:sinfo.roomCard,coupon:0})
                        cb(null, sinfo);
                    }
                });
            } else {
                cb(null, sinfo);
            }
        },
        function(sinfo, cb){
            if(sinfo.coupon > 0){
                self.app.rpc.usersvr.userRemote.addCoupon(session, {uid:uid, deltaCoupon:sinfo.coupon}, function(err,res){
                    if(err){
                        cb(err);
                    } else {
                        log.insert({cmd:"coupon_sign_award",uid:uid,coin:0,roomCard:sinfo.roomCard,coupon:sinfo.coupon})
                        cb(null);
                    }
                });
            } else {
                cb(null);
            }
        }
    ], function(err){
        if(err){
            next(null, err);
        } else {
            next(null, 'ok');
        }
    });
};