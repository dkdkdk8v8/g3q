/**
 * Created by mofanjun on 2017/10/26.
 */
var cwd = process.cwd();
var Define = require(cwd + '/app/robot/coinNiuNiu4/define');
var Logic = require(cwd + '/app/robot/coinNiuNiu4/logic');
var CardUtils = require(cwd + '/app/coin/niuNiu/module/cardUtils');

//const
var RANDOM_MIN_TIME = 1;
var RANDOM_MAX_TIME = 3;

var gameScript = function () {
    this.pomelo = undefined;
    this.gameType = undefined;
    this.deskName = undefined;
    this.players = [];
    this.desk = undefined;
    this.maxPlayer = 0;
    this.my = undefined;
    this.timer = undefined;
    this.eventList = [];
    this.gameTimes = 0;
}

module.exports = gameScript;

var intervalRandom = function (min,max) {
    var v = min * 1000 + Math.floor(Math.random() * (max - min + 1) * 1000);
    return v;
}

gameScript.prototype.clearTimer = function () {
    if(this.timer) {
        clearTimeout(this.timer);
        delete this.timer;
    }
}

gameScript.prototype.init = function (p, g, d, u, w) {
    this.pomelo = p;
    this.gameType = g;
    this.deskName = d;
    this.watcher = w;
    this.gameTimes = 0;

    this.initEventListener();

    var self = this;

    this.pomelo.request(this.gameType + ".gameHandler.queryDeskInfo",{deskName:this.deskName},function (data) {
        if(data.err || data.code == 500){
            return;
        }

        self.desk = data.deskInfo;
        self.players = data.playerInfo;

        for(var i = 0; i < self.players.length; i++) {
            if (self.players[i].uid == u){
                self.my = self.players[i];
                break;
            }
        }
    })
}

gameScript.prototype.addEventListener = function (name, callback) {
    this.eventList.push({name:name, cb:callback});
    this.pomelo.on(name,callback);
}

gameScript.prototype.removeAllEventListener = function () {
    for(var i = 0; i < this.eventList.length; i++){
        var e = this.eventList[i];
        this.pomelo.removeListener(e.name,e.cb);
    }
}

gameScript.prototype.exitGame = function () {
    var self = this;
    this.pomelo.request(this.gameType + ".gameHandler.deskExit",{deskName:this.deskName},function (data) {
        if(data.err || data.code == 500){
            console.log(">>> [机器人] UID:", self.my.uid, "退出房间失败");
        }
    })
}

gameScript.prototype.initEventListener = function () {
    var gameType = this.gameType;
    var deskName = this.deskName;
    var self = this;
    //入座
    this.addEventListener(gameType + "_OnSitDown",function (data) {
        if(data.uid != self.my.uid){
            console.log(">>> [机器人] UID:", self.my.uid, "检测到玩家坐下 UID:", data.uid);
            self.players.push(data);
        }
    })
    //离开
    this.addEventListener(gameType + "_OnExit",function (data) {
        // 自己被退出游戏
        if (data.uid == self.my.uid) {
            console.log(">>> [机器人] UID:", self.my.uid, "已离开房间");
            self.clearTimer();
            self.removeAllEventListener();
            self.pomelo.disconnect();
        }
        else {
            for (var i = 0; i < self.players.length; i++) {
                if (self.players[i].uid == data.uid) {
                    self.players.splice(i, 1);
                }
            }
        }
    })
    //游戏开始
    this.addEventListener(gameType + "_OnGameStart",function (data) {
        self.maxPlayer = data.playUids.length;
        console.log(">>> [机器人] UID:", self.my.uid, "游戏开始，参与人数:", self.maxPlayer);
        //初始化游戏数据
        self.cards = [];
        self.gameStatus = Define.GameStatus.null;
        self.isWatcher = false;
        self.isBank = false;
    })
    //游戏步骤切换
    this.addEventListener(gameType + "_OnNewStep",function (data) {
        //update
        var myUid = self.my.uid;
        if(typeof data.gameStatus == "undefined"){
            console.log(">>> [机器人] UID:", self.my.uid, "收到步骤切换消息，但数据有误");
            return;
        }

        if(self.isWatcher){
            return;//如果是旁观那么 不处理游戏数据
        }

        self.gameStatus = data.gameStatus;
        console.log(">>> [机器人] UID:", self.my.uid, "切换到阶段:", self.gameStatus);
        //
        if(self.gameStatus == Define.GameStatus.Card){
            console.log(">>> [机器人] UID:", self.my.uid, "收到发牌数据");
            self.robBank(data);
        }else if(self.gameStatus == Define.GameStatus.ShowBank){
            self.isBank = data.bankUid == myUid ? true : false;
        }else if(self.gameStatus == Define.GameStatus.Point){//闲家叫分
            if(! self.isBank){
                self.callPoints(data);
            }
        }else if(self.gameStatus == Define.GameStatus.LeftCard){//加牌
            self.showMyCards(data);
        }

    })
    //别人叫分
    this.addEventListener(gameType + "_OnCall",function (data) {
        //do nothing
    })
    //别人组牌
    this.addEventListener(gameType + "_OnCalCard",function (data) {
        //do nothing
    })
    //游戏结束
    this.addEventListener(gameType + "_OnGameEnd",function (data) {
        //计算退出时间
        var legalExitTime = 3.5;//TODO:4秒是固定延迟
        var isExited = false;
        self.gameTimes ++;
        console.log(">>> [机器人] UID:", self.my.uid, "本局结束，累计参与局数:", self.gameTimes);
        //
        var v = Math.random();
        if(self.gameTimes < 3){
            if(v < 0.1){
                isExited = true;
                console.log(">>> [机器人] UID:", self.my.uid, "决定退出房间");
                //
                self.timer = setTimeout(function(){
                    self.exitGame();
                },intervalRandom(legalExitTime,legalExitTime + 2));
            }
        }else if(self.gameTimes == 6){
            if(v < 0.2){
                isExited = true;
                console.log(">>> [机器人] UID:", self.my.uid, "决定退出房间");
                self.timer = setTimeout(function(){
                    self.exitGame();
                },intervalRandom(legalExitTime,legalExitTime + 2));
            }
        }else if(v < 0.4){
            isExited = true;
            console.log(">>> [机器人] UID:", self.my.uid, "决定退出房间");
            self.timer = setTimeout(function(){
                self.exitGame();
            },intervalRandom(legalExitTime,legalExitTime + 2));
        }
        //准备
        if(! isExited){
            console.log(">>> [机器人] UID:", self.my.uid, "决定继续游戏，准备中...");
            self.timer = setTimeout(function () {
                self.pomelo.request(gameType + ".gameHandler.ready",{deskName:deskName},function (data) {
                    if(data.err || data.code == 500){
                        console.log(">>> [机器人] UID:", self.my.uid, "发送准备请求失败");
                    }
                })
            },intervalRandom(legalExitTime + 1,legalExitTime + 4.5));
        }
    })
    //托管
    this.addEventListener(gameType + "_OnTrusttee",function (data) {
        if(data.uid == self.my.uid && data.bTrustee) {
            setTimeout(function () {
                self.pomelo.request(gameType + ".gameHandler.cancelTrusttee",{deskName:deskName},function (data) {
                    if(data.err || data.code == 500){
                        console.log(">>> [机器人] UID:", self.my.uid, "取消托管失败");
                    }
                })
            },intervalRandom(0.5,1));
        }
    })
    //玩家信息更新???
    this.addEventListener(gameType + "_OnUserUpdate",function (data) {
        if(data.uid == self.my.uid && data.coin != undefined){
            self.watcher.emit("updateCoin",data);
        }
    })
}

gameScript.prototype.robBank = function (data) {
    if(! data.cards || data.cards.length == 0){
        this.isWatcher = true;
        return;
    }
    this.cards = data.cards;
    var gameType = this.gameType;
    var isManPai = Logic.isManPai(this.cards);
    var random = Math.floor(Math.random() * 100);
    var point = 0;

    if(isManPai){
        if(random <= 10){}
        else if(random <= 20) {point = 1}
        else if(random <= 30) {point = 2}
        else if(random <= 50) {point = 3}
        else {point = 4}
    } else {
        if(random <= 30){}
        else if(random <= 50) {point = 1}
        else if(random <= 70) {point = 2}
        else if(random <= 90) {point = 3}
        else {point = 4}
    }
    console.log(">>> [机器人] UID:", this.my.uid, "抢庄决策:", point, "倍, 手牌:", CardUtils.formatCards(this.cards));
    setTimeout(function () {
        this.pomelo.request(gameType + ".gameHandler.call",{deskName:this.deskName,uid:this.my.uid,point:point},function (data) {})
    }.bind(this),intervalRandom(RANDOM_MIN_TIME + 2,RANDOM_MAX_TIME + 2));
}

gameScript.prototype.callPoints = function (data) {
    var isManPai = Logic.isManPai(this.cards);
    var gameType = this.gameType;
    var random = Math.floor(Math.random() * 100);
    var point = 0;
    if(isManPai){
        if(random <= 10){point = 1}
        else if(random <= 20) {point = 2}
        else if(random <= 30) {point = 3}
        else if(random <= 50) {point = 4}
        else {point = 5}
    } else {
        if(random <= 30){point = 1}
        else if(random <= 50) {point = 2}
        else if(random <= 70) {point = 3}
        else if(random <= 90) {point = 4}
        else {point = 5}
    }
    console.log(">>> [机器人] UID:", this.my.uid, "闲家下注:", point, "倍");
    setTimeout(function () {
        this.pomelo.request(gameType + ".gameHandler.call",{deskName:this.deskName,uid:this.my.uid,point:point},function (data) {})
    }.bind(this),intervalRandom(RANDOM_MIN_TIME,RANDOM_MAX_TIME));
}

gameScript.prototype.showMyCards = function (data) {
    this.cards = this.cards.concat(data.cards);
    var gameType = this.gameType;
    var res = Logic.GetCardResult(this.cards);
    console.log(">>> [机器人] UID:", this.my.uid, "组牌完成, 手牌:", CardUtils.formatCards(this.cards), "牌型权重:", res.cardType.weight);
    var hasCow = res.cardType.weight != Define.PAI_XING.NoCow.weight ? true : false;
    setTimeout(function () {
        this.pomelo.request(gameType + ".gameHandler.calCard",{deskName:this.deskName,uid:this.my.uid,hasCow:hasCow});
    }.bind(this),intervalRandom(RANDOM_MIN_TIME,RANDOM_MAX_TIME))
}