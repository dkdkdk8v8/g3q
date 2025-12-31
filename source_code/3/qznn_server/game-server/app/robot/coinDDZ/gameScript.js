/**
 * Created by mofanjun on 2017/10/26.
 */
var cwd = process.cwd();
var poker = require(cwd + '/app/robot/coinDDZ/poker');
//const
var HAND_CARDS_COUNT = 17;
var RANDOM_MIN_TIME = 1;
var RANDOM_MAX_TIME = 3;
var gameType = "coinDDZ";

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
    this.handCards = null;
    this.previousUid = null;
    this.previousOutCards = null;
    this.opreatCode = -1;
    this.callFraction = 1;
    this.allowRob = false;
    this.landlordUid = null;
    this.isTimeoutHandCards = false;//是否发完牌
    this.currentCallUid = null;
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
    //游戏 结束自动 退出 不在发起申请
    // var self = this;
    // this.pomelo.request(this.gameType + ".gameHandler.deskExit",{deskName:this.deskName},function (data) {
    //     if(data.err || data.code == 500){
    //         console.log("--->robot exit desk failed");
    //     }
    // })
}

gameScript.prototype.initEventListener = function () {
    var gameType = this.gameType;
    var deskName = this.deskName;
    var self = this;
    //入座
    this.addEventListener(gameType + "_onTableSitDown",function (data) {
        if( self.my && data.uid != self.my.uid){
            self.players.push(data);
        }
    })
    //离开
    this.addEventListener(gameType + "_onExitTable",function (data) {
        // 自己被退出游戏
        if (data.uid == self.my.uid) {
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
    this.addEventListener(gameType + "_onStartGame",function (data) {
        self.maxPlayer = self.players.length;
        self.isTimeoutHandCards = false;
        //初始化游戏数据
        self.cards = [];
    })
    //发牌
    this.addEventListener(gameType + "_onDealHandCards",function (data) {
        if(data.uid != self.my.uid){
            var player = this.getPlayerByUid(data.uid);           
            player.handCardsCount = 17;
            return;
        }
        self.handCards = new poker.Cards(data.cards);
        setTimeout(function(){
            this.isTimeoutHandCards = true;
            if(this.currentCallUid == this.my.uid){
                self.robBank();
            }
        }.bind(self),8 * 1000);
    })
    //抢庄
    this.addEventListener(gameType + "_onTurnToCaller",function (data) {
        if(data.uid != self.my.uid){
            console.log("error caller");
            return;
        }
        self.callFraction = data.callFraction;
        self.allowRob = data.allowRob;
        if(self.isTimeoutHandCards){
            self.robBank();
        }
    })
    //定地主
    this.addEventListener(gameType + "_onLandLord",function (data) {
        self.landlordUid = data.uid;
    })
    //加地主牌
    this.addEventListener(gameType + "_onDealThreeCards",function (data) {
        if(self.landlordUid == self.my.uid){
            console.log("robot is landlord");
            var appendCardList = new poker.Cards(data.cards);
            self.handCards.addList(appendCardList);
        }
    })
    //其他玩家出牌
    this.addEventListener(gameType + "_onOut",function (data) {
        //
        self.previousUid = data.uid;
        self.previousOutCards = new poker.Cards(data.cards);
        //
        if(data.uid == self.my.uid){
            var outCards = new poker.Cards(data.cards);
            self.handCards.removeList(outCards);
        }else{
            var player = self.getPlayerByUid(data.uid);
            player.handCardsCount -= data.cards.length;
        }
    })
    //出牌指令
    this.addEventListener(gameType + "_onOperateCode",function (data) {
        if(data.uid == self.my.uid){
            console.log(">my operate time<");
            self.previousUid = data.previousPlayerID;
            self.opreatCode = data.type;
            self.outCard();
        }
    })

    //游戏结束
    this.addEventListener(gameType + "_onStopGame",function (data) {
        //clear
        // this.game = {};
        // self.handCards = null;
        // //ready
        // self.timer = setTimeout(function () {
        //     self.pomelo.request(gameType + ".gameHandler.ready",{deskName:deskName},function (data) {
        //         if(data.err || data.code == 500){
        //             console.log('robot ready failed');
        //         }
        //     })
        // },intervalRandom(8,10));
    })
    //结算
    this.addEventListener(gameType + "_onResult",function(data){
        //游戏结束 被动离桌
        //计算退出时间
        // var legalExitTime = 6;
        // var isExited = false;
        // console.log("robot",self.my.uid,"game times:",self.gameTimes);
        // self.gameTimes ++;
        // //
        // var v = Math.random();
        // if(self.gameTimes == 1){
        //     if(v < 0.3){
        //         isExited = true;
        //         //
        //         self.timer = setTimeout(function(){
        //             self.exitGame();
        //         },intervalRandom(legalExitTime,legalExitTime + 2));
        //     }
        // }else if(self.gameTimes == 2){
        //     if(v < 0.6){
        //         isExited = true;
        //         self.timer = setTimeout(function(){
        //             self.exitGame();
        //         },intervalRandom(legalExitTime,legalExitTime + 2));
        //     }
        // }else if(v < 0.9){
        //     isExited = true;
        //     self.timer = setTimeout(function(){
        //         self.exitGame();
        //     },intervalRandom(legalExitTime,legalExitTime + 2));
        // }
        //准备
        // if(! isExited){
        //     self.timer = setTimeout(function () {
        //         self.pomelo.request(gameType + ".gameHandler.ready",{deskName:deskName},function (data) {
        //             if(data.err || data.code == 500){
        //                 console.log('robot ready failed');
        //             }
        //         })
        //     },intervalRandom(legalExitTime + 2,legalExitTime + 4));
        // }
    })
    //托管
    this.addEventListener(gameType + "_onTrust",function (data) {
        if(data.uid == self.my.uid && data.bTrustee) {
            setTimeout(function () {
                self.pomelo.request(gameType + ".gameHandler.cancelTrust",{deskName:deskName},function (data) {
                    if(data.err || data.code == 500){
                        console.log('robot cancel truestee failed');
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

gameScript.prototype.getMyNextPlayer = function () {
    var uid = this.my.uid;
    var player = this.getPlayerByUid(uid);
    var chairNo = player.chairNo;
    var nextChairNo = chairNo % this.maxPlayer + 1
    var nextPlayer = null;
    for(var i = 0;i < this.players.length; i++){
        var thePlayer = this.players[i];
    
        if(thePlayer.chairNo == nextChairNo){
            nextPlayer = thePlayer;
            break;
        }
    }

    return nextPlayer;
}

//判断自己是不是庄家
gameScript.prototype.isLandlord = function(){
    return this.my.uid == this.landlordUid;
}

gameScript.prototype.getPlayerByUid = function (uid) {
    var players = this.players;
    for(var i in players){
        var player = players[i];
        if(player.uid == uid){
            return player;
        }
    }
}

gameScript.prototype.isMyPartner = function (uid) {
    if(this.my.uid == this.landlordUid){
        return false;
    }
    return uid != this.landlordUid && this.my.uid != uid;
}

//首出的牌
gameScript.prototype.getMyFirstOutCards = function(){
    //
    var taker = new poker.GeneralTaker();
    var nextPlayer = this.getMyNextPlayer();
    //下家队友 放双 放单
    if(this.isMyPartner(nextPlayer.uid)){
        if(nextPlayer.handCardsCount == 1){
            var card = this.handCards.list[0];
            return [{value:card.value,type:card.type}];
        }else if(nextPlayer.handCardsCount == 2){
            var cards =  taker.takePair(this.handCards);
            if(!! cards){
                var list = [];
                cards.list.forEach(function(card){
                    list.push({value:card.value,type:card.type});
                })
                return list;
            }else{
                var card = this.handCards.list[0];
                return [{value:card.value,type:card.type}];
            }
        }
    }
    //自己打
    var cards = taker.take(this.handCards);
    var list = [];
    cards.list.forEach(function(card){
        list.push({value:card.value,type:card.type});
    })
    console.log("first out list is------------->",list);
    return list;
}

//跟牌
gameScript.prototype.getMyFollowOutCards = function(){
    var previousOutCards = this.previousOutCards;
    var previousUid = this.previousUid;
    var self = this;
    var isSamllCards = function(cards){
        var bSamllSingle = cards.size == 1 && cards.list[0].value < 10;
        var bSamllPair = cards.size == 2 && cards.list[0].value < 10;
        return bSamllSingle || bSamllPair;
    }

    var isNextLandlord = function(){
        var player = self.getMyNextPlayer();
        return player.uid == self.landlordUid;
    }

   
    //过牌 = 队友 && 自己手牌大于3 &&（队友手牌小于3张 || 队友）
    if(this.isMyPartner(previousUid) && this.handCards.size > 3){
        var player = this.getPlayerByUid(previousUid);
        //队友手牌低于3张了
        if(player.handCardsCount <= 5){
            return null;
        }
        //下家非地主
        if(! isNextLandlord()){
            return null
        }
        //队友出的不是小牌
        if(! isSamllCards(previousOutCards)){
            return null
        }
    }

    var out = poker.hint(this.handCards,previousOutCards);
    if(out.length == 0){
        return null
    }else{
        var list = [];
        out[0].list.forEach(function (card) {
            list.push({value:card.value,type:card.type})
        })
        return list;
    }
}

gameScript.prototype.robBank = function () {
    var random = Math.floor(Math.random() * 100);
    console.log("robot callFraction",this.callFraction);
    if(random < 50){
        this.passCall();
    }else{
        this.call();
    }
}

gameScript.prototype.outCard = function () {
    //首出
    if(this.opreatCode == 0){
        var list = this.getMyFirstOutCards();
        var param = {
            deskName:this.deskName,
            cards:list
        }
        setTimeout(function () {
            this.pomelo.request(gameType + ".gameHandler.out",param,function (data) {})
        }.bind(this),intervalRandom(RANDOM_MIN_TIME,RANDOM_MAX_TIME));
    }else if(this.opreatCode == 1){//压牌
        var list = this.getMyFollowOutCards();
        if(! list){//没牌过
            var param = {
                deskName:this.deskName
            }
            setTimeout(function () {
                this.pomelo.request(gameType + ".gameHandler.pass",param,function (data) {
                    if(data.code == 500){
                        console.log("error msg",data.msg);
                    }    
                })
            }.bind(this),intervalRandom(RANDOM_MIN_TIME,RANDOM_MAX_TIME));
        }else{
            var param = {
                deskName:this.deskName,
                cards:list
            }

            setTimeout(function () {
                this.pomelo.request(gameType + ".gameHandler.out",param,function (data) {})
            }.bind(this),intervalRandom(RANDOM_MIN_TIME,RANDOM_MAX_TIME));
        }
    }
}

gameScript.prototype.call = function () {
    var param = {
        deskName:this.deskName,
        callFraction:2
    }

    var max = RANDOM_MAX_TIME + 10;
    var min = RANDOM_MIN_TIME + 10;
    setTimeout(function () {
        this.pomelo.request(gameType + ".gameHandler.call",param,function (data) {})
    }.bind(this),intervalRandom(min,max));
}

gameScript.prototype.passCall = function () {
    var param = {
        deskName:this.deskName
    }

    setTimeout(function () {
        this.pomelo.request(gameType + ".gameHandler.passCall",param,function (data) {})
    }.bind(this),intervalRandom(RANDOM_MIN_TIME,RANDOM_MAX_TIME));
}


