//lib
var gDef = require("./globalDefine.js")
//define
var gameType = "coinMaJiang_nd"
var RANDOM_MIN_TIME = 1;
var RANDOM_MAX_TIME = 3;
/**
 * @brief:摸啥打啥机器人
 */
var gameScript = function(){
    this.pomelo = undefined;
    this.gameType = undefined;
    this.deskName = undefined;
    this.players = [];
    this.desk = undefined;
    this.maxPlayer = 0;
    this.my = undefined;
    this.timer = undefined;
    this.eventList = [];
    this.bankUid = null;
    this.handCards = null;
    this.lastCard = null;//摸到的那张牌
    this.curCard = null;//打出的那张牌
}

module.exports = gameScript;

var intervalRandom = function (min,max) {
    var v = min * 1000 + Math.floor(Math.random() * (max - min + 1) * 1000);
    return v;
}

/**
 * @profile:找到相同的牌点的牌
 * @arg optArr
 * @arg sameCnt 若为4 说明是找4张一样的牌
 * @return {legalCard:[[]],restCard:[]}
*/
var findSameCard = function(optArr,sameCnt){
    var legalCard = [];
    var restCard = [];
    //
    optArr.forEach(function(a,b){
        return a - b;
    })
    //
    var result = {}
    optArr.forEach(function(card){
        if(! result[card]){
            result[card] = [];
        }
        result[card].push(card);
    })
    //
    for(var card in result){
        if(result[card].length == sameCnt){
            legalCard.push(result[card]);
        }else{
            restCard = restCard.concat(result[card]);
        }
    }

    return {legalCard:legalCard,restCard:restCard}
}

/**
 * @profile:找连续的牌
 * @arg optArr
 * @arg sequenceCnt 连几张的
 * @return {legalCard:[[]],restCard:[]}
*/
var findSequenceCard = function(optArr,sequenceCnt){
    var legalCard = [];
    var restCard = [];

    //
    optArr.sort(function(a,b){
        return a - b;
    })
    //
    var isSequence = true;
    var tmpCard = [];
    for(var i = 0; i < optArr.length;){
        //如果判定的牌与后面的牌不够组成顺子 或者 牌点已经是“风 中 发 白”了
        if(i + sequenceCnt > optArr.length || optArr[i] >= 0x0301){
            restCard.push(optArr[i]);
            i++;
            continue;
        }
        //
        for(var j = 0; j < sequenceCnt; j++){
            if(optArr[i] + j != optArr[i + j]){
                isSequence = false;
                break;
            }
            tmpCard.push(optArr[i + j]);
        }

        if(isSequence){
            legalCard.push(tmpCard);
            i += sequenceCnt;
        }else{
            restCard.push(optArr[i]);
            i++;
        }
        //
        isSequence = true;
        tmpCard = [];
    }

    return {legalCard:legalCard,restCard:restCard};
}


gameScript.prototype.clearTimer = function () {
    if(this.timer) {
        clearTimeout(this.timer);
        delete this.timer;
    }
}

gameScript.prototype.init = function(p, g, d, u, w){
    this.pomelo = p;
    this.gameType = g;
    this.deskName = d;
    this.watcher = w;

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

gameScript.prototype.addEventListener = function(name, callback){
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
    // var self = this;
    // this.pomelo.request(this.gameType + ".gameHandler.deskExit",{deskName:this.deskName},function (data) {
    //     if(data.err || data.code == 500){
    //         console.log("--->robot exit desk failed");
    //     }
    // })
}

gameScript.prototype.initEventListener = function() {
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
        self.gameTimes = 0;
    })
    //摇骰子 定庄
    this.addEventListener(gameType + "_OnCraps",function(data){
        self.bankUid = data.bankUid;
    })
    //发13张牌
    this.addEventListener(gameType + "_OnInitCard",function(data){
        self.handCards = data.cards;
    })
    //发1张牌
    this.addEventListener(gameType + "_OnPushCard",function(data){
        if(data.uid == self.my.uid){
            self.lastCard = data.card;//摸到的牌
            self.handCards.push(data.card);
            console.log("_OnPushCard is--------------->>>>",self.handCards,"gameStatus is--------->>>",data.gameStatus);
            if(data.gameStatus == gDef.GameStatus.WaitCard){//自己不能 碰 杠 胡
                self.outCard(data.card);
            }
        }
    })
    /**
     *@brief:玩家能-碰 杠 胡
     * 1.操作 能胡则胡 否则过
     * 2.出牌 
    */
    this.addEventListener(gameType + "_OnOptCode",function(data){
        if(data.uid == self.my.uid){
            var optCode = null
            var cards = null;
            if(data.optCode & gDef.OptCardCode.Hu){
                optCode = gDef.OptCardCode.Hu;//胡
            }else if(data.optCode & gDef.OptCardCode.AnGang){
                //暗杠不一定是刚摸的那张
                result = findSameCard(self.handCards,4);
                for(var i = 0; i < result.legalCard.length; i++){
                    var sameCards = result.legalCard[i];
                    if(cards == null){
                        cards = sameCards;
                    }

                    if(sameCards[0] == self.lastCard){//优先杠出自己刚摸的那张
                        cards = sameCards;
                    }
                }

                optCode = gDef.OptCardCode.AnGang;//暗杠
                console.log("------------------>>>Robot",self.my.uid,"AnGang Operation cards----->>>",cards);
            }else if(data.optCode & gDef.OptCardCode.MingGang){
                var optCard = !! self.lastCard ? self.lastCard : self.curCard;

                var optCardCnt = 0;
                self.handCards.forEach(function(iCard){
                    if(iCard == optCard) optCardCnt++
                })

                if(optCardCnt == 1){//补杠
                    cards = [optCard];
                }else{
                    cards = [optCard,optCard,optCard,optCard];
                }
                optCode = gDef.OptCardCode.MingGang;//明杠
            }else if(data.optCode & gDef.OptCardCode.Peng){
                cards = [self.curCard,self.curCard,self.curCard];
                optCode = gDef.OptCardCode.Peng;//碰
            }else{
                optCode = gDef.OptCardCode.Null;//过
            }
            setTimeout(function(){
                self.pomelo.request(self.gameType + ".gameHandler.optCard",{uid:self.my.uid,optCode:optCode,deskName:self.deskName,cards:cards},function (data) {
                    //nothing
                })
            }, intervalRandom(RANDOM_MIN_TIME,RANDOM_MAX_TIME));
        }
    })
    this.addEventListener(gameType + "_OnPopCard",function(data){
        if(data.uid == self.my.uid){
            var popIndex = self.handCards.indexOf(data.card);
            self.handCards.splice(popIndex,1);
        }
        self.curCard = data.card;//记录桌上当前打的牌
    })
    //有玩家进行操作//自己过 那么再打一张牌
    this.addEventListener(gameType + "_OnOptCard",function(data){
        if(data.uid == self.my.uid){
            if(!! data.optCards.optCode && (data.optCards.optCode & gDef.OptCardCode.Hu)){//胡
                return;
            }
            if(!! data.optCards.optCode && !! data.optCards.cards){
                if(! (data.optCards.optCode & gDef.OptCardCode.MingGang)
                && ! (data.optCards.optCode & gDef.OptCardCode.AnGang)
                && ! (data.optCards.optCode & gDef.OptCardCode.Peng)){
                    return;
                }
                //更新手牌
                self.lastCard == null;
                var cards = data.optCards.cards;
                console.log("uid:",self.my.uid,"------->>>1T. Before operate------------->>>optCards",cards);
                console.log("2T. Before operate------------->>>handCards",self.handCards);
                var tmpHandCards = []
                var isDel = false
                for(var i in self.handCards){
                    for(var j in cards){
                        if(self.handCards[i] == cards[j]){
                            isDel = true;
                            break
                        }
                    }

                    if(! isDel){
                        tmpHandCards.push(self.handCards[i]);
                    }
                    isDel = false;
                }

                if(tmpHandCards.length == 0){
                    console.log("2. Robot uid is:",self.my.uid,"handCards is:",self.handCards);
                }
                self.handCards = tmpHandCards;
                console.log("3T. After operate------------->>>handCards",self.handCards);
            }

            self.outCard([]);
        }
    })
    //游戏结束
    this.addEventListener(gameType + "_OnGameEnd",function (data) {
        //被动离桌
        //计算退出时间
        // var legalExitTime = 3;
        // var isExited = false;
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
    this.addEventListener(gameType + "_OnTrusttee",function (data) {
        if(data.uid == self.my.uid && data.bTrustee) {
            setTimeout(function () {
                self.pomelo.request(gameType + ".gameHandler.cancelTrusttee",{deskName:deskName},function (data) {
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

/**
 * @profile:根据评估算出要打的牌 并刷新手牌
 * @arg moCard 摸到的牌
 * 
*/
gameScript.prototype.outCard = function(moCard){
    var self = this;
    console.log("1. uid:",self.my.uid,"---->>>outCard---->>>handCard:",self.handCards,"moCard-------->>>:",moCard);
    //self.handCards = self.handCards.concat(moCard);
    var result = null;
    var retainCards = [];
    //找杠
    result = findSameCard(self.handCards,4);
    retainCards = retainCards.concat(result.legalCard);  
    //找刻子
    result = findSameCard(result.restCard,3);
    retainCards = retainCards.concat(result.legalCard);  
    //找顺子
    result = findSequenceCard(result.restCard,3);
    retainCards = retainCards.concat(result.legalCard); 
    //找将
    result = findSameCard(result.restCard,2);
    retainCards = retainCards.concat(result.legalCard);  
    //找连两张
    result = findSequenceCard(result.restCard,2);
    retainCards = retainCards.concat(result.legalCard);

    //合并牌组
    var legalCard = [];
    retainCards.forEach(function(cards){
        legalCard = legalCard.concat(cards);
    })
    //找那张出的牌
    var outCard = null
    if(!! result.restCard.length){
        outCard = result.restCard[result.restCard.length - 1];
    }else{
        outCard = legalCard[legalCard.length - 1];
    }
    //
    legalCard = legalCard.concat(result.restCard);
    legalCard.sort(function(a,b){return a - b});
    self.handCards = legalCard;
    
    if(! outCard){
        console.log("1. --->>> Robot uid is:",self.my.uid,"retain cards is:",retainCards,"reset card is:",result.restCard,"moCard is:",moCard);
    }
    console.log("2x. legalCard is--------------->>>>",legalCard,"outcard is-------->>>",outCard);
    //出牌
    setTimeout(function(outCard){
        self.pomelo.request(self.gameType + ".gameHandler.popCard",{uid:self.my.uid,card:outCard,deskName:self.deskName},function (data) {
            self.lastCard = null;
        })
    }.bind(null,outCard),intervalRandom(RANDOM_MIN_TIME,RANDOM_MAX_TIME));
}