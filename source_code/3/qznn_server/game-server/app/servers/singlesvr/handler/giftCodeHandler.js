/**
 * Created by Administrator on 2016/12/22.
 */
var pomelo = require('pomelo');
var utils = require('../../../util/utils');
var log = pomelo.app.get('mongodb');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;

    this.errUid = {};
};

var handler = Handler.prototype;

handler.exchangeCode = function(msg, session, next) {

    var uid = msg.uid, code = msg.code.toUpperCase();
    var now = Math.floor(new Date().getTime()/1000);

    if (!this.errUid[uid] || utils.isSameDay(this.errUid[uid].optTime, now) != 0) {
        this.errUid[uid] = {optTime:now, errCount:0};
    }
    if (this.errUid[uid].errCount > 50) {
        return next(null, {err:true, msg:"您今天尝试的错误次数过多,请明天再试！"});
    }

    var self = this;
    var GiftCode = this.app.get('models').GiftCode;

    pomelo.app.rpc.usersvr.userRemote.getMyUserDailyInfo(uid, {uid:uid, keys:["giftCodeCount"]}, function (err, dailyInfo) {
        if (err) {
            return next(null, err);
        }
        if (dailyInfo.giftCodeCount >= 10) {
            self.errUid[uid].errCount = 99;
            return next(null, {err:true, msg:"对不起，您今天的兑换次数已达上限！"});
        }

        GiftCode.findOne({where:{code:code}}).then(function(codeInfo) {
            if (codeInfo) {
                if (codeInfo.leftCount < 1) {
                    self.errUid[uid].errCount += 1;
                    if (codeInfo.codeType == 0) {
                        return next(null, {err: true, msg: "对不起，您的兑换码已被使用!"});
                    }
                    else {
                        return next(null, {err: true, msg: "对不起，此兑换码已达使用次数上限!"});
                    }
                }
                if (codeInfo.endTime < now) {
                    self.errUid[uid].errCount += 1;
                    return next(null, {err:true, msg:"对不起，您的兑换码已过期!"});
                }
                if (codeInfo.codeType != 0) {
                    pomelo.app.rpc.usersvr.userRemote.getMyUserAddInfo(uid, {uid:uid, keys:["codeInfoJson"]}, function (err, addInfo) {
                        if (err) {
                            return next(null, err);
                        }
                        var exangeInfo = JSON.parse(addInfo.codeInfoJson);
                        if (exangeInfo[codeInfo.codeType]) {
                            self.errUid[uid].errCount += 1;
                            return next(null, {err:true, msg:"您已经使用过此类兑换码!"});
                        }
                        else {
                            pomelo.app.rpc.usersvr.userRemote.addRoomCard(uid, {uid:uid, cardNum:codeInfo.cardNum}, function (err, res) {
                                if (err) {
                                    return next(null, err);
                                }

                                exangeInfo[codeInfo.codeType] = 1;

                                pomelo.app.rpc.usersvr.userRemote.refreshUserAddData(uid, {uid:uid},
                                    [{key:'codeInfoJson', value:JSON.stringify(exangeInfo)}], function () {
                                        pomelo.app.rpc.usersvr.userRemote.refreshUserDailyData(uid, {uid:uid},
                                            [{key:'giftCodeCount', value:dailyInfo.giftCodeCount+1}], function () {
                                                codeInfo.leftCount -= 1;
                                                codeInfo.save();

                                                log.insert({cmd:"exchangeCode", code:code, roomCard:codeInfo.cardNum, uid:uid});
                                                return next(null, {msg:"恭喜，兑换成功！获得 钻石x"+codeInfo.cardNum+"颗"});
                                            });
                                    });

                            });
                        }
                    });
                }
                else {
                    pomelo.app.rpc.usersvr.userRemote.addRoomCard(uid, {uid:uid, cardNum:codeInfo.cardNum}, function (err, res) {
                        if (err) {
                            return next(null, err);
                        }
                        codeInfo.leftCount -= 1;
                        codeInfo.save();

                        pomelo.app.rpc.usersvr.userRemote.refreshUserDailyData(uid, {uid:uid},
                            [{key:'giftCodeCount', value:dailyInfo.giftCodeCount+1}], function () {
                                log.insert({cmd:"exchangeCode", code:code, roomCard:codeInfo.cardNum, uid:uid});
                                return next(null, {msg:"恭喜，兑换成功！获得 钻石x"+codeInfo.cardNum+"颗"});
                            });
                    });
                }
            }
            else {
                self.errUid[uid].errCount += 1;
                next(null, {err:true, msg:"对不起，您的兑换码有误!"});
            }
        });
    });

};