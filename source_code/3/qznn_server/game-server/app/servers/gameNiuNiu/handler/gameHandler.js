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

handler.startGame = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    if (!desk.canStart()) {
        next(null, {err:true, msg:"不能开始游戏!"});
        return;
    }
    if (desk.fangOwnerUid != msg.uid) {
        next(null, {err:true, msg:"不是房主!"});
        return;
    }
    desk.emit('startgame', msg);
    next(null, "ok");

    var gameList = this.app.get("games");
    this.app.get('mongodb').insert({cmd:"startGame", gameType:gameList.gameNiuNiu.index});
};

handler.dissolutionDesk = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    if (!desk.canDissolutionDesk(msg.uid)) {
        next(null, {err:true, mgs:"不是房主!"});
    }
    else {
        desk.emit('dissolution', msg);
        next(null, false, "ok");
    }
};

handler.cancelTrusttee = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('canceltrusttee', msg);
    next(null, false, "ok");
};

handler.kickPlayer = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    if (!desk.canKickPlayer(msg.uid)) {
        next(null, {err:true, mgs:"踢人错误!"});
    }
    else {
        desk.emit('kickplayer', msg);
        next(null, "ok");
    }
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
// 申请解散
handler.disApply = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('disapply', msg);
    next(null, "ok");
};

// 解散操作
handler.disOpreat = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('disopreat', msg);
    next(null, "ok");
};

handler.enterDesk = function (msg, session, next) {
    msg.uid = session.uid;
    var user;
    var self = this;
    //
    var authClub = function(cb){
        var desk = self.tableService.get(msg.deskName);

        if(! desk){
            return cb({err:true,msg:"桌子不存在，请联系管理员" + msg.deskName})
        }

        if(!! desk.clubId){
            pomelo.app.rpc.clubsvr.clubRemote.isMember(null,{uid:session.uid,clubId:desk.clubId},cb);
            return;
        }
        cb(null,true);
    }
    //
    async.waterfall([authClub,
            function (allowEnter,cb) {
                if(! allowEnter){
                    return cb({err:true,msg:"不是亲友圈成员 不能加入圈子 请先加入圈子"});
                }

                pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
                    gameType: msg.gameType,
                    uid:msg.uid
                }, cb);
            },
            function (res, cb) {
                user = res;
                
                if(user.gameType && (user.gameType != msg.gameType || user.deskName != msg.deskName)) {
                    var infotip = user.gameType == user.deskName ? "您已经报名比赛 请先退赛" : "你已经加入其他桌子!";
                    return cb({err: true, errCode: 1001, msg: infotip});
                }

                var desk = self.tableService.get(msg.deskName);

                if (desk) {
                    var r = desk.canEnterDesk(user);
                    if (r == 0) {
                        desk.emit("enter", user);
                        cb(false, "ok");
                    }
                    else if (r == 1) {
                        cb({err: true, msg: "人数已满!"});
                    }
                    else if (res == 2) {
                        cb({err: true, msg: "房间已经解散!"});
                    }
                    else if (r == 3) {
                        cb({err: true, msg: "该房间已经开始游戏，加入失败!"});
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
            next(null, {table:{tableNo:msg.deskName}});
        });
};

handler.quickEnterDesk = function(msg,session,next){
    var boxId = msg.boxId;

    if(msg.gameType != "gameNiuNiu"){
        return next(null,{code:500,msg:"错误的游戏类型"});
    }

    if(! boxId instanceof Number){
        return next(null,{code:500,msg:"房号错误"});
    }

    var self = this;
    var deskName = this.tableService.getBoxTableNo(boxId);
    if(! deskName){
        next(null,{code:200,msg:"房间已满,请稍后尝试"});
        return;
    }

    msg.deskName = deskName;
    self.enterDesk(msg,session,next);
}

// 使用道具
handler.useProp = function (msg, session, next) {
    var desk = this.tableService.get(msg.deskName);
    if (!desk) {
        next(null, {err:true, msg: "桌子不存在!"});
        return;
    }
    desk.emit('prop', msg);
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
        pomelo.app.get('channelService').pushMessageByUids("gameNiuNiu" + "_OnPlayWile", msg, desk.getOnlineSids());
    });
};