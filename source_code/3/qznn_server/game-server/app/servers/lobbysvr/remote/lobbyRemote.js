/**
 * Created by Administrator on 2016/10/13.
 */

var utils = require("../../../util/utils");
var async = require("async");
var fs = require("fs");
var pomelo = require('pomelo');
var names = require('../../../game/common/nickName.json');

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;

    var self = this;

    var noticeFiles = {1:"app/game/notice-1.txt",
                            2:"app/game/notice-2.txt",
                            3:"app/game/notice-3.txt"};

    this.notices = {};

    for (var i in noticeFiles) {
        var file = noticeFiles[i];
        fs.readFile(file, "utf8", function (i, err, data) {
            self.notices[i] = data;
        }.bind(null, i));
    }

    this.curIndex = 0;
    this.scrollMsgs = ["欢迎来到【闲清棋牌平台】。本游戏平台仅供玩家文明娱乐，禁止赌博！",
                        "平台代理火热招募中，详询官方客服：xianqing00003，xianq005",
                        "游戏问题bug反馈请联系 xianqing00003"
                        //"从代理处购买钻石时，请前往官方公众号：【会员中心】—【验证代理】，输入代理微信号进行代理资质验证，以免上当受骗！"
                        ];

    this.rechargeMsg = "购买钻石请联系群主或代理。\n游戏问题反馈及代理咨询请联系：\nxianqing00003、xianq005\n问题bug反馈：xianqing00003";
    this.rechargeAccount = "gh_50af890420cc";
};

remote.prototype.getSysMessage = function (args, callback) {
    var index = args.index || 1;
    if (this.notices[index]) {
        utils.invokeCallback(callback, false, this.notices[index]);
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"活动不存在!"});
    }
};

remote.prototype.modifySysMessage = function (args, callback) {
    var index = args.index || 1;
    this.notices[index] = args.msg;
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.getScrollMsg = function (args, callback) {
    utils.invokeCallback(callback, false, this.scrollMsgs);
};

remote.prototype.modifyScrollMsg = function (args, callback) {
    this.scrollMsgs = args.msgs;
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.modifyRechargeMsg = function (args, callback) {
    this.rechargeMsg = args.msg;
    if (args.account && args.account != "") {
        this.rechargeAccount = args.account;
    }
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.getRechargeMsg = function (args, callback) {
    utils.invokeCallback(callback, false, {msg:this.rechargeMsg, account:this.rechargeAccount});
};

remote.prototype.scrollSystemMsg = function (args, callback) {
    if (this.curIndex >= this.scrollMsgs.length) {
        this.curIndex = 0;
    }
    var self = this;
    this.app.rpc.chatsvr.chatRemote.pushMessageToWorld(null, "OnScrollMsg", {msg:this.scrollMsgs[this.curIndex], type:1}, function () {
        self.curIndex++;
        utils.invokeCallback(callback);
    });
};

remote.prototype.sysAddRedPackage = function (args, callback) {
    var games = [{"name": "灵溪麻将","weight":70},
        {"name": "平阳麻将", "weight":30}];

    var cardTypes = [["杀猪", "杀猪胡"], ["杀猪", "杀猪胡"]];

    var index;
    var count = 0;
    var gameName;
    var w = Math.floor(Math.random()*100) + 1;
    for (var i = 0; i < games.length; i++) {
        count += games[i].weight;
        if (w <= count) {
            index = i;
            gameName = games[i].name;
            break;
        }
    }
    
    var cardType = cardTypes[index];
    index = Math.floor(Math.random()*cardType.length);
    var cardName = cardType[index];

    index = Math.floor(Math.random()*names.length);
    var playerName = names[index];
    var redInfo = {uid: 0, nickName:playerName};

    // var weights = [{"coin":1, "count":1, "weight":8},
    //             {"coin":2, "count":2, "weight":1},
    //             {"coin":3, "count":3, "weight":1},
    //             {"coin":4, "count":4, "weight":1},
    //             {"coin":5, "count":5, "weight":0},
    //             {"coin":0, "count":1, "weight":89}
    //     ];
    //
    //
    // var w = Math.floor(Math.random()*100) + 1;
    // var count = 0;
    // for (var i = 0; i < weights.length; i++) {
    //     count += weights[i].weight;
    //     if (w <= count) {
    //         redInfo.totalCoin = weights[i].coin;
    //         redInfo.totalCount = weights[i].count;
    //         break;
    //     }
    // }

    redInfo.totalCoin = 0;
    redInfo.totalCount = 1;

    var bMsg = "<font>玩家</font><font color=255,255,0>" + playerName + "</font><font>在</font><font color=0,255,0>"+gameName+"</font><font>游戏中打出了</font><font color=0,255,0>" + cardName + "</font><font>，给大家发送了一份福利。请注意抢红包。</font>";
    pomelo.app.rpc.singlesvr.redPackageRemote.addRedPackage(null,
        redInfo,
        function (err, packageId) {
            pomelo.app.rpc.chatsvr.chatRemote.pushMessageToWorld(null, "OnScrollMsg", {
                msg: bMsg,
                type: 2,
                packageId: packageId,
                timestamp: Math.floor(new Date().getTime()/1000)
            }, function () {
                utils.invokeCallback(callback);
            });
        });
};
