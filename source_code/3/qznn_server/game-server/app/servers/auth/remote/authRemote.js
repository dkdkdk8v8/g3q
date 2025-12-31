var tokenService = require('../../../shared/token');

var DEFAULT_SECRET = 'pomelo_session_secret';
var DEFAULT_EXPIRE = 24 * 60 * 60 * 1000;	// default session expire time: 24 hours

module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
    var session = app.get('session') || {};
    this.secret = session.secret || DEFAULT_SECRET;
    this.expire = session.expire || DEFAULT_EXPIRE;
};

var pro = Remote.prototype;

/**
 * Auth token and check whether expire.
 *
 * @param  {String}   token token string
 * @param  {Function} cb
 * @return {Void}
 */
pro.auth = function(token, cb) {
    var res = tokenService.parse(token, this.secret);
    if(!res) {
        return cb({err:true, msg: "token信息错误!"});
    }

    if(!checkExpire(res, this.expire)) {
        return cb({err:true, msg: "token过期!"});
    }
    cb(false, {uid:res.uid});
};

/**
 * Check the token whether expire.
 *
 * @param  {Object} token  token info
 * @param  {Number} expire expire time
 * @return {Boolean}        true for not expire and false for expire
 */
var checkExpire = function(token, expire) {
    if(expire < 0) {
        // negative expire means never expire
        return true;
    }

    return (Date.now() - token.timestamp) < expire;
};
