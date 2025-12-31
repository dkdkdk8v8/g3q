/**
 * Created by Administrator on 2016/10/8.
 */
var pomelo = require('pomelo');

module.exports = function() {
    return new Filter();
};

var Filter = function() {
};

/**
 * Area filter
 */
Filter.prototype.before = function(msg, session, next){
    if (msg.__route__ == "loginsvr.loginHandler.registerNewUser" || msg.__route__ == "loginsvr.loginHandler.login") {
        next();
        return;
    }
    if (session.uid != undefined) {
        msg.uid = session.uid;
        next();
    }
    else {
        next(new Error("错误的请求!"));
    }
};

Filter.prototype.after = function (err, msg, session, resp, next) {
    next();
};