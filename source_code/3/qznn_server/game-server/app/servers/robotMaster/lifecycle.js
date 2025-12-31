/**
 * Created by sdev on 2018/1/5.
 */
var fs = require("fs");
var path = require("path");
var async = require("async");
var Sequelize = require('sequelize');

//机器人总量w
var MAX_ROBOT_COUNT = 2000;

var myApp = null;
var robots = [];

/**
 * @brief:金币生成规则函数
 * 
*/
var getMyCoin = function(index){
    switch(Math.ceil(index * 5 / MAX_ROBOT_COUNT)){
        case 4:
            return 8000 * 10000;
        case 3:
            return 800 * 10000;
        case 2:
            return 80 * 10000;
        case 1:
            return 8 * 10000;
        default:
            return 3 * 10000;
    }
}

var getGameId = function(cb){
    return myApp.get('models').UserInfo.sequelize.transaction({
        isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, function (t) {
        return myApp.get('models').GameIdSet.findOne({transaction:t}).then(function(gameIdSet) {
            if (!!gameIdSet) {
                return gameIdSet.destroy({transaction: t}).then(function (g) {
                    return gameIdSet;
                });
            } else {
                throw new Error('no game id');
            }
        });
    }).then(function (result) {
        cb(null, result.id);
    }).catch(function (ex) {
        console.log("GameIdSet:" + ex);
        cb(ex);
    });
};

var createRobot = function(index,nickname,faceId){
    return function(cb){
        getGameId(function(err,gameId){
            if(!! err){
                console.log("创建机器人",index,"with error#",err.message);
                return cb();
            }
            var robot = {};
            robot.nickName = nickname;
            robot.faceId =  faceId;
            robot.gameId = gameId;
            robot.sex = Math.round(Math.random());
            robot.coin = getMyCoin(index);
            robot.recharge = robot.coin;//机器人首次充值
            robots.push(robot);
            cb();
        })
    }
}

module.exports.afterStartAll = function(app) {
    myApp = app;
    var RobotInfo = pomelo.app.get('models')['RobotInfo'];
    RobotInfo.findAndCountAll().then(function(result){
        if(result.count == 0){
            var rootPath = path.dirname(require.main.filename);
            var configPath = path.join(rootPath,"config/avatar.json");
            fs.readFile(configPath,"utf8",function(err,result){
                if(!! err){
                    throw err;
                }
                var json = JSON.parse(result);
                var baseUrl = json.basePath;
                var avatars = json.avatars;

                var createRobotsFuncs = [];
                for(var i = 0; i < MAX_ROBOT_COUNT; i++){
                    var func = createRobot(i,avatars[i].nickname,baseUrl + "/" + avatars[i].path);
                    createRobotsFuncs.push(func);
                }

                async.waterfall(createRobotsFuncs,function(err,result){
                    if(!! err){
                        throw err;
                    }
                    RobotInfo.bulkCreate(robots).then(function(){
                        app.rpc.robotMaster.masterRemote.initRobot(null, {}, function () {});
                        console.log("1. ------>>>robotMasterSvr create robot success");
                    })
                })
            })
            return;
        }
        app.rpc.robotMaster.masterRemote.initRobot(null, {}, function () {});
        console.log("2. ------>>>robotMasterSvr create robot success");
    }).catch(function(err){
        console.log("3. ---->>>robotMasterSvr init error",err.message);
    })
};
