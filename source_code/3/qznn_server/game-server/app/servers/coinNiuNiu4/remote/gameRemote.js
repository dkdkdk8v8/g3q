/**
 * Created by Administrator on 2016/8/5.
 */
var Desk = require("../../../coin/niuNiu/module/desk");
var utils = require("../../../util/utils");
var groupDeskEvent = require("../../../coin/niuNiu/event/groupDeskEvent");
var gOnlineDef = require('../../../game/common/onlineDefine');

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
    this.tableService = this.app.get("tableService");
};

remote.prototype.createDesk = function (args, callback) {

    var desk = new Desk({
        maxPlayer: args.maxPlayer,
        deskType: args.deskType,
        deskName: args.deskName,
        minCoin: args.minCoin,
        maxCoin:args.maxCoin,
        baseCoin:args.baseCoin,
        roomIndex: args.roomIndex,
        flag: args
    });

    groupDeskEvent.addEventListener(desk);

    this.tableService.add(args.deskName, desk);
    utils.invokeCallback(callback, false, "ok");
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
            utils.invokeCallback(callback, {err: true, msg: "哈币超出房间上限"});
        }
        else if (res == 3) {
            utils.invokeCallback(callback, {err: true, msg: "金币太少了!赚点钱再来吧!"});
        }
        else if (res == 4) {
            utils.invokeCallback(callback, {err: true, msg: "该位置上已经有人!"});
        }
    }
    else {
        utils.invokeCallback(callback, {err: true, msg: "桌子不存在!"});
    }
};

// 被动退出房间
remote.prototype.playerOffline = function (args, callback) {
    var desk = this.tableService.get(args.deskName);
    if (desk && ! desk.endTimer) {
        desk.emit('offline', args);
    }
    utils.invokeCallback(callback);
};

remote.prototype.getDeskPlayerInfo = function (args, callback) {
    var desk = this.tableService.get(args.deskName);
    if (desk) {
        utils.invokeCallback(callback, false, desk.getPlayersInfo());
    }
    else {
        utils.invokeCallback(callback, {err: true, msg: "房间不存在!"});
    }
}

remote.prototype.onUserCoinReduce = function(msg,cb){
    var deskName = msg.deskName;
    var uid = msg.uid;
    var coin = msg.coin;
    var table = this.tableService.get(deskName);
    if( ! table){
        return cb({code:Code.FAIL,msg:"牌局不存在"});
    }

    var player = table.getPlayerByUid(uid);
    player.score = coin;
    if(player.score < table.minCoin){
        if((!! table.game && table.gameStatus != 0) || !! table.endTimer){
            return cb(null);//游戏中不直接踢人
        }

        table.emit("exit", {uid: uid, msg: "金币不足 无法开始游戏"});
    }
    cb(null);
}

remote.prototype.getTableAttr = function(msg,cb){
    var deskName = msg.deskName;
    var keys = msg.keys;

    var table = this.tableService.get(deskName);
    var result = {};
    for(var i = 0; i < keys.length; i++){
        var key = keys[i];
        if(!! table[key]){
            result[key] = table[key];
        }
    }
    cb(null,result);
}

remote.prototype.getPlayerCount = function(msg,cb){
    var infos = this.tableService.countPlayersByRoom();

    var chgRate = [
        0.8,
        0.45,
        0.21,
        0.09
    ];

    for(var i = 0; i < 4; i++){
        var n = infos[(i+1).toString()];
        n = Math.round(gOnlineDef.getOnlineNumVirtual()*chgRate[i])+n;
        infos[(i+1).toString()] = n;
    }

    cb(null,infos);
}
