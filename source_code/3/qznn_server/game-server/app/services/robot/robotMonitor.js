/**
 * Created by Administrator on 2017/6/19.
 */
var monitor = module.exports;

// 机器人对应的房间信息
var robotData = {};

// 房间相关状态信息
var deskInfoData = {};

// 空闲机器人
var freeRobotArr = [];

// 忙碌机器人
var busyRobotData = {};

//真人玩家当天输赢统计
var userData = {}
//房间和桌子映射
var roomDeskMap = {};
//房间信息
var roomInfoData = {};


var isRobot = function(uid){
    return uid > 10000000
}

monitor.getRoomId = function(gameType,deskName){
    for(var roomId in roomDeskMap){
        if(~ roomDeskMap[roomId].indexOf(deskName)){
            return roomId;
        }
    }
}

monitor.enterGame = function (uid, gameType, deskName) {
    var roomInfo = roomInfoData[this.getRoomId(gameType,deskName)];
    var deskInfo = deskInfoData[deskName];
    
    var now = Math.round(new Date().getTime()/1000);
    if (isRobot(uid)) {
        robotData[uid] = {uid:uid, gameType: gameType, deskName: deskName, playCount:0, enterTime:now};
        deskInfo.robotUids.push(uid);
        deskInfo.robotNum++;
        roomInfo.robotCount++;
    }
    else {
        deskInfo.playerNum++;
        roomInfo.playerCount++;
    }
};

monitor.leaveGame = function (uid, deskName) {
    var deskInfo = deskInfoData[deskName];
    var roomInfo = roomInfoData[this.getRoomId(null,deskName)];
    if (isRobot(uid)) {
        if (robotData[uid]) {
            var info = robotData[uid];
            if (info && info.deskName) {
                var robots =  deskInfo.robotUids;
                for (var i = 0; i < robots.length; i++) {
                    if (robots[i] == uid) {
                        robots.splice(i, 1);
                        break;
                    }
                }
            }
            delete robotData[uid];
            deskInfo.robotNum--;
            roomInfo.robotCount --;
        }
        monitor.recycleRobot(uid);
    }
    else {
        deskInfo.playerNum--;
        roomInfo.playerCount--;
    }
};

monitor.startGame = function (deskName) {
    var deskInfo = deskInfoData[deskName];
    deskInfo.isStart = true;

    for (var i = 0 ;i < deskInfo.robotUids.length; i++) {
        var u = deskInfo.robotUids[i];
        var d = robotData[u];
        if (d) {
            d.playCount++;
        }
    }
};

monitor.endGame = function (gameType,deskName,award) {
    var roomInfo = roomInfoData[this.getRoomId(gameType,deskName)];
    var deskInfo = deskInfoData[deskName];
    deskInfo.isStart = false;
    if(! isRobot(award.uid)){
        userData[award.uid] += award.score;
    }else{
        roomInfo.score += award.score;
    }
};

monitor.addDesk = function(info) {
    var gameType = info.gameType;
    /*桌子和房间的映射表*/
    var roomId = info.gameType + "_" + info.roomIndex;
    roomDeskMap[roomId] = !! roomDeskMap[roomId] ? roomDeskMap[roomId] : []
    roomDeskMap[roomId].push(info.deskName);
    /*房间信息*/
    if(! roomInfoData[roomId]){//桌子信息没有初始化过
        roomInfoData[roomId] = {};
        roomInfoData[roomId].playerCount = 0;
        roomInfoData[roomId].robotCount = 0;
        roomInfoData[roomId].maxChairCount = 0;
        roomInfoData[roomId].score = 0;//房间总输赢
        roomInfoData[roomId].luckChance = 0;//获得好牌的概率
    }
    roomInfoData[roomId].maxChairCount += info.maxPlayer;
    /*桌子信息*/
    deskInfoData[info.deskName] = info;
    deskInfoData[info.deskName].playerNum = 0;// 真人玩家数量
    deskInfoData[info.deskName].robotNum = 0;// 机器人数量
    deskInfoData[info.deskName].robotUids = [];// 机器人id
    deskInfoData[info.deskName].isStart = false;// 是否开始游戏
};

monitor.getDeskInfo = function(deskName) {
    return deskInfoData[deskName];
};

//x = w/(3+y/ε)
monitor.getRoomMaxRobot = function(gameType,deskName){
    var epsilon = 1;
    var roomInfo = roomInfoData[this.getRoomId(gameType,deskName)];
    var chairCount = roomInfo.maxChairCount;
    var playerCount = roomInfo.playerCount;
    var robotCount = roomInfo.robotCount;
    //decision the epsilon
    if(playerCount <= robotCount / 5){
        epsilon = 10;
    }else if(playerCount <= robotCount * 2 / 5){
        epsilon = 8;
    }else if(playerCount <= robotCount * 3 / 5){
        epsilon = 6;
    }else if(playerCount <= robotCount * 4 / 5){
        epsilon = 4;
    }else if(playerCount <= robotCount){
        epsilon = 2;
    }
    //
    var maxRobotCount = chairCount / (3 + playerCount / epsilon);
    return maxRobotCount;
}

monitor.getRoomInfo = function(gameType,deskName){
    return roomInfoData[this.getRoomId(gameType,deskName)];
}

monitor.updateLuckChance = function(calcFunc){
    for(var roomId in roomInfoData){
        var roomInfo = roomInfoData[roomId];
        roomInfo.luckChance = calcFunc(roomInfo);
    }
}


monitor.reset = function() {
    robotData = {};
    deskInfoData = {};
    freeRobotArr = [];
    busyRobotData = {};
};

monitor.getRoomRobot = function(deskName) {
    var info = [];
    var rUids = deskInfoData[deskName].robotUids;
    for (var i = 0; i < rUids.length; i++) {
        var u = rUids[i];
        if (robotData[u]) {
            info.push(robotData[u]);
        }
    }
    return info;
};

monitor.addFreeRobot = function (uid, info,coin) {
    freeRobotArr.push({uid:uid, info:info,coin:coin});
};

monitor.getFreeRobot = function () {
    return freeRobotArr;
}

monitor.setFreeRobot = function (copy) {
    if(copy instanceof Array){
        freeRobotArr = copy;
    }
}

monitor.recycleRobot = function (uid) {
    console.log("----------------->>>recycleRobot", uid);
    if (busyRobotData[uid]) {
        freeRobotArr.push({uid:uid, info:busyRobotData[uid]});
        delete busyRobotData[uid];
    }
};

monitor.getFreeRobotUid = function (minCoin,maxCoin) {
    var index;

    var uid;
    var count = 0;
    if (freeRobotArr.length <= 0) {
        return;
    }

    maxCoin = maxCoin == 0 ? Number.MAX_SAFE_INTEGER : maxCoin;
    //find legal robots
    var legalArr = [];
    for(var i = 0; i < freeRobotArr.length; i++){
        if(freeRobotArr[i].info.coin > minCoin && freeRobotArr[i].info.coin < maxCoin){
            legalArr.push(i);
        }
    }
    //random robot
    if(!! legalArr.length){
        var index = Math.floor(Math.random()*legalArr.length);
        index = legalArr[index];
        uid = freeRobotArr[index].uid;
        busyRobotData[uid] = freeRobotArr[index].info;
        freeRobotArr.splice(index, 1);
    }

    console.log("----------------->>>addRobot", uid);
    return uid;
};

monitor.refreshRobotCoin = function(uid, coin) {
    if (busyRobotData[uid]) {
        busyRobotData[uid].coin = coin;
    }
};