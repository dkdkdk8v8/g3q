/**
 * Created by kudoo on 2018/5/17.
 */
var pomelo = require('pomelo');
var log = pomelo.app.get('mongodb');

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
    var account = msg.account;
    var cardNum = 5;

    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{account:account}})
        .then(function (res) {
            if (res) {
                var uid = res.uid;
                pomelo.app.rpc.usersvr.userRemote.addRoomCard(res.uid, {cardNum:cardNum, uid: uid}, function(err, r) {
                    if (err) {
                        next(null, {err:true, code: err.code});
                    }
                    else {
                        log.insert({cmd:"discountAddRoomCard", addNum:cardNum, uid:uid});
                        next(null, {result:"ok"});
                    }
                });
            }
            else {
                next(null, {result:"error", code:errCode.Account_Not_Exit});
            }
        });
};