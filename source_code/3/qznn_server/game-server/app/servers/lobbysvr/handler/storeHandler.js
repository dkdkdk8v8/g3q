/**
 * Created by kudoo on 2018/4/19.
 */

var async = require("async");
var gDef = require('../../../game/common/exchangeDefine');
var pomelo = require("pomelo");
var log = pomelo.app.get('mongodb');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

function generateRandomString(length) {
    var len = length || 16;
    var chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
    var str = "";
    for ( var i = 0; i < len; i++ )
        str += chars[ Math.ceil(Math.random()*(chars.length-1)) ];

    return str;
}


var handler = Handler.prototype;


handler.getAppstoreInfo = function(msg, session, next) {
    next(null, gDef.ExchangeData);
};

handler.getAppstoreGoodsInfo = function(msg, session, next) {
    next(null, gDef.getGoodsInfo());
};

//房卡兑换金币
handler.exchange = function(msg, session, next) {
    var uid = session.uid;
    var pid = msg.pid;
    var self = this;
    if(pid<1||pid>gDef.ExchangeData.length){
        next(null, {err:true, code:101, msg:"pid参数错误！"});
    }
    var prod = gDef.ExchangeData[pid-1];

    async.waterfall([
        function(cb){
            self.app.rpc.usersvr.userRemote.costRoomCard(session, {uid:uid, costNum:prod.roomCard, type:'charge'}, function(err,res){
                if(err){
                    cb(err);
                } else {
                    cb();
                }
            });
        },
        function(cb){
            self.app.rpc.usersvr.userRemote.addCoin(session, {uid:uid, deltaCoin:prod.coin}, function(err,res){
                if(err){
                    cb(err);
                } else {
                    log.insert({cmd:"coin_exchange",uid:uid,coin:prod.coin,pid:pid});
                    cb();
                }
            });
        }
    ],function(err, res){
        if(err){
            next(null, err);
        } else {
            next(null, {code:200});
        }
    })
};

//礼券兑换物品
handler.exchangeGoods = function(msg, session, next) {
    var uid = session.uid;
    var pid = msg.pid;
    var self = this;
    var prod = gDef.getGoodsById(pid);
    if(!prod || !prod.valid){
        next(null, {err:true, code:101, msg:"商品已下架！"});
    }

    async.waterfall([
        function(cb){
            self.app.rpc.usersvr.userRemote.costCoupon(session, {uid:uid, deltaCoupon: -prod.coupon}, function(err,res){
                if(err){
                    cb(err);
                } else {
                    log.insert({cmd:"exchange_cost_coupon", uid: uid, coupon:prod.coupon});
                    cb();
                }
            });
        },
        function(cb){
            cb();//禁自动兑换房卡
            // if(prod.roomCard) {
            //     //兑换房卡的
            //     self.app.rpc.usersvr.userRemote.addRoomCard(session, {uid:uid, cardNum:prod.roomCard}, function(err,res){
            //         if(err){
            //             cb(err);
            //         } else {
            //             cb();
            //         }
            //     });
            // } else {
            //     cb();
            // }
        },
        function(cb){
            var code = generateRandomString(6);
            var UserExchange = pomelo.app.get('models').UserExchange;
            UserExchange.create({
                uid: uid,
                productID: prod.id,
                productName: prod.product,
                code: code,
                status: 0
            }).then(function (record) {
                if (record) {
                    cb(null, code);
                }
                else {
                    cb({err:true, msg:"创建兑换记录失败"});
                }
            });
        }
    ],function(err, code){
        if(err){
            next(null, err);
        } else {
            next(null, {code:code});
        }
    })
};