/**
 * Created by Administrator on 2017/2/28.
 */
var Token = require('../../../shared/token');
var pomelo = require('pomelo');
var utils = require("../../../util/utils");
var Sequelize = require('sequelize');

var log = pomelo.app.get('mongodb');
var redisConfig = pomelo.app.get('redis');

var redis = require("redis");

var DEFAULT_SECRET = 'pomelo_session_secret';

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app){
    this.app = app;
};

var getGameId = function(cb){
    return pomelo.app.get('models').UserInfo.sequelize.transaction({
        isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, function (t) {
        return pomelo.app.get('models').GameIdSet.findOne({transaction:t}).then(function(gameIdSet) {
            if (!!gameIdSet) {
                return gameIdSet.destroy({transaction: t}).then(function (g) {
                    return gameIdSet;
                });
            } else {
                throw new Error('no game id');
            }
        });
    }).then(function (result) {
        cb(null, result.id);
    }).catch(function (ex) {
        console.log("GameIdSet:" + ex);
        cb(ex);
    });
};

var register = function(msg, callback){
    getGameId(function(err,gameId){
        if(err){
            return callback({err:true,msg:'数据库错误'});
        }
        var now = Math.round(new Date().getTime()/1000);
        var createTime = now;
        var lastLoginTime = now;
        if (msg.platformId != 3) {
            msg.nickName = msg.nickName || "游客" + Math.floor((1 + Math.random()) * 10000);
            msg.faceId = msg.faceId || 1;
        }
        else {
            msg.faceId = -1;
        }
        var o = {
            account:msg.account,
            loginPwd:msg.loginPwd,
            nickName:msg.nickName,
            faceId:msg.faceId,
            sex:msg.sex || 1,
            city:msg.city,
            province:msg.province,
            country:msg.country,
            createTime:createTime,
            lastLoginTime:lastLoginTime,
            platformId: msg.platformId,
            gameId:gameId,
            roomCard:20,
            coin:20000,
            phoneNum: msg.phoneNum,
            registerChannelID: msg.channelID,
            lastLoginIP: msg.ip || ""
        };

        return pomelo.app.get('models').UserInfo.findOrCreate({where:{account:o.account}, defaults:o}).spread(function(user, created){
            if (created) {
                log.insert({cmd: "createUser", uid: user.uid, roomCard: user.roomCard, platformId: user.platformId, channelID:msg.channelID, ip:msg.ip,coin:o.coin});
                pomelo.app.rpc.websvr.webRemote.registerNotify(user.uid, {uid:user.uid, account:user.account, gameId:user.gameId}, function(){});
            }
            console.log("------------------------------------------>>>>register", user.uid, created);
            var secret = DEFAULT_SECRET;
            return callback(null, {token: Token.create(user.uid, Date.now(), secret), uid: user.uid});
        }).catch(function(ex){
            console.log("register:"+ex);
            return callback({err:true,msg:'数据库错误!'});
        });
    });
};

var saveUser = function(u, callback){
    return u.save({attributes:['lastLoginTime', 'lastLoginPlatform', 'lastLoginIP', 'lastLoginChannelID']}).then(function(){
        log.insert({cmd:"userLogin", uid: u.uid, roomCard: u.roomCard, coin:u.coin, coupon:u.coupon, ip:u.lastLoginIP, channelID:u.lastLoginChannelID});
        var secret = DEFAULT_SECRET;
        if (u.isFrozen) {
            return callback({err:true, msg:"您的帐号已被封禁,请联系客服处理!"});
        }
        else {
            return callback(null, {token: Token.create(u.uid, Date.now(), secret), uid: u.uid});
        }
    }).catch(function(ex){
        console.log("save user err:"+ex);
        return callback({err:true,msg:'数据库错误!'});
    });
};

Handler.prototype.login = function(msg, callback){
    var account = msg.account;
    var loginPwd = msg.loginPwd;
    var platformId = msg.platformId;
    var phoneNum = msg.phoneNum;
    var identifyingCode = msg.identifyingCode;

    if(!account && !phoneNum){
        return callback({err:true, msg:'帐号为空!'});
    }
    // 微信安卓 : 4   微信苹果 :5
    if (platformId == 4 || platformId == 5) {
        msg.nickName = utils.formatUTF8Str(msg.nickname);
        msg.faceId = msg.headimgurl;
    }

    // H5 : 2
    if(platformId == 2){
        if (!this.client) {
            this.client = redis.createClient({
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                db: redisConfig.db
            });
        }
        var uinkey = "wxUin:"+account;
        return this.client.get(uinkey, function(err, reply) {
            if (err) {
                console.log("uinkey err:" + err);
                return callback({err:true, msg: 'redis错误!'});
            }
            var o = JSON.parse(reply);
            if (!!o &&　o.openid) {
                if (!o.unionid || o.unionid == "") {
                    o.unionid = o.openid;
                }
                o.account = o.unionid;
                o.nickName = utils.formatUTF8Str(o.nickname);
                o.faceId = o.headimgurl;
                o.platformId = platformId;
            }
            else {
                return callback({err:true, msg: '帐号不存在!'});
            }
            pomelo.app.get('models').UserInfo.findOne({where: {account: o.account}}).then(function (u) {
                if (!u) {
                    if (platformId != 1) {
                        return register(o, callback);//注册新用户
                    }
                    else {
                        return callback({err:true, msg: '帐号不存在!'});
                    }
                }
                if (platformId == 3 && u.loginPwd != loginPwd) {
                    return callback({err:true, msg: '密码错误'});
                }
                u.lastLoginTime = Math.round(new Date().getTime() / 1000);//更新日期
                u.nickName = o.nickName;
                u.faceId = o.faceId;
                u.lastLoginPlatform = msg.platformId;
                u.lastLoginIP = msg.ip;
                u.lastLoginChannelID = msg.channelID || "";

                saveUser(u, callback);
            });
        });
    }
    // 手机号登录
    else if (platformId == 6) {
        var reg= /^0?(13\d|14[5,7]|15[0-3,5-9]|17[0135678]|18\d)\d{8}$/;
        var f = reg.test(phoneNum);
        if(!f){
            return callback({err:true, msg:"手机号错误!"});
        }
        var reg2 = /^\d{6}$/;
        f = reg2.test(identifyingCode);
        if (!f) {
            return callback({err:true, msg:"验证码错误!"});
        }
        if (!this.client) {
            this.client = redis.createClient({
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                db: redisConfig.db
            });
        }
        var uinkey = "tel:" + phoneNum;
        return this.client.get(uinkey, function(err, reply) {
            if (err) {
                console.log("uinkey err:" + err);
                return callback({err:true, msg: 'redis错误!'});
            }
            var code = reply;
            if (!code || identifyingCode != code) {
                return callback({err:true, msg: "验证码错误!"});
            }
            pomelo.app.get('models').UserInfo.findOne({where: {phoneNum: phoneNum}}).then(function (u) {
                if (!u) {
                    // return register(msg, callback);//注册新用户
                    return callback({err:true, msg: "手机号码未注册!"});
                }
                u.lastLoginTime = Math.round(new Date().getTime() / 1000);//更新日期
                u.lastLoginPlatform = msg.platformId;
                u.lastLoginIP = msg.ip;
                u.lastLoginChannelID = msg.channelID || "";

                saveUser(u, callback);
            });
        });
    }
    else {
        pomelo.app.get('models').UserInfo.findOne({where: {account: account}}).then(function (u) {
            if (!u) {
                if (platformId) {
                    return register(msg, callback);//注册新用户
                }
                else {
                    return callback({err:true, msg: '帐号不存在!'});
                }
            }
            if (platformId == 3 && u.loginPwd != loginPwd) {
                return callback({err:true, msg: '密码错误'});
            }

            u.lastLoginTime = Math.round(new Date().getTime() / 1000);//更新日期
            if (msg.nickName) {
                u.nickName = utils.formatUTF8Str(msg.nickName);
            }
            if (msg.faceId) {
                u.faceId = msg.faceId;
            }
            u.lastLoginPlatform = msg.platformId;
            u.lastLoginIP = msg.ip;
            u.lastLoginChannelID = msg.channelID || "";

            saveUser(u, callback);
        });
    }
};

Handler.prototype.registerNewUser = function(msg, callback){
    var account = msg.account;
    var platformId = msg.platformId;

    if(!account){
        return callback({err:true,msg:'帐号为空'})
    }
    if(platformId == 3){
        register(msg, callback);//注册新用户
    }
    else {
        callback({err:true, msg: '平台错误!'});
    }
};

Handler.prototype.modifyUserInfo = function (msg, callback) {
    var attrs = msg.attrs;
    var uid = msg.uid;

    var keys = {sign:1,sex:1,faceId:1,nickName:1};

    var data = {};
    for (var i = 0; i < attrs.length; i++) {
        if (!keys[attrs[i].key]) {
            callback({err: true, msg: "非法操作!"});
        }
        data[attrs[i].key] = attrs[i].value;
    }

    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.update(data, {where:{uid: uid}})
        .then(function (count) {
            if (count == 1) {
                callback(null, "ok");
            }
            else {
                callback({err: true, msg: "用户不存在!"});
            }
        });
};