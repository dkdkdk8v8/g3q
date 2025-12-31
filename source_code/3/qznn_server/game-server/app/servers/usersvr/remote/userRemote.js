/**
 * Created by Administrator on 2016/10/13.
 */
var utils = require("../../../util/utils");
var async = require("async");
var fs = require("fs");
var pomelo = require('pomelo');
var User = require('../../../domain/User');
var dispatch = require('../../../util/dispatcher');
var log = pomelo.app.get('mongodb');
var UserDailyInfo = require('../../../domain/UserDailyInfo');
var UserAddInfo = require('../../../domain/UserAddInfo');
var daily_score_db = require("../../../../lib/daily_score_db");

module.exports = function(app) {
    return new remote(app);
};

var timeExpire = 10*60;

var isRobot = function (uid) {
    return uid >= 10000000
}

var remote = function(app) {
    this.app = app;

    this.users = {};

    this.dataModels = {};

    this.replaceRoom = {};

    this.dataModels.gameNiuNiu = {data:require('../../../domain/NiuNiuUserInfo'), model:"NiuNiuUserInfo"};

    this.dataModels.gameDDZ = {data:require('../../../domain/DDZUserInfo'), model:"DDZUserInfo"};

    this.dataModels.gameSSS = {data:require('../../../domain/SSSUserInfo'), model:"SSSUserInfo"};

    this.dataModels.gamePDK = {data:require('../../../domain/PDKUserInfo'), model:"PDKUserInfo"};

    this.dataModels.gameTexasPoker = {data:require('../../../domain/TexasPokerUserInfo'), model:"TexasPokerUserInfo"};

    this.dataModels.gameMaJiang_nd = {data:require('../../../domain/MaJiangNDUserInfo'), model:"MaJiangNDUserInfo"};

    this.dataModels.gameMaJiang_gtz = {data:require('../../../domain/MaJiangGTZUserInfo'),model:"MaJiangGTZUserInfo"};
    //金币场
    this.dataModels.coinMaJiang_nd = {data:require('../../../domain/MaJiangNDUserInfo'),model:"CoinMaJiangNDUserInfo"};
    this.dataModels.coinNiuNiu4 = {data:require('../../../domain/NiuNiuUserInfo'),model:"CoinNiuNiuUserInfo"};
    this.dataModels.coinDDZ = {data:require('../../../domain/DDZUserInfo'),model:"CoinDDZUserInfo"};
    
    this.gameList = app.get('games');

    this.competitionSwitch = false; //比赛开关
    this.compModels = {};
    this.compModels.gameMaJiang_nd = {model:"MaJiangNDCompetition"};
};

remote.prototype.loginGetUserInfo = function(args, callback) {

    if (!this.app.get('userList')) {
        this.app.set('userList', this.users);//只能加这里
    }

    var self = this;
    var nowTime = Math.round(new Date().getTime()/1000);
    if (args.uid) {
        var uid = args.uid;
        async.waterfall([function(cb) {
            // 获取基本信息
                if (!self.users[uid] || !self.users[uid].expire || self.users[uid].expire < nowTime) {
                    var UserInfo = null;
                    if(isRobot(uid)){
                        UserInfo = self.app.get('models').RobotInfo
                    }else{
                        UserInfo = self.app.get('models').UserInfo
                    }
                    UserInfo.findOne({where: {uid: uid}})
                        .then(function (u) {
                            if (u) {
                                // 更新昵称和头像
                                if (self.users[uid]) {
                                    self.users[uid].nickName = u.nickName;
                                    self.users[uid].faceId = u.faceId;
                                }
                                else {
                                    self.users[uid] = new User(u);
                                }

                                self.users[uid].ip = args.ip;
                                self.users[uid].sid = args.sid;
                                self.users[uid].expire = nowTime + timeExpire;

                                self.users[uid].isonline = true;

                                cb();
                            }
                            else {
                                cb({err: true, msg: "用户不存在"});
                            }
                        });
                }
                else {
                    var u = self.users[uid];
                    u.ip = args.ip;
                    u.sid = args.sid;
                    // 删掉断线属性
                    u.isonline = true;
                    cb();
                }
            },
            // 获取每日信息
            function(cb) {
                var d = self.users[uid].dailyData;
                if (d) {
                    cb();
                }
                else {
                    self.app.get('models').UserDailyInfo.findOrCreate({where:{uid:uid}}).spread(function(dailyInfo, bcreate) {
                        self.users[uid].dailyData = new UserDailyInfo(dailyInfo);
                        cb();
                    });
                }
            },
            // 获取附加信息
            function(cb) {
                var d = self.users[uid].addData;
                if (d) {
                    cb();
                }
                else {
                    self.app.get('models').UserAddInfo.findOrCreate({where:{uid:uid}}).spread(function(addInfo, bcreate) {
                        self.users[uid].addData = new UserAddInfo(addInfo);
                        cb();
                    });
                }
            },
            // 获取比赛状态
            function(cb) {
                self.app.rpc.matchsvr.matchRemote.getMatcherStatus(null,{uid:uid},function(err,res){
                    self.users[uid].isApplyMatch = res != 0;
                    cb();
                })
            }],
            function(err) {
                if (err) {
                    utils.invokeCallback(callback, err);
                }
                if (utils.isSameDay(nowTime - self.users[uid].addData.lastLoginTime) <= 2) {
                    self.refreshUserAddData({uid:uid},
                        [{key:"activeDay", deltaValue:1}], function(){});
                }
                else {
                    self.refreshUserAddData({uid:uid},
                        [{key:"activeDay", value:1},
                            {key:"gameCount", value:0},
                            {key:"costRoomCard", value:0},
                            {key:"lastLoginTime", value:nowTime}], function(){});
                }

                var user = self.users[args.uid];
                var userInfo = new User(user);
                userInfo.gameType = user.gameType;
                userInfo.deskName = user.deskName;
                userInfo.dailyData = new UserDailyInfo(user.dailyData);
                utils.invokeCallback(callback, false, userInfo);
            });
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"用户不存在"});
    }
};

remote.prototype.enterGame = function (args, callback) {
    var self = this;
    var uid = args.uid;
    var gameType = args.gameType;
    var deskName = args.deskName;

    if (!this.users[uid]) {
        utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
        return;
    }

    if (this.users[uid].gameType && this.users[uid].deskName) {
        if (gameType != this.users[uid].gameType || deskName != this.users[uid].deskName) {
            utils.invokeCallback(callback, {err:true, msg:"已经加入其他游戏!"});
            return;
        }
    }



    if (this.gameList[gameType]) {
        // 正常进入房间
        if (args.costNum > 0) {
            if (args.costNum + this.users[uid].frozenRoomCard > this.users[uid].roomCard) {
                return utils.invokeCallback(callback, {err:true, msg:"您的钻石数量不足!"});
            }
        }
    }

    if (this.dataModels[gameType]) {
        if (!this.users[uid][gameType]) {
            this.app.get('models')[this.dataModels[gameType].model].findOrCreate({where: {uid: uid}})
                .then(function (res) {
                    self.users[uid][gameType] = new self.dataModels[gameType].data(res[0]);
                    self.users[uid].gameType = gameType;
                    self.users[uid].deskName = deskName;
                    utils.invokeCallback(callback, false, "ok");
                });
        }
        else {
            this.users[uid].gameType = gameType;
            this.users[uid].deskName = deskName;
            utils.invokeCallback(callback, false, "ok");
        }
    }
    else {
        this.users[uid].gameType = gameType;
        this.users[uid].deskName = deskName;
        utils.invokeCallback(callback, false, "ok");
    }
};

remote.prototype.modifyUserInfo = function (info, callback) {
    var attrs = info.attrs;
    var uid = info.uid;

    var keys = {sign:1,sex:1,faceId:1,nickName:1,guideStep:1};

    var data = {};
    for (var i = 0; i < attrs.length; i++) {
        if (!keys[attrs[i].key]) {
            utils.invokeCallback(cb, {err: true, msg: "非法操作!"});
            return;
        }
        data[attrs[i].key] = attrs[i].value;
    }
    var self = this;

    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.update(data, {where:{uid: uid}})
        .then(function (count) {
            if (count == 1) {
                for (var i = 0; i < attrs.length; i++) {
                    self.users[info.uid][attrs[i].key] = attrs[i].value;
                }
                utils.invokeCallback(callback, false, "ok");
            }
            else {
                utils.invokeCallback(callback, {err: true, msg: "用户不存在!"});
            }
        });
};

remote.prototype.authModifyUserInfo = function (args, callback) {
    if (!this.users[args.uid]) {
        utils.invokeCallback(callback, false, "ok");
        return;
    }

    var attrs = args.attrs;

    var keys = {faceId:1,nickName:1};

    for (var i = 0; i < attrs.length; i++) {
        if (!keys[attrs[i].key]) {
            utils.invokeCallback(cb, {err: true, msg: "非法操作!"});
            return;
        }
    }

    for (var i = 0; i < attrs.length; i++) {
        this.users[args.uid][attrs[i].key] = attrs[i].value;
    }
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.queryUser = function (args, callback) {
    var uid = args.quid, self = this;
    var res = {};
    async.waterfall([
        function (cb) {
            var UserInfo = null;
            if(isRobot(uid)){
                UserInfo = self.app.get('models').RobotInfo;
            }else{
                UserInfo = self.app.get('models').UserInfo;
            }
            UserInfo.findOne({where:{uid:uid}})
                .then(function(user) {
                    if (user) {
                        res = new User(user);
                        cb();
                    }
                    else {
                        cb({err:true, msg:"用户不存在"});
                    }
                });
        }
    ], function(err) {
        if (err) {
            utils.invokeCallback(callback, err);
            return;
        }
        utils.invokeCallback(callback, false, res);
    });
};

/**
 * @profile:这个接口可以批量查询用户，优先从内存在查询，再从数据库中查询。
 * @arg quids [uid] 查询的uid数组
 * @arg attrs [attr] 需要查询的用户属性
 * @return [Users] 用户的具体数据
 * @extends 不支持查询机器人信息
*/
remote.prototype.queryUsers = function(args,callback){
    var quids = args.quids;
    var attrs = args.attrs;

    var filter = [];
    quids.forEach(function(uid){
        if(filter.indexOf(uid) == -1){
            filter.push(uid);
        }
    })

    var quserSet = {};
    var offlineUids = [];
    var self = this;
    UserInfo = self.app.get('models').UserInfo;
    //从内存中找
    var findUserInCache = function(cb){
        for(var i = 0; i < filter.length; i++){
            var userInCache = self.users[filter[i]];
            if(! userInCache){
                offlineUids.push(filter[i]);
                continue;
            }

            if(! attrs){//查询没有列出查询的属性
                continue;
            }

            var item = {};
            for(var j = 0; j < attrs.length; j++){
                var key = attrs[j];
                item[key] = userInCache[key];
            }
            //TODO:一个特殊处理的字段
            if(userInCache.isonline){
                item.isOnline = true;
            }
            quserSet[item.uid] = item;
        }
        cb(null);
    }
    //从数据库中招
    var findUserInDB = function(cb){
        if(offlineUids.length == 0){
            return cb(null);
        }

        //TODO:attributes是否可以传[] 文档没说明 所以取巧一下.
        var queryObj = {where:{uid:offlineUids},raw:true};

        UserInfo.findAll(queryObj).then(function(results){
            for(var i = 0; i < results.length; i++){
                var item = results[i];
                quserSet[item.uid] = item;
            }
            cb(null);
        })
    }
    //
    async.waterfall([findUserInCache,findUserInDB],function(err,result){
        if(!! err){
            return utils.invokeCallback(callback,err);
        }

        var qusers = [];
        for(var i = 0; i < quids.length; i++){
            qusers.push(quserSet[quids[i]]);
        }

        utils.invokeCallback(callback,null,qusers);
    })
}

remote.prototype.offline = function (args, callback) {
    var uid = args.uid;
    if (this.users[uid]) {
        if (this.users[uid].isonline) {
            delete this.users[uid].isonline;
        }
        if (this.users[uid].ip) {
        delete this.users[uid].ip;
        }
        utils.invokeCallback(callback, false, {gameType:this.users[uid].gameType, deskName:this.users[uid].deskName});
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"用户还未创建!"});
    }
};

remote.prototype.queryUserInfo = function (args, callback) {
    var res = [];
    var self = this;
    if(args.gameType && !this.dataModels[args.gameType]) {
        return utils.invokeCallback(callback, {err:true, msg:"游戏类型错误"});
    }
    async.waterfall([
        function (cb) {
            if (args.type & 0x1) {
                var user = new User(self.users[args.uid]);
                if (args.gameType) {
                    if (self.users[args.uid][args.gameType]) {
                        user.userData = new self.dataModels[args.gameType].data(self.users[args.uid][args.gameType]);
                        res.push(user);
                        cb();
                    }
                    else {
                        self.app.get('models')[self.dataModels[args.gameType].model].findOrCreate({where: {uid: args.uid}})
                            .then(function (r) {
                                self.users[args.uid][args.gameType] = new self.dataModels[args.gameType].data(r[0]);
                                user.userData = new self.dataModels[args.gameType].data(self.users[args.uid][args.gameType]);
                                res.push(user);
                                cb();
                            });
                    }
                }
                else {
                    res.push(user);
                    cb();
                }
            }
            else {
                cb();
            }
        },
        function (cb) {
            if (args.type & 0x2) {
                if (self.users[args.quid]) {
                    var user = new User(self.users[args.quid]);
                    if (args.gameType) {
                        if (self.users[args.quid][args.gameType]) {
                            user.userData = new self.dataModels[args.gameType].data(self.users[args.quid][args.gameType]);
                            res.push(user);
                            cb();
                        }
                        else {
                            self.app.get('models')[self.dataModels[args.gameType].model].findOrCreate({where: {uid: args.quid}})
                                .then(function (r) {
                                    self.users[args.quid][args.gameType] = new self.dataModels[args.gameType].data(r[0]);
                                    user.userData = new self.dataModels[args.gameType].data(self.users[args.quid][args.gameType]);
                                    res.push(user);
                                    cb();
                                });
                        }
                    }
                    else {
                        res.push(user);
                        cb();
                    }
                }
                else {
                    self.queryUser(args, function (err, user) {
                        if (err) {
                            cb(err);
                        }
                        else {
                            res.push(user);
                            cb();
                        }
                    });
                }
            }
            else {
                utils.invokeCallback(cb, false);
            }
        }
    ], function(err, r) {
        if (err) {
            utils.invokeCallback(callback, err);
            return;
        }
        utils.invokeCallback(callback, false, res);
    });
};


remote.prototype.refreshUserData = function (args, attrs, callback) {
    var uid = args.uid;
    var user = this.users[uid];
    var gameType = args.gameType;
    var compKeys = {totalCount:1,winCount:1,totalScore:1,playCount:1};//比赛数据

    if (this.gameList[gameType]) {
        if (this.dataModels[args.gameType]) {
            var change = {};
            var compAttrs = [];
            var oldTotalScore = user[gameType].totalScore;
            for (var i = 0; i < attrs.length; i++) {
                if (attrs[i].value != undefined) {
                    change[attrs[i].key] = attrs[i].value;
                    user[gameType][attrs[i].key] = change[attrs[i].key];
                }
                else if (attrs[i].deltaValue != undefined) {
                    change[attrs[i].key] = user[gameType][attrs[i].key] + attrs[i].deltaValue;
                    user[gameType][attrs[i].key] = change[attrs[i].key];
                }

                if(compKeys[attrs[i].key]){
                    compAttrs.push(attrs[i]);
                }
            }

            //更新比赛数据
            if(compAttrs.length > 0){
                this.refreshUserCompetitionData(args, compAttrs);
            }

            var newTotalScore = user[gameType].totalScore;
            if (oldTotalScore != newTotalScore && daily_score_db[gameType]) {
                var dayIndex = utils.getCurPassDay();
                daily_score_db[gameType].findOrCreate({
                    where: {
                        uid: uid,
                        dayIndex: dayIndex
                    }
                }).spread(function (info, bcreate) {
                    info.score += (newTotalScore - oldTotalScore);
                    info.save({fields: ['score']});
                });
            }

            var changeAttr = [];
            if (change.playCount) {
                changeAttr.push({key: "gameCount", deltaValue: 1});
                changeAttr.push({key: "totalCount", deltaValue: 1});
                this.refreshUserAddData({uid: uid},
                    changeAttr, function () {
                    });
            }

            this.app.get('models')[this.dataModels[gameType].model].update(change, {where: {uid: uid}})
                .then(function (count) {
                    // for (var i = 0; i < attrs.length; i++) {
                    //     user[gameType][attrs[i].key] = change[attrs[i].key];
                    // }
                    utils.invokeCallback(callback, null, "ok");
                });
        }
        else {
            utils.invokeCallback(callback, null, "ok");
        }
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"错误的游戏类型!"});
    }
};

remote.prototype.refreshUserCompetitionData = function (args, attrs, callback) {
    if(!this.competitionSwitch){
        return utils.invokeCallback(callback, null, "比赛未开始");
    }

    var uid = args.uid;
    var gameType = args.gameType;
    console.log("uid:",uid);
    var user = this.users[uid];
    var gameId = user.gameId;
    if (!this.gameList[gameType]) {
        return utils.invokeCallback(callback, {err:true, msg:"错误的游戏类型!"});
    }

    if (!this.compModels[gameType]) {
        return utils.invokeCallback(callback, {err:true, msg:"此类游戏没有比赛!"});
    }

    this.app.get('models')[this.compModels[gameType].model].findOrCreate({where: {uid: uid}, defaults:{uid:uid, gameId:gameId}})
        .spread(function (res, created) {
            for (var i = 0; i < attrs.length; i++) {
                if (attrs[i].deltaValue != undefined) {
                    var key = attrs[i].key;
                    var deltaValue = attrs[i].deltaValue;
                    res[key] += deltaValue;
                }
            }
            res.save().then(function(){
                utils.invokeCallback(callback, false, "ok");
            })
        });
};

remote.prototype.refreshUserDailyData = function (args, attrs, callback) {
    var uid = args.uid;
    var user = this.users[uid];

    if (user) {
        var dailyData = user.dailyData;
        var change = {};
        for (var i = 0; i < attrs.length; i++) {
            if (attrs[i].value != undefined) {
                change[attrs[i].key] = attrs[i].value;
                dailyData[attrs[i].key] = change[attrs[i].key];
            }
            else if (attrs[i].deltaValue != undefined) {
                change[attrs[i].key] = dailyData[attrs[i].key] + attrs[i].deltaValue;
                dailyData[attrs[i].key] = change[attrs[i].key];
            }
        }
        this.app.get('models').UserDailyInfo.update(change, {where:{uid:uid}})
            .then(function (count) {
                // for (var i = 0; i < attrs.length; i++) {
                //     dailyData[attrs[i].key] = change[attrs[i].key];
                // }
                pomelo.app.get('channelService').pushMessageByUids("OnDailyDataUpdate",
                    change,
                    [{
                    uid: args.uid,
                    sid: user.sid
                }]);
                utils.invokeCallback(callback, null, "ok");
            });
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
};

remote.prototype.refreshUserAddData = function (args, attrs, callback) {
    var uid = args.uid;
    var user = this.users[uid];

    if (user) {
        var addData = user.addData;
        var change = {};
        for (var i = 0; i < attrs.length; i++) {
            if (attrs[i].value != undefined) {
                change[attrs[i].key] = attrs[i].value;
                addData[attrs[i].key] = change[attrs[i].key];
            }
            else if (attrs[i].deltaValue != undefined) {
                change[attrs[i].key] = addData[attrs[i].key] + attrs[i].deltaValue;
                addData[attrs[i].key] = change[attrs[i].key];
            }
        }
        this.app.get('models').UserAddInfo.update(change, {where:{uid:uid}})
            .then(function (count) {
                // for (var i = 0; i < attrs.length; i++) {
                //     addData[attrs[i].key] = change[attrs[i].key];
                // }
                utils.invokeCallback(callback, null, "ok");
            });
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
};

remote.prototype.getMyUserAddInfo = function (args, callback) {
    var uid = args.uid;
    var user = this.users[uid];
    if (user) {
        var addData = user.addData;
        var info = {};
        if (args.keys) {
            for (var i = 0; i < args.keys.length; i++) {
                info[args.keys[i]] = addData[args.keys[i]];
            }
        }
        else {
            info = new UserAddInfo(addData);
        }
        utils.invokeCallback(callback, false, info);
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
};

remote.prototype.getMyUserDailyInfo = function (args, callback) {
    var uid = args.uid;
    var user = this.users[uid];
    if (user) {
        var dailyData = user.dailyData;

        var now = Math.floor(new Date().getTime()/1000);

        if (0 != utils.isSameDay(dailyData.lastOptTime, now)) {
            this.app.get('models').UserDailyInfo
            .findOne({where: {uid: uid}})
            .then(function (d) {
                UserDailyInfo.reset(d, now);
                d.save();
                user.dailyData = new UserDailyInfo(d);
                dailyData = user.dailyData;
                var info = {};
                if (args.keys) {
                    for (var i = 0; i < args.keys.length; i++) {
                        info[args.keys[i]] = dailyData[args.keys[i]];
                    }
                }
                else {
                    info = new UserDailyInfo(dailyData);
                }
                utils.invokeCallback(callback, false, info);
            });
        }
        else {
            var info = {};
            if (args.keys) {
                for (var i = 0; i < args.keys.length; i++) {
                    info[args.keys[i]] = dailyData[args.keys[i]];
                }
            }
            else {
                info = new UserDailyInfo(dailyData);
            }
            utils.invokeCallback(callback, false, info);
        }
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
};

remote.prototype.certificationPlayer = function (args, callback) {
    var CertificationInfo = this.app.get('models').CertificationInfo;

    var user = this.users[args.uid];
    var UserInfo = this.app.get('models').UserInfo;
    CertificationInfo.findOrCreate({where:{uid:args.uid}, defaults:{name:args.name,IDNumber:args.IDNumber}})
        .then(function (res) {
            UserInfo.update({isCheck:1}, {where:{uid:args.uid}}).then(function (count) {
                user.isCheck = 1;
                utils.invokeCallback(callback, false, "ok");
            });
        });
};

remote.prototype.costRoomCard = function (args, callback) {
    var uid = args.uid;
    if (undefined == args.costNum || args.costNum < 0) {
        utils.invokeCallback(callback, {err:true, msg:"消耗房卡数量错误!"});
        return;
    }
    var self = this;

    var checkUser = function(cb){
        var user = self.users[uid];
        if(!user){
            var UserInfo = self.app.get('models').UserInfo;
            UserInfo.findOne({where:{uid:uid}})
                .then(function(user) {
                    if (user) {
                        self.users[uid] = new User(user);
                        cb(null, self.users[uid]);
                    }
                    else {
                        cb({err:true, msg:"用户不存在"});
                    }
                });
        } else {
            cb(null, user);
        }
    };

    var checkCard = function(user, cb){
        if (args.costNum > user.roomCard) {
            cb({err:true, msg:"钻石不足!"});
        } else {
            cb(null, user);
        }
    }

    var costCard = function(user, cb){
        user.roomCard -= args.costNum;
        user.costRoomCard += args.costNum;
        var UserInfo = self.app.get('models').UserInfo;
        UserInfo.update({roomCard:user.roomCard, costRoomCard:user.costRoomCard}, {where:{uid: args.uid}})
            .then(function (count) {
                if (count == 1) {
                    if(args.type == "charge"){
                        log.insert({cmd:"chargeRoomCard", costNum: args.costNum, leftNum: user.roomCard, uid: args.uid});
                    } else {
                        log.insert({cmd:"costRoomCard", costNum: args.costNum, leftNum: user.roomCard, uid: args.uid});
                    }
                    pomelo.app.rpc.websvr.webRemote.costNotify(user.uid, {nickname:user.nickName, gameId:user.gameId, cards:args.costNum}, function(){});
                    pomelo.app.get('channelService').pushMessageByUids("OnUserUpdate", {
                        uid: args.uid,
                        roomCard: user.roomCard
                    }, [{
                        uid: args.uid,
                        sid: user.sid
                    }]);
                    self.refreshUserAddData({uid: args.uid},
                        [{key: "costRoomCard", deltaValue: args.costNum}], function () {
                        });

                    // 去掉冻结房卡
                    if (args.isReplace) {
                        console.log("------------->>>costRoomCard frozenRoomCard", user.frozenRoomCard, args.costNum);
                        user.frozenRoomCard -= args.costNum;
                        if (user.frozenRoomCard < 0) {
                            console.log("---------->>>user.frozenRoomCard ERROR");
                        }
                    }
                    cb();
                }
                else {
                    user.roomCard += args.costNum;
                    user.costRoomCard -= args.costNum;
                    cb({err:true, msg:"用户不存在!"});
                }
            });
    };

    async.waterfall([checkUser,checkCard,costCard],function (err) {
        if(!err){
            utils.invokeCallback(callback, false, "ok");
        } else {
            utils.invokeCallback(callback, err);
        }
    });
};

var errCode = {
    DataBase_Err: 1,
    Account_Not_Exit: 2,
    Order_Repeat: 3,
    Game_Server_Err: 4
};

var saveOrder = function (app, orderId, uid, cardNum, proxyId, gameId, callback) {
    var ProxyAddLog = app.get('models').ProxyAddLog;
    // 判断单号
    ProxyAddLog.create({orderId:orderId,uid:uid,cardNum:cardNum,proxyId:proxyId,gameId:gameId})
        .then(function (order) {
            utils.invokeCallback(callback, false, "ok");
        });
};

remote.prototype.proxyAddRoomCard = function (args, callback) {
    var cardNum = args.cardNum;
    var orderId = args.orderId;
    var proxyId = args.proxyId;
    var gameId = args.gameId;
    var uid = args.uid;
    var self = this;

    var ProxyAddLog = this.app.get('models').ProxyAddLog;
    // 判断单号
    ProxyAddLog.findOne({where:{orderId:orderId}})
        .then(function (res) {
            if (res) {
                utils.invokeCallback(callback, {err:true, code:errCode.Order_Repeat});
            }
            else {
                self.addRoomCard({cardNum:cardNum, uid: uid}, function(err, res) {
                    if (err) {
                        utils.invokeCallback(callback, {err:true, code:errCode.Account_Not_Exit});
                    }
                    else {
                        log.insert({cmd:"proxyAddRoomCard", proxyId:proxyId, orderId:orderId, addNum:cardNum, uid:uid});
                        saveOrder(self.app, orderId, uid, cardNum, proxyId, gameId, callback);
                    }
                });
            }
        });
};

var savePromoterOrder = function (app, orderId, uid, cardNum, promoterId, gameId, callback) {
    var PromoterAddLog = app.get('models').PromoterAddLog;
    // 判断单号
    PromoterAddLog.create({orderId:orderId,uid:uid,cardNum:cardNum,promoterId:promoterId,gameId:gameId})
        .then(function (order) {
            utils.invokeCallback(callback, false, "ok");
        });
};

remote.prototype.promoterAddRoomCard = function (args, callback) {
    var cardNum = args.cardNum;
    var orderId = args.orderId;
    var promoterId = args.promoterId;
    var gameId = args.gameId;
    var uid = args.uid;
    var self = this;

    var PromoterAddLog = this.app.get('models').PromoterAddLog;
    // 判断单号
    PromoterAddLog.findOne({where:{orderId:orderId}})
        .then(function (res) {
            if (res) {
                utils.invokeCallback(callback, {err:true, code:errCode.Order_Repeat});
            }
            else {
                self.addRoomCard({cardNum:cardNum, uid: uid}, function(err, res) {
                    if (err) {
                        utils.invokeCallback(callback, {err:true, code:errCode.Account_Not_Exit});
                    }
                    else {
                        log.insert({cmd:"promoterAddRoomCard", promoterId:promoterId, orderId:orderId, addNum:cardNum, uid:uid});
                        savePromoterOrder(self.app, orderId, uid, cardNum, promoterId, gameId, callback);
                    }
                });
            }
        });
};


var saveAppStoreOrder = function (app, orderId, uid, cardNum, gameId, callback) {
    var AppStoreAddLog = app.get('models').AppStoreAddLog;
    // 判断单号
    AppStoreAddLog.create({orderId:orderId,uid:uid,cardNum:cardNum,gameId:gameId})
        .then(function (order) {
            utils.invokeCallback(callback, false, "ok");
        });
};

remote.prototype.appStoreAddRoomCard = function (args, callback) {
    var cardNum = args.cardNum;
    var orderId = args.orderId;
    var gameId = args.gameId;
    var productID = args.productID;
    var uid = args.uid;
    var self = this;

    var AppStoreAddLog = this.app.get('models').AppStoreAddLog;
    // 判断单号
    AppStoreAddLog.findOne({where:{orderId:orderId}})
        .then(function (res) {
            if (res) {
                utils.invokeCallback(callback, {err:true, code:errCode.Order_Repeat});
            }
            else {
                self.addRoomCard({cardNum:cardNum, uid: uid}, function(err, res) {
                    if (err) {
                        utils.invokeCallback(callback, {err:true, code:errCode.Account_Not_Exit});
                    }
                    else {
                        log.insert({cmd:"appStoreAddRoomCard", orderId:orderId, addNum:cardNum, uid:uid});
                        saveAppStoreOrder(self.app, orderId, uid, cardNum, gameId, callback);

                        var keys = {
                            "ID_IAP_CARD_1":"appleRecharge1Count",
                            "ID_IAP_CARD_2":"appleRecharge2Count",
                            "ID_IAP_CARD_3":"appleRecharge3Count"
                        };
                        if (keys[productID]) {
                            self.refreshUserDailyData({uid:uid}, [{key:keys[productID], deltaValue:1}], function() {

                            });
                        }
                    }
                });
            }
        });
};

remote.prototype.addRoomCard = function (args, callback) {
    var cardNum = args.cardNum;
    var self = this;
    var uid = args.uid;

    var UserInfo = self.app.get('models').UserInfo;
    UserInfo.findOne({where:{uid: uid}})
        .then(function (user) {
            if (user) {
                user.roomCard += args.cardNum;
                user.save({fileds: ['roomCard']})
                    .then(function () {
                        if (self.users[uid]) {
                            self.users[uid].roomCard += cardNum;
                            if (self.users[uid].isonline) {
                                pomelo.app.get('channelService').pushMessageByUids("OnUserUpdate", {
                                    uid: uid,
                                    roomCard: self.users[uid].roomCard
                                }, [{
                                    uid: uid,
                                    sid: self.users[uid].sid
                                }]);
                            }
                        }
                        log.insert({cmd:"addRoomCard", cardNum:cardNum, uid: args.uid});
                        utils.invokeCallback(callback, false, "ok");
                    });
            }
            else {
                utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
            }
        });
};

remote.prototype.getMyUserInfo = function (args, callback) {
    var self = this;

    pomelo.app.rpc.matchsvr.matchRemote.getMatcherStatus(null,{uid:args.uid},function(err,matchStatus){
        if(matchStatus == 1 && ! args.isNeedUserInfo){//apply not start game
            return callback(null,{gameType:Date.now(),deskName:Date.now()})
        }

        if (self.users[args.uid]) {
            var user = {};
            if (args.keys) {
                for (var i = 0; i < args.keys.length; i++) {
                    user[args.keys[i]] = self.users[args.uid][args.keys[i]];
                }
            }
            else {
                user = new User(self.users[args.uid]);
                user.sid = self.users[args.uid].sid;
                user.gameType = self.users[args.uid].gameType;
                user.deskName = self.users[args.uid].deskName;
            }
    
            var gameType = args.gameType;
            if (self.gameList[gameType]) {
                if (self.dataModels[gameType]) {
                    if (!self.users[args.uid][gameType]) {
                        self.app.get('models')[self.dataModels[gameType].model].findOrCreate({where: {uid: args.uid}})
                            .then(function (res) {
                                self.users[args.uid][gameType] = new self.dataModels[gameType].data(res[0]);
                                user.userData = new self.dataModels[gameType].data(res[0]);
                                utils.invokeCallback(callback, false, user);
                            });
                    }
                    else {
                        user.userData = new self.dataModels[gameType].data(self.users[args.uid][gameType]);
                        utils.invokeCallback(callback, false, user);
                    }
                }
                else {
                    utils.invokeCallback(callback, false, user);
                }
            }
            else {
                //大厅里
                utils.invokeCallback(callback, false, user);
            }
        }
        else {
            utils.invokeCallback(callback, {err:true, msg:"未知错误!"});
        }
    })
};

remote.prototype.leaveGame = function (args, callback) {
    var user = this.users[args.uid];
    if (user) {
        if (args.gameType == user.gameType && args.deskName == user.deskName) {
            delete user.gameType;
            delete user.deskName;
        }
    }
    console.log("-------------------------------->>>>player leave game", args.uid);
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.newGamePlayer = function (uid, callback) {
    if (this.users[uid]) {
        if (this.users[uid].isNewUser) {
            utils.invokeCallback(callback, {err:true});
        }
        else {
            this.users[uid].isNewUser = 1;
            var self = this;
            var UserInfo = null;
            if(isRobot(uid)){
                UserInfo = self.app.get('models').RobotInfo;
            }else{
                UserInfo = self.app.get('models').UserInfo;
            }

            UserInfo.update({isNewUser:1}, {where:{uid: uid}})
                .then(function (count) {
                    if (count == 1) {
                        utils.invokeCallback(callback, false, "ok");
                    }
                    else {
                        self.users[uid].isNewUser = 0;
                        utils.invokeCallback(callback, {err: true});
                    }
                });
        }
    }
    else {
        utils.invokeCallback(callback, {err:true});
    }
};

remote.prototype.costCoin = function (args, callback) {
    var user = this.users[args.uid];
    if (undefined == args.deltaCoin || args.deltaCoin > 0) {
        utils.invokeCallback(callback, {err:true, msg:"消耗金币数量错误!"});
        return;
    }
    if (args.deltaCoin + user.coin < 0) {
        utils.invokeCallback(callback, {err:true, msg:"金币不足!"});
        return;
    }
    if (!args.bTest) {
        user.coin += args.deltaCoin;
        var UserInfo = null;
        if(isRobot(args.uid)){
            UserInfo = this.app.get('models').RobotInfo
        }else{
            UserInfo = this.app.get('models').UserInfo
        }
        UserInfo.update({coin:user.coin}, {where:{uid: args.uid}})
            .then(function (count) {
                if (count == 1) {
                    log.insert({cmd:"costCoin", deltaCoin: args.deltaCoin, now: user.coin, uid: args.uid});
                    pomelo.app.get('channelService').pushMessageByUids("OnUserUpdate", {
                        uid: args.uid,
                        coin: user.coin
                    }, [{
                        uid: args.uid,
                        sid: user.sid
                    }]);
                    utils.invokeCallback(callback, false, {coin:user.coin});
                }
                else {
                    user.coin -= args.deltaCoin;
                    utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
                }
            });
    }
    else {
        utils.invokeCallback(callback, false, {coin:user.coin});
    }
};

remote.prototype.addCoin = function (args, callback) {
    var user = this.users[args.uid];
    if (undefined == args.deltaCoin || args.deltaCoin < 0) {
        utils.invokeCallback(callback, {err:true, msg:"添加金币数量错误!"});
        return;
    }
    var UserInfo = null;
    if(isRobot(args.uid)){
        UserInfo = this.app.get('models').RobotInfo
    }else{
        UserInfo = this.app.get('models').UserInfo
    }

    UserInfo.update({coin:user.coin + args.deltaCoin}, {where:{uid: args.uid}})
        .then(function (count) {
            if (count == 1) {
                user.coin += args.deltaCoin;
                log.insert({cmd:"addCoin", deltaCoin: args.deltaCoin, now: user.coin, uid: args.uid});
                if (user.isonline) {
                    pomelo.app.get('channelService').pushMessageByUids("OnUserUpdate", {
                        uid: args.uid,
                        coin: user.coin
                    }, [{
                        uid: args.uid,
                        sid: user.sid
                    }]);
                }
                utils.invokeCallback(callback, false, {coin:user.coin});
            }
            else {
                utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
            }
        });
};

remote.prototype.costCoupon = function (args, callback) {
    var user = this.users[args.uid];
    if (undefined == args.deltaCoupon || args.deltaCoupon > 0) {
        utils.invokeCallback(callback, {err:true, msg:"消耗礼券数量错误!"});
        return;
    }
    if (args.deltaCoupon + user.coupon < 0) {
        utils.invokeCallback(callback, {err:true, msg:"礼券不足!"});
        return;
    }

    user.coupon += args.deltaCoupon;
    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.update({coupon:user.coupon}, {where:{uid: args.uid}})
        .then(function (count) {
            if (count == 1) {
                log.insert({cmd:"costCoupon", deltaCoupon: args.deltaCoupon, now: user.coupon, uid: args.uid});
                pomelo.app.get('channelService').pushMessageByUids("OnUserUpdate", {
                    uid: args.uid,
                    coupon: user.coupon
                }, [{
                    uid: args.uid,
                    sid: user.sid
                }]);
                utils.invokeCallback(callback, false, {coupon:user.coupon});
            }
            else {
                user.coupon -= args.deltaCoupon;
                utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
            }
        });
};

remote.prototype.addCoupon = function (args, callback) {
    var user = this.users[args.uid];
    if (undefined == args.deltaCoupon || args.deltaCoupon < 0) {
        utils.invokeCallback(callback, {err:true, msg:"添加礼券数量错误!"});
        return;
    }
    var UserInfo = this.app.get('models').UserInfo;

    UserInfo.update({coupon:user.coupon + args.deltaCoupon}, {where:{uid: args.uid}})
        .then(function (count) {
            if (count == 1) {
                user.coupon += args.deltaCoupon;
                log.insert({cmd:"addCoupon", deltaCoupon: args.deltaCoupon, now: user.coupon, uid: args.uid});
                if (user.isonline) {
                    pomelo.app.get('channelService').pushMessageByUids("OnUserUpdate", {
                        uid: args.uid,
                        coupon: user.coupon
                    }, [{
                        uid: args.uid,
                        sid: user.sid
                    }]);
                }
                utils.invokeCallback(callback, false, {uid:user.uid,coupon:user.coupon});
            }
            else {
                utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
            }
        });
};

remote.prototype.getUserAttr = function (args, callback) {
    var uid = args.uid;
    var self = this;
    var res = {uid: uid};
    async.waterfall([
        function (cb) {
            if (self.users[uid]) {
                cb();
            }
            else {
                var UserInfo = null;
                if(isRobot(uid)){
                    UserInfo = self.app.get('models').RobotInfo
                }else{
                    UserInfo = self.app.get('models').UserInfo
                }
                UserInfo.findOne({where:{uid:uid}})
                    .then(function(user) {
                        if (user) {
                            self.users[uid] = new User(user);
                            cb();
                        }
                        else {
                            cb({err:true, msg:"用户不存在"});
                        }
                    });
            }
        },
        function (cb) {
            for (var i = 0; i < args.keys.length; i++) {
                res[args.keys[i]] = self.users[uid][args.keys[i]];
            }
            cb();
        }
    ], function(err, r) {
        if (err) {
            utils.invokeCallback(callback, err);
            return;
        }
        utils.invokeCallback(callback, false, res);
    });
};
remote.prototype.getFreeCoin = function (args, callback) {
    var self = this;
    var dailyInfo;
    async.waterfall([function (cb) {
            dailyInfo = self.users[args.uid].dailyData;
            if (dailyInfo.freeCoinCount >= 3) {
                cb({err:true, msg:"领取的低保次数已达上限，请明天再来!"});
            }
            else if (self.users[args.uid].coin >= 1000) {
                cb({err:true, msg:"您的金币大于1000，不用领取低保!"});
            }
            else {
                dailyInfo.freeCoinCount += 1;
                cb();
            }
        },
        function (cb) {
            self.refreshUserDailyData({uid:args.uid}, [{key:'freeCoinCount', value:dailyInfo.freeCoinCount}], cb);
        },
        function (res, cb) {
            self.addCoin({uid:args.uid, deltaCoin:3000}, cb);
        }
    ],
    function(err, res) {
        if (err) {
            utils.invokeCallback(callback, err);
            return;
        }
        utils.invokeCallback(callback, null, {msg:"您已成功领取低保3000金币，今天还可以领取" + (3-dailyInfo.freeCoinCount) + "次!"});
    });
};

remote.prototype.quitGame = function (args, callback) {
    var user = this.users[args.uid];
    if (user) {
        if (user.gameType) {
            delete user.gameType;
        }
        if (user.deskName) {
            delete user.deskName;
        }
    }
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.bindWeiXin = function (args, callback) {
    if (!args.account || args.account.length == 0) {
        return utils.invokeCallback(callback, {err:true, msg:"参数错误!"});
    }
    var user = this.users[args.uid];
    if (!user) {
        return utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
    if (user.account.length != 0) {
        return utils.invokeCallback(callback, {err:true, msg:"该帐号已经绑定微信号!"});
    }
    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{account:args.account}}).then(function(u) {
        if (u) {
            if (u.phoneNum.length == 0) {
                return utils.invokeCallback(callback, {err:true, msg:"该微信已经注册!"});
            }
            else {
                return utils.invokeCallback(callback, {err:true, msg:"该微信已经绑定其他手机号!"});
            }
        }
        else {
            user.account = args.account;
            UserInfo.update({account:args.account}, {where:{uid:user.uid}}).then(function (count) {
                if (count == 1) {
                    return utils.invokeCallback(callback, false, "ok");
                }
                else {
                    user.account = "";
                    return utils.invokeCallback(callback, {err:true, msg:"绑定失败!"});
                }
            })
        }
    });
};

remote.prototype.bindPhoneNum = function (args, callback) {
    if (!args.phoneNum || args.phoneNum.length == 0) {
        return utils.invokeCallback(callback, {err:true, msg:"参数错误!"});
    }
    var reg= /^0?(13\d|14[5,7]|15[0-3,5-9]|17[0135678]|18\d)\d{8}$/;
    var f = reg.test(args.phoneNum);
    if(!f){
        return utils.invokeCallback(callback, {err:true, msg:"手机号错误!"});
    }
    var user = this.users[args.uid];
    if (!user) {
        return utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
    if (user.phoneNum.length != 0) {
        return utils.invokeCallback(callback, {err:true, msg:"该帐号已经绑定手机!"});
    }
    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{phoneNum:args.phoneNum}}).then(function(u) {
        if (u) {
            if (u.account.length == 0) {
                return utils.invokeCallback(callback, {err:true, msg:"该手机号已经注册!"});
            }
            else {
                return utils.invokeCallback(callback, {err:true, msg:"该手机号已经绑定其他微信!"});
            }
        }
        else {
            user.phoneNum = args.phoneNum;
            UserInfo.update({phoneNum:args.phoneNum}, {where:{uid:user.uid}}).then(function (count) {
                if (count == 1) {
                    return utils.invokeCallback(callback, false, "ok");
                }
                else {
                    user.phoneNum = "";
                    return utils.invokeCallback(callback, {err:true, msg:"绑定失败!"});
                }
            })
        }
    });
};

remote.prototype.refreshGPSInfo = function (args, callback) {
    var user = this.users[args.uid];
    if (!user) {
        return utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
    else {
        user.GPSInfo = args.GPSInfo;
        utils.invokeCallback(callback, null, "ok");
    }
};

remote.prototype.gmModifyUserInfo = function (args, callback) {
    var uid = args.uid;

    var change = {};
    change[args.key] = args.value;

    var self = this;

    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.update(change, {where:{uid: uid}})
        .then(function (count) {
            if (count == 1) {
                if (self.users[args.uid]) {
                    self.users[args.uid][args.key] = args.value;
                }
                utils.invokeCallback(callback, false, "ok");
            }
            else {
                utils.invokeCallback(callback, {err: true, msg: "用户不存在!"});
            }
        });
};

remote.prototype.addReplaceRoom = function (args, callback) {
    var uid = args.uid;
    var user = this.users[uid];
    if (!user) {
       return utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
    if (!this.replaceRoom[uid]) {
        this.replaceRoom[uid] = [];
    }
    if (args.costNum + user.frozenRoomCard > user.roomCard) {
        return utils.invokeCallback(callback, {err:true, msg:"您的钻石数量不足!"});
    }
    if (this.replaceRoom[uid].length >= 5) {
        return utils.invokeCallback(callback, {err:true, msg:"您的代开房间不能同时超过5个!"});
    }
    console.log("------------->>>addReplaceRoom frozenRoomCard", user.frozenRoomCard, args.costNum);
    user.frozenRoomCard += args.costNum;
    this.replaceRoom[uid].push(args);
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.queryReplaceRoomList = function (args, callback) {
    var uid = args.uid;
    if (!this.replaceRoom[uid]) {
        this.replaceRoom[uid] = [];
    }
    utils.invokeCallback(callback, false, this.replaceRoom[uid]);
};

remote.prototype.recycleReplaceRoom = function (args, callback) {
    var uid = args.uid;
    var roomList = this.replaceRoom[uid];
    var user = this.users[uid];
    if (!roomList || !user) {
        return utils.invokeCallback(callback, {err:true, msg:"用户不存在!"});
    }
    for (var i = 0; i < roomList.length; i++) {
        var roomInfo = roomList[i];
        if (roomInfo.deskName == args.deskName) {
            // 解除冻结钻石
            if (args.isDissolution) {
                console.log("------------->>>recycleReplaceRoom frozenRoomCard", user.frozenRoomCard, roomInfo);
                user.frozenRoomCard -= roomInfo.costNum;
                if (user.frozenRoomCard < 0) {
                    console.log("---recycleReplaceRoom, ERROR");
                }
            }
            console.log("------------->>>recycleReplaceRoom", args.deskName, "frozenRoomCard", user.frozenRoomCard);
            roomList.splice(i, 1);
            return utils.invokeCallback(callback, false, "ok");
        }
    }
    return utils.invokeCallback(callback, {err:true, msg:"房间不存在!"});
};

remote.prototype.clearUserTotalScore = function(args, callback) {
    for (var u in this.users) {
        var user = this.users[u];
        for (var j = 0; j < args.games.length; j++) {
            var game = args.games[j];
            if (user[game]) {
                user[game].totalScore = 0;
            }
        }
    }
    utils.invokeCallback(callback, null, 'ok');
};

remote.prototype.switchCompetition = function(args, callback) {
    this.competitionSwitch = args.switch||false;
    console.log("switch", this.competitionSwitch);
    utils.invokeCallback(callback, null, 'ok');
};

//freeze user coin
remote.prototype.freezeCoin = function(args,callback){
    var uid = args.uid
    var freezeCoin = args.freezeCoin;

    var user = this.users[uid];

    if(freezeCoin < 0){
        // utils.invokeCallback(callback,{err:true,msg:"冻结的金币不能为负"});
        callback(new Error("冻结的金币不能为负"));
        return;
    }

    if(user.freezeCoin != 0){
        // utils.invokeCallback(callback,{err:true,msg:"玩家已冻结金币，不能重复冻结"});
        callback(new Error("玩家已冻结金币，不能重复冻结"));
        return;
    }

    if(user.coin - freezeCoin < 0){
        // utils.invokeCallback(callback,{err:true,msg:"冻结金币不能大于玩家金币"});
        callback(new Error("冻结金币不能大于玩家金币"));
        return;
    }

    console.log("3.freeze user:",uid,"--->>>coin:",args.freezeCoin);
    user.freezeCoin = args.freezeCoin;
    user.coin -= freezeCoin;
    // utils.invokeCallback(callback,{err:false});
    callback(null);
}

remote.prototype.freezeAllCoin = function(args,callback){
    var uid = args.uid
    var user = this.users[uid];

    if(user.freezeCoin != 0){
        callback(new Error("玩家已冻结金币，不能重复冻结"));
        return;
    }

    console.log("1.freeze user:",uid,"--->>>coin:",user.coin);
    user.freezeCoin = user.coin;
    user.coin = 0;
    
    callback(null);
}

remote.prototype.unfreezeCoin = function(args,callback){
    var uid = args.uid;
    var user = this.users[uid];
    console.log("2.unfreeze user:",uid,"--->>>coin:",user.freezeCoin);
    user.coin += user.freezeCoin;
    user.freezeCoin = 0;
    callback(null);
}

//玩家游戏数据
remote.prototype.setGameData = function(args,callback){
    var response = args.response;
    var redisClient = this.app.get("redisClient");
    var funcs = []
    for(var key in response){
        var makeFunc = function(key){
            var func = function(cb){
                redisClient.set("Game:"+key,JSON.stringify(response[key]),function(err,replay){
                    if(!! err) {
                       return cb(err)
                    };
                    cb(null);
                })
            }
            return func;
        }
        funcs.push(makeFunc(key));
    }

    async.parallel(funcs,function(err,results){
        if(!! err){
            return callback(err);
        }
        callback(null,"ok");
    })
}

remote.prototype.getGameData = function(args,callback){
    var uids = args.uids;
    var redisClient = this.app.get("redisClient");

    var funcs = [];
    var response = {};
    uids.forEach(function(uid){
        var func = function(cb){
            redisClient.get("Game:"+uid,function(err,replay){
                if(!! err){
                    return cb(err);
                }
                response[uid] = !! replay ? replay : "{}"
                cb(null)
            })
        }
        funcs.push(func);
    });

    async.parallel(funcs,function(err,results){
        if(!! err){
            console.log("getGameData err message:",err.message);
            callback(err);
            return;
        }
        callback(null,response);
    })
}