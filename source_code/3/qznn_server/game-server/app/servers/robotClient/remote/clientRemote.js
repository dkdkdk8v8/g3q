/**
 * Created by Administrator on 2016/10/11.
 */
var pomelo = require('pomelo');
var utils = require("../../../util/utils");
var vm = require('vm');
var fs = require('fs');
var script = fs.readFileSync("app/robot/common/simpleClient.js",'utf8');
var EventEmitter = require('events').EventEmitter;
var util = require("util");

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;

    this.on("updateCoin", function(data) {
        console.log("--------------->>>updateCoin", data);
        //robot#6 通知机器人金币更新
        pomelo.app.rpc.robotMaster.masterRemote.onRobotUpdateCoin(null, data, function() {

        });
    });
};

util.inherits(remote, EventEmitter);

var run = function(uid,gameType,deskName,watcher) {
    try {
        var initSandbox = {
            console:console,
            require:require,
            watcher:watcher,
            setTimeout:setTimeout,
            clearTimeout:clearTimeout,
            setInterval:setInterval,
            clearInterval:clearInterval,
            global:global,
            process:process,
            gameType:gameType,
            deskName:deskName,
            uid:uid,
            servers:pomelo.app.getServersByType("gate")
        };

        var context = vm.createContext(initSandbox);
        vm.runInContext(script,context);
    } catch(ex){
        return ex;
    }
};

remote.prototype.robotEnterGame = function(args, callback) {
    var gameType = args.gameType;
    var deskName = args.deskName;
    var uid = args.uid;
    var allowMonitorGameList = this.app.get("robotConfig")["allowMonitorGameList"];
    if(allowMonitorGameList.indexOf(gameType) == -1){
        callback(null,"错误的机器人游戏类型");
        return;
    }
    
    var err = run(uid, gameType, deskName, this);

    console.log("------------------>>>>err", err);

    this.once("recycle_"+gameType+"_"+deskName+"_"+uid, function(bsuccess) {
        // 加入失败
        if (!bsuccess) {
            pomelo.app.rpc.robotMaster.masterRemote.onPlayerExitDesk(null, args, function() {
                console.log("------------->>>", "recycle_"+gameType+"_"+deskName+"_"+uid);
            });
        }
    });

    if (!! err) {
        callback({err:true, msg:err});
    }
    else {
        callback(null, "ok");
    }

};

remote.prototype.robotExitGame = function(args, callback) {
    var gameType = args.gameType;
    var deskName = args.deskName;

    this.emit("exitGame_"+gameType+"_"+deskName+"_"+args.uid);

    callback(null, "ok");
};


