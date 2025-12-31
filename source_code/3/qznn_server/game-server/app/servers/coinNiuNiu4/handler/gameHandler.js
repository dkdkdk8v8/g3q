var pomelo = require('pomelo');
var async = require("async");
var gDef = require('../../../game/common/wileDefine');
var pomelo = require("pomelo");
var log = pomelo.app.get('mongodb');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
    this.tableService = this.app.get("tableService");
};

var handler = Handler.prototype;

// 离开桌子
handler.deskExit = function (msg, session, next) {
    console.log("remote.prototype.exitDesk", msg.uid);
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('exit', msg);
    log.insert({cmd:"niuniu_exitDesk",deskName:msg.deskName,uid:msg.uid});
    next(null, false, "ok");
};

handler.calCard = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('cal', msg);
    next(null, "ok");
};

handler.cancelTrusttee = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('canceltrusttee', msg);
    log.insert({cmd:"nuiuniu_cancelTrust",deskName:msg.deskName,uid:msg.uid});
    next(null, false, "ok");
};

handler.call = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('call', msg);
    next(null, "ok");
};

handler.chat = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('chat', msg);
    next(null, "ok");
};

handler.ready = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('ready', msg);
    log.insert({cmd:"niuniu_ready",deskName:msg.deskName,uid:msg.uid});
    next(null, "ok");
};

handler.queryDeskInfo = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    next(null, desk.queryDeskInfo(msg));
};

handler.enterDesk = function (msg, session, next) {
    msg.uid = session.uid;
    var user;
    var self = this;

    async.waterfall([
            function (cb) {
                pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
                    gameType: msg.gameType,
                    uid:msg.uid
                }, cb);
            },
            function (res, cb) {
                user = res;


                if(user.gameType && (user.gameType != msg.gameType || user.deskName != msg.deskName)) {
                    var infotip = user.gameType == user.deskName ? "您已经报名比赛 请先退赛" : "你已经加入其他游戏";
                    cb({err: true, msg: infotip});
                    return;
                }

                var desk = self.tableService.get(msg.deskName);
                user.pos = msg.pos;
                if (desk) {
                    var r = desk.canEnterDesk(user);
                    if (r == 0) {
                        desk.emit("enter", user);
                        cb(false, "ok");
                    }
                    else if (r == 1) {
                        cb({err: true, msg: "人数已满!"});
                    }
                    else if (r == 2) {
                        cb({err:true, msg:"哈币超出房间上限"});
                    }
                    else if (r == 3) {
                        cb({err: true, msg: "金币太少了!赚点钱再来吧!"});
                    }
                    else if (r == 4) {
                        cb({err: true, msg: "位置错误!请重新尝试!"});
                    }
                    else if (r == 5) {
                        return self.watcherEnterDesk(msg,session,next);
                        //cb({err: true, msg: "该位置上已经有人!"});
                    }
                }
                else {
                    cb({err: true, msg: "桌子不存在!"});
                }
            },
            function (res, cb) {
                pomelo.app.rpc.usersvr.userRemote.enterGame(session, {
                    uid: msg.uid,
                    gameType: msg.gameType,
                    deskName: msg.deskName
                }, cb);
            }
        ],
        function (err, res) {
            if (err) {
                next(null, err);
                return;
            }
            log.insert({cmd:"niuniu_enterDesk",deskName:msg.deskName,uid:msg.uid,pos:msg.pos})
            next(null, {table:{tableNo:msg.deskName}});
        });
};

handler.enterDeskWithoutPos = function (msg, session, next) {
    msg.uid = session.uid;
    var user;
    var self = this;
    var clientChairNo;
    async.waterfall([
            function (cb) {
                pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
                    gameType: msg.gameType,
                    uid:msg.uid
                }, cb);
            },
            function (res, cb) {
                user = res;

                if(user.gameType && (user.gameType != msg.gameType || user.deskName != msg.deskName)) {
                    var infotip = user.gameType == user.deskName ? "您已经报名比赛 请先退赛" : "你已经加入其他游戏";
                    return cb({err: true, errCode: 1001, msg: infotip});
                }

                var desk = self.tableService.get(msg.deskName);
                if (desk) {
                    var pos = desk.pickupChair(user);
                    clientChairNo = pos;
                    //var r = desk.canEnterDesk(user);
                    if (pos >= 0) {
                        user.pos = pos;
                        desk.emit("enter", user);
                        cb(false, "ok");
                    }
                    else if (pos == -2) {
                        cb({err:true, msg:"哈币超出房间上限"});
                    }
                    else if (pos == -3) {
                        cb({err: true, msg: "金币太少了!赚点钱再来吧!"});
                    }
                    else {
                        cb({err: true, msg: "人数已满!"});
                    }
                }
                else {
                    cb({err: true, msg: "桌子不存在!"});
                }
            },
            function (res, cb) {
                pomelo.app.rpc.usersvr.userRemote.enterGame(session, {
                    uid: msg.uid,
                    gameType: msg.gameType,
                    deskName: msg.deskName
                }, cb);
            }
        ],
        function (err, res) {
            if (err) {
                next(null, err);
                return;
            }

            next(null, {
                gameType: msg.gameType,
                deskName: msg.deskName,
                clientChairNo:clientChairNo
            });
            log.insert({cmd:"niuniu_enterDesk",deskName:msg.deskName,uid:msg.uid,pos:clientChairNo})
        });
};

handler.quickEnterDesk = function(msg,session,next){
    var roomIndex = msg.roomIndex;

    if(msg.gameType != "coinNiuNiu4"){
        return next(null,{code:Code.FAIL,msg:"错误的游戏类型"});
    }

    if(! roomIndex instanceof Number || roomIndex < 1){
        return next(null,{code:Code.FAIL,msg:"房号错误"});
    }

    var self = this;
    var deskName = this.tableService.getQuickEnterTableNo(roomIndex);
    if(! deskName){
        next(null,{code:Code.OK,msg:"房间已满,请稍后尝试"});
        return;
    }

    pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
        gameType: msg.gameType,
        uid:msg.uid
    }, function(err,res){
        if(!! err){
            next(null,{code:500,msg:"快速匹配出错,err=" + err.message});
            return;
        }
        var user = res;
        var desk = self.tableService.get(deskName);
        var chairNo = desk.pickupChair(user);

        if(chairNo == -1){
            next(null, {err:true,msg:"位置已满"});
            return
        }else if(chairNo == -2){
            next(null, {err:true,msg:"哈币超出房间上限"});
            return
        }else if(chairNo == -3){
            next(null, {err:true,code:501,msg:"金币太少了!赚点钱再来吧!"});
            return
        }

        msg.deskName = deskName;
        msg.pos = chairNo;
        self.enterDesk(msg,session,next);
    });
}

handler.sitDown = function (msg, session, next) {
    msg.uid = session.uid;
    var user;
    var self = this;
    async.waterfall([
            function (cb) {
                pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
                    gameType: msg.gameType,
                    uid:msg.uid
                }, cb);
            },
            function (res, cb) {
                user = res;

                var desk = self.tableService.get(msg.deskName);

                if (desk) {
                    var r = desk.canSitDown(user);
                    if (r == 0) {
                        cb(false, "ok");

                        desk.emit("sitDown", user);
                    }
                    else if (r == 1) {
                        cb({err: true, msg: "人数已满!"});
                    }
                    else if (r == 2) {
                        cb({err:true, msg:"哈币超出房间上限"});
                    }
                    else if (r == 3) {
                        cb({err: true, msg: "金币太少了!赚点钱再来吧!"});
                    }
                    else if (r == 4) {
                        cb({err: true, msg: "该位置上已经有人!"});
                    }
                }
                else {
                    cb({err: true, msg: "桌子不存在!"});
                }
            }
        ],
        function (err, res) {
            if (err) {
                next(null, err);
                return;
            }
            next(null, res);
        });
};


handler.sitUp = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);

    if (desk) {
        desk.emit("sitUp", msg);
        next(null, "ok");
    }
    else {
        next(null, {err: true, msg: "桌子不存在!"});
    }
};

handler.watcherEnterDesk = function(msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    var user;
    async.waterfall([
            function (cb) {
                pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
                    uid:msg.uid
                }, cb);
            },
            function (res, cb) {
                user = res;
                user.pos = msg.pos;
                var err = desk.addWatcher(user);
                cb(err, "ok");
            },
            function (res, cb) {
                pomelo.app.rpc.usersvr.userRemote.enterGame(session, {
                    uid: msg.uid,
                    gameType: "coinNiuNiu4",
                    deskName: msg.deskName
                }, cb);
            }
        ],
        function (err, res) {
            if (err) {
                next(null, err);
                return;
            }
            next(null, {pos:msg.pos});
        });
};

handler.requestWatchCard = function(msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    var watcherUid = msg.uid;
    var uid = msg.targetUid;
    desk.emit('watchapply', {watcherUid:watcherUid, uid:uid});
    next(null, "ok");
};


handler.answerWatchCard = function(msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('watchanswer', msg);
    next(null, "ok");
};

handler.getMyWatcher = function(msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    next(null, desk.getMyWatcher(msg.uid));
};

// 施放
handler.sendWile = function(msg, session, next) {
    var uid = session.uid;
    var fid = msg.fid;//对象
    var wid = msg.wid;
    var prodInfo = gDef.gWiles[wid-1];
    var desk = this.tableService.get(msg.deskName);

    if(!prodInfo){
        next(null, {err:true, msg:"无此产品"});
    }

    this.app.rpc.usersvr.userRemote.costCoin(session, {uid:uid, deltaCoin:-prodInfo.price}, function (err, res) {
        if (err) {
            next(null, {code:500,msg:err.message});
            return
        }

        log.insert({cmd: "coin_wile", uid:uid, fid:fid, wid:wid, deltaCoin:prodInfo.price});
        next(null, {code:200,msg:err.message});
        msg.uid = uid;
        pomelo.app.get('channelService').pushMessageByUids("coinNiuNiu4_OnPlayWile", msg, desk.getOnlineSids());
    });
};

// 施放
handler.sendWile = function(msg, session, next) {
    var uid = session.uid;
    var fid = msg.fid;//对象
    var wid = msg.wid;
    var prodInfo = gDef.gWiles[wid-1];
    var desk = this.tableService.get(msg.deskName);

    if(!prodInfo){
        next(null, {err:true, msg:"无此产品"});
    }

    this.app.rpc.usersvr.userRemote.costCoin(session, {uid:uid, deltaCoin:-prodInfo.price}, function (err, res) {
        if (err) {
            next(null, {code:500,msg:"金币不足,暂时无法赠送礼物"});
            return
        }

        log.insert({cmd: "coin_wile", uid:uid, fid:fid, wid:wid, deltaCoin:prodInfo.price});
        next(null, {code:200,msg:err.message});
        msg.uid = uid;
        pomelo.app.get('channelService').pushMessageByUids("coinNiuNiu4_OnPlayWile", msg, desk.getOnlineSids());
    });
};
