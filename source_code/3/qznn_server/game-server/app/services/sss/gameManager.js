var poker = require("./sssPoker.js");
var events = require("events");
var util = require('util');
var logger = require('pomelo-logger').getLogger(__filename);
var Code = require('../../../../shared/code');
var sss_db = require('../../../lib/sss_db');
var checkUtil =require('../../../../shared/checkUtil');
var war_record_db = require('../../../lib/war_record_db');

var random = function(min,max){
    return Math.floor(min+Math.random()*(max-min));
}

/**
 * game player
 * @constructor
 */
var Player = function(playerID){
    this.playerID = playerID;
    this.handCards = new poker.Cards();//手中的牌
    this.isGaming = false;//是否在游戏中
    this.chairNo = 0;//座位

    this.isOut = false;//是否允许此玩家操作
    this.tickApplyDrop = null;//申请解散房间倒记时

    this.nickName = "";//昵称
    this.faceID = "";//头像
    this.ip = "";

    this.isWinner = false;//是否获胜者
    this.isReady = false;//是否准备好，小局游戏开始之前用,第一局不用，直接开始游戏
    this.disconnected = false;//是否断线
    this.isApplier = false;//是否是申请者

    this.answerStatus = 0;//回答状态,0.未作回答,1.同意,2.拒绝

    this.entity = null;//13张实体

    this.score1 = 0;//第一墩分数
    this.score2 = 0;//第二墩分数
    this.score3 = 0;//第三墩分数


    this.score = 0;//积分
    this.totalScore = 0;//积分

    this.shootList = [];//打枪列表
    this.isShootAll = false;

    this.gunNumber = 0;//打枪数
    this.bGunNumber = 0;//被打枪数
    this.gunAllNumber = 0;//全垒打数
    this.specialNumber = 0;//特殊牌型数
    this.sfNumber = 0;//同花顺数
    this.bombNumber = 0;//炸弹数
    this.isForce = 0;//是否强行组成普通牌型

    this.winNumber = 0;//胜利数
    this.totalGunNumber = 0;//打枪数
    this.totalBGunNumber = 0;//被打枪数
    this.totalGunAllNumber = 0;//全垒打数
    this.totalSpecialNumber = 0;//特殊牌型数
    this.totalSfNumber = 0;//同花顺数
    this.totalBombNumber = 0;//炸弹数
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
        totalScore:this.totalScore,
        isGaming:this.isGaming,
        chairNo:this.chairNo,
        pos:this.chairNo - 1,
        isOut:this.isOut,
        disconnected:this.disconnected,
        answerStatus:this.answerStatus,
        isApplier:this.isApplier,
        isReady:this.isReady,
        isForce:this.isForce,
        ip:this.ip,
        gameId:this.gameId,
        score:this.score,
        totalScore:this.totalScore,
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
    var playerInfo = {
        playerID:this.playerID,
        nickName:this.nickName,
        faceID:(!!this.faceID)?this.faceID:"",
        score1:this.score1,
        score2:this.score2,
        score3:this.score3,

        score:this.score,
        totalScore:this.totalScore,
        handCards:handCards,
        isGaming:this.isGaming,
        chairNo:this.chairNo,
        isOut:this.isOut,
        disconnected:this.disconnected,
        answerStatus:this.answerStatus,
        isApplier:this.isApplier,
        isReady:this.isReady,
        isForce:this.isForce,
        ip:this.ip,
        gameId:this.gameId
    }
    return playerInfo;
}

Player.prototype.clear = function(){
    this.handCards = new poker.Cards();//手中的牌
    this.isOut = false;
    this.isWinner = false;//是否获胜者
    this.isReady = false;
    this.isShootAll = false;
    this.gunNumber = 0;//打枪数
    this.bGunNumber = 0;//被打枪数
    this.gunAllNumber = 0;//全垒打数
    this.specialNumber = 0;//特殊牌型数
    this.sfNumber = 0;//同花顺数
    this.bombNumber = 0;//炸弹数
    this.isForce = 0;
    this.score1 = 0;//积分
    this.score2 = 0;//积分
    this.score3 = 0;//积分
    this.score = 0;//积分
    this.shootList = [];
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
//Player.TICK_APPLY_DROP_SPAN = 5*1000;//申请解散倒记时长度为300秒

var Table = function(msg) {
    events.EventEmitter.call(this);
    this.tableID = msg.tableID;
    this.tableNo = msg.tableNo;
    this.creatorID = msg.creatorID;
    this.allowGameTimes = msg.allowGameTimes;//牌局里允许的游戏次数
    this.consumeDiamond = msg.consumeDiamond;
    this.scoreType = msg.scoreType;
    this.gunType = msg.gunType;
    this.playMethod = msg.playMethod;
    this.players =[];//桌子上的所有玩家
    this.seatNumber = 4;//此桌的座位数量，座位号1..seatNumber
    this.game = null; //桌子上的某局游戏
    this.isStart = false;//牌局开始
    this.isStop = false;
    this.gameTimes = 0;//游戏次数
    this.isApplyStage = false;//是否有人申请
    this.tickWait = null;
    this.fangOwnerID = 0;
    this.isReplace = msg.isReplace;
    this.boxId = msg.boxId;
    this.clubId = msg.clubId;
    this.isAntiCheating = msg.isAntiCheating;
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
    return sss_db.Table.findOne({
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
        logger.error("rpc.gameSSS.gameRemote.drop:"+err);
        return cb(null,{code:Code.FAIL,msg:err});
    });
}
Table.prototype.drop = function(player,cb){
    cb = cb || function(){}
    var self = this;
    return sss_db.Table.findOne({
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
            self.emit("sss_onDropTable",player);
            self.stop();
        });

    }).catch(function(err){
        logger.error("rpc.gameSSS.gameRemote.drop:"+err);
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
         cb(null,{code:Code.FAIL,msg:'人数已满'});
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
    this.emit("sss_onPlayerReady",player);
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
            this.emit("sss_onWait");
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
    //     cb(null,{code:Code.FAIL,msg:'此牌局已经开始'})
    //     return;
    // }
    var sitPlayers = this.players.filter(function(p){
        return !!p.chairNo;
    });
    if(sitPlayers.length  < 2){
        cb(null,{code:Code.FAIL,msg:'牌局入座人数不够,不能开始'});
        return;
    }
    if (this.disTimer) {
        clearTimeout(this.disTimer);
        this.disTimer = null;
    }
    this.isStart = true;
    //
    sitPlayers.forEach(function(p){
        p.isReady = true;
    });
    cb(null,{code:Code.OK});
    this.emit("sss_onTableStart");
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
    var stopDate = Date.now();
    sss_db.Table.update({
        isStop: 1,
        stopDate:stopDate,
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
        var pList = [];
        var sitPlayers = self.players.filter(function(p){
            return !!p.chairNo;
        });

        sitPlayers.forEach(function (player) {
            var p = {playerID: player.playerID, nickName: player.nickName, totalScore: player.totalScore, gameId:player.gameId}
            playerList.push(p);
            var pp = {
                playerID: player.playerID,
                nickName: player.nickName,
                //faceID:player.faceID,
                totalScore: player.totalScore,
                winNumber:player.winNumber,
                totalGunNumber:player.totalGunNumber,
                totalBGunNumber:player.totalBGunNumber,
                totalGunAllNumber:player.totalGunAllNumber,
                totalSpecialNumber:player.totalSpecialNumber,
                totalSfNumber:player.totalSfNumber,
                totalBombNumber:player.totalBombNumber,
                gameId:player.gameId
            }
            pList.push(pp);
        });
        sss_db.Table.update({ res: JSON.stringify(pList)}, { where: { tableID:self.tableID } });

        playerList.sort(function (s1, s2) {
            return s2.chairNo - s1.chairNo;
        });
        //self.emit("sss_onTableStop", pList,stopDate.toString());
        self.players.forEach(function(p){
            if(self.clubId){
                pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitup(null,{uid:p.playerID,clubId:self.clubId,boxId:self.boxId,deskName:self.tableNo},function(){});
            }
        })
        if(self.isReplace){
            pomelo.app.rpc.usersvr.userRemote.queryUsers(self.creatorID,{quids:[self.creatorID],attrs:["uid","faceId","gameId","nickName"]},function(err,users){
                var user = users[0];
                var uid = user.uid;
                var faceId = user.faceId;
                var gameId  = user.gameId;
                var nickName = user.nickName;
                self.emit("sss_onTableStop", pList,stopDate.toString(),{uid:uid,gameId:gameId,faceId:faceId,nickName:nickName});
                self.clear();
                cb(null,{code:Code.OK});
            });
        }else{
            self.emit("sss_onTableStop", pList,stopDate.toString(),null);
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
    if(sitPlayers.length  < 2){
        cb(null,{code:Code.FAIL,msg:'牌局入座人数不够,不能开始'});
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

    player.chairNo = chairNo;
    if (chairNo == 1) {
        if (this.isReplace) {
            this.fangOwnerID = player.playerID;
        }
        else {
            this.fangOwnerID = this.creatorID;
        }
    }
    if(this.clubId){pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitdown(null,{playerInfo:player.getBasicInfo(),deskName:this.tableNo,clubId:this.clubId,boxId:this.boxId},function(){});}
    cb(null,{code:Code.OK});
    
    this.startGame();
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
        this.emit("sss_onTableStandUp",player,chairNo);
        logger.info("desk:", this.tableNo, "standUp");
        return;
    }
}

Table.prototype.getDeskBasicInfo  = function(){
    var info = {};
    var playerList = [];
    this.players.forEach(function(player){
        playerList.push(player.getBasicInfo());
    })

    info.playerInfo = playerList;
    info.deskInfo = {
        tableID:this.tableID,
        allowGameTimes:this.allowGameTimes,//牌局里允许的游戏次数
        isApplyStage:this.isApplyStage,//是否处于申请阶段
        isStart:this.isStart,
        isStop:this.isStop,
        gameTimes:this.gameTimes,//游戏次数
        tableNo:this.tableNo,
        creatorID:this.creatorID,
        gunType:this.gunType,
        scoreType:this.scoreType,
        startDate:this.startDate,
        playMethod: this.playMethod,
        isReplace:this.isReplace,
        fangOwnerID:this.fangOwnerID,
        isAntiCheating:this.isAntiCheating,
    }
    return info;
}

Table.prototype.getTableInfo = function(uid){
    var playerList = [];
    var self = this;
    this.players.forEach(function(player){
        if(!!self.game && self.game.gameStage == GameStage.PLAY){
            var playerID = player.playerID;
            if(!!uid){
                playerID = uid;
            }
            playerList.push(player.getPlayerInfo(playerID));
        } else {
            playerList.push(player.getPlayerInfo(player.playerID));
        }

    })
    var tableInfo = {
        players:playerList,
        tableID:this.tableID,
        game:(!!this.game)?this.game.getGameInfo():null,
        playerPlayTimeSpan:Player.TICK_PLAY_SPAN,
        playerApplyDropTimeSpan:Player.TICK_APPLY_DROP_SPAN,
        waitSpan:Table.TICK_WAIT_SPAN,
        allowGameTimes:this.allowGameTimes,//牌局里允许的游戏次数
        isApplyStage:this.isApplyStage,//是否处于申请阶段
        isStart:this.isStart,
        isStop:this.isStop,
        gameTimes:this.gameTimes,//游戏次数
        tableNo:this.tableNo,
        creatorID:this.creatorID,
        gunType:this.gunType,
        scoreType:this.scoreType,
        isReplace:this.isReplace,
        fangOwnerID:this.fangOwnerID,
        playMethod: this.playMethod,
        clubId:this.clubId,
        isAntiCheating:this.isAntiCheating,
    }
    return tableInfo;
}
Table.prototype.clear = function(){
    if(!this.players){
        return ;
    }
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
    logger.info("desk:",this.tableNo,"startTickApplyDrop:",player.playerID);
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
    this.emit("sss_onApplyDrop",player);
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
            if(rejectList.length < answerNumber || agreeList.length >= answerNumber){//超过半数人拒绝,结束申请
            //if(agreeList.length >= answerNumber){//超过半数人同意或拒绝,结束申请
                self.drop(p);
                console.log('applyDropStop---1111', p.playerID);
            }
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
    this.emit("sss_onAnswerDrop",player,agree);

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
    this.deck = null;//一副牌
    this.gameRecord = {
        messageList:[]
    };//一局游戏的牌谱记录
    this.gameResult = {}
}

Game.prototype.getGameInfo = function(){
    var gameInfo ={
        gameStage:this.gameStage
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
        var cards = self.deck.dispatch(13);
        player.handCards = new poker.Cards();
        cards.forEach(function(card){
            player.handCards.add(card);
        })
        player.handCards.sort();
        self.table.emit("sss_onDealHandCards",player);
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

Game.prototype.check =function(player,cardList,isForce){//查检牌型
    var entity = null;
    if(!!isForce){//1
        entity = cardList.toSpecialEntity(poker.NormalEntity);
    } else {
        entity = cardList.toSpecialEntity();
    }

    if(!entity){//不符合牌型
        return false;
    }
    player.entity = entity;
    return true;
}


Game.prototype.out =function(player,msg,cb){
    cb = cb || function(){};
    if(!player.isGaming){
        cb(null,{code:Code.FAIL,msg:'此玩家未在游戏中'})
        return;
    }
    if(!!player.isOut){
        cb(null,{code:Code.FAIL,msg:'不能重复出牌'})
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
        for(var i in msg.cards){
            var card = msg.cards[i];
            var exists = player.handCards.list.some(function (item) {
                return item.value == card.value && item.type == card.type;
            });
            if(!exists){
                return cb(null,{code:Code.FAIL,msg:'有不存在的牌'});
            }
        }
    }

    var cardList = new poker.Cards(msg.cards);
    console.log('isForce',msg.isForce);
    var isForce = msg.isForce||0;//特殊牌型强行组装

    if(!this.check(player,cardList,isForce)){
        cb(null,{code:Code.FAIL,msg:'牌型不符合'})
        return;
    }
    player.isForce = isForce;
    player.isOut = true;

    player.handCards = cardList;

    console.log('player.handCards',player.handCards,'playerID:',player.playerID);

    cb(null,{code:Code.OK});

    this.table.emit("sss_onOut",player,msg.cards);

    this.progress();
}

Game.prototype.progress = function(){
    //是否游戏结束
    if(this.canStopGame()){
        return this.stop();
    }
}

Game.prototype.canStopGame = function(){
    if(this.gameStage == GameStage.NULL){
        return false;
    }
    var everyOne = this.players.every(function(player){
        return player.isOut;
    });
    if(!!everyOne){
        return true;
    }
    return false;
}
Game.prototype.getTestDeck = function(){
    var deck = new poker.Deck();
    deck.shuffle(200);
    var Card = poker.Card;
    var cards = new poker.Cards(
       [{"value":14,"type":1},{"value":2,"type":1},{"value":3,"type":1},
           {"value":2,"type":2},{"value":3,"type":2},{"value":5,"type":2},{"value":4,"type":2},{"value":6,"type":2},
           {"value":11,"type":4},{"value":11,"type":3},{"value":11,"type":2},{"value":11,"type":1},{"value":10,"type":4}

           ]
    )
    // var cards = new poker.Cards(
    //     [{"value":14,"type":1},{"value":2,"type":1},{"value":3,"type":1},
    //         {"value":2,"type":2},{"value":3,"type":2},{"value":5,"type":2},{"value":4,"type":2},{"value":6,"type":2},
    //         {"value":11,"type":4},{"value":12,"type":4},{"value":13,"type":4},{"value":14,"type":4},{"value":10,"type":4}
    //
    //     ]
    // )
    // var cards = new poker.Cards(
    //     [{"value":14,"type":1},{"value":2,"type":1},{"value":3,"type":1},
    //         {"value":4,"type":1},{"value":5,"type":1},{"value":8,"type":2},{"value":4,"type":2},{"value":6,"type":2},
    //         {"value":11,"type":4},{"value":12,"type":4},{"value":13,"type":4},{"value":14,"type":4},{"value":10,"type":4}]
    // )
    // var cards2 = new poker.Cards([
    //    new Card(3,3),new Card(4,3),new Card(5,3),new Card(7,3),
    //    new Card(8,3),new Card(9,3),new Card(10,3),new Card(11,3),
    //    new Card(7,1),new Card(8,1),new Card(9,1),new Card(10,1),new Card(11,1),
    // ]);


    deck.removeList(cards);
    deck.addList(cards);
    // deck.removeList(cards2);
    // deck.addList(cards2);
    return deck;
}
Game.prototype.start = function(){
    this.table.gameTimes++;
    this.table.players.forEach(function(player){
        player.clear();
    });
    this.players.forEach(function(player){
        player.isGaming = true;
    });

    this.deck = new poker.Deck();
    this.deck.shuffle(200);
    // this.deck = this.getTestDeck();
    this.gameStage = GameStage.PLAY;
    this.table.emit("sss_onStartGame");//一局游戏开始
    this.dealHandCards();//发13张牌

    this.gameRecord.table = this.table.getTableInfo();
    if(!! this.table.clubId){
        pomelo.app.rpc.clubsvr.clubRemote.onStartGame(null,{gameType:"gameSSS",deskName:this.table.tableNo,
        clubId:this.table.clubId,boxId:this.table.boxId,gameCount:this.table.gameTimes,totalGameCount:this.table.allowGameTimes},function(){});
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

    this.players.forEach(function(player){
        var shootList =[];
        player.shootList.forEach(function(p){
            shootList.push({ playerID: p.playerID });
        })
        var p = {
            playerID:player.playerID,
            nickName:player.nickName,
            score1:player.score1,
            score2:player.score2,
            score3:player.score3,
            isShootAll:player.isShootAll?1:0,
            shootList:shootList,
            score:player.score,
            totalScore:player.totalScore,
            handCards:player.getHandCards(),
            isForce:player.isForce,
            gameId:player.gameId
        }
        playerList.push(p);
    });

    var self = this;

    console.log('this.players score')
    this.players.forEach(function(pppp){
        console.log('this.player id',pppp.playerID,'score:',pppp.score,'total score:',pppp.totalScore);
    });
    //更新数据记录
    for(var i in this.players){
        (function (player){
            sss_db.GameSSSRecord.findOrCreate({where:{uid:player.playerID,tableID:self.table.tableID,number:self.table.gameTimes,tableNo:self.table.tableNo},defaults:{score:0}}).then(function(records){
                records[0].score = player.score;
                records[0].gunNumber = player.gunNumber;
                records[0].bGunNumber = player.bGunNumber;
                records[0].gunAllNumber = player.gunAllNumber;
                records[0].specialNumber = player.specialNumber;
                records[0].sfNumber = player.sfNumber;
                records[0].bombNumber = player.bombNumber;
                records[0].save({attributes:["score"]});
            }).catch(function(err){
                logger.error("GameSSSRecord error:"+err);
            });
            sss_db.TableMember.update({
                score: player.totalScore,
                winNumber:player.winNumber,
                totalGunNumber:player.totalGunNumber,
                totalBGunNumber:player.totalBGunNumber,
                totalGunAllNumber:player.totalGunAllNumber,
                totalSpecialNumber:player.totalSpecialNumber,
                totalSfNumber:player.totalSfNumber,
                totalBombNumber:player.totalBombNumber,
            }, {
                where: {
                    tm_table_id:self.table.tableID,
                    tm_user_id:player.playerID
                }
            }).catch(function(err){
                logger.error("TableMember error:"+err);
            });
        })(self.players[i])

    }

    this.table.emit("sss_onStopGame");//一局游戏结束
    this.table.emit("sss_onResult",playerList);

    // this.saveWar();

    this.players.forEach(function(player){
        player.isGaming = false;
    });

    if(this.table.gameTimes >= this.table.allowGameTimes){
        this.table.stop();
    }
}

Game.prototype.saveWar = function(){
    // var gameType = "gameSSS"
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
    if(!!this.players){
        this.players.forEach(function(player){
            player.clear();
            self.table.clearTickApplyDrop(player);
        });
    }

    this.gameRecord.playerList = [];
    this.gameRecord.messageList = [];
    this.players = [];
}
Game.prototype.getMaxScorePlayerList = function() {
    var player = this.players[0];
    var list = [];
    for(var i = 0,length = this.players.length;i<length;i++){
       if(this.players[i].score > player.score){
           player = this.players[i];
       }
    }
    this.players.forEach(function(pp){
        if(player.score == pp.score){
            list.push(pp);
        }
    });
    return list;
}
Game.prototype.calculateScore = function(){//处理结算
    var self = this;

    //基础分(只限普通13张的玩家)
    this.players.forEach(function(player1){
        var entity1 = player1.entity;
        if(entity1.specialPokerType == poker.SpecialPokerType.NORMAL){
            self.players.forEach(function(player2){
                if(player1.equals(player2)){
                    return;
                }
                var entity2 = player2.entity;
                if(entity2.specialPokerType == poker.SpecialPokerType.NORMAL){
                    if(entity1.entity1.compareTo(entity2.entity1) > 0){
                        player1.score1 += entity1.entity1.water;
                        player2.score1 -= entity1.entity1.water;
                    }
                    if(entity1.entity2.compareTo(entity2.entity2) > 0){
                        player1.score2 += entity1.entity2.water;
                        player2.score2 -= entity1.entity2.water;
                    }
                    if(entity1.entity3.compareTo(entity2.entity3) > 0){
                        player1.score3 += entity1.entity3.water;
                        player2.score3 -= entity1.entity3.water;
                    }

                    if(entity1.entity1.compareTo(entity2.entity1) > 0
                        && entity1.entity2.compareTo(entity2.entity2) > 0
                        && entity1.entity3.compareTo(entity2.entity3) > 0 ){
                        player1.shootList.push(player2);
                        console.log('self.table.gunType',self.table.gunType)
                        if(self.table.gunType == "2"){
                            var score = player1.entity.entity1.water + player1.entity.entity2.water + player1.entity.entity3.water;
                            console.log('gun score1:',score)
                            player1.score += score;
                            player2.score -= score;
                        } else {
                            player1.score += 3;
                            player2.score -= 3;
                        }
                    }
                }
            });

        }
    });
    this.players.forEach(function(ppp){
            ppp.score +=ppp.score1+ppp.score2+ppp.score3;
    });

    //特殊牌型
    this.players.forEach(function(player1){
        if(player1.entity.specialPokerType > poker.SpecialPokerType.NORMAL){
            self.players.forEach(function(player2){
                if(!player1.equals(player2) && player1.entity.compareTo(player2.entity)>0){
                    console.log('self.table.scoreType',self.table.scoreType)
                    if(self.table.scoreType == "2"){
                        player1.score += player1.entity.water2;
                        player2.score -= player1.entity.water2;
                    } else {
                        player1.score += player1.entity.water;
                        player2.score -= player1.entity.water;
                    }

                    console.log('specialPoker:',player1.entity.specialPokerType)
                }
            });
        }
    });

    //计算全垒打
    this.players.forEach(function(p){
        if(p.shootList.length == self.players.length - 1 && p.shootList.length > 1){
            p.isShootAll = true;
            //var score = p.score;
            var score = (p.entity.entity1.water + p.entity.entity2.water + p.entity.entity3.water)*2;
            console.log('gun score2:',score)
            p.shootList.forEach(function(player2){
                console.log('self.table.gunType',self.table.gunType)
                if(self.table.gunType == "2"){
                    player2.score -= score;
                    p.score += score;
                } else {
                    player2.score -= 9;
                    p.score += 9;
                }
            });
        }
    });

    //计算总分
    this.players.forEach(function(p){
        p.totalScore += p.score;
    });
    //同花顺数与炸弹数
    this.players.forEach(function(p){
        self.players.forEach(function(other){
            var some = other.shootList.some(function(pp){
                return pp.playerID == p.playerID;
            });
            p.bGunNumber += some?1:0;
        });

        p.gunNumber = p.shootList.length;
        p.gunAllNumber = p.isShootAll?1:0;
        p.specialNumber = p.entity.specialPokerType > poker.SpecialPokerType.NORMAL?1:0;
        if(p.entity.entity2.pokerType == poker.PokerType.STRAIGHT_FLUSH){
            p.sfNumber++;
        }
        if(p.entity.entity2.pokerType == poker.PokerType.FOUR){
            p.bombNumber++;
        }
        if(p.entity.entity3.pokerType == poker.PokerType.STRAIGHT_FLUSH){
            p.sfNumber++;
        }
        if(p.entity.entity3.pokerType == poker.PokerType.FOUR){
            p.bombNumber++;
        }
        var winList = self.getMaxScorePlayerList();
        winList.forEach(function(winPlayer){
            if(winPlayer.equals(p)){
                p.winNumber++;
            }
        })


        p.totalGunNumber += p.gunNumber;//打枪数
        p.totalBGunNumber += p.bGunNumber;//被打枪数
        p.totalGunAllNumber += p.gunAllNumber;//全垒打数
        p.totalSpecialNumber += p.specialNumber;//特殊牌型数
        p.totalSfNumber += p.sfNumber;//同花顺数
        p.totalBombNumber += p.bombNumber;//炸弹数
    });
    //排序
    this.players.sort(function(p1,p2){
        return p2.score - p1.score;
    });
}

module.exports = {
    Player:Player,
    Table:Table,
    Game:Game,
    GameStage:GameStage,
}