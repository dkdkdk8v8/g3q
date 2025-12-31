/**
 * Created by kudoo on 2018/4/4.
 */
var request = require('request');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app){
    this.app = app;
};

Handler.prototype.registerNotify = function(msg, callback){
    var account = msg.account;
    var gameID = msg.gameId;
    var uid = msg.uid;
    var self = this;

    var notifyurl = "http://xqagent.wangbq.top/loginotify";
    request({
        uri : notifyurl,
        method : "POST",
        body : {
            account:account,
            gameID:gameID
        },
        json : true,
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
            var ret = body;
            if(ret.code){
                var args = {uid: uid, key: "code", value: ret.code};
                self.app.rpc.usersvr.userRemote.gmModifyUserInfo(uid, args, function(err, r) {
                    if (err) {
                        console.log("绑定邀请码失败！");
                    }
                    else {
                        console.log("绑定邀请码成功！");
                    }
                });
            }
            callback(null, body);
        } else {
            console.log("http error:",error, response.statusCode, body);
            callback({err:true, msg:"http error"});
        }
    });
};

Handler.prototype.costNotify = function(msg, callback){
    var nickname = msg.nickname;
    var gameID = msg.gameId;
    var cards = msg.cards;

    var notifyurl = "http://xqagent.wangbq.top/costnotify";
    request({
        uri : notifyurl,
        method : "POST",
        body : {
            nickname:nickname,
            gameID:gameID,
            cards:cards
        },
        json : true,
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
            callback(null, body);
        } else {
            console.log("http error:",error, response.statusCode, body);
            callback({err:true, msg:"http error"});
        }
    });
};