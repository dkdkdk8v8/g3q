/**
 * Created by Administrator on 2016/8/5.
 */
var Desk = require("../../../game/niuNiu/module/desk");
var utils = require("../../../util/utils");
var async = require("async");
var groupDeskEvent = require("../../../game/niuNiu/event/groupDeskEvent");
var pomelo = require("pomelo");
var gDef = require("../../../game/niuNiu/globalDefine");
var log = pomelo.app.get('mongodb');

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
    this.tableService = this.app.get("tableService");
};

remote.prototype.createDesk = function (args, user, callback) {
    var self = this;
    if (args.deskType != gDef.GroupDeskType.TongBi && args.deskType != gDef.GroupDeskType.Random && args.deskType != gDef.GroupDeskType.Card && args.deskType != gDef.GroupDeskType.SequenceBank) {
        utils.invokeCallback(callback, {err:true, msg:"桌子类型错误!"});
    }
    // else if (args.deskType == gDef.GroupDeskType.Active && !utils.isInActive(1)) {
    //     utils.invokeCallback(callback, {err:true, msg:"活动未开放!"});
    // }
    else {
        var flag = args.flag;
        var needNum;
        if (flag.countType == 1) {
            needNum = 2;
        }
        else if (flag.countType == 2) {
            needNum = 4;
        }
        else  if (flag.countType == 3) {
            needNum = 6;
        }
        else {
            utils.invokeCallback(callback, {err:true, msg:"房间模式错误!"});
            return;
        }
        
        if (utils.isInFreeTime()) {
            needNum = 0;
        }

        if (user.roomCard < needNum) {
            utils.invokeCallback(callback, {err:true, msg:"钻石不足!"});
            return;
        }

        var now = Math.round(new Date().getTime()/1000);
        var NiuNiuGroupInfo = self.app.get('models').NiuNiuGroupInfo;
        NiuNiuGroupInfo.create({deskName:args.deskName, createTime:now, createId:args.uid, deskType:args.deskType, flag:JSON.stringify(args.flag)})
            .then(function (deskInfo) {
                if (!deskInfo) {
                    utils.invokeCallback(callback, {err:true, msg:"房间创建失败!"});
                    return;
                }
                var desk;
                var maxPlayer = 5;
                if(this.flag.poepleNumType == 2){
                    maxPlayer = 8;
                }

                desk = new Desk({
                    maxPlayer: maxPlayer,
                    deskType: args.deskType,
                    deskName: args.deskName,
                    deskId: deskInfo.deskId,
                    createUid: args.uid,
                    flag: args.flag,
                    costNum: needNum,
                    isReplace: args.isReplace,
                    clubId:args.clubId,
                    boxId:args.boxId,
                    isAntiCheating:args.isAntiCheating,
                });

                log.insert({cmd:"createDesk", gameType:3, isReplace: args.isReplace, deskId:deskInfo.deskId, uid:args.uid, flag:args.flag, deskType:args.deskType});

                groupDeskEvent.addEventListener(desk);

                self.tableService.add(args.deskName, desk);
                utils.invokeCallback(callback, false, {costNum: needNum});

            });
    }
};

remote.prototype.canEnterDesk = function (args, user, callback) {
    var desk = this.tableService.get(args.deskName);
    if (desk) {
        var res = desk.canEnterDesk(user);
        if (res == 0) {
            utils.invokeCallback(callback, false, "ok");
        }
        else if (res == 1) {
            utils.invokeCallback(callback, {err: true, msg: "人数已满!"});
        }
        else if (res == 2) {
            utils.invokeCallback(callback, {err: true, msg: "房间已经解散!"});
        }
        else if (res == 3) {
            utils.invokeCallback(callback, {err: true, msg: "该房间已经开始游戏，加入失败!"});
        }
    }
    else {
        utils.invokeCallback(callback, {err: true, msg: "桌子不存在!"});
    }
};

// 被动退出房间
remote.prototype.playerOffline = function (args, callback) {
    var desk = this.tableService.get(args.deskName);
    if (desk) {
        desk.emit('offline', args);
    }
    utils.invokeCallback(callback);
};

remote.prototype.clearDesk = function (args, callback) {
    this.tableService.remove(args.deskName);
    utils.invokeCallback(callback);
};

remote.prototype.onChat = function (args, callback) {
    var desk = this.tableService.get(args.deskName);
    if (desk) {
        desk.emit('chat', args);
    }
    utils.invokeCallback(callback);
};

remote.prototype.queryDeskInfo = function (args, callback) {
    var desk = this.tableService.get(args.deskName);
    if (!desk) {
        callback({err:true, msg: "桌子不存在!"});
        return;
    }
    callback(null, desk.getDeskBasicInfo());
};

remote.prototype.dissolutionDesk = function (args, callback) {
    var desk = this.tableService.get(args.deskName);
    if (!desk) {
        callback({err:true, msg: "桌子不存在!"});
        return;
    }
    if (!desk.canDissolutionDesk(args.uid)) {
        callback({err:true, msg:"房间内已经有玩家,无法解散房间!"});
    }
    else {
        desk.emit('dissolution', args);
        callback(null, "ok");
    }
};
