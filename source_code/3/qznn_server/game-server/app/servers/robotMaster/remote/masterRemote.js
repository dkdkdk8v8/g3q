/**
 * Created by Administrator on 2016/10/11.
 */
var crypto = require('crypto');
var pomelo = require('pomelo');
var utils = require("../../../util/utils");
var monitor = require("../../../services/robot/robotMonitor");
var connecter = pomelo.app.get('connecter');

var MAX_USER_WIN_SCORE = 1000000;
var MAX_USER_COUNT = 10;
var isRecordingCards = true;

var isRobot = function (uid) {
    var robotStartUid = 10000000;
    return uid > robotStartUid;
}

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
    this.timerList = {};
    /*
    * robotTask[gameType] = {
    *    playCount:0
    *    maxWinGold:0
    *    ...
    * }
    *
    * */
    this.robotTask = {};//限制条件
};

var intervalRandom = function (min, max) {
    var v = min*1000 + Math.floor(Math.random()*(max-min+1)*1000);
    return v;
};

remote.prototype.initRobot = function (args, callback) {
    //monitor.reset();
    //Read into memory
    var RobotInfo = pomelo.app.get('models')['RobotInfo']
    RobotInfo.findAll({attributes:['uid', 'coin']}).then(function(res) {
        for (var i = 0; i < res.length; i++) {
            monitor.addFreeRobot(res[i].uid, res[i],res[i].coin);
        }
        if (typeof callback == "function") {
            callback(null, "ok");
        }
    });
};

/*
* @brief:清理携带金币过多或过少的机器人
* */
remote.prototype.clearFreeRobot = function (args,callback) {
    var maxGold = args.maxGold;
    var minGold = args.minGold;
    var freeRobotArr = monitor.getFreeRobot();
    var copy = [];
    while (freeRobotArr.length){
        copy.push(freeRobotArr.shift());
    }
    var RobotInfo = pomelo.app.get('models')['RobotInfo']
    RobotInfo.sequelize.query('DELETE FROM robotinfo WHERE coin >= ? OR coin <= ?',
        { replacements: [maxGold,minGold], type: RobotInfo.sequelize.QueryTypes.DELETE })
        .then(function (res) {
            for(var index = 0; index < copy.length; index++){
                if(copy[index].coin >= maxGold || copy[index].coin <= minGold) {
                    copy.splice(index, 1);
                }
            }
            monitor.setFreeRobot(copy);
            callback(null,'ok');
        }).catch(function (err) {
            console.log('delete err',err);
            callback(err,null);
        })
}

/*
remote.prototype.addRobot = function (gameType, deskName) {
    // 准备投放第一个机器人
    var timeId = setTimeout(function() {
        var info = monitor.getDeskInfo(deskName);
        if (info.playerNum > 0) {
            var uid = monitor.getFreeRobotUid();
            if (uid) {
                console.log("--------------------->>>add robot", uid);
                pomelo.app.rpc.robotClient.clientRemote.robotEnterGame(uid, {uid: uid, deskName: deskName, gameType: gameType}, function () {
                });
            }
        }
    }, intervalRandom(5,10));
    this.timerList[deskName].push(timeId);
};
*/


remote.prototype.clearRobotTimer = function (deskName) {
    var timers = this.timerList[deskName];
    for (var i = 0; i < timers.length; i++) {
        clearTimeout(timers[i]);
    }
    this.timerList[deskName] = []
};

/*
* 机器人投放策略相关函数
* */
remote.prototype.canEnterDesk = function (gameType,deskName) {
    var info = monitor.getDeskInfo(deskName);
    var roomInfo = monitor.getRoomInfo(gameType,deskName);
    var maxRobot = monitor.getRoomMaxRobot(gameType,deskName);

    if(roomInfo.robotCount >= maxRobot){
        console.log("Robot Task Failed--->>>房间:",monitor.getRoomId(gameType,deskName),"机器人投放超出限制");
        return false;
    }

    if(gameType != "coinNiuNiu4" && info.isStart){
        console.log('canStartEnterTask.err---->',gameType,'游戏已经开始');
        return false;
    }

    if (info.playerNum < 0){
        console.log('canStartEnterTask.err---->桌子玩家数量为0');
        return false;
    }

    if(info.robotNum + info.playerNum > info.maxPlayer){
        console.log('canStartEnterTask.err---->座位已满:',gameInfo.maxPlayer);
        return false;
    }

    return true;
}

remote.prototype.addRobot = function (gameType, deskName){
    if (this.canEnterDesk(gameType,deskName)){
        var table = monitor.getDeskInfo(deskName);
        var uid = monitor.getFreeRobotUid(table.minCoin,table.maxCoin);
        if (uid) {
            console.log("--------------------->>>add robot", uid);
            pomelo.app.rpc.robotClient.clientRemote.robotEnterGame(uid, {uid: uid, deskName: deskName, gameType: gameType}, function () {
            });
        }
    }
}

var addRobotTask = function (gameType,deskName) {
    var info = monitor.getDeskInfo(deskName);
    var emptyPosNum = info.maxPlayer - info.playerNum - info.robotNum;
    if(emptyPosNum != 0){//在延迟后 再检测一次人数
        this.addRobot(gameType,deskName)
    } 
}

remote.prototype.canStartEnterTask = function (gameType,deskName) {
    var timeList = this.timerList[deskName];
    var info = monitor.getDeskInfo(deskName);
    console.log("timeList.length = ",timeList.length," info.playerNum = ",info.playerNum," info.isStart = ",info.isStart);
    return timeList.length == 0 && info.playerNum > 0 && ! info.isStart;
}

//入桌任务-> 机器人 轮流入桌
remote.prototype.startEnterTask = function (gameType,deskName) {
    //计算空位
    var info = monitor.getDeskInfo(deskName);
    var emptyPosNum = info.maxPlayer - info.playerNum - info.robotNum;
    var lastEnterInterval = 0;
    for(var i = 1; i <= emptyPosNum; i++){
        var randomTime = intervalRandom(2,4) + lastEnterInterval;
        var task = setTimeout(addRobotTask.bind(this),randomTime,gameType,deskName);
        this.timerList[deskName].push(task);
        lastEnterInterval = randomTime;
    }
}

//游戏事件
remote.prototype.onDeskCreate = function(args, callback) {
    monitor.addDesk(args);

    this.timerList[args.deskName] = [];

    callback(null, "ok");
};

//游戏事件
remote.prototype.onPlayerEnterDesk = function(args, callback) {
    monitor.enterGame(args.uid, args.gameType, args.deskName, args.coin);
    // 房间玩家信息
    var info = monitor.getDeskInfo(args.deskName);
    //开始投放机器人
    if(this.canStartEnterTask(args.gameType,args.deskName)){
        this.startEnterTask(args.gameType, args.deskName);
    }
    callback(null, "ok");
};

//游戏事件
remote.prototype.onPlayerExitDesk = function(args, callback) {
    monitor.leaveGame(args.uid, args.deskName);
    // 房间玩家消息
    var info = monitor.getDeskInfo(args.deskName);
    if (args.uid < 10000000) {
        this.clearRobotTimer(args.deskName);
        if (info.playerNum == 0) {
            for (var i = 0; i < info.robotUids.length; i++) {
                var uid = info.robotUids[i];
                setTimeout(function(u) {
                    pomelo.app.rpc.robotClient.clientRemote.robotExitGame(u, {uid:u, deskName:args.deskName, gameType:args.gameType}, function(){});
                }.bind(null, uid), intervalRandom(2, 3));
            }
        }else{ 
            if(this.canStartEnterTask(args.gameType,args.deskName)){
                this.startEnterTask(args.gameType, args.deskName);
            }
        }
    }
    else {
        if (info.playerNum != 0) {
            // 有人离开 重新启用定时器
            this.clearRobotTimer(args.deskName);
            if(this.canStartEnterTask(args.gameType,args.deskName)){
                this.startEnterTask(args.gameType, args.deskName);
            }
        }
    }
    callback(null, "ok");
};

remote.prototype.onGameStart = function(args, callback) {
    // 清除定时器
    this.clearRobotTimer(args.deskName);

    // 更新桌子状态
    monitor.startGame(args.deskName);
    callback(null, false);
};

remote.prototype.onGameEnd = function(args, callback) {
    monitor.endGame(args.gameType,args.deskName,args.award);
    /*
    var min = GameExitTimeout[args.gameType];

    var robots = monitor.getRoomRobot(args.deskName);
    for (var i = 0; i < robots.length; i++) {
        var v = Math.random();
        if (robots[i].playCount == 1) {
            if (v < 0.3) {
                setTimeout(function(uid) {
                    pomelo.app.rpc.robotClient.clientRemote.robotExitGame(uid, {uid:uid, deskName:args.deskName, gameType:args.gameType}, function(){});
                }.bind(null, robots[i].uid), intervalRandom(min, min + 1));
            }
        }
        else if (robots[i].playCount == 2) {
            if (v < 0.6) {
                setTimeout(function(uid) {
                    pomelo.app.rpc.robotClient.clientRemote.robotExitGame(uid, {uid:uid, deskName:args.deskName, gameType:args.gameType}, function(){});
                }.bind(null, robots[i].uid), intervalRandom(min , min + 1));
            }
        }
        else {
            if (v < 0.9) {
                setTimeout(function(uid) {
                    pomelo.app.rpc.robotClient.clientRemote.robotExitGame(uid, {uid:uid, deskName:args.deskName, gameType:args.gameType}, function(){});
                }.bind(null, robots[i].uid), intervalRandom(min , min + 1));
            }
        }
    }

    // 重新启用定时器
    //this.addRobot(args.gameType, args.deskName);
    */
    // var deskInfo = monitor.getDeskInfo(args.deskName);
    // if(!! args.deckMD5){
    //     console.log("deck md5 is",args.deckMD5,"rDeck is---->>>",args.rDeck);
    //     //connecter.insert({name:args.gameType,deckMD5:args.deckMD5,rDeck:args.rDeck});
    // }
    //开始投放机器人
    if(args.gameType == "coinNiuNiu4" && this.canStartEnterTask(args.gameType,args.deskName)){
        this.startEnterTask(args.gameType, args.deskName);
    }
    callback(null, false);
};

remote.prototype.onRobotUpdateCoin = function(args, callback) {
    monitor.refreshRobotCoin(args.uid, args.coin);
    callback(null, "ok");
};

//每N分钟(默认5分钟) 更新一次概率
remote.prototype.updateLuckChance = function(args,callback){
    console.log("masterRemote --->>> start update luck chance......");

    //计算机器人拿好牌的概率 [0,1)
    var calcLuckChance = function(roomInfo){
        if(roomInfo.playerCount < MAX_USER_COUNT){
            return 0;
        }
        var chance = roomInfo.score - MAX_USER_WIN_SCORE > 0 ? (roomInfo.score - MAX_USER_WIN_SCORE)/MAX_USER_WIN_SCORE : 0;
        return chance;
    }

    monitor.updateLuckChance(calcLuckChance);
    callback(null,"ok");
}

//牌记录服务
//TODO:记录还需要修改
// remote.prototype.onRecordDeck = function(args,callback){
//     if(! isRecordingCards){
//         return false;
//     }
    
//     var gameType = args.gameType;
//     var deskName = args.deskName;
//     var serializeDeck = args.serializeDeck;
    
//     var deskInfo = monitor.getDeskInfo(deskName);
//     deskInfo.deck = serializeDeck;

//     callback(null,"ok");
// }


//获取拿好牌的概率
var getLuckChance = function(gameType,deskName){
    var roomInfo = monitor.getRoomInfo(gameType,deskName);
    return roomInfo.luckChance;
}

remote.prototype.getGameDeck = function(args,callback){
    var gameType = args.gameType;
    var deskName = args.deskName;

    console.log("Now Luck Chance is:",getLuckChance(gameType,deskName));

    if(Math.random() > getLuckChance(gameType,deskName)){
        callback(null,{isLuckDeck:false});
        return;
    }

    connecter.findRandomOne({name:gameType},function(err,deckInfo){
        if(!! err){
            callback(null,{isLuckDeck:false});
            return;
        }

        if(! deckInfo){
            callback(null,{isLuckDeck:false});
            return;
        }
        callback(null,{isLuckDeck:true,rDeck:deckInfo.rDeck});
    });
}






