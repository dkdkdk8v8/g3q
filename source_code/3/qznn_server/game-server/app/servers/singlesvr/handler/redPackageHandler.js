/**
 * Created by Administrator on 2016/11/16.
 */
var pomelo = require('pomelo');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

handler.grabRedPackage = function(msg, session, next) {
    msg.uid = session.uid;
    pomelo.app.rpc.singlesvr.redPackageRemote.grabRedPackage(session, msg, function(err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};