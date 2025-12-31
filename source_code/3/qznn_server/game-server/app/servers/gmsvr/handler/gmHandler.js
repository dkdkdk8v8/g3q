/**
 * Created by Administrator on 2016/11/25.
 */

var utils = require("../../../util/utils");
var async = require("async");
var pomelo = require("pomelo");
var war_record_db = require('../../../../lib/war_record_db');
var daily_score_db = require("../../../../lib/daily_score_db");

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
    this.channelService = app.get('channelService');
};

var handler = Handler.prototype;

// 修改充值信息
handler.changeRechargeMsg = function(msg, session, next) {
    this.app.rpc.lobbysvr.lobbyRemote.modifyRechargeMsg(session, msg, function (err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};

// 修改公告信息
handler.changeSystemMsg = function(msg, session, next) {
    this.app.rpc.lobbysvr.lobbyRemote.modifySysMessage(session, msg, function (err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};

// 修改滚动信息
handler.changeScrollMsg = function (msg, session, next) {
    this.app.rpc.lobbysvr.lobbyRemote.modifyScrollMsg(session, msg, function (err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};

// 获取滚动信息
handler.getScrollMsg = function (msg, session, next) {
    this.app.rpc.lobbysvr.lobbyRemote.getScrollMsg(session, msg, function (err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};

handler.addGiftcode = function (msg, session, next) {
    var GiftCode = this.app.get('models').GiftCode;
    var str = "0123456789QWERTYUIOPLKJHGFDSAZXCVBNM0123456789";
    var length = str.length;
    var now = Math.floor(new Date().getTime()/1000);
    var totalCount = msg.num || 100;
    var res = [];
    var endTime = msg.endTime || (now + 180*24*60*60);
    var cardNum = msg.cardNum || 1;
    var codeType = msg.codeType || 0;
    var leftCount = msg.leftCount || 1;

    GiftCode.findAll().then(function(giftCodes) {
        var codeSet = {};
        for (var i = 0; i < giftCodes.length; i++) {
            codeSet[giftCodes[i].code] = true;
        }
        var callback = function () {
            var codes = [];
            var count = totalCount - res.length;
            if (count > 100) {
                count = 100;
            }
            while(1) {
                if (count > 0) {
                    var c = "";
                    for (var j = 0; j < 8; j++) {
                        var index = Math.floor(Math.random()*length);
                        c = c + str[index];
                    }
                    if (!codeSet[c]) {
                        count--;
                        codeSet[c] = true;
                        codes.push({code: c, cardNum: cardNum, endTime: endTime, codeType: codeType, leftCount: leftCount});
                    }
                }
                else {
                    break;
                }
            }
            GiftCode.bulkCreate(codes).then(function (cs) {
                for (var i = 0 ; i < cs.length; i++) {
                    res.push(cs[i].code);
                }
                if (res.length < totalCount) {
                    setTimeout(callback, 0);
                }
                else {
                    next(null, res);
                }
            });
        };
        callback();
    });
};

// 服务器控制
// isOpen(bool) msg(string) games(string arr)
handler.svrCtrl = function (msg, session, next) {
    pomelo.app.rpc.desknamesvr.deskNameRemote.svrCtrl(session, msg, function(err, res) {
        next(null, "ok");
    });
};

// 玩家强制离开游戏
// gameId(number)
handler.leaveGame = function (msg, session, next) {
    var gameId = msg.gameId;
    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({attributes:['uid'], where:{gameId:gameId}})
        .then(function (res) {
            if (res) {
                pomelo.app.rpc.usersvr.userRemote.quitGame(res.uid, {uid:res.uid}, function(err, r) {
                    next(null, "ok");
                });
            }
            else {
                next(null, {err:true, msg:"用户不存在!"});
            }
        });
};

//强制解散桌子
handler.dissolutionDesk = function(msg, session, next){
    var deskName = Number(msg.deskName);
    var self = this;

    var gameType = null;
    var createUid = null;
    var getDeskInfo = function(cb){
        self.app.rpc.desknamesvr.deskNameRemote.getDeskInfo(deskName,{deskName:deskName},function(err,info){
            if(!! err){
                return cb(new Error(err.msg));
            }
            gameType = info.gameType;
            createUid = info.uid;
            cb(null);
        })
    }

    var dissolutionIt = function(cb){
        self.app.rpc[gameType].gameRemote.dissolutionDesk(deskName,{uid:"XAdmin",deskName:deskName},function(err,result){
            if(!! err){
                return cb(new Error(err.msg));
            }

            cb(null);
        })
    }


    async.waterfall([getDeskInfo,dissolutionIt],function(err,result){
        if(!! err){
            console.log("[gmSvr dissolutionDesk]------------>>>",err);
            return next(null,{err:true,msg:err.message});
        }

        return next(null,"ok");
    })
}

// 批量添加房卡
// minId(number) maxId(number) addNum(number)
handler.addRoomCard = function(msg, session, next) {
    var errUid = [];
    var addFunc = function(uid, addNum) {
        return function(cb) {
            pomelo.app.rpc.usersvr.userRemote.addRoomCard(uid, {uid:uid, cardNum:addNum}, function(err, res) {
                if (err) {
                    errUid.push(uid);
                }
                cb();
            });
        }
    };
    var funcs = [];
    for (var i = msg.minId; i <= msg.maxId; i++) {
        funcs.push(addFunc(i, msg.addNum));
    }
    async.waterfall(funcs,
        function (err, res) {
        next(null, errUid);
    })
};

// 踢出所有玩家
handler.killGameProcess = function(msg, session, next) {
    pomelo.app.rpc.chatsvr.chatRemote.pushMessageToWorld(null, "OnKillProcess", {msg:msg.msg}, function () {
        next(null, "ok");
    });
};

handler.deleteGameRecord = function (msg, session, next) {
    pomelo.app.rpc.gmsvr.gmRemote.deleteGameRecord(null, {}, function (err, res) {
        next(null, res);
    });
};

handler.deleteDailyScore = function (msg, session, next) {
    pomelo.app.rpc.gmsvr.gmRemote.deleteDailyScore(null, {}, function (err, res) {
        next(null, res);
    });
};

handler.deleteGameHistory = function (msg, session, next) {
    pomelo.app.rpc.gmsvr.gmRemote.deleteGameHistory(null, {}, function (err, res) {
        next(null, res);
    });
};

//handler.modifyUserInfo = function (msg, session, next) {
//    var uid = msg.uid;
//    if (!uid || !msg.key || msg.value == undefined) {
//        return next(null, {err:true, msg:"参数错误"});
//    }
//    pomelo.app.rpc.usersvr.userRemote.gmModifyUserInfo(uid, msg, function(err, res) {
//        if (err) {
//            next(null, err);
//        }
//        else {
//            next(null, res);
//        }
//    });
//};

handler.freezeUser = function (msg, session, next) {
    var gameId = msg.gameId;
    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({attributes:['uid'], where:{gameId:gameId}})
        .then(function (res) {
            if (res) {
                var args = {uid: res.uid, key: "isFrozen", value: msg.isFrozen ? 1 : 0};
                pomelo.app.rpc.usersvr.userRemote.gmModifyUserInfo(res.uid, args, function(err, r) {
                    if (err) {
                        next(null, err);
                    }
                    else {
                        next(null, r);
                    }
                });
            }
            else {
                next(null, {err:true, msg:"用户不存在!"});
            }
        });
};

handler.lhjGetGameParam = function (msg, session, next) {
    pomelo.app.rpc.coinLHJ.gameRemote.getGameParam(null, msg, function(err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};

handler.lhjSetGameParam = function (msg, session, next) {
    pomelo.app.rpc.coinLHJ.gameRemote.setGameParam(null, msg, function(err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};

handler.switchCompetition = function (msg, session, next) {
    pomelo.app.rpc.usersvr.userRemote.switchCompetition(session, msg, function(err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};
