/**
 * Created by kudoo on 2018/4/18.
 */

var async = require("async");
var gDef = require('../../../game/common/lotteryDefine');
var pomelo = require("pomelo");
var log = pomelo.app.get("mongodb");

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;


handler.getLotterReward = function(msg, session, next) {
    next(null, gDef.LotteryRewards);
};

// handler.test = function(msg, session, next) {
//     var coin = 0;
//     var roomCard = 0;
//     var coupon = 0;
//     var map = [];
//     for(var i=0;i<1000;i++){
//         var r = gDef.luckyDraw();
//         console.log(r);
//         coin += r.coin;
//         roomCard += r.roomCard;
//         coupon += r.coupon;
//         map[r.id] = map[r.id] || 0;
//         map[r.id]++;
//     }
//     console.log(coin, roomCard, coupon);
//     console.log(map);
//     next(null, 'ok');
// };

handler.luckyDraw = function(msg, session, next) {
    var uid = session.uid;
    var self = this;

    var cCostCoin = 20000;

    async.waterfall([
        function(cb){
            self.app.rpc.usersvr.userRemote.costCoin(session, {uid:uid, deltaCoin:-cCostCoin}, function(err,res){
                if(err){
                    cb(err);
                } else {
                    var r = gDef.luckyDraw();
                    log.insert({cmd:"coin_lottery_expend",uid:uid,coin:cCostCoin})
                    cb(null, r);
                }
            });
        },
        function(reward, cb){
            if(reward.coin > 0){
                self.app.rpc.usersvr.userRemote.addCoin(session, {uid:uid, deltaCoin:reward.coin}, function(err,res){
                    if(err){
                        cb(err);
                    } else {
                        log.insert({cmd:"coin_lottery_award",uid:uid,coin:reward.coin,roomCard:0,coupon:0})
                        cb(null, reward);
                    }
                });
            } else {
                cb(null, reward);
            }
        },
        function(reward, cb){
            if(reward.roomCard > 0){
                self.app.rpc.usersvr.userRemote.addRoomCard(session, {uid:uid, cardNum:reward.roomCard}, function(err,res){
                    if(err){
                        cb(err);
                    } else {
                        log.insert({cmd:"roomCard_lottery_award",uid:uid,coin:0,roomCard:reward.roomCard,coupon:0})
                        cb(null, reward);
                    }
                });
            } else {
                cb(null, reward);
            }
        },
        function(reward, cb){
            if(reward.coupon > 0){
                self.app.rpc.usersvr.userRemote.addCoupon(session, {uid:uid, deltaCoupon:reward.coupon}, function(err,res){
                    if(err){
                        cb(err);
                    } else {
                        log.insert({cmd:"coupon_lottery_award",uid:uid,coin:0,roomCard:0,coupon:reward.coupon})
                        cb(null, reward);
                    }
                });
            } else {
                cb(null, reward);
            }
        }
    ],function(err, res){
        if(err){
            next(null, err);
        } else {
            next(null, res);
        }
    })
};