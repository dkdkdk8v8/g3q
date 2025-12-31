var pomelo = require('pomelo');

module.exports = function(app){
    return new Handler(app);
};

var Handler = function(app){
    this.app = app;
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
            session.bind(res.uid);
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