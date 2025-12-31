var poker = require("./pdkPoker.js");
var events = require("events");
var util = require('util');
var logger = require('pomelo-logger').getLogger(__filename);
var Code = require('../../../../shared/code');
var pdk_db = require('../../../lib/pdk_db');

var checkUtil =require('../../../../shared/checkUtil');
logger.info = function(){};

var random = function(min,max){
    return Math.floor(min+Math.random()*(max-min));
}

/**
 * game player
 * @constructor
 */
var Player = function(playerID){
    this.playerID = playerID;
    this.score = 0;//积分
    this.totalScore = 0;//积分
    this.handCards = null;//手中的牌
    this.isGaming = false;//是否在游戏中
    this.chairNo = 0;//座位
    this.isAllowOperate = false;//是否允许此玩家操作
    this.tickPlay = null;//玩牌倒记时
    this.tickApplyDrop = null;//申请解散房间倒记时
    this.outList = [];//出过的每一手牌组成的列表
    this.nickName = "";//昵称u
    this.faceID = "";//头像
    this.disconnected = false;//是否断线

    this.isReady = false;//是否准备好，小局游戏开始之前用,第一局不用，直接开始游戏

    this.pass = false;//过牌
    this.isWinner = false;
    this.answerStatus = 0;//回答状态,0.未作回答,1.同意,2.拒绝
    this.isApplier = false;

    this.winBombNumber = 0;
    this.lastHands = null;//最后一手牌

    this.bombNumber = 0;
    this.winNumber = 0;//胜利次数
    this.gNumber = 0;//关门次数
    this.bgNumber = 0;//被关门次数
    this.maxScore = 0;//最大分数
    this.qgNumber = 0;//全关次数

    this.isBGuanMen = false;//是否关门
    this.isGuanMen = false;//是否关门
    this.isQGuanMen = false;//全关门
}

Player.prototype.equals = function(other){
    if (!other || !(other instanceof Player)){
        logger.error('the other Player is not available.');
        return false;
    }
    return this.playerID === other.playerID;
}

Player.prototype.getBasicInfo = function(){
    var playerInfo = {
        playerID:this.playerID,
        nickName:this.nickName,
        faceID:(!!this.faceID)?this.faceID:"",
        score:this.score,
        totalScore:this.totalScore,
        isGaming:this.isGaming,
        chairNo:this.chairNo,
        pos:this.chairNo - 1,
        isAllowOperate:this.isAllowOperate,
        disconnected:this.disconnected,
        pass:this.pass,
        bombNumber:this.bombNumber,
        winBombNumber:this.winBombNumber,
        isWinner:this.isWinner,
        isBGuanMen:this.isBGuanMen,
        isGuanMen:this.isGuanMen,
        isQGuanMen:this.isQGuanMen,
        ip:this.ip,
        gameId:this.gameId,
        sex:this.sex,

        answerStatus:this.answerStatus,
        isApplier:this.isApplier,
        isReady:this.isReady
    }
    return playerInfo;
}

Player.prototype.getPlayerInfo = function(uid){
    var handCards = [];//手中牌
    if(this.playerID == uid && this.handCards){//自己显示手中牌，其它人不发送手中牌
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
    var lastList = [];
   if (!!this.lastHands && !!this.lastHands.list){
       this.lastHands.list.forEach(function(card){
           lastList.push({value:card.value,type:card.type})
       });
   }
    var playerInfo = {
        playerID:this.playerID,
        nickName:this.nickName,
        faceID:(!!this.faceID)?this.faceID:"",
        score:this.score,
        totalScore:this.totalScore,
        handCards:handCards,
        outCards:outCards,
        isGaming:this.isGaming,
        chairNo:this.chairNo,
        isAllowOperate:this.isAllowOperate,
        disconnected:this.disconnected,
        pass:this.pass,
        bombNumber:this.bombNumber,
        winBombNumber:this.winBombNumber,
        isWinner:this.isWinner,
        isBGuanMen:this.isBGuanMen,
        isGuanMen:this.isGuanMen,
        isQGuanMen:this.isQGuanMen,
        ip:this.ip,
        gameId:this.gameId,
        sex:this.sex,


        answerStatus:this.answerStatus,
        isApplier:this.isApplier,
        isReady:this.isReady,
        lastHands:(!!this.lastHands)?lastList:"",

    }
    return playerInfo;
}

Player.prototype.clear = function(){
    this.handCards = null;//手中的牌
    this.isAllowOperate = false;//是否允许此玩家操作
    this.outList = [];//出过的每一手牌组成的列表


    this.isReady = false;//是否准备好，小局游戏开始之前用,第一局不用，直接开始游戏

    this.isWinner = false;
    this.isBGuanMen = false;//是否关门
    this.isGuanMen = false;//是否关门
    this.isQGuanMen = false;//全关门
    this.pass = false;//过牌
    this.bombNumber = 0;
    this.score = 0;
    this.lastHands = null;

    this.winBombNumber = 0;
}
Player.prototype.getHandCards = function(){
    var cards = [];
    this.handCards.list.forEach(function(card){
        var oCard = {value:card.value,type:card.type};
        cards.push(oCard);
    })
    return cards;
}

Player.TICK_PLAY_SPAN = 30*1000;//操作倒记时长度为30秒
Player.TICK_APPLY_DROP_SPAN = 5*1000*60;//申请解散倒记时长度为300秒

var Table = function(msg) {
    events.EventEmitter.call(this);

    this.tableID = msg.tableID;
    this.tableNo = msg.tableNo;
    this.creatorID = msg.creatorID;

    this.playMethod = msg.playMethod;//玩法

    this.allowGameTimes = msg.allowGameTimes;//牌局里允许的游戏次数

    this.consumeDiamond = msg.consumeDiamond;
    this.isAntiCheating = msg.isAntiCheating;
    this.heart3 = parseInt(msg.heart3);
    this.mustFollow = parseInt(msg.mustFollow);
    this.players =[];//桌子上的所有玩家
    this.seatNumber = 3;//此桌的座位数量，座位号1..seatNumber
    this.game = null; //桌子上的某局游戏
    this.isStart = false;//牌局开始
    this.isStop = false;
    this.firstOutAllCardPlayer = null;
    this.gameTimes = 0;//游戏次数
    this.isApplyStage = 0;//是否有人申请
    this.tickWait = null;
    this.fangOwnerID = 0;
    this.isReplace = msg.isReplace;
    this.clubId = msg.clubId;
    this.boxId = msg.boxId;
    var self = this;
    this.disTimer = setTimeout(function() {
        if (self.fangOwnerID) {
            var p = self.getPlayerByID(self.fangOwnerID);
            self.drop(p);
        }
        else {
            self.dissolution(self.creatorID);
        }
    }, 1*60*60*1000);
}
util.inherits(Table, events.EventEmitter);
Table.TICK_WAIT_SPAN = 10*1000;//等待阶段倒记时长度为20秒

// 代开放解散
Table.prototype.dissolution = function(uid,cb){
    cb = cb || function(){}
    if (uid != this.creatorID && uid != "XAdmin") {
        return cb({code:Code.FAIL,msg:"不是创建者,不能解散房间!"});
    }
    // if (this.players.length > 0) {
    //     return cb({code:Code.FAIL,msg:"已经有玩家在房间,无法解散房间!"});
    // }
    if (this.isStart && uid != "XAdmin"){
        return cb({code:Code.FAIL,msg:"游戏已经开始,不能退出!"});
    }

    var self = this;
    return pdk_db.Table.findOne({
        attributes:['isDrop','tableID'],
        where:{
            tableID:self.tableID,
            isDrop:0
        }
    }).then(function(tt){
        if(!tt){
            return cb(null,{code:Code.FAIL,msg:'数据库中无此牌局'});
        }
        tt.isDrop = 1;

        tt.dropDate = new Date();
        return tt.save({
            attributes:['isDrop','dropDate']
        }).then(function(){
            cb(null,{code:Code.OK});
            self.emit("ddz_onDropTable",{uid:uid});
            self.stop();
        });

    }).catch(function(err){
        logger.error("rpc.gamePDK.gameRemote.drop:"+err);
        return cb(null,{code:Code.FAIL,msg:err});
    });
}


Table.prototype.drop = function(player,cb){
    cb = cb || function(){}

    var self = this;
    return pdk_db.Table.findOne({
        attributes:['isDrop','tableID'],
        where:{
            tableID:self.tableID,
            isDrop:0,
        }
    }).then(function(tt){
        if(!tt){
            return cb(null,{code:Code.FAIL,msg:'数据库中无此牌局'});
        }
        tt.isDrop = 1;
        tt.dropDate = new Date();
        return tt.save({
            attributes:['isDrop','dropDate']
        }).then(function(){
            cb(null,{code:Code.OK});
            self.emit("pdk_onDropTable",player);
            self.stop();
        });

    }).catch(function(err){
        logger.error("rpc.gamePDK.gameRemote.drop:"+err);
        return cb(null,{code:Code.FAIL,msg:err});
    });
}

Table.prototype.getPlayer = function(chairNo){
    for(var i in this.players){
        if(this.players[i].chairNo == chairNo){
            return this.players[i];
        };
    }
    return null;
 }
Table.prototype.getPlayerByID = function(playerID){
    for(var i in this.players){
        if(this.players[i].playerID == playerID){
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
Table.prototype.exists = function(playerID){
    return this.players.some(function(player){
        return player.playerID == playerID;
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
Table.prototype.add = function(player,cb){
    cb = cb || function(){};
    logger.info("desk:",this.tableNo,"Table.add(playerID:",player.playerID,")");
    if(!!this.isStart){
        return cb(null,{code:Code.FAIL,msg:'牌局已经开始,不能加入'});
    }
    if(this.exists(player.playerID)){
        if(!this.isStart){
            return cb(null,{code:Code.FAIL,msg:'您已经加入牌局'});
        }

    }
     var chairNo = this.getEmptySeat();
     if(!chairNo){
         cb(null,{code:Code.FAIL,msg:'位置已满'});
         return;
     }

    this.players.push(player);
    cb(null,{code:Code.OK});
}
Table.prototype.remove = function(playerID){
    logger.info("desk:",this.tableNo,"Table.remove(player)");
    var len = this.players.length;

    for (var i = 0; i < len; i++) {
        if(this.players[i].playerID == playerID){
            this.players.splice(i,1);
            return;
        }
    }
}
Table.prototype.playerReady = function(playerID,cb){
    cb = cb || function(){};
    if(!!this.isStop){
        cb(null,{code:Code.FAIL,msg:'牌局已经结束'})
        return;
    }
    if(!this.isStart){
        cb(null,{code:Code.FAIL,msg:'牌局未开始'})
        return;
    }
    if(this.gameTimes < 1){
        cb(null,{code:Code.FAIL,msg:'第二局才可以按下准备好'})
        return;
    }
    if(!!this.game && this.game.gameStage == GameStage.PLAY){
        return cb(null,{code:Code.FAIL,msg:'已经在小局游戏中,不能按下准备'});
    }
    var player = this.getPlayerByID(playerID);
    if(!!player.isReady){
        cb(null,{code:Code.FAIL,msg:'已经准备好了'})
        return;
    }

    player.isReady = true;
    cb(null,{code:Code.OK});
    this.emit("pdk_onPlayerReady",player);
    var ppList = this.players.filter(function(item){
        return !!item.isReady && !!item.chairNo;

    });
    var sitPlayers = this.players.filter(function(p){
        return !!p.chairNo;
    });
    var self = this;
    if(!!ppList && ppList.length >= 2){
        if(!this.game || this.game.gameStage != GameStage.WAIT) {
            this.game.gameStage = GameStage.WAIT;
            this.emit("pdk_onWait");
        }
        if(ppList.length == sitPlayers.length){
            self.clearTickWait();
            return self.startGame();
        } else {
            this.tickWait = setTimeout(function(){
                self.clearTickWait();
                self.startGame();
            },Table.TICK_WAIT_SPAN+1000);
        }
    }
}

Table.prototype.kickPlayer = function(player,cb){
    cb = cb || function(){};
    if(!!this.isStart){
        cb(null,{code:Code.FAIL,msg:'此牌局已经开始'})
        return;
    }
    this.remove(player.playerID);

    cb(null,{code:Code.OK});

}
Table.prototype.start = function(cb){
    cb = cb || function(){};
    // if(!!this.isStart){
    //     cb(null,{code:Code.FAIL,msg:'此牌局已经开始'});
    //     return;
    // }
    var sitPlayers = this.players.filter(function(p){
        return !!p.chairNo && !p.disconnected;
    });
    if(sitPlayers.length  < 2){
        cb(null,{code:Code.FAIL,msg:'牌局入座人数不够不能开始'});
        return;
    }

    if (this.disTimer) {
        clearTimeout(this.disTimer);
        this.disTimer = null;
    }

    sitPlayers.forEach(function(p){
        p.isReady = true;
    });


    this.isStart = true;
    cb(null,{code:Code.OK});
    this.emit("pdk_onTableStart");
    this.startGame();
}
Table.prototype.stop = function(cb){//处理牌局结果//保存数据//转发用户信息更新
    cb = cb || function(){};

    if(!!this.isStop){
        cb(null,{code:Code.FAIL,msg:'牌局已经结束'})
        return;
    }
    var self = this;
    self.isStop = true;
    pdk_db.Table.update({
        isStop: 1,
        stopDate:Date.now()
    }, {
        where:{
            tableID:this.tableID
        }
    }).then(function (table) {

            if (self.disTimer) {
                clearTimeout(self.disTimer);
                self.disTimer = null;
            }

            var playerList = [];

            self.players.forEach(function(player){
                var p = {
                    playerID:player.playerID,
                    totalScore:player.totalScore,
                    nickName:player.nickName,
                    winBombNumber:player.winBombNumber,
                    bombNumber:player.bombNumber,
                    winNumber:player.winNumber,
                    gNumber:player.gNumber,
                    bgNumber:player.bgNumber,
                    maxScore:player.maxScore,
                    qgNumber:player.qgNumber,
                }
                playerList.push(p);
                //pdk_db.GamePDKRecord.findOrCreate({where:{uid:player.playerID,tableID:self.tableID,number:self.gameTimes,tableNo:self.tableNo},defaults:{score:0}}).then(function(records){
                //    records[0].score = player.totalScore;
                //    records[0].save({attributes:["score"]});
                //});
            });
            pdk_db.Table.update({ res: JSON.stringify(playerList)}, { where: { tableID:self.tableID } });

            playerList.sort(function(s1,s2){ return s2 - s1; });
            self.players.forEach(function(p){
                if(self.clubId){
                    pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitup(null,{uid:p.playerID,clubId:self.clubId,boxId:self.boxId,deskName:self.tableNo},function(){});
                }
            })
            // self.emit("pdk_onTableStop",playerList);
            if(self.isReplace){
                pomelo.app.rpc.usersvr.userRemote.queryUsers(self.creatorID,{quids:[self.creatorID],attrs:["uid","faceId","gameId","nickName"]},function(err,users){
                    var user = users[0];
                    var uid = user.uid;
                    var faceId = user.faceId;
                    var gameId  = user.gameId;
                    var nickName = user.nickName;
                    self.emit("pdk_onTableStop", playerList,{uid:uid,gameId:gameId,faceId:faceId,nickName:nickName});
                    self.clear();
                    cb(null,{code:Code.OK});
                });
            }else{
                self.emit("pdk_onTableStop", playerList,null);
                self.clear();
                cb(null,{code:Code.OK});
            }
    }).catch(function (ex) {
        logger.error("table stop:"+ex);
        cb(null,{code:Code.ERROR,msg:'程序错误',error:ex});
    });
}


Table.prototype.startGame = function(cb){
    cb = cb || function(){};
    if(!!this.isStop){
        cb(null,{code:Code.FAIL,msg:'牌局已经结束'});
        return;
    }
    if(!this.isStart){
        cb(null,{code:Code.FAIL,msg:'牌局未开始'});
        return;
    }
    var sitPlayers = this.players.filter(function(p){
        return !!p.chairNo && p.isReady;
    });
    //var sitPlayers = this.players.filter(function(p){
    //    return !!p.chairNo;
    //});
    if(sitPlayers.length  < 2){
        cb(null,{code:Code.FAIL,msg:'牌局入座人数不够不能开始'});
        return;
    }

    this.game = new Game(this);
    this.game.players = sitPlayers.slice(0);
    this.game.start();
}
Table.prototype.sitDown = function(player,chairNo,cb){
    logger.info("desk:",this.tableNo,"sitDown:chairNo:",chairNo);
    cb = cb || function(){};
    if(!checkUtil.isPositiveInteger(chairNo) || chairNo > this.seatNumber){
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

    if (chairNo == 1) {
        if (this.isReplace) {
            this.fangOwnerID = player.playerID;
        }
        else {
            this.fangOwnerID = this.creatorID;
        }
    }

    player.chairNo = chairNo;
    if(this.clubId){pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitdown(null,{playerInfo:player.getBasicInfo(),deskName:this.tableNo,clubId:this.clubId,boxId:this.boxId},function(){});}
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
        this.emit("pdk_onTableStandUp",player,chairNo);
        logger.info("desk:", this.tableNo, "standUp");
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

        playerPlayTimeSpan:Player.TICK_PLAY_SPAN,
        playerApplyDropTimeSpan:Player.TICK_APPLY_DROP_SPAN,
        playMethod:this.playMethod,//玩法
        allowGameTimes:this.allowGameTimes,//牌局里允许的游戏次数
        heart3:this.heart3,
        mustFollow:this.mustFollow,
        isStart:this.isStart,
        isStop:this.isStop,
        gameTimes:this.gameTimes,//游戏次数

        waitSpan:Table.TICK_WAIT_SPAN,
        tableNo:this.tableNo,
        creatorID:this.creatorID,
        isApplyStage:this.isApplyStage,
        startDate:this.startDate,
        isReplace:this.isReplace,
        fangOwnerID:this.fangOwnerID,
        isAntiCheating:this.isAntiCheating,
    };
    return info;
}



Table.prototype.getTableInfo = function(uid){
    var playerList = [];
    var self = this;
    this.players.forEach(function(player){
        var playerID = player.playerID;
        if(!!uid){
            playerID = uid;
        }
        var info = player.getPlayerInfo(playerID);
        playerList.push(info);
    })
    var tableInfo = {
        players:playerList,
        tableID:this.tableID,
        game:(!!this.game)?this.game.getGameInfo():null,

        playerPlayTimeSpan:Player.TICK_PLAY_SPAN,
        playerApplyDropTimeSpan:Player.TICK_APPLY_DROP_SPAN,
        playMethod:this.playMethod,//玩法
        allowGameTimes:this.allowGameTimes,//牌局里允许的游戏次数
        heart3:this.heart3,
        mustFollow:this.mustFollow,
        isStart:this.isStart,
        isStop:this.isStop,
        gameTimes:this.gameTimes,//游戏次数

        waitSpan:Table.TICK_WAIT_SPAN,
        tableNo:this.tableNo,
        creatorID:this.creatorID,
        isApplyStage:this.isApplyStage,
        isReplace:this.isReplace,
        fangOwnerID:this.fangOwnerID,
        clubId:this.clubId,
        isAntiCheating:this.isAntiCheating,
    }
    //console.log('tableInfo',tableInfo)
    return tableInfo;
}
Table.prototype.clear = function(){
    this.players.forEach(function(player){
        if(!!player.tickPlay){
            clearTimeout(player.tickPlay);
        }
        if(!!player.tickApplyDrop){
            clearTimeout(player.tickApplyDrop);
        }

    });
    this.players = [];
    if(!!this.game){
        this.game.clear();
        this.game = null;
    }
}
Table.prototype.clearTickWait = function(){
    logger.info("desk:",this.tableNo,"clearTickWait");
    if(!!this.tickWait){
        clearTimeout(this.tickWait);
    }
}
Table.prototype.clearTickApplyDrop = function(player){
    logger.info("desk:",this.tableNo,"clearTickApplyDrop");
    if(!!player && !!player.tickApplyDrop){
        clearTimeout(player.tickApplyDrop);
    }
}
Table.prototype.startTickApplyDrop = function(player){
    logger.info("desk:",this.tableNo,"startTickApplyDrop:",player.playerID,'Player.TICK_APPLY_DROP_SPAN',Player.TICK_APPLY_DROP_SPAN);
    var self = this;
    this.clearTickApplyDrop(player);
    player.tickApplyDrop = setTimeout(function(){
        self.applyDropStop(); //结束申请
        player.tickApplyDrop = null;

    },Player.TICK_APPLY_DROP_SPAN);
}

Table.prototype.applyDropStart = function(player,cb){
    cb = cb || function(){};
    if(this.isApplyStage){
        return cb(null,{code:Code.FAIL,msg:'已经有人申请解散游戏了'})
    }
    player.isApplier = true;
    this.isApplyStage = true;

    cb(null,{code:Code.OK});
    this.emit("pdk_onApplyDrop",player);
    this.startTickApplyDrop(player); //启动倒记时
}
Table.prototype.applyDropStop = function(){
    console.log('Table applyDropStop')
    var rejectList = this.players.filter(function(p){
        return !!p.chairNo && p.answerStatus == 2;
    });
    var agreeList = this.players.filter(function(p){
        return !!p.chairNo && p.answerStatus == 1;
    });
    var gList = this.players.filter(function(p){
        return (!!p.chairNo && !p.isApplier);
    });
    var answerNumber = Math.ceil(gList.length / 2);
    //var answerNumber2 = Math.floor(gList.length/ 2);

    var self = this;
    this.players.forEach(function(p){
        if(!!p.isApplier){
            p.isApplier = false;//是否是申请者
            console.log('agreeList.length',agreeList.length,'answerNumber',answerNumber)
            if(rejectList.length < answerNumber || agreeList.length >= answerNumber){//超过半数人拒绝,结束申请
                self.drop(p);
                console.log('applyDropStop---', p.playerID);
            }

            //if(rejectList.length < answerNumber){//超过半数人拒绝,结束申请
            //    //if(agreeList.length >= answerNumber){//超过半数人同意或拒绝,结束申请
            //    self.drop(p);
            //    console.log('applyDropStop---1111', p.playerID);
            //}
            self.clearTickApplyDrop(p);
        }
    });
    this.isApplyStage = false;//是否有人申请
    console.log("isApplyStage",this.isApplyStage)
    this.players.forEach(function(p){
        p.answerStatus = 0;//回答状态,0.未作回答,1.同意,2.拒绝
    });

}
Table.prototype.answerDrop = function(player,agree,cb){
    cb = cb || function(){};
    if(!!player.answerStatus){
        return cb(null,{code:Code.FAIL,msg:'您已经回答过了'})
    }
    if(!this.isApplyStage){
        return cb(null,{code:Code.OK,msg:'申请解散流程已结束,请重新发起申请'})
    }
    if(!!player.isApplier){
        return cb(null,{code:Code.FAIL,msg:'解散牌局发起者不能作答'})
    }
    player.answerStatus = agree;

    cb(null,{code:Code.OK});
    this.emit("pdk_onAnswerDrop",player,agree);

    var agreeList = this.players.filter(function(p){
        return !!p.chairNo && p.answerStatus == 1;
    });
    var rejectList = this.players.filter(function(p){
        return !!p.chairNo && p.answerStatus == 2;
    });
    //var answerList = this.players.filter(function(p){
    //    return (!!p.chairNo && p.answerStatus > 0 && !p.isApplier);
    //});
    var gList = this.players.filter(function(p){
        return (!!p.chairNo && !p.isApplier);
    });
    var answerNumber = Math.ceil(gList.length/ 2);
    var answerNumber2 = Math.floor(gList.length/ 2);
    if(rejectList.length > answerNumber2 || agreeList.length >= answerNumber){//超过半数人同意或拒绝,结束申请
        this.applyDropStop();
    }
}

Table.prototype.costRoomCard = function(args,callback){
    var self = this;
    var clubId = self.clubId;
    var boxId = self.boxId;

    if(!! clubId && !! boxId){
        pomelo.app.rpc.clubsvr.clubRemote.costRoomCard(self.creatorID,
            {clubId:clubId,boxId:boxId,costNum:self.consumeDiamond},callback) 
    }else{
        pomelo.app.rpc.usersvr.userRemote.costRoomCard(self.creatorID,
            {uid:self.creatorID, costNum:self.consumeDiamond, isReplace:self.isReplace},callback)
    }
}

//Quick enter desk
Table.prototype.getEmptySeatCount = function(){
    return this.seatNumber - this.players.length;
}



var GameStage = {
    WAIT:1,//第二局倒记时阶段
    PLAY: 2,//玩牌。
    NULL:0 //未在游戏中
}
var Game = function(table){
    this.players = [];//在游戏中玩的玩家
    this.table = table;//桌子

    this.gameStage = GameStage.NULL;

    this.deck = null;//两副牌
    this.currentPlayer = null;
    this.firstPlayer = null;
    this.previousPlayer = null;

    this.bombFraction = 1;//炸弹倍率
    this.gameRecord = {
        messageList:[]
    };//一局游戏的牌谱记录
    this.gameResult = {};
    this.allowBorrow = false;//是否允许借风

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
    var self = this;
    var gameInfo ={
        gameStage:this.gameStage,
        landlord:(!!self.landlord)?self.landlord.playerID:0,
        currentPlayer:(!!this.currentPlayer)?this.currentPlayer.playerID:0,
        previousPlayer:(!!this.previousPlayer)?this.previousPlayer.playerID:0,
        firstPlayer: (!!this.firstPlayer)?this.firstPlayer.playerID:0,
        bombFraction:this.bombFraction//炸弹倍率
    }
    return gameInfo;
}
Game.prototype.getPlayerByID = function(playerID){
    for(var i in this.players){
        if(this.players[i].playerID == playerID){
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

Game.prototype.dealHandCards = function(){
    var self = this;

    this.players.forEach(function(player){
        var cards = self.deck.dispatch(16);
        player.handCards = new poker.Cards();
        cards.forEach(function(card){
            player.handCards.add(card);
        })
        player.handCards.sort();
        self.table.emit("pdk_onDealHandCards",player);
    });
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

Game.prototype.check =function(player,cardList){//查检牌型
    var entity = null;
    if(cardList.size == player.handCards.size){
        console.log('cardList.toLastEntity');
        entity = cardList.toLastEntity();
    } else {
        entity = cardList.toEntity();
    }
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
        if(previousEntity.pokerType == poker.PokerType.BOMB){
            this.previousPlayer.winBombNumber--;
        }
    }
    if(entity.pokerType == poker.PokerType.BOMB){
        player.bombNumber++;
        player.winBombNumber++;

    }
    return true;
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
    if(!!player.handCards){
        var cloneCards = player.handCards.clone();
        for(var i in msg.cards){
            var card = new poker.Card(msg.cards[i].value,msg.cards[i].type);
            var success = cloneCards.remove(card);
            if(!success){
                return cb(null,{code:Code.FAIL,msg:'有不存在的牌'});
            }
        }
    }
    var cardList = new poker.Cards(msg.cards);


    console.log("poker type:",cardList.pokerType);
    if(!this.check(player,cardList)){
        cb(null,{code:Code.FAIL,msg:'牌型不符合或大不过上一家'})
        return;
    }

    player.isAllowOperate = false;


    player.outList.push(cardList);
    player.lastHands = cardList;
    console.log('player.handCards.size:',player.handCards.size,'playerID:',player.playerID,'cardList.size:',cardList.size);
    player.handCards.removeList(cardList);


    console.log('player.handCards.size:',player.handCards.size,'playerID:',player.playerID,'cardList.size:',cardList.size);
    if(player.handCards.size <=0){
        player.isGaming = false;
        player.isWinner = true;
        player.winNumber++;
        if(!this.table.firstOutAllCardPlayer){//首次出完
            this.table.firstOutAllCardPlayer = player;
        }

    }
    cb(null,{code:Code.OK});

    player.pass = false;
    if(this.currentPlayer == this.firstPlayer){//出牌
        this.previousPlayer = null;
        this.table.emit("pdk_onOut",player,msg.cards,0);
    } else { //压牌
        this.firstPlayer = this.currentPlayer;

        this.table.emit("pdk_onOut",player,msg.cards,1);
    }
    this.previousPlayer = player;
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

    var previousPlayer = this.getPreviousPlayer(player.chairNo);
    var length = previousPlayer.outList.length;
    var previousOutCards = previousPlayer.outList[length-1];
    var list = poker.hint(player.handCards,previousOutCards);

    if(this.table.mustFollow && list && list.length > 0) {
        cb(null,{code:Code.FAIL,msg:'有牌必须跟'})
        return;
    }

    player.isAllowOperate = false;
    //this.clearTickPlay(player);
    player.pass = true;

    player.outList.push(new poker.Cards([]));
    player.lastHands = [];

    cb(null,{code:Code.OK});
    this.table.emit("pdk_onPass",player);

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
        previousPlayerID = this.previousPlayer.playerID;
    }

    var code = {
        playerID:player.playerID,
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
        return (player.handCards.size <= 0);//有一个出完牌
    });
    if(!!someOne){
        return true;
    }
    return false;
}


Game.prototype.clearLastHands = function(){
     this.players.forEach(function(p){
         p.lastHands = null;
     });
}
Game.prototype.sendOperateCodeImmediate = function(player){
    if(!player || !player.isGaming){
        return
    }
    player.isAllowOperate = true;

    if(this.currentPlayer == this.firstPlayer){
        //清除最后一手牌
        this.clearLastHands();
    }
    //发送操作码
    this.table.emit("pdk_onOperateCode",player,this.getOperateCode(player));


}

Game.prototype.start = function(){
    var self = this;
    this.table.gameTimes++;
    this.players.forEach(function(player){
        player.clear();
        player.isGaming = true;

        self.table.firstOutAllCardPlayer = null;
    });

    this.allowBorrow = false;//是否允许借风

    this.gameStage = GameStage.PLAY;
    this.deck = new poker.Deck();
    //this.deck.sort();

    this.deck.shuffle(100);
    this.table.emit("pdk_onStartGame");//一局游戏开始


    this.dealHandCards();//发16张牌

    this.setFirstPlayer();

    this.gameRecord.table = this.table.getTableInfo();

    //发送操作码
    this.sendOperateCodeImmediate(this.firstPlayer);
    if(!! this.table.clubId){
        pomelo.app.rpc.clubsvr.clubRemote.onStartGame(null,{gameType:"gamePDK",deskName:this.table.tableNo,
        clubId:this.table.clubId,boxId:this.table.boxId,gameCount:this.table.gameTimes,totalGameCount:this.table.allowGameTimes},function(){});
    }
}
Game.prototype.setFirstPlayer = function(){
    if(!!this.table.heart3){
        for(var i=0;i<this.players.length;i++){
            var player = this.players[i];
            var some = player.handCards.list.some(function(card){
                return card.value == 3 && card.type == 3;
            });
            if(some){
                this.firstPlayer = player;
                this.currentPlayer = this.firstPlayer;
                return;
            }
        }

    }
    if(!!this.table.firstOutAllCardPlayer){
        this.firstPlayer = this.table.firstOutAllCardPlayer;
        this.currentPlayer = this.firstPlayer;
    } else {
        var i = random(0,this.players.length);
        this.firstPlayer = this.players[i];
        this.currentPlayer = this.firstPlayer;
    }

}


Game.prototype.stop = function(){
    if(this.gameStage == GameStage.NULL){
        return;
    }
    this.gameStage = GameStage.NULL;

    console.log('stop')


    //计算分数
    this.calculateScore();
    //摊牌
    var playerList = [];

    var self = this;
    this.players.forEach(function(player){
        var p = {
            playerID:player.playerID,
            nickName:player.nickName,
            isWinner:player.isWinner?1:0,
            score:player.score,
            totalScore:player.totalScore,
            handCards:player.getHandCards(),
            isGuanMen:!!player.isGuanMen?1:0,
            isBGuanMen:!!player.isBGuanMen?1:0,
            isQGuanMen:!!player.isQGuanMen?1:0,
        }
        playerList.push(p);
    });

    //更新数据记录
    for(var i in this.players){
        var p = this.players[i];
        (function (player){
            pdk_db.TableMember.update({
                score: player.totalScore
            }, {
                where: {
                    tm_table_id:self.table.tableID,
                    tm_user_id:player.playerID
                }
            }).catch(function(err){
                logger.error("TableMember update err:"+err);
            });
            pdk_db.GamePDKRecord.findOrCreate({where:{uid:player.playerID,tableID:self.table.tableID,number:self.table.gameTimes,tableNo:self.table.tableNo},defaults:{score:0}}).then(function(records){
                records[0].score = player.score;
                records[0].save({attributes:["score"]}).catch(function(err){
                    logger.error("GamePDKRecord save err:"+err);
                });
            }).catch(function(err){
                logger.error("GamePDKRecord findOrCreate err:"+err);
            });
        })(p)
    }
    this.table.emit("pdk_onStopPlay");
    this.table.emit("pdk_onStopGame");//一局游戏结束
    this.table.emit("pdk_onResult",playerList);

    // this.saveWar();

    this.table.players.forEach(function(player){
        player.isGaming = false;
        player.isReady = false;
        player.handCards = new poker.Cards();
    });

    if(this.table.gameTimes >= this.table.allowGameTimes){
        this.table.stop();
    }  

}
Game.prototype.saveWar = function(){
    // var gameType = "gamePDK"
    // var tableId = this.table.tableID;
    // var deskName = this.table.tableNo;
    // var roundIndex = this.table.gameTimes;
    // var record = JSON.stringify(this.gameRecord);
    // var result = JSON.stringify(this.gameResult);
    // app.rpc.singlesvr.gameRecordRemote.saveGameRecord(null,gameType, tableId, deskName, roundIndex, record, result,function () { });
    //保存当局牌谱到数据库
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
    this.players.forEach(function(player){
        player.clear();
        self.table.clearTickApplyDrop(player);
    });
    this.gameRecord.messageList = [];
    this.players = [];

}

/**
 * 赢家出完牌后进行小局结算。剩下的玩家，剩余多少手牌扣多少分，每个炸弹额外扣10分。扣除的分数全部作为赢家的加分。
 * 例：玩家1出完牌为赢家，玩家2剩余3张手牌，玩家3剩余4个A、4个2，则玩家2扣3分，玩家3扣28分，玩家1加31分。
 * 关门：被关门者扣除剩余牌张数*2的分数，与炸弹分开计算加在一起作为得分。
 * 最后一局结束后先弹小局结算，点击继续游戏弹出总结算。总结算显示本场游戏玩家总的得
 */
Game.prototype.calculateScore = function(){//处理结算
    var self = this;

    this.players.forEach(function(player){
       if(!player.isWinner){
            var score = player.handCards.size;
            if(player.handCards.size == 16){
                score = score * 2;
                player.bgNumber++;
                player.isBGuanMen = true;
                self.table.firstOutAllCardPlayer.gNumber++;
                self.table.firstOutAllCardPlayer.isGuanMen = true;
            }
           player.score += (-1) * score;
           self.table.firstOutAllCardPlayer.score += score;
       }
    });
    //全关
    var everyOne = this.players.every(function(player){
        if(!player.isWinner){
            if(player.handCards.size == 16){
                return true;
            }
            return false;
        }
        return true;
    });
    if(everyOne){
        self.table.firstOutAllCardPlayer.qgNumber++;
        self.table.firstOutAllCardPlayer.isQGuanMen = true;
    }
    this.players.forEach(function(p1){
        if(p1.winBombNumber >= 1){
            self.players.forEach(function(p2){
                if(!p1.equals(p2)){
                    p1.score += 10*p1.winBombNumber;
                    p2.score -= 10*p1.winBombNumber;
                }
            });
        }
    });
    this.players.forEach(function(player){
        if(player.score > player.maxScore){
            player.maxScore = player.score;
        }
        player.totalScore = player.score + player.totalScore;
    });
}

module.exports = {
    Player:Player,
    Table:Table,
    Game:Game,
    GameStage:GameStage
}