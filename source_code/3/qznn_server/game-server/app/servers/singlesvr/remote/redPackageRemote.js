/**
 * Created by Administrator on 2016/11/16.
 */

var utils = require("../../../util/utils");
var async = require("async");
var fs = require("fs");
var pomelo = require('pomelo');
var log = pomelo.app.get('mongodb');

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;

    this.packages = {};
};

var GrapPackage = function (leftCoin, leftNum) {
    if (leftNum == 1) {
        return leftCoin;
    }
    var left = leftCoin - leftNum;
    var max = left*3/leftNum > left ? left : left*3/leftNum;
    var coin = parseInt(Math.random()*max) + 1;
    return coin;
};

remote.prototype.addRedPackage = function(args, callback) {
    var RedPackageInfo = pomelo.app.get('models').RedPackageInfo;
    var self = this;
    var now = Math.round(new Date().getTime() / 1000);
    // 空的红包
    if (args.totalCoin != 0) {
        RedPackageInfo.create({uid: args.uid, timestamp: now, totalCard: args.totalCoin})
            .then(function (package) {
                log.insert({
                    cmd: "addRedPackage",
                    id: package.id,
                    roomCard: args.totalCoin,
                    count: args.totalCount,
                    uid: args.uid
                });
                self.packages[package.id] = {
                    leftCoin: args.totalCoin,
                    leftNum: args.totalCount,
                    uidMap: {},
                    uidList: [],
                    nickName: args.nickName
                };
                utils.invokeCallback(callback, false, package.id);
            });
    }
    else {
        utils.invokeCallback(callback, false, 0);
    }
};

remote.prototype.grabRedPackage = function (args, callback) {
    var uid = args.uid;
    var packageInfo = this.packages[args.packageId];
    if (!packageInfo) {
        utils.invokeCallback(callback, {err: true, msg: "您手慢了，红包已经派完了!"});
        return;
    }
    var random = Math.floor(Math.random()*10);
    if (random != 5) {
        utils.invokeCallback(callback, {err: true, msg: "哎呀，红包没有抢到!"});
        return;
    }
    if (packageInfo.uidMap[uid]) {
        utils.invokeCallback(callback, {err: true, msg: "您已经抢过该红包!"});
        return;
    }
    var coin = GrapPackage(packageInfo.leftCoin, packageInfo.leftNum);

    packageInfo.uidMap[uid] = true;
    packageInfo.uidList.push(uid);

    packageInfo.leftCoin -= coin;
    packageInfo.leftNum -= 1;
    if (packageInfo.leftNum == 0) {
        var RedPackage = pomelo.app.get('models').RedPackageInfo;
        RedPackage.update({recivers:JSON.stringify(packageInfo.uidList)}, {where:{id:args.packageId}})
            .then(function(count) {

            });
        delete this.packages[args.packageId];
    }
    pomelo.app.rpc.usersvr.userRemote.addRoomCard(uid, {uid:uid, cardNum:coin}, function(err, res) {
        if (err) {
            utils.invokeCallback(callback, err);
        }
        else {
            log.insert({cmd:"grabRedPackage", id:args.packageId, roomCard:coin, uid:uid});
            if (coin == 0) {
                utils.invokeCallback(callback, {err: true, msg: "您手慢了，红包已经派完了!"});
            }
            else {
                utils.invokeCallback(callback, false, {msg: "<font>领取了玩家</font><font color=255,255,0>" + packageInfo.nickName + "</font><font>发出的红包，获得</font><font color=255,255,0>" + coin + "钻</font>"});
            }
        }
    });
};