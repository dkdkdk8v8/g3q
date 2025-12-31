/**
 * Created by Administrator on 2016/10/11.
 */
var pomelo = require('pomelo');

module.exports = function(app) {
    return new Handler(app);
};

var errCode = {
    DataBase_Err: 1,
    Account_Not_Exit: 2,
    Order_Repeat: 3,
    Game_Server_Err: 4
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

handler.addCard = function(msg, session, next) {

    var gameId = msg.gameId;

    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{gameId:gameId}})
        .then(function (res) {
            if (res) {
                res.uid = msg.uid;
                pomelo.app.rpc.usersvr.userRemote.proxyAddRoomCard(res.uid, msg, function(err, r) {
                    if (err) {
                        next(null, {result:"error", code: err.code});
                    }
                    else {
                        next(null, {result:"ok"});
                    }
                });
            }
            else {
                next(null, {result:"error", code:errCode.Account_Not_Exit});
            }
        });
};

handler.exists = function(msg, session, next) {
    var gameId = msg.gameId;
    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{gameId:gameId}})
        .then(function (res) {
            if (res) {
                next(null, {result:"ok", nickName: res.nickName});
            }
            else {
                next(null, {result:"error", code:errCode.Account_Not_Exit});
            }
        });
};
