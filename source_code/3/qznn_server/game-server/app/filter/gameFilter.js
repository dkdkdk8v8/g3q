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
    var uid = session.uid;
    if (uid != undefined) {
        msg.uid = session.uid;
        next();
    }
    else {
        next(new Error("uid not exists!"));
    }
};

Filter.prototype.after = function (err, msg, session, resp, next) {
    next();
};