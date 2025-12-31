var async = require('async');
var pomelo = require("pomelo");
var log = pomelo.app.get('mongodb');
var utils = require("../../../util/utils");

var newVersion = "1.0.0";

module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app) {
  this.app = app;
};

var onUserLeave = function (app, session, reason) {
	if(!session || !session.uid) {
		return;
	}

	pomelo.app.rpc.chatsvr.chatRemote.leaveWorldChannel(session, session.uid, session.frontendId, function(){});

	app.rpc.usersvr.userRemote.offline(session, {uid:session.uid}, function(err, info) {
		if (info) {
            console.log("------------------->>onUserLeave", info);
			var gameType = info.gameType;
			var deskName = info.deskName;
			if (gameType && deskName) {
				if (pomelo.app.rpc[gameType]) {
					session.set("deskName", deskName);
					pomelo.app.rpc[gameType].gameRemote.playerOffline(session, {
						id: session.id,
						uid: session.uid,
						deskName: deskName
					}, function () {
					});
				}
			}
		}
	});
};
/**
 * New client entry.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.enter = function(msg, session, next) {
    var token = msg.token, self = this, version = msg.version;
    if(!token) {
        return next(null, {err: true, msg:"token不存在!"});
    }

    // var checkRes = utils.checkVersion(newVersion, version);
    // var resMsg;
    // if (checkRes != 0) {
    //     if (checkRes == 1) {
    //         resMsg = "当前游戏版本过低,请去应用商店更新!";
    //     }
    //     else if (checkRes == 2) {
    //         resMsg = "当前游戏版本不是最新,请更新游戏!";
    //     }
    // }

    var uid,oUser = null;
    async.waterfall([
        function(cb) {
            self.app.rpc.auth.authRemote.auth(session, token, cb);
        },
        function(data, cb) {
            uid = parseInt(data.uid);
            // 判断在线情况
            var sessionService = self.app.get('sessionService');
            //duplicate log in
            var sessions = sessionService.getByUid(uid);
            if( !! sessions) {
                var oldSession = sessions[0];
                self.app.get('channelService').pushMessageByUids("OnKickOut", {msg:"该帐号在其他地方登录!"},
                    [{uid:uid, sid:oldSession.frontendId}]
                );
                self.app.get('sessionService').kick(uid, cb);
            }
            else {
                cb();
            }
        },
        function(cb) {
            var ip = session.__session__.__socket__.remoteAddress.ip.replace("::ffff:", "");
            self.app.rpc.usersvr.userRemote.loginGetUserInfo(uid, {uid:uid, sid:session.frontendId, ip:ip}, cb);
        },
        function(user, cb) {
            oUser = user;
            session.bind(uid, cb);
            session.set('uid', uid);
        },
        function(cb) {
            session.on('closed', onUserLeave.bind(null, self.app));
            session.pushAll(cb);
        },
        function (cb) {
            var connection = pomelo.app.components.__connection__;
            if (connection) {
                connection.updateUserInfo(oUser.uid, {username:oUser.nickName});
            }
            pomelo.app.rpc.chatsvr.chatRemote.addToWorldChannel(session, session.uid, session.frontendId, cb);
        }
    ], function(err) {
        if(!!err) {
            console.log("login fail:", err);
            return next(null, {err:true, msg:"登录失败!"});
        }
        next(null, {user: oUser, version:newVersion});
    });
};

Handler.prototype.login = function(msg, session, next) {
	msg.ip = session.__session__.__socket__.remoteAddress.ip.replace("::ffff:", "");
    pomelo.app.rpc.loginsvr.loginRemote.login(session, msg, function(err, res){
		if (err) {
            next(null, err);
		}
		else {
			next(null, res);
		}
	});
};

Handler.prototype.registerNewUser = function(msg,session,next){
    pomelo.app.rpc.loginsvr.loginRemote.registerNewUser(session, msg, function(err, res){
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};

Handler.prototype.modifyUserInfo = function (msg, session, next) {
    pomelo.app.rpc.loginsvr.loginRemote.modifyUserInfo(session, msg, function(err, res){
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};
