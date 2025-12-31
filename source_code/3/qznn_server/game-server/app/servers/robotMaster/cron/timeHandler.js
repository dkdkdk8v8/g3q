/**
 * Created by mofanjun on 2017/11/9.
 */
var pomelo = require('pomelo');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {

};

handle = Handler.prototype;

handle.updateRobotLuckChance = function(){
    pomelo.app.rpc.robotMaster.masterRemote.updateLuckChance(null,{},function(){});
}
