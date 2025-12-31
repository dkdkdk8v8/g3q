var dispatcher = require('../../../util/dispatcher');

/**
 * Gate handler that dispatch user to connectors.
 * @param app application context
 * @returns {Handler} request handler
 */
module.exports = function(app){
    return new Handler(app);
};

var Handler = function(app){
    this.app = app;
};

Handler.prototype.queryEntry = function(msg, session, next){
    var uid = msg.uid || Math.floor(Math.random()*1000+1000);

    // var connectors = this.app.getServersById(this.app.curServer);
    // if(!connectors || connectors.length === 0) {
    //     next(null,{code:500, msg:"服务器地址获取失败!"});
    //     return;
    // }
    // var res = dispatcher.dispatch(uid, connectors);
    next(null,{code:200, host:this.app.curServer.cHost, port:this.app.curServer.cPort});
};