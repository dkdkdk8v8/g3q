/**
 * Created by Administrator on 2016/10/11.
 */
var pomelo = require('pomelo');
var utils = require("../../../util/utils");

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
};

var errCode = {
    DataBase_Err: 1,
    Account_Not_Exit: 2,
    Order_Repeat: 3,
    Game_Server_Err: 4
};

remote.prototype.addCard = function(args, callback) {
    var gameId = args.gameId;

    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{gameId:gameId}})
        .then(function (res) {
            if (res) {
                args.uid = res.uid;
                pomelo.app.rpc.usersvr.userRemote.proxyAddRoomCard(res.uid, args, function(err, r) {
                    if (err) {
                        utils.invokeCallback(callback, {err:true, code: err.code});
                    }
                    else {
                        utils.invokeCallback(callback, false, "ok");
                    }
                });
            }
            else {
                utils.invokeCallback(callback, {err:true, code:errCode.Account_Not_Exit});
            }
        });
};

remote.prototype.exists = function(args, callback) {
    var gameId = args.gameId;

    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{gameId:gameId}})
        .then(function (res) {
            if (res) {
                utils.invokeCallback(callback, false, "ok");
            }
            else {
                utils.invokeCallback(callback, {err:true, code:errCode.Account_Not_Exit});
            }
        });
};
