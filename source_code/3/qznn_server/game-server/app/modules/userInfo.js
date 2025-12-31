/**
 * Created by kudoo on 2016/11/3.
 */
var logger = require('pomelo-logger').getLogger(__filename);
var utils = require('../util/utils');

module.exports = function(opts) {
    return new Module(opts);
};

module.exports.moduleId = 'userInfo';

var Module = function(opts) {
    opts = opts || {};
    this.app = opts.app;
    this.type = opts.type || 'pull';
    this.interval = opts.interval || 5;
};

Module.prototype.monitorHandler = function(agent, msg, cb) {
    //collect data
    //var serverId = agent.id;
    if (!this.app.get('userList'))
        return;
     agent.notify(module.exports.moduleId, this.app.get('userList'));
};

Module.prototype.masterHandler = function(agent, msg, cb) {
    if(!msg) {
        // pull interval callback
        var list = agent.typeMap['usersvr'];
        if(!list || list.length === 0) {
            return;
        }
        agent.notifyByType('usersvr', module.exports.moduleId);
        return;
    }

    var data = agent.get(module.exports.moduleId);
    if(!data) {
        data = {};
        agent.set(module.exports.moduleId, data);
    } else {
        agent.set(module.exports.moduleId, msg);
    }
};

Module.prototype.clientHandler = function(agent, msg, cb) {
    utils.invokeCallback(cb, null, agent.get(module.exports.moduleId));
};