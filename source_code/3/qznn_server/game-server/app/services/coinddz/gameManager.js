var poker = require("../ddz/poker.js");
var events = require("events");
var util = require('util');
var logger = require('pomelo-logger').getLogger(__filename);
var async = require("async");
var pomelo = require("pomelo");
var log = pomelo.app.get('mongodb');

var random = function(min,max){
    return Math.floor(min+Math.random()*(max-min));
}

var Code = {
    OK: 200,//操作成功
    FAIL: 500,//操作失败
};

var gameType = 'coinDDZ';
var ONE_SPRING = 2;
var ONE_BOOM = 2;
var MAX_PLAYER = 3;
/**
 * game player
 * @constructor
 */
var Player = function(uid){
    this.uid = uid;
    this.score = 0;//积分
    this.coin = 0;//金币
    this.handCards = new poker.Cards();//手中的牌
    this.isGaming = false;//是否在游戏中
    this.chairNo = 0;//座位
    this.callTimes = 0;//叫牌次数
    this.callFraction = 0;//叫的分数
    this.addCallTime = 0;
    this.isAllowOperate = false;//是否允许此玩家操作
    this.tickCall = null;//叫牌倒记时
    this.tickPlay = null;//玩牌倒记时
    this.tickApplyDrop = null;//申请解散房间倒记时
    this.tickAnswerDrop = null;//申请解散房间倒记时
    this.outList = [];//出过的每一手牌组成的列表
    this.nickName = "";//昵称
    this.faceID = "";//头像
    this.sex = 0;//性别
    this.pass = false;//玩牌pass
    this.isWinner = false;//是否获胜者
    this.passCall = 0;//叫牌时,过,过后不能再叫牌
    this.isReady = false;//是否准备好，小局游戏开始之前用,第一局不用，直接开始游戏
    this.disconnected = false;//是否断线
    this.isApplier = false;//是否是申请者
    this.ip = "";
    this.isMatcher = false;

    this.answerStatus = 0;//回答状态,0.未作回答,1.同意,2.拒绝
    this.robMultiple = 1;//抢的倍率,默认为1倍
    this.bombNumber = 0;
    this.rocketNumber = 0;
    this.dzWinNumber = 0;//地主胜利次数
    this.nmWinNumber = 0;//农民胜利次数
    this.springNumber = 0;//春天次数
    this.isTrust = false;
    this.tickTimer = null;
}

Player.prototype.clearTimer = function () {
    if(this.tickTimer){
        clearTimeout(this.tickTimer);
        this.tickTimer = null;
    }
}


Player.prototype.timeoutOutCard = function (game) {//有牌则压 没牌则过
    var self = this;
    this.clearTimer();
    var elapse = this.isTrust ? 5 : 15;
    this.tickTimer = setTimeout(function() {
        var result = game.canAutoOut(self);
        if(!! result.out){//出牌
           game.out(self,{cards:result.cards});
        }else{//过牌
            game.pass(self);
        }
        console.log("player uid",self.uid,"trust");
        game.trust(self);
    }, elapse * 1000);
}

Player.prototype.timeoutCall = function (game) {//超时 不叫
    var self = this;
    this.clearTimer();
    this.tickTimer = setTimeout(function () {
        game.call(self,{callFraction:3})
    },15 * 1000);
}

Player.prototype.addCoin = function (coin,cb) {
    var self = this;
    if(self.isMatcher){
        if(coin == 0) return cb(null);
        pomelo.app.rpc.matchsvr.matchRemote.addMatchScore(null,{uid:self.uid,score:coin},function(err,res){
            if(!! err && !! cb){
                return cb(err);
            }
            self.coin = res.coin;
            if(!! cb){
                cb(null,res);
            }
        });
    }else{
        if (coin > 0) {
            pomelo.app.rpc.usersvr.userRemote.addCoin(this.uid, {uid:this.uid, deltaCoin:coin}, function(err, res){
                if (err) {
                    if (cb) {
                        cb(err);
                    }
                }
                else {
                    self.coin = res.coin;
                    if (cb) {
                        cb(null, res);
                    }
                }
            });
        }
        else {
            pomelo.app.rpc.usersvr.userRemote.costCoin(this.uid, {uid:this.uid, deltaCoin:coin}, function(err, res){
                if (err) {
                    if (cb) {
                        cb(err);
                    }
                }
                else {
                    self.coin = res.coin;
                    if (cb) {
                        cb(null, res);
                    }
                }
            });
        }
    }
}

Player.prototype.equals = function(other){
    if (!other || !(other instanceof Player)){
        logger.error('the other Player is not available.');
        return false;
    }
    return this.uid === other.uid;
}

Player.prototype.getBasicInfo = function(){
    var playerInfo = {
        uid:this.uid,
        nickName:this.nickName,
        faceID:this.faceID,
        coin:this.coin,
        pos:this.chairNo - 1
    }
    return playerInfo;
}

Player.prototype.getPlayerInfo = function(uid){
    var handCards = [];//手中牌
    if(this.uid == uid && this.handCards){//自己显示手中牌，其它人不发送手中牌
        this.handCards.list.forEach(function(item){
            var card = {
                value:item.value,
                type:item.type
            }
            handCards.push(card);
        });
    }
    var outCards = [];
    if(!!this.outList){
        this.outList.forEach(function (cards) {
            var cList = [];
            cards.list.forEach(function (item) {
                var card = {
                    value:item.value,
                    type:item.type
                }
                cList.push(card);
            });
            outCards.push(cList);
        })
    }
    var playerInfo = {
        uid:this.uid,
        nickName:this.nickName,
        sex:this.sex,
        faceID:(!!this.faceID)?this.faceID:"",
        score:this.score,
        totalScore:this.coin,
        handCards:handCards,
        handCardsCount:this.handCards.list.length,
        outCards:outCards,
        isGaming:this.isGaming,
        chairNo:this.chairNo,
        callTimes:this.callTimes,
        passCall:this.passCall,
        pass:this.pass,
        callFraction:this.callFraction,
        isAllowOperate:this.isAllowOperate,
        disconnected:this.disconnected,
        answerStatus:this.answerStatus,
        isApplier:this.isApplier,
        isReady:this.isReady,
        ip:this.ip,
        gameId:this.gameId,
        vipLevel:this.vipLevel,
        ownGoods:this.ownGoods
    }
    return playerInfo;
}

Player.prototype.clear = function(){
    this.handCards = new poker.Cards();//手中的牌
    this.callTimes = 0;//叫牌次数
    this.addCallTime = 0;
    this.callFraction = 0;//叫的分数
    this.isAllowOperate = false;//是否允许此玩家操作
    this.outList = [];//出过的每一手牌组成的列表
    this.isWinner = false;//是否获胜者
    this.isReady = false;
    this.passCall = 0;//叫牌时,过,过后不能再叫牌
    this.robMultiple = 1;//
    this.score = 0;//积分
    this.pass = false;//玩牌pass
    //
    this.dzWinNumber = 0;
    this.nmWinNumber = 0;
    this.springNumber = 0;
    this.rocketNumber = 0;
    this.bombNumber = 0;
    
}
Player.prototype.getHandCards = function(){
    var cards = [];
    this.handCards.list.forEach(function(card){
        var oCard = {value:card.value,type:card.type};
        cards.push(oCard);
    })

    cards.sort(function(a,b){
        if(a.value == b.value){
            return a.type - b.type
        }

        return a.value - b.value
    })

    return cards;
}

Player.TICK_CALL_SPAN = 15*1000;//操作倒记时长度为15秒
Player.TICK_PLAY_SPAN = 15*1000;//操作倒记时长度为30秒
Player.TICK_APPLY_DROP_SPAN = 5*1000*60;//申请解散倒记时长度为300秒
Player.TICK_ANSWER_DROP_SPAN = 5*1000*60;//回答解散倒记时长度为300秒


var Table = function(msg) {
    events.EventEmitter.call(this);
    this.tableID = msg.tableID;
    this.tableNo = msg.tableNo;
    this.playMethod = msg.playMethod;//玩法
    this.isCardCounting = msg.isCardCounting;//是否记牌
    this.bombLimitType = msg.bombLimitType;//炸弹上限类型,1:不限,2:3炸、3:4炸、4:5炸
    this.mid = msg.mid;
    this.players =[];//桌子上的所有玩家
    this.seatNumber = 3;//此桌的座位数量，座位号1..seatNumber
    this.game = null; //桌子上的某局游戏
    this.firstOutAllCardPlayer = null;
    this.gameTimes = 0;//游戏次数
    this.bottomFraction = 1;//底分

    this.minCoin = msg.minCoin;
    this.maxCoin = msg.maxCoin;
    this.baseCoin = msg.baseCoin;
    this.roomIndex = msg.roomIndex;
    this.flag = msg.flag;
    this.watcher = {};
    this.isStart = false;
}
util.inherits(Table, events.EventEmitter);

Table.prototype.getDeskFee = function () {
    return !! this.mid ? 0 : Math.round(this.baseCoin * 0.08);
}

Table.prototype.getSysFee = function () {
    return 0;
}

// 代开放解散
// Table.prototype.dissolution = function(uid,cb){
//     cb = cb || function(){}
//     if (uid != this.creatorID) {
//         return cb({code:Code.FAIL,msg:"不是创建者,不能解散房间!"});
//     }
//     if (this.players.length > 0) {
//         return cb({code:Code.FAIL,msg:"已经有玩家在房间,无法解散房间!"});
//     }
//     var self = this;
//     return ddz_db.Table.findOne({
//         attributes:['isDrop','tableID'],
//         where:{
//             tableID:self.tableID,
//             isDrop:0
//         }
//     }).then(function(tt){
//         if(!tt){
//             return cb(null,{code:Code.FAIL,msg:'数据库中无此牌局'});
//         }
//         tt.isDrop = 1;
//
//         tt.dropDate = new Date();
//         return tt.save({
//             attributes:['isDrop','dropDate']
//         }).then(function(){
//             cb(null,{code:Code.OK});
//             self.stop();
//         });
//
//     }).catch(function(err){
//         logger.error("rpc.gameSSS.gameRemote.drop:"+err);
//         return cb(null,{code:Code.FAIL,msg:err});
//     });
// }

Table.prototype.drop = function(player,cb){
    cb = cb || function(){}
    var self = this;

    cb(null,{code:Code.OK});
    self.emit("ddz_onDropTable",player);
    self.stop();
}
Table.prototype.getPlayer = function(chairNo){
    for(var i in this.players){
        if(this.players[i].chairNo == chairNo){
            return this.players[i];
        };
    }
    return null;
 }
Table.prototype.getPlayerByID = function(uid){
    for(var i in this.players){
        if(this.players[i].uid == uid){
            return this.players[i];
        };
    }
    return null;
}
Table.prototype.getNextPlayer = function(chairNo){
    if(this.players.length < 2){
        return null;
    }
    if(chairNo == this.seatNumber){
        for (var i = 1; i <= chairNo - 1; i++) {
            var player = this.getPlayer(i);
            if(!!player){
                return player;
            }
        }
    } else {
        for (var i = chairNo + 1; i <= this.seatNumber; i++) {
            var player = this.getPlayer(i);
            if(!!player){
                return player;
            }
        }
        for (var i = 1; i <= chairNo - 1; i++) {
            var player = this.getPlayer(i);
            if(!!player){
                return player;
            }
        }
    }
    return null;
}
Table.prototype.getPreviousPlayer = function(chairNo){
    if(this.players.length < 2){
        return null;
    }
    if(chairNo == 1){
        for (var i = this.seatNumber; i >= 1; i--) {
            var player = this.getPlayer(i);
            if(!!player){
                return player;
            }
        }
    } else {
        for (var i = chairNo - 1; i >= 1; i--) {
            var player = this.getPlayer(i);
            if(!!player){
                return player;
            }
        }
        for (var i = this.seatNumber; i >= chairNo + 1; i--) {
            var player = this.getPlayer(i);
            if(!!player){
                return player;
            }
        }
    }
    return null;
}
Table.prototype.existsPlayer = function(chairNo){
    return this.players.some(function(player){
        return player.chairNo == chairNo;
    });
}
Table.prototype.exists = function(uid){
    return this.players.some(function(player){
        return player.uid == uid;
    });
}
Table.prototype.getEmptySeat = function(){
    var chairNo = 0;
    for (var i = 1; i <= this.seatNumber; i++) {
        if(!this.existsPlayer(i)){
            chairNo = i;
            break;
        }
    }
    logger.info("desk:",this.tableNo,"Table.getEmptySeat():chairNo:",chairNo);
    return chairNo;
}

Table.prototype.getEmptySeatCount = function(){
    var count = 0;
    for (var i = 1; i <= this.seatNumber; i++) {
        if(!this.existsPlayer(i)){
            count++
        }
    }
    return count;
}

Table.prototype.add = function(player,cb){
    cb = cb || function () {};

    if(this.game && this.game.gameStage == GameStage.PLAY){
        console.log("------>table add",this.game.gameStage);
        return cb(null,{code:Code.FAIL,msg:"牌局已经开始，不能加入"});
    }
    if(this.exists(player.uid)){
        return cb(null,{code:Code.FAIL,msg:"您已加入牌局"});
    }
    var chairNo = this.getEmptySeat();
    if(!chairNo){
        return cb(null,{code:Code.FAIL,msg:"人数已满"});
    }
    if(player.coin >= this.maxCoin){
        return cb(null,{code:Code.FAIL,msg:"金币太多了~"});
    }

    if(player.coin <= this.minCoin){
        return cb(null,{code:Code.FAIL,msg:"金币太少了~"});
    }
    this.players.push(player);
    cb(null,{code:Code.OK});
}
Table.prototype.remove = function(uid){
    var len = this.players.length;
    for (var i = 0; i < len; i++) {
        if(this.players[i].uid == uid){
            this.players.splice(i,1);
            break;
        }
    }

    if(! this.mid){
        pomelo.app.rpc.robotMaster.masterRemote.onPlayerExitDesk(null,{uid:uid,deskName:this.tableNo,gameType:gameType},function (err,res) {
            if(!! err){
                console.log('notify robot exit desk failed with err message',err.message);
            }
        });
    }
}

Table.prototype.cancelTrust = function (player,cb) {
    cb = cb || function () {}

    if(! player.isTrust){
        return cb(null,{code:Code.FAIL,msg:"已经取消托管了"})
    }
    player.isTrust = false;
    if(!! this.game){
        player.clearTimer();
        player.timeoutOutCard(this.game);
    }
    cb(null,{code:Code.OK});
    this.emit("ddz_onCancelTrust",player);
}

Table.prototype.clearTickWait = function(){
    if(!!this.tickWait){
        clearTimeout(this.tickWait);
        delete this.tickWait;
    }
}

Table.prototype.playerReady = function(uid,cb){
    cb = cb || function(){};
    if(!!this.game && this.game.gameStage == GameStage.PLAY){
        console.log("已经在小局游戏中,不能按下准备");
        return cb(null,{code:Code.FAIL,msg:'已经在小局游戏中,不能按下准备'});
    }

    var player = this.getPlayerByID(uid);
    if(!!player.isReady){
        cb(null,{code:Code.FAIL,msg:'已经准备好了'})
        return;
    }
    //
    var self = this;
    if(player.coin < this.minCoin){
        this.kickPlayer(player,function (err,res) {
            if(!!err){
                console.log('kickPlayer is error')
                return;
            }
            player.isKick = true;
            console.log('kickPlayer res:',res)
            if(res.code == 200){
                self.emit("ddz_onKickPlayer",player,"金币不足,请先充值");
            }
        })
        cb(null,{code:Code.FAIL,msg:'金币不足'})
        return;
    }

    player.isReady = true;

    var ppList = this.players.filter(function(item){
        return !!item.isReady && !!item.chairNo;
    });

    if(!!ppList && ppList.length >=MAX_PLAYER){
        this.isStart = true;
        this.clearTickWait();
        this.startGame();
    }
    cb(null,{code:Code.OK});
}

Table.prototype.kickPlayer = function(player,cb){
    cb = cb || function () {
        };
    if (!!this.game && !!this.game.gameStage) {
        cb(null, {code: Code.FAIL, msg: '此牌局已经开始'})
        return;
    }
    if(!!player.isTrust){
        this.cancelTrust(player,function(err,res){});
    }
    this.remove(player.uid);

    cb(null, {code: Code.OK});
}

Table.prototype.start = function(cb){
    cb = cb || function(){};
    // if(!!this.isStart){
    //     cb(null,{code:Code.FAIL,msg:'此牌局已经开始'})
    //     return;
    // }
    var sitPlayers = this.players.filter(function(p){
        return !!p.chairNo;
    });
    if(sitPlayers.length  < 3){
        cb(null,{code:Code.FAIL,msg:'牌局入座人数不够,不能开始'});
        return;
    }

    if (this.disTimer) {
        clearTimeout(this.disTimer);
        this.disTimer = null;
    }

    //this.isStart = true;
    cb(null,{code:Code.OK});
    this.emit("ddz_onTableStart");
    this.startGame();
}

Table.prototype.startGame = function(cb){
    cb = cb || function(){};

    var sitPlayers = this.players.filter(function(p){
        return !!p.chairNo && p.isReady;
    });
    if(sitPlayers.length  < 3){
        cb(null,{code:Code.FAIL,msg:'牌局入座人数不够不能开始'});
        return;
    }
    var self = this;
    var costDeskFee = function(cb){
        var funcs = [];
        var costFunc = function(player){
            var cf = function(callback){
                player.addCoin(- self.getDeskFee(),callback);
                log.insert({cmd:"coin_tax",gameType:gameType,uid:player.uid,deskName:self.tableNo,coin:self.getDeskFee()});
            }
            return cf;
        }

        for(var i = 0; i < self.players.length; i++){
            funcs.push(costFunc(self.players[i]));
        }

        async.parallel(funcs,function(err,results){
            if(!! err){
                return cb(err);
            }
            self.game = new Game(self);
            self.game.players = sitPlayers.slice(0);
            self.game.start();
            cb(null)
        })
    }
    costDeskFee(cb);
}

Table.prototype.restartGame = function (cb) {
    var sitPlayers = this.players.filter(function(p){
        return !!p.chairNo;
    });

    this.game = new Game(this);
    this.game.players = sitPlayers.slice(0);
    this.game.start();
}

Table.prototype.sitDown = function(player,chairNo,cb){
    logger.info("desk:",this.tableNo,"sitDown:chairNo:",chairNo);
    cb = cb || function(){};
    if(typeof chairNo != "number" || chairNo > this.seatNumber){
        cb(null,{code:Code.FAIL,msg:'座位号不正确'})
        return;
    }
    if(!!this.existsPlayer(chairNo)){
        cb(null,{code:Code.FAIL,msg:'此座位被占用'})
        return;
    }
    if(!!player.chairNo){
        cb(null,{code:Code.FAIL,msg:'请先站起才能入座到其它位置'})
        return;
    }

    player.chairNo = chairNo;
    player.pos = chairNo - 1;
    // if(! this.mid){
    //     pomelo.app.rpc.robotMaster.masterRemote.onPlayerEnterDesk(null,{uid:player.uid,deskName:this.tableNo,gameType:gameType},function (err,res) {
    //         if(!! err){
    //             console.log('notify robot sitdown err',err.message);
    //         }
    //     });
    // }
    cb(null,{code:Code.OK});
    //this.startGame();
}
Table.prototype.standUp = function(player,cb){//站起并不代表离开游戏，离开此桌，旁观
    cb = cb || function(){};
    if(!player.chairNo){
        cb(null,{code:Code.FAIL,msg:'你的座位号为0'})
        return;
    }
    if(!player.isGaming) {
        var chairNo = player.chairNo;
        player.chairNo = 0;
        cb(null, {code:Code.OK});
        this.emit("ddz_onTableStandUp",player,chairNo);
        //logger.info("desk:", this.tableNo, "standUp");
        return;
    }
}

Table.prototype.getDeskBasicInfo = function() {
    var info = {};
    var playerList = [];
    this.players.forEach(function(player){
        playerList.push(player.getBasicInfo());
    })

    info.playerInfo = playerList;
    info.deskInfo = {
        tableID:this.tableID,
        game:(!!this.game)?this.game.getGameInfo():null,
        playMethod:this.playMethod,//玩法
        isCardCounting:this.isCardCounting,//是否记牌
        gameTimes:this.gameTimes,//游戏次数
        bottomFraction:this.bottomFraction,//底分
        tableNo:this.tableNo,
        bombLimitType:this.bombLimitType,
        startDate:this.startDate,
    }
    return info;
}

Table.prototype.getPlayersInfo = function () {
    var playerList = [];
    this.players.forEach(function(player){
        playerList.push(player.getBasicInfo());
    });
    return playerList;
}

Table.prototype.getTableInfo = function(uid){
    var playerList = [];
    this.players.forEach(function(player){
        var playerID = player.uid;
        if(!! uid){
            playerID = uid;
        }
        playerList.push(player.getPlayerInfo(playerID));
    })

    //
    var previousUid = null;
    var previousOut = [];
    if(this.game && this.game.previousPlayer){
        var previousPlayer = this.game.previousPlayer;
        previousUid = previousPlayer.uid;
        var lastOut = previousPlayer.outList[previousPlayer.outList.length - 1];
        lastOut.list.forEach(function (card) {
            previousOut.push({value:card.value,type:card.type,marked:card.isMarked()});
        })
    }

    var tableInfo = {
        players:playerList,
        tableID:this.tableID,
        game:(!!this.game)?this.game.getGameInfo():null,
        playerCallTimeSpan:Player.TICK_CALL_SPAN,
        playerPlayTimeSpan:Player.TICK_PLAY_SPAN,
        playerApplyDropTimeSpan:Player.TICK_APPLY_DROP_SPAN,
        playerApplyAnswerTimeSpan:Player.TICK_ANSWER_DROP_SPAN,
        playMethod:this.playMethod,//玩法
        //allowGameTimes:this.allowGameTimes,//牌局里允许的游戏次数
        isCardCounting:this.isCardCounting,//是否记牌
        //isApplyStage:this.isApplyStage,//是否处于申请阶段
        //isStart:this.isStart,
        //isStop:this.isStop,
        gameTimes:this.gameTimes,//游戏次数
        bottomFraction:this.bottomFraction,//底分
        tableNo:this.tableNo,
        //creatorID:this.creatorID,
        bombLimitType:this.bombLimitType,
        //isReplace:this.isReplace,
        //fangOwnerID:this.fangOwnerID
        baseCoin:this.baseCoin,
        roomIndex:this.roomIndex,
        flag:this.flag,
        maxPlayer:this.maxPlayer,
        previousUid:previousUid,
        previousOut:previousOut,
        matchId:this.mid,
    }
    return tableInfo;
}
Table.prototype.clear = function(){
    if(!this.players){
        return ;
    }
    this.players.forEach(function(player){
        if(!!player.tickCall){
            clearTimeout(player.tickCall);
        }
        if(!!player.tickPlay){
            clearTimeout(player.tickPlay);
        }
        if(!!player.tickApplyDrop){
            clearTimeout(player.tickApplyDrop);
        }
        if(!!player.tickAnswerDrop){
            clearTimeout(player.tickAnswerDrop);
        }

    });
    this.players = [];
    if(!!this.game){
        this.game.clear();
        this.game = null;
    }
}
Table.prototype.clearTickAnswerDrop = function(player){
    logger.info("desk:",this.tableNo,"tickAnswerDrop");
    if(!!player && !!player.tickAnswerDrop){
        clearTimeout(player.tickAnswerDrop);
    }
}

Table.prototype.clearTickApplyDrop = function(player){
    logger.info("desk:",this.tableNo,"clearTickApplyDrop");
    if(!!player && !!player.tickApplyDrop){
        clearTimeout(player.tickApplyDrop);
    }
}
// Table.prototype.startTickApplyDrop = function(player){
//     logger.info("desk:",this.tableNo,"startTickApplyDrop:",player.playerID);
//     var self = this;
//     this.clearTickApplyDrop(player);
//     player.tickApplyDrop = setTimeout(function(){
//         self.applyDropStop(); //结束申请
//         player.tickApplyDrop = null;
//
//     },Player.TICK_APPLY_DROP_SPAN);
// }
//
// Table.prototype.applyDropStart = function(player,cb){
//     cb = cb || function(){};
//     if(this.isApplyStage){
//         return cb(null,{code:Code.FAIL,msg:'已经有人申请解散游戏了'})
//     }
//     player.isApplier = true;
//     this.isApplyStage = true;
//
//     cb(null,{code:Code.OK});
//     this.emit("ddz_onApplyDrop",player);
//     this.startTickApplyDrop(player); //启动倒记时
// }
// Table.prototype.applyDropStop = function(){
//     console.log('Table applyDropStop')
//     var agreeList = this.players.filter(function(p){
//         return !!p.chairNo && p.answerStatus == 1;
//     });
//     var answerList = this.players.filter(function(p){
//         return (!!p.chairNo && p.answerStatus > 0 && !p.isApplier);
//     });
//
//     var self = this;
//     this.players.forEach(function(p){
//         if(!!p.isApplier){
//             p.isApplier = false;//是否是申请者
//             if(agreeList.length >= 1 || answerList.length <= 0){//有人同意或无人回答,解散房间
//                 self.drop(p);
//                 console.log('applyDropStop---', p.playerID);
//             }
//             self.clearTickApplyDrop(p);
//         }
//     });
//     this.isApplyStage = false;
//     this.players.forEach(function(p){
//         p.answerStatus = 0;//回答状态,0.未作回答,1.同意,2.拒绝
//     });
//
// }
// Table.prototype.answerDrop = function(player,agree,cb){
//     cb = cb || function(){};
//     if(!!player.answerStatus){
//         return cb(null,{code:Code.FAIL,msg:'您已经回答过了'})
//     }
//     if(!this.isApplyStage){
//         return cb(null,{code:Code.OK,msg:'申请解散流程已结束,请重新发起申请'})
//     }
//     if(!!player.isApplier){
//         return cb(null,{code:Code.FAIL,msg:'解散牌局发起者不能作答'})
//     }
//     player.answerStatus = agree;
//
//     cb(null,{code:Code.OK});
//     this.emit("ddz_onAnswerDrop",player,agree);
//
//     var agreeList = this.players.filter(function(p){
//         return !!p.chairNo && p.answerStatus == 1;
//     });
//     var answerList = this.players.filter(function(p){
//         return (!!p.chairNo && p.answerStatus > 0 && !p.isApplier);
//     });
//     if(agreeList.length >= 1 || answerList.length >= 2){//有1人回答,结束申请
//         this.applyDropStop();
//     }
// }

//旁观
Table.prototype.addWatcher = function(user){
    this.watcher[user.uid] = user;
}

Table.prototype.getMyWatcher = function(uid){
    var player = this.getPlayerByID(uid);
    if(! player){
        return [];
    }
    var watchers = [];
    for(var u in this.watcher){
        if(this.watcher[u].pos == player.pos){
            watchers.push({uid:u, isAgree:this.watcher[u].watcherUid==uid, nickName:this.watcher[u].nickName});
        }
    }
    return watchers;
}

Table.prototype.watchApply = function(msg){
    var player = this.getPlayerByID(msg.uid);
    if(! player){
        return;
    }
    var watcher = this.watcher[msg.watcherUid];
    if(! watcher) {
        return;
    }
    
    this.emit("ddz_onWatchCard",player);
}

Table.prototype.resetMyWatcher = function(uid){
    var watchers  = this.getMyWatcher(uid);
    for(var i = 0; i < watchers.length; i++){
        var watcher = watchers[i];
        watcher = this.watcher[watcher.uid];
        watcher.isAgree = false;
        delete watcher.watcherUid;
    }
}

Table.prototype.watchAnswer = function(msg){
    var player = this.getPlayerByID(msg.uid);
    if(! player){
        return;
    }
    var watcher = this.watcher[msg.watcherUid];
    if(! watcher){
        return;
    }
    var data = {
        uid:msg.watcherUid,
        targetUid:msg.uid,
        isAgree:msg.isAgree
    }
    if(msg.isAgree){
        watcher.watcherUid = msg.uid;
        watcher.isAgree = msg.isAgree;
        data.cards = player.getHandCards();
    }else{
        watcher.isAgree = false;
        if (watcher.watcherUid) {
            delete watcher.watcherUid;
        }
    }
    this.emit("ddz_onWatchAnswer", msg.watcherUid, data);
}

var GameStage = {
    CALL: 1,//叫牌。
    PLAY: 2,//玩牌。
    NULL:0 //未在游戏中
}
var Game = function(table){
    this.players = [];//在游戏中玩的玩家
    this.table = table;//桌子
    this.board = []//三张底牌放在台面上
    this.gameStage = GameStage.NULL;
    this.landlord = null;//地主
    this.deck = null;//一副牌
    this.currentPlayer = null;
    this.firstPlayer = null;
    this.previousPlayer = null;
    this.callFraction = 0;//叫分
    this.robMultiple = 0;//抢地主倍数1,2,4,8,16,抢一次增加一倍
    this.springFaction = 0;//春天
    this.bombFraction = 0;//炸弹倍率
    this.gameRecord = {
        messageList:[]
    };//一局游戏的牌谱记录
    this.gameResult = {};
    this.rate = 1;//倍率
    this.maxCallFraction = 0;//当局最大叫分
    this.openCardInfo = {}//明牌信息
}
Game.prototype.getDeckCards = function(){
    var deckCards = [];//台面
    if(!this.deck){
        return [];
    }
    this.deck.list.forEach(function(item){
        var card = {
            value:item.value,
            type:item.type
        }
        deckCards.push(card);
    });
    return deckCards;
}
Game.prototype.getGameInfo = function(){
    var board = [];//台面
    var self = this;
    this.board.forEach(function(item){
        var card = {
            value:item.value,
            type:item.type
        }
        board.push(card);
    });
    var currentCallPlayerID = 0;
    if(this.gameStage == GameStage.CALL && !!this.callPlayer){
        currentCallPlayerID = this.callPlayer.uid;
    }
    var gameInfo ={
        board:board,//台面
        gameStage:this.gameStage,
        landlord:(!!self.landlord)?self.landlord.uid:0,
        currentPlayer:(!!this.currentPlayer)?this.currentPlayer.uid:0,
        currentCallPlayer:currentCallPlayerID,
        callFraction:this.callFraction,//叫分
        robMultiple:this.robMultiple,//抢地主倍数1,2,4,8,16,抢一次增加一倍
        springFaction:this.springFaction,//春天
        bombFraction:this.bombFraction,//炸弹倍率
        rate:this.rate,//总倍率
        openCardInfo:this.openCardInfo//明牌信息
    }
    return gameInfo;
}
Game.prototype.getPlayerByID = function(uid){
    for(var i in this.players){
        if(this.players[i].uid == uid){
            return this.players[i];
        };
    }
    return null;
}
Game.prototype.getNextPlayer = function(chairNo){
    if(this.players.length < 2){
        return null;
    }
    if(chairNo == this.table.seatNumber){
        for (var i = 1; i <= chairNo - 1; i++) {
            var player = this.table.getPlayer(i);
            if(!!player && player.isGaming){
                return player;
            }
        }
    } else {
        for (var i = chairNo + 1; i <= this.table.seatNumber; i++) {
            var player = this.table.getPlayer(i);
            if(!!player && player.isGaming){
                return player;
            }
        }
        for (var i = 1; i <= chairNo - 1; i++) {
            var player = this.table.getPlayer(i);
            if(!!player && player.isGaming){
                return player;
            }
        }
    }
    return null;
}

Game.prototype.getPreviousPlayer = function(chairNo){
    if(this.players.length < 2){
        return null;
    }
    if(chairNo == 1){
        for (var i = this.table.seatNumber; i >= 1; i--) {
            var player = this.table.getPlayer(i);
            if(!!player && player.isGaming){
                return player;
            }
        }
    } else {
        for (var i = chairNo - 1; i >= 1; i--) {
            var player = this.table.getPlayer(i);
            if(!!player && player.isGaming){
                return player;
            }
        }
        for (var i = this.table.seatNumber; i >= chairNo + 1; i--) {
            var player = this.table.getPlayer(i);
            if(!!player && player.isGaming){
                return player;
            }
        }
    }
    return null;
}

Game.prototype.dealDeck = function () {
    var showCardIndex,showCard;
    for(var i = 0; i < this.deck.list.length; i++){
        var card = this.deck.list[i];
        if(card.isMarked()){
            showCardIndex = i;
            showCard = card;
            break;
        }
    }
    var uid = this.table.getPlayer((showCardIndex%MAX_PLAYER)+1).uid;
    this.openCardInfo.card = {value:showCard.value,type:showCard.type};
    this.openCardInfo.uid = uid;
    this.table.emit("ddz_onDealDeck",showCardIndex,showCard,uid);
}

Game.prototype.dealHandCards = function(){
    var self = this;
    // this.players.forEach(function(player){
    //     var cards = self.deck.dispatch(2);
    //     player.handCards = new poker.Cards();
    //     cards.forEach(function(card){
    //         player.handCards.add(card);
    //     })
    //     player.handCards.sort();
    //     self.table.emit("ddz_onDealHandCards",player);
    // });
    var MAX_PLAYER = 3;
    var HAND_CARDS_COUNT = 17;
    var cards = self.deck.dispatch(MAX_PLAYER * HAND_CARDS_COUNT);
    var player = self.table.getPlayer(1);
    cards.forEach(function (card) {
        player.handCards.add(card);
        if(card.value == self.openCardInfo.card.value && card.type == self.openCardInfo.card.type){
            self.openCardInfo.index = player.handCards.size;
        }
        player = self.getNextPlayer(player.chairNo);
    })
    this.players.forEach(function (player) {
        //player.handCards.sort();
        self.table.emit("ddz_onDealHandCards",player);
    })
    this.table.emit("ddz_onWatcherDealHandCards");
    //自动整理手牌
    player.handCards.sort();
}



Game.prototype.exists =function(player){
    if(!player){
        return false;
    }
    return this.players.some(function(item){
        return item.equals(player);
    });
}
Game.prototype.add = function(player){
    if(!this.exists(player)){
        this.players.push(player);
        return true;
    }
    return false;
}
Game.prototype.remove = function(player){
    var len = this.players.length;
    for (var i = 0; i < len; i++) {
        if(this.players[i].equals(player)){
            this.players.slice(i,1);
            return true;
        }
    }
    return false;
}

Game.prototype.rob =function(player,cb){
    cb = cb || function(){};
    if(!player.isGaming){
        cb(null,{code:Code.FAIL,msg:'此玩家未在游戏中'})
        return;
    }
    if(!player.isAllowOperate) {
        cb(null,{code:Code.FAIL,msg:'还未轮到此玩家操作'})
        return;
    }

    if(!player.equals(this.callPlayer)){
        cb(null,{code:Code.FAIL,msg:'此玩家不是当前叫牌玩家'})
        return false;
    }
    if(this.table.playMethod != 2){
        cb(null,{code:Code.FAIL,msg:'玩牌方式不对'})
        return false;
    }
    if(this.gameStage != GameStage.CALL){
        cb(null,{code:Code.FAIL,msg:'不在叫牌阶段,不能抢地主'})
        return false;
    }
    player.isAllowOperate = false;
    player.callTimes++;
    player.addCallTime++;
    this.robMultiple = this.robMultiple * 2;
    player.robMultiple = player.robMultiple*2;
    if(player.callFraction == 3){
        this.landlord = player;
    }

    cb(null,{code:Code.OK});

    //this.rate = this.table.bottomFraction* this.callFraction*this.robMultiple;
    this.calcRate();
    this.table.emit("ddz_onRob",player);

    //处理叫牌流程
    this.progressCall(player);

}

Game.prototype.passCall =function(player,cb){//过
    cb = cb || function(){};
    if(!player.isGaming){
        cb(null,{code:Code.FAIL,msg:'此玩家未在游戏中'})
        return;
    }
    if(!player.isAllowOperate) {
        cb(null,{code:Code.FAIL,msg:'还未轮到此玩家操作'})
        return;
    }
    if(!player.equals(this.callPlayer)){
        cb(null,{code:Code.FAIL,msg:'此玩家不是当前叫牌玩家'})
        return false;
    }
    if(this.gameStage != GameStage.CALL){
        cb(null,{code:Code.FAIL,msg:'不在叫牌阶段,不能操作'})
        return false;
    }

    player.isAllowOperate = false;
    if(this.callFraction*this.robMultiple > 3){
        player.passCall = 2;
    } else {
        player.passCall = 1;
    }

    player.callTimes++;

    cb(null,{code:Code.OK});
    this.table.emit("ddz_onPassCall",player);
    //处理叫牌流程
    this.progressCall(player);
}
Game.prototype.call =function(player,msg,cb){
    cb = cb || function(){};
    if(!player.isGaming){
        cb(null,{code:Code.FAIL,msg:'此玩家未在游戏中'})
        return;
    }
    if(!player.isAllowOperate) {
        cb(null,{code:Code.FAIL,msg:'还未轮到此玩家操作'})
        return;
    }

    if(!player.equals(this.callPlayer)){
        cb(null,{code:Code.FAIL,msg:'此玩家不是当前叫牌玩家'})
        return false;
    }
    if(parseInt(msg.callFraction) <= this.callFraction){
        cb(null,{code:Code.FAIL,msg:'叫分不能低于上一玩家的叫分'})
        return false;
    }
    if(this.gameStage != GameStage.CALL){
        cb(null,{code:Code.FAIL,msg:'不在叫牌阶段,不能操作'})
        return false;
    }
    player.isAllowOperate = false;
    player.callFraction = msg.callFraction;//叫的分
    player.callTimes++;
    player.addCallTime++;
    player.clearTimer();
    this.callFraction = msg.callFraction;
    if(player.callFraction > this.maxCallFraction){
        this.maxCallFraction = player.callFraction;
        this.landlord = player;
    }

    cb(null,{code:Code.OK});

    //this.rate = this.table.bottomFraction* this.callFraction*this.robMultiple;
    this.calcRate();
    this.table.emit("ddz_onCall",player);

    //处理叫牌流程
    this.progressCall(player);

}
Game.prototype.stopCall = function(){
    var pList = this.players.filter(function(player){//有三个pass
        return !!player.passCall;
    });

    if(!!pList && pList.length >=3){//三个pass
        // if(this.table.gameTimes >= this.table.allowGameTimes){
        //     return this.table.stop();
        // }
        // else {
        //     return this.table.startGame();
        // }
        console.log("------>restartGame");
        return this.table.restartGame();
    } else {
        //取地主
        var pList = null;
        if (this.table.game.robMultiple >=2) {//抢地主
            var chairSet = {};
            chairSet[this.firstPlayer.uid] = 3;

            var nextPlayer = this.getNextPlayer(this.firstPlayer.chairNo);
            chairSet[nextPlayer.uid] = 2;

            nextPlayer = this.getNextPlayer(nextPlayer.chairNo);
            chairSet[nextPlayer.uid] = 1;

            pList = this.players.sort(function(p1,p2){
                if (p2.addCallTime == p1.addCallTime) {
                    return chairSet[p1.uid] - chairSet[p2.chairNo];
                }
                else {
                    return p2.addCallTime - p1.addCallTime;
                }
            });
        } else {
             pList = this.players.sort(function(p1,p2){
                return p2.callFraction - p1.callFraction;
            });
        }

        this.landlord = pList[0];

        //转发地主
        this.table.emit("ddz_onLandLord",this.landlord);
        this.dealBoard();//发3张底牌

        this.table.emit("ddz_onStopCall");
        this.playStage();//游戏阶段
    }
}
Game.prototype.playStage = function(){
    this.gameStage = GameStage.PLAY;
    this.currentPlayer = this.landlord;
    this.firstPlayer = this.landlord;
    this.table.emit("ddz_onStartPlay");
    //发送操作码
    this.sendOperateCodeImmediate(this.landlord);
}
Game.prototype.isCallOver = function(){
    if(this.table.playMethod == 1) {
        //叫分
        if(this.callFraction >= 3){//有人叫3分,结束叫牌
            return true;
        }
        var someOneNoCall = this.players.some(function(player){
            return player.callTimes <= 0;
        });
        if(!!someOneNoCall){//有些人未叫,不能结束
            return false;
        }

        return true;
        /*
        var pList = this.players.filter(function(player){//有两个pass
            return !!player.passCall;
        });
        if(!!pList && pList.length >=2){//两个或三个pass
            console.log("call over with pass");
            return true;
        }
        return false;
        */
    }

    if (this.table.playMethod == 2) {//抢地主
        var someOneNoCall = this.players.some(function(player){
            return player.callTimes <= 0;
        });
        if(!!someOneNoCall){//有些人未叫,不能结束
            return false;
        }
        var pList = this.players.filter(function(player){//有两个pass
            return !!player.passCall;
        });
        if(!!pList && pList.length >=2){//两个或三个pass
            return true;
        }
        if(this.robMultiple >=8){//16
            return true;
        }
        return false;
    }
    if (this.table.playMethod == 3) {//叫地主
        if(this.callFraction >= 3){
            return true;
        }
        var someOneNoCall = this.players.some(function(player){
            return player.callTimes <= 0;
        });
        if(!!someOneNoCall){//有些人未叫,不能结束
            return false;
        }
        var pList = this.players.filter(function(player){//有两个pass
            return !!player.passCall;
        });
        if(!!pList && pList.length >=2){//两个或三个pass
            return true;
        }
        return false;
    }
}
Game.prototype.check =function(player,cardList){//查检牌型
    var entity = cardList.toEntity();
    if(!entity){//不符合牌型
        return false;
    }
    if(player != this.firstPlayer){//压牌
        var length = this.previousPlayer.outList.length;
        var previousOutCards = this.previousPlayer.outList[length-1];
        var previousEntity = previousOutCards.toEntity();
        if(entity.compareTo(previousEntity) <= 0){//压不过
            return false;
        }
    }

    //炸弹,2^炸弹次数,如果牌类型为炸弹,翻倍
    if(entity.pokerType == poker.PokerType.BOMB || entity.pokerType == poker.PokerType.ROCKET){
        // if((this.table.bombLimitType == 1)
        //     || (this.table.bombLimitType == 2 && this.bombFraction < 8)
        //     || (this.table.bombLimitType == 3 && this.bombFraction < 16)
        //     || (this.table.bombLimitType == 4 && this.bombFraction < 16)){
        //     this.bombFraction = this.bombFraction*2;
        // }
        this.bombFraction += ONE_BOOM;
    }
    if(entity.pokerType == poker.PokerType.BOMB ){
        player.bombNumber++;
    }
    if(entity.pokerType == poker.PokerType.ROCKET){
        player.rocketNumber++;
    }
    return true;
}
Game.prototype.setSpring =function(){
    if(this.landlord.isWinner){
        var others = this.players.every(function (player) {
            return player.handCards.size == 17 || player.isWinner;
        });
        if(!!others){
            this.springFaction = ONE_SPRING;
            this.landlord.springNumber++;
        }
    } else  if(this.landlord.outList.length == 1){
            this.springFaction = ONE_SPRING;
    }

}

Game.prototype.canAutoOut = function (player) {
    //是否必出
    if(this.previousPlayer == null || this.previousPlayer.uid == player.uid){
        var card = player.handCards.list[0];
        return {out:true,cards:[{value:card.value,type:card.type}]};
    }
    //是否是队友
    var isPartnerOut = (this.previousPlayer.uid != this.landlord.uid) && (player.uid != this.landlord.uid) && (this.previousPlayer.uid != player.uid);
    if(! isPartnerOut){
        var length = this.previousPlayer.outList.length;
        var previousOutCards = this.previousPlayer.outList[length-1];
        var out = poker.hint(player.handCards,previousOutCards);
        if(out.length){
            var list = [];
            out[0].list.forEach(function (card) {
                list.push({value:card.value,type:card.type})
            })
            console.log("player=",player.uid," auto out cards=",list);
            return {out:true,cards:list}
        }
    }
    return {out:false,cards:null};
}

Game.prototype.out =function(player,msg,cb){

    cb = cb || function(){};
    if(!player.isGaming){
        cb(null,{code:Code.FAIL,msg:'此玩家未在游戏中'})
        return;
    }
    if(!player.isAllowOperate) {
        cb(null,{code:Code.FAIL,msg:'还未轮到此玩家操作'})
        return;
    }
    if(!player.equals(this.currentPlayer)) {
        cb(null,{code:Code.FAIL,msg:'此玩家不是当前玩家'})
        return;
    }
    if(this.gameStage != GameStage.PLAY) {
        cb(null,{code:Code.FAIL,msg:'未进入游戏阶段，不能出牌'})
        return;
    }
    if(!msg || !msg.cards || msg.cards.length <= 0) {
        cb(null,{code:Code.FAIL,msg:'出的牌不能为空'})
        return;
    }

    //检查客户端发给来的牌，是否是本玩家手中的牌
    var outCards = [];
    if(!!player.handCards){
        for(var i in msg.cards){
            var card = msg.cards[i];
            var exists = player.handCards.list.some(function (item) {
                return item.value == card.value && item.type == card.type;
            });
            if(!exists){
                return cb(null,{code:Code.FAIL,msg:'有不存在的牌'});
            }
            //将存在的mark保存
            for(var j = 0; j < player.handCards.list.length; j++){
                var pCard = player.handCards.list[j];
                if(pCard.value == card.value && pCard.type == card.type){
                    outCards.push(pCard);
                    break;
                }
            }
        }
    }

    var cardList = new poker.Cards(msg.cards);
    if(!this.check(player,cardList)){
        cb(null,{code:Code.FAIL,msg:'牌型不符合或大不过上一家'})
        return;
    }

    player.clearTimer();//出牌后 清除倒计时
    var outMarkedCards = [];
    if(player.uid == this.landlord.uid){
        var cards = msg.cards;
        for(var i = 0; i < this.board.length; i++){
            var boardCard = this.board[i];
            for(var j = 0; j < cards.length; j++){
                var card = cards[j];
                if(card.value == boardCard && card.type == boardCard.type){
                    outMarkedCards.push(boardCard);
                }
            }
        }
    }


    player.isAllowOperate = false;

    player.outList.push(cardList);
    player.handCards.removeList(cardList);

    console.log('player.out',outCards,'playerID:',player.uid);
    // if(player.handCards.size <=0){
    //     this.table.firstOutAllCardPlayer = player;
    // }
    player.pass = false;
    cb(null,{code:Code.OK});

    //this.rate = this.table.bottomFraction* this.callFraction*this.robMultiple * this.bombFraction *this.springFaction;
    this.calcRate();
    if(this.currentPlayer == this.firstPlayer){//出牌
        this.previousPlayer = null;
        this.table.emit("ddz_onOut",player,outCards,0);
    } else { //压牌
        this.firstPlayer = this.currentPlayer;
        this.table.emit("ddz_onOut",player,outCards,1);
    }
    this.previousPlayer = player;

    // if(!! outMarkedCards.length){
    //     this.table.emit("ddz_onMarkedCardOut",player,outMarkedCards);
    // }
    this.progress(player);
}
Game.prototype.pass =function(player,cb){
    cb = cb || function(){};
    if(!player.isGaming){
        cb(null,{code:Code.FAIL,msg:'此玩家未在游戏中'})
        return;
    }
    if(!player.isAllowOperate) {
        cb(null,{code:Code.FAIL,msg:'还未轮到此玩家操作'})
        return;
    }

    if(!player.equals(this.currentPlayer)) {
        cb(null,{code:Code.FAIL,msg:'此玩家不是当前玩家'})
        return;
    }
    if(this.currentPlayer == this.firstPlayer) {//出牌
        cb(null,{code:Code.FAIL,msg:'出牌玩家不能不出牌'})
        return;
    }
    if(this.gameStage != GameStage.PLAY) {
        cb(null,{code:Code.FAIL,msg:'未进入游戏阶段，不能过'})
        return;
    }
    player.isAllowOperate = false;
    player.clearTimer();
    player.pass = true;
    cb(null,{code:Code.OK});
    this.table.emit("ddz_onPass",player);

    this.progress(player);
}
Game.prototype.progress = function(player){
    //是否游戏结束
    if(this.canStopGame()){
        return this.stop();
    }
    console.log('next progress')
    //下一玩家
    this.currentPlayer = this.getNextPlayer(player.chairNo);
    this.sendOperateCodeImmediate(this.currentPlayer);
}
Game.prototype.getOperateCode = function(player){
    var previousPlayerID = 0;
    if(!!this.previousPlayer){
        previousPlayerID = this.previousPlayer.uid;
    }

    var code = {
        uid:player.uid,
        type:this.currentPlayer == this.firstPlayer ? 0:1,//0:出牌,1:压牌
        previousPlayerID:previousPlayerID
    }
    return code;
}
Game.prototype.canStopGame = function(){
    if(this.gameStage == GameStage.NULL){
        return false;
    }
    var someOne = this.players.some(function(player){
        return player.handCards.size <= 0;
    });
    if(!!someOne){
        return true;
    }
    return false;
}

Game.prototype.turnToCaller = function(player){
    this.callPlayer = player;
    var o ={
        playMethod:this.table.playMethod,
        callFraction:this.callFraction,
        allowRob:0
    }
    //叫地主开始,发送时带有类型
    if (this.table.playMethod == 2) {//抢地主
        o.allowRob = true;
    } else if (this.table.playMethod == 3) {//叫地主
        o.callFraction = 3;
    }
    player.isAllowOperate = true;
    player.timeoutCall(this);
    this.table.emit("ddz_onTurnToCaller",player,o);
}
Game.prototype.dealBoard = function(){
    this.board = [];
    var card1 = this.deck.dispatch();
    var card2 = this.deck.dispatch();
    var card3 = this.deck.dispatch();
    card1.mark();
    card2.mark();
    card3.mark();
    this.board.push(card1);
    this.board.push(card2);
    this.board.push(card3);
    this.board.sort(function (card1,card2) {
        return card1.compareTo(card2);
    })
    this.landlord.handCards.add(card1);
    this.landlord.handCards.add(card2);
    this.landlord.handCards.add(card3);
    console.log('ddz_onDealThreeCards')
    this.table.emit("ddz_onDealThreeCards",this.board);

}

Game.prototype.calcRate = function () {
    this.rate = this.maxCallFraction + this.bombFraction + this.springFaction;
}

Game.prototype.setFirstCaller = function(){
    // //指定叫牌玩家
    // if(!!this.table.firstOutAllCardPlayer){
    //     // this.firstPlayer = this.table.firstOutAllCardPlayer;
    //     // return this.table.firstOutAllCardPlayer.isFirstCaller = true;
    // }
    // else {
    //     // if (!this.table.firstPlayer) {
    //         var i = random(0,this.players.length);
    //         this.firstPlayer = this.players[i];
    //         this.table.firstPlayer = this.players[i];
    //         return this.players[i].isFirstCaller = true;
    //     // }
    //     // else {
    //     //     this.firstPlayer = this.table.firstPlayer;
    //     //     return this.firstPlayer.isFirstCaller = true;
    //     // }
    // }
    for(var i = 0; i < this.players.length; i++){
        var cards = this.players[i].handCards.list;
        for(var j = 0; j < cards.length; j++){
            var card = cards[j];
            if(card.isMarked()){
                this.firstPlayer = this.players[i];
                this.table.firstPlayer = this.firstPlayer;
                return this.players[i].isFirstCaller = true;
            }
        }
    }
    //第一位为首家
    this.firstPlayer = this.players[0];
    this.table.firstPlayer = this.firstPlayer;
    return this.players[0].isFirstCaller = true;
}
Game.prototype.progressCall = function(player){
    if(this.isCallOver()){
        this.stopCall();
    } else {
        var nextPlayer = this.getNextPlayer(player.chairNo);
        this.turnToCaller(nextPlayer)
    }
}
Game.prototype.callStage = function(){
    //开始叫牌
    this.gameStage = GameStage.CALL;
    this.table.emit("ddz_onStartCall");
    //设置首位叫牌玩家
    this.setFirstCaller();
    //设置叫牌玩家
    this.turnToCaller(this.firstPlayer);

}
Game.prototype.clearRaiseTimes = function(){
    logger.info("desk:",this.table.tableNo,"clearRaiseTimes");
    //清除加注次数
    this.players.forEach(function(player){
        player.raiseTimes = 0;
    });
}
Game.prototype.sendOperateCodeImmediate = function(player){
    if(!player || !player.isGaming){
        return
    }
    player.isAllowOperate = true;
    //发送操作码
    player.timeoutOutCard(this);
    waitTime = Player.TICK_PLAY_SPAN / 1000;
    this.table.emit("ddz_onOperateCode",player,this.getOperateCode(player),waitTime);
}

Game.prototype.markCardByIndex = function (index) {
    var card = this.deck.list[index];
    card.mark();
}

Game.prototype.start = function(){
    //通知机器人游戏开始
    if(! this.table.mid){
        pomelo.app.rpc.robotMaster.masterRemote.onGameStart(null,{deskName:this.table.tableNo,gameType:gameType},function (err,res) {
            if(!!err){
                console.log('notify robot start game failed',err.message);
            }
        });
    }

    var self = this;
    var freezePlayerCoin = function(cb){
        var funcs = [];
        var freezeFunc = function(player){
            var ff = function(callback){
                pomelo.app.rpc.usersvr.userRemote.freezeCoin(null,{uid:player.uid,freezeCoin:self.table.minCoin - self.table.getDeskFee()},function(err,res){
                    if(!! err){
                        return callback(err);
                    }
                    callback(null);
                })
            }
            return ff;
        }

        for(var i = 0; i < self.players.length; i++){
            funcs.push(freezeFunc(self.players[i]));
        }

        async.parallel(funcs,function(err,results){
            if(!! err){
                //return cb(err);
            }
            cb(null);
        })
    }

    var finalFunc = function(err,result){
        self.table.gameTimes++;
        self.players.forEach(function(player){
            player.clear();
            player.isGaming = true;
    
        });
        self.deck = new poker.Deck();
        //this.deck.sort();
        self.deck.shuffle(100);
        self.markCardByIndex(random(1,50));
        self.table.emit("ddz_onStartGame");//一局游戏开始
        self.dealDeck();//发牌堆
        self.dealHandCards();//发17张牌
    
        self.gameRecord.table = self.table.getTableInfo();
        self.callStage();//叫地主阶段
    }

    async.waterfall([freezePlayerCoin],finalFunc);
}

Game.prototype.trust = function (player, cb) {//托管
    cb = cb || function () {
        };
    if (!!player.isTrust) {
        return cb(null, {code: Code.FAIL, msg: '已经托管了'})
    }
    if (!player.isGaming) {
        return cb(null, {code: Code.FAIL, msg: '此玩家未在游戏中'})
    }

    if (this.gameStage != GameStage.PLAY) {
        return cb(null, {code: Code.FAIL, msg: '未进入游戏阶段，不能托管'})
    }

    player.isTrust = true;
    cb(null, {code: Code.OK});
    this.table.emit("ddz_onTrust", player);
}

Game.prototype.stop = function(){
    if(this.gameStage == GameStage.NULL){
        return;
    }
    this.gameStage = GameStage.NULL;
    this.table.isStart = false;
    console.log('game stop------>',this.gameStage);
    var self = this;
    var otherPlayer = this.players.filter(function (item1) {
        return item1.uid != self.landlord.uid;
    });
    if(this.landlord.handCards.size <= 0){
        this.landlord.isWinner = true;
        this.landlord.dzWinNumber++;
        otherPlayer.forEach(function (item2) {
            item2.isWinner = false;
        });
    } else {
        this.landlord.isWinner = false;
        otherPlayer.forEach(function (item3) {
            item3.isWinner = true;
            item3.nmWinNumber++;
        });
    }
    //设置春天
    this.setSpring();
    //计算分数
    this.calculateScore();
    //以小博大 && 不够扣
    this.players.forEach(function(p){
        if(p.score < 0){
            p.acScore = - Math.min(Math.abs(p.score),p.coin);
        }else{
            p.acScore = Math.min(p.score,p.coin);
        }
    })
    //计算实际输赢
    var self = this;
    var finalFunc = function(err,result){
        //
        if(!! err){
            console.log("ddz cost coin failed with error",err.message);
        }
        //摊牌
        var playerList = [];
        var robotRes = [];
        var isSpring = self.springFaction == 2 ? 1:0;
        var callFraction = self.callFraction;
        self.players.forEach(function(player){
            var p = {
                uid:player.uid,
                nickName:player.nickName,
                score:player.score,
                totalScore:player.coin,
                handCards:player.getHandCards(),
                isSpring:isSpring,
                callFraction:callFraction,
                baseCoin:self.table.baseCoin,
                pos:player.chairNo - 1,
                faceID:player.faceID,
                boomCnt:player.rocketNumber + player.bombNumber
            };
            playerList.push(p);
            player.clearTimer();//TODO:特意的处理 待移除
            var robot = {
                uid:player.uid,
                score:player.score,
            }
            robotRes.push(robot);
            log.insert({cmd:"ddz_endGame",deskName:self.table.tableNo,uid:p.uid,
                res:JSON.stringify({score:player.score,isSpring:isSpring,baseCoin:self.table.baseCoin,boomCnt:player.bombNumber+player.rocketNumber})});
            if(player.score > 0){
                log.insert({cmd:"coin_win",gameType:gameType,deskName:self.table.tableNo,coin:player.score,uid:player.uid});
            }else if(player.score < 0){
                log.insert({cmd:"coin_lose",gameType:gameType,deskName:self.table.tableNo,coin:player.score,uid:player.uid});
            }
        });
        //发礼券
        self.awardCoupon();
        self.table.emit("ddz_onStopPlay");
        self.table.emit("ddz_onStopGame");//一局游戏结束
        self.table.emit("ddz_onResult",playerList,isSpring);
        if(! self.table.mid){
            pomelo.app.rpc.robotMaster.masterRemote.onGameEnd(null,{deskName:self.table.tableNo,gameType:gameType,award:robotRes},function (err,res) {
                if(!! err){
                    console.log('notify robot game end failed',err.message);
                }
            })
        }
        //
        //游戏结束 玩家离桌
        if(!! self.table.mid){
            var uids = [];
            for(var i in self.table.players){
                uids.push(self.table.players[i].uid);
            }
            console.log("[coinDDZ Game.prototype.stop]------------------>>>",uids);
            pomelo.app.rpc.matchsvr.matchRemote.onGameEnd(null,{gameType:gameType,deskName:self.table.tableNo,uids:uids,mid:self.table.mid},function(){});
        }else{
            while(self.table.players.length){
                var player = self.table.players[0];
                if(!! player){
                    self.table.emit("ddz_onGameStopQuit",player);
                }
            }
        }
        //手动释放game
        if(!! self.table.game){
            self.table.game = null;
        }
    }

    //扣分
    var unfreezePlayerCoin = function(cb){
        var funcs = [];
        self.players.forEach(function(p){
            var func = function(callback){
                pomelo.app.rpc.usersvr.userRemote.unfreezeCoin(null,{
                    uid:p.uid
                },function (err,user) {
                    callback(null);
                })
            }
            funcs.push(func);
        })
        async.parallel(funcs,function(err,res){
            if(!! err){
                return cb(err);
            }
            cb(null);
        })
    }

    var costCoin = function(cb){
        var funcs = []
        self.players.forEach(function(p){
            var func = function(callback){
                p.addCoin(p.acScore,callback);
            }
            funcs.push(func);
        })

        async.parallel(funcs,function(err,res){
            if(!! err){
                return cb(err);
            }
            cb(null);
        })
    }
    async.waterfall([unfreezePlayerCoin,costCoin],finalFunc);
}
Game.prototype.saveWar = function(){
    //保存当局牌谱到数据库
    // var gameType = "coinDDZ"
    // var tableId = this.table.tableID;
    // var deskName = this.table.tableNo;
    // var roundIndex = this.table.gameTimes;
    // var record = JSON.stringify(this.gameRecord);
    // var result = JSON.stringify(this.gameResult);
    // app.rpc.singlesvr.gameRecordRemote.saveGameRecord(null,gameType, tableId, deskName, roundIndex, record, result,function () { });
    // war_record_db.GameWarRecord.create({
    //     tableID: this.table.tableID,
    //     tableNo:this.table.tableNo,
    //     gameTimes:this.table.gameTimes,
    //     content:JSON.stringify(this.gameRecord),
    //     result:JSON.stringify(this.gameResult),
    // });
}

Game.prototype.clear = function(){
    var self = this;
    if(!!this.players){
        this.players.forEach(function(player){
            player.clear();
            self.table.clearTickApplyDrop(player);
            self.table.clearTickAnswerDrop(player);
        });
    }

    this.gameRecord.playerList = [];
    this.gameRecord.messageList = [];
    this.players = [];
    this.board = []//底牌
}
/**
 * 小局得分=底分*胜负倍率*角色倍率*地主叫分*炸弹倍率*春天倍率。
 * 例：叫分模式地主叫3倍，地主胜利，共打出2个炸弹，没有春天。
 * 则地主得分=底分*胜负倍率*角色倍率*地主叫分*炸弹倍率*春天倍率=1*1*2*3*4*1=24
 * 农民得分=底分*胜负倍率*角色倍率*地主叫分*炸弹倍率*春天倍率=1*（-1）*1*3*4*1=-12
 */
Game.prototype.calculateScore = function(){//处理结算
    var bottomFraction = this.table.bottomFraction;
    var self = this;
    this.players.forEach(function(player){
        var winFraction = player.isWinner ? 1: -1;
        var roleFaction = 1;
        if(player.equals(self.landlord)){
            roleFaction =  2;
        }
        player.score = winFraction * roleFaction * self.table.baseCoin * ( self.maxCallFraction + self.bombFraction  + self.springFaction );
    });
}

Game.prototype.awardCoupon = function(){
    //礼券功能 高级场 或者 精英场才有
    var self = this;
    if(self.table.roomIndex >= 3){
        var uids = [];
        var result = {}
        self.table.players.forEach(function(pp){
            uids.push(pp.uid);
            result[pp.uid] = pp.score;
        })
        pomelo.app.rpc.usersvr.userRemote.getGameData(null,{uids:uids},function(err,response){
            if(!! err){
                console.log("awardCoupon err:------->>>",err.message);
                return;//do nothing
            }
            for(var uid in response){
                response[uid] = JSON.parse(response[uid]);
            }
            for(var key in response){
                var info = response[key];
                if(result[key] > 0){
                    if(info.giftGameType == gameType && info.giftRoomIndex == self.table.roomIndex){
                        info.giftWinTimes++;
                        if(info.giftWinTimes == 5){
                            info.giftWinTimes = 0;
                            var awardCouponCount = 0;
                            if(self.table.roomIndex == 3){
                                awardCouponCount = 15;
                            }else if(self.table.roomIndex == 4){
                                awardCouponCount = 100;
                            }
                            pomelo.app.rpc.usersvr.userRemote.addCoupon(null,{uid:key,deltaCoupon:awardCouponCount},function(err,result){
                                if(!! err){
                                    return;
                                }
                                var player = self.table.getPlayerByID(result.uid);
                                if(!! player){
                                    var msg = "恭喜您 获得" + result.coupon + "张礼券";
                                    self.table.emit("ddz_onAward",result.uid,msg);
                                }
                            })
                        }
                    }else{
                        info.giftGameType = gameType;
                        info.giftRoomIndex = self.table.roomIndex;
                        info.giftWinTimes = 1;
                    }
                }else{
                    info.giftGameType = gameType;
                    info.giftRoomIndex = self.table.roomIndex;
                    info.giftWinTimes = 0;
                }
            }
            //存数据
            pomelo.app.rpc.usersvr.userRemote.setGameData(null,{response:response},function(err,result){})
        })
    }
}

module.exports = {
    Player:Player,
    Table:Table,
    Game:Game,
    GameStage:GameStage,
}