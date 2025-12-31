/**
 * Created by Administrator on 2016/10/11.
 */
var pomelo = require('pomelo');
var paySign = require("../../../util/paySign");
var log = pomelo.app.get('mongodb');

var payKey = "8a283ac2326611e8b4670ed5f89f718b";

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
    pomelo.app.rpc.proxysvr.proxyRemote.addCard(session, msg, function(err, res) {
        if (err) {
            next(null, {result:"error", code: err.code});
        }
        else {
            next(null, {result:"ok",msg:msg});
        }
    });
};

handler.sendCard = function(msg, session, next){
    var gameId = msg.gameId;
    var cardNum = parseInt(msg.cardNum);
    var ckmsg = {
        cardNum:msg.cardNum,
        gameId:gameId
    };
    var sign = paySign.sign(ckmsg, payKey);
    if(msg.sign != sign){
        return next(null, {err:true, msg:"签名不对！"});
    }
    console.log("==>",ckmsg);
    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{gameId:gameId}})
        .then(function (res) {
            if (res) {
                // args.uid = res.uid;
                // self.addRoomCard({cardNum:cardNum, uid: uid}, function(err, res) {
                pomelo.app.rpc.usersvr.userRemote.addRoomCard(res.uid, {uid:res.uid, cardNum:cardNum}, function(err, r) {
                    if (err) {
                        next(null, {err:true, code: err.code});
                    }
                    else {
                        log.insert({cmd:"sendRoomCard", addNum:cardNum, uid:res.uid});
                        next(null, "ok");
                    }
                });
            }
            else {
                next(null, {err:true, code:errCode.Account_Not_Exit});
            }
        });
}

handler.exists = function(msg, session, next) {
    var gameId = msg.gameId;

    var UserInfo = this.app.get('models').UserInfo;
    UserInfo.findOne({where:{gameId:gameId}})
        .then(function (res) {
            if (res) {
                next(null, {result:"ok", nickName: res.nickName, roomCard:res.roomCard});
            }
            else {
                next(null, {result:"error", code:errCode.Account_Not_Exit});
            }
        });
};

handler.existsClub = function(msg, session, next) {
    var tel = msg.tel;

    var Club = this.app.get('models').Club;
    Club.findOne({where:{tel:tel}})
        .then(function (res) {
            if (!!res) {
                next(null, {code:200,
                    clubId:res.clubId,
                    clubName:res.clubName,
                    roomCard:res.roomCard,
                    createTime:res.createTime
                });
            }
            else {
                next(null, {code:errCode.Account_Not_Exit, msg:"亲友圈不存在"});
            }
        });
};

handler.chargeClub = function(msg, session, next){
    pomelo.app.rpc.clubsvr.clubRemote.addRoomCard(session,msg,function(err,res){
        next(null,res);
    })
}