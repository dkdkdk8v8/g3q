var pomelo = require("pomelo");
var poker = require("./poker.js");
var events = require("events");
var util = require('util');
var logger = require('pomelo-logger').getLogger(__filename);
var Code = require('../../../../shared/code');
var ddz_db = require('../../../lib/ddz_db');
var checkUtil =require('../../../../shared/checkUtil');
//var war_record_db = require('../../../lib/war_record_db');
var random = function(min,max){
    return Math.floor(min+Math.random()*(max-min));
}

/**
 * game player
 * @constructor
 */
var Player = function(uid){
    this.uid = uid;
    this.score = 0;//积分
    this.totalScore = 0;//积分
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
    this.pass = false;//玩牌pass
    this.isWinner = false;//是否获胜者
    this.passCall = 0;//叫牌时,过,过后不能再叫牌
    this.isReady = false;//是否准备好，小局游戏开始之前用,第一局不用，直接开始游戏
    this.disconnected = false;//是否断线
    this.isApplier = false;//是否是申请者
    this.ip = "";

    this.answerStatus = 0;//回答状态,0.未作回答,1.同意,2.拒绝
    this.robMultiple = 1;//抢的倍率,默认为1倍
    this.bombNumber = 0;
    this.rocketNumber = 0;
    this.dzWinNumber = 0;//地主胜利次数
    this.nmWinNumber = 0;//农民胜利次数
    this.springNumber = 0;//春天次数
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
        faceID:(!!this.faceID)?this.faceID:"",
        score:this.score,
        totalScore:this.totalScore,
        isGaming:this.isGaming,
        chairNo:this.chairNo,
        pos:this.chairNo - 1,
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
        gameId:this.gameId
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
        faceID:(!!this.faceID)?this.faceID:"",
        score:this.score,
        totalScore:this.totalScore,
        handCards:handCards,
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
        gameId:this.gameId
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
}
Player.prototype.getHandCards = function(){
    var cards = [];
    this.handCards.list.forEach(function(card){
        var oCard = {value:card.value,type:card.type};
        cards.push(oCard);
    })
    return cards;
}

Player.TICK_CALL_SPAN = 15*1000;//操作倒记时长度为15秒
Player.TICK_PLAY_SPAN = 30*1000;//操作倒记时长度为30秒
Player.TICK_APPLY_DROP_SPAN = 5*1000*60;//申请解散倒记时长度为300秒
Player.TICK_ANSWER_DROP_SPAN = 5*1000*60;//回答解散倒记时长度为300秒


var Table = function(msg) {
    events.EventEmitter.call(this);
    this.tableID = msg.tableID;
    this.tableNo = msg.tableNo;
    this.creatorID = msg.creatorID;
    this.playMethod = msg.playMethod;//玩法
    this.allowGameTimes = msg.allowGameTimes;//牌局里允许的游戏次数
    this.isCardCounting = msg.isCardCounting;//是否记牌
    this.consumeDiamond = msg.consumeDiamond;
    this.bombLimitType = msg.bombLimitType;//炸弹上限类型,1:不限,2:3炸、3:4炸、4:5炸
    this.isAntiCheating = msg.isAntiCheating;
    this.players =[];//桌子上的所有玩家
    this.seatNumber = 3;//此桌的座位数量，座位号1..seatNumber
    this.game = null; //桌子上的某局游戏
    this.isStart = false;//牌局开始
    this.isStop = false;
    this.firstOutAllCardPlayer = null;
    this.gameTimes = 0;//游戏次数
    this.bottomFraction = 1;//底分
    this.isApplyStage = false;//是否有人
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

// 代开放解散
Table.prototype.dissolution = function(uid,cb){
    cb = cb || function(){}
    if (uid != this.creatorID && uid != "XAdmin") {
        return cb({code:Code.FAIL,msg:"不是创建者,不能解散房间!"});
    }

    if (this.isStart && uid != "XAdmin"){
        return cb({code:Code.FAIL,msg:"游戏已经开始,不能退出!"});
    }

    // if (this.players.length > 0) {
    //     return cb({code:Code.FAIL,msg:"已经有玩家在房间,无法解散房间!"});
    // }
    var self = this;
    return ddz_db.Table.findOne({
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
    return ddz_db.Table.findOne({
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
            self.emit("ddz_onDropTable",player);
            self.stop();
        });

    }).catch(function(err){
        logger.error("rpc.gameDDZ.gameRemote.drop:"+err);
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
Table.prototype.add = function(player,cb){
    cb = cb || function(){};
    logger.info("desk:",this.tableNo,"Table.add(uid:",player.uid,")");
    if(this.exists(player.uid)){
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
Table.prototype.remove = function(uid){
    logger.info("desk:",this.tableNo,"Table.remove(player)");
    
    var len = this.players.length;
    for (var i = 0; i < len; i++) {
        if(this.players[i].uid == uid){
            this.players.splice(i,1);
            return;
        }
    }
}

Table.prototype.playerReady = function(uid,cb){
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
    if(!!this.game && this.game.gameStage != GameStage.NULL){
        return cb(null,{code:Code.FAIL,msg:'已经在小局游戏中,不能按下准备'});
    }
    var player = this.getPlayerByID(uid);
    if(!!player.isReady){
        cb(null,{code:Code.FAIL,msg:'已经准备好了'})
        return;
    }

    player.isReady = true;
    cb(null,{code:Code.OK});
    this.emit("ddz_onPlayerReady",player);
    var everyOne = this.players.every(function (item) {
        return !!item.isReady;
    });
    if(!!everyOne){
        this.startGame();
    }
}

Table.prototype.kickPlayer = function(player,cb){
    cb = cb || function(){};
    if(!!this.isStart){
        cb(null,{code:Code.FAIL,msg:'此牌局已经开始'})
        return;
    }
    this.remove(player.uid);

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
    if(sitPlayers.length  < 3){
        cb(null,{code:Code.FAIL,msg:'牌局入座人数不够不能开始'});
        return;
    }

    if (this.disTimer) {
        clearTimeout(this.disTimer);
        this.disTimer = null;
    }

    this.isStart = true;
    cb(null,{code:Code.OK});
    this.emit("ddz_onTableStart");
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
    ddz_db.Table.update({
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
        if (!!self.game) {
            self.game.players.forEach(function (player) {
                var p = {
                    uid: player.uid,
                    nickName: player.nickName,
                    totalScore: player.totalScore,
                    bombNumber:player.bombNumber,
                    rocketNumber:player.rocketNumber,
                    dzWinNumber:player.dzWinNumber,//地主胜利次数
                    nmWinNumber:player.nmWinNumber,//农民胜利次数
                    gameId:player.gameId
                }
                playerList.push(p);
            });
            ddz_db.Table.update({ res: JSON.stringify(playerList)}, { where: { tableID:self.tableID } });
        }
        playerList.sort(function (s1, s2) {
            return s2 - s1;
        });

        self.players.forEach(function(p){
            if(self.clubId){
                pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitup(null,{uid:p.uid,clubId:self.clubId,boxId:self.boxId,deskName:self.tableNo},function(){});
            }
        })

        if(self.isReplace){
            pomelo.app.rpc.usersvr.userRemote.queryUsers(self.creatorID,{quids:[self.creatorID],attrs:["uid","faceId","gameId","nickName"]},function(err,users){
                var user = users[0];
                var uid = user.uid;
                var faceId = user.faceId;
                var gameId  = user.gameId;
                var nickName = user.nickName;
                self.emit("ddz_onTableStop", playerList,{uid:uid,gameId:gameId,faceId:faceId,nickName:nickName});
                self.clear();
                cb(null,{code:Code.OK});
            });
        }else{
            self.emit("ddz_onTableStop", playerList,null);
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
        return !!p.chairNo;
    });
    if(sitPlayers.length  < 3){
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
            this.fangOwnerID = player.uid;
        }
        else {
            this.fangOwnerID = this.creatorID;
        }
    }
    player.chairNo = chairNo;

    cb(null,{code:Code.OK});
    if(this.clubId){pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitdown(null,{playerInfo:player.getBasicInfo(),deskName:this.tableNo,clubId:this.clubId,boxId:this.boxId},function(){});}
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
        this.emit("ddz_onTableStandUp",player,chairNo);
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
        playMethod:this.playMethod,//玩法
        allowGameTimes:this.allowGameTimes,//牌局里允许的游戏次数
        isCardCounting:this.isCardCounting,//是否记牌
        isApplyStage:this.isApplyStage,//是否处于申请阶段
        isStart:this.isStart,
        isStop:this.isStop,
        gameTimes:this.gameTimes,//游戏次数
        bottomFraction:this.bottomFraction,//底分
        tableNo:this.tableNo,
        creatorID:this.creatorID,
        bombLimitType:this.bombLimitType,
        startDate:this.startDate,
        isReplace:this.isReplace,
        fangOwnerID:this.fangOwnerID,
        isAntiCheating:this.isAntiCheating,
    }
    return info;
}

Table.prototype.getTableInfo = function(uid){
    var playerList = [];
    this.players.forEach(function(player){
        var pUid = player.uid;
        if(!!uid){
            pUid = uid;
        }
        playerList.push(player.getPlayerInfo(pUid));
    })
    var tableInfo = {
        players:playerList,
        tableID:this.tableID,
        game:(!!this.game)?this.game.getGameInfo():null,
        playerCallTimeSpan:Player.TICK_CALL_SPAN,
        playerPlayTimeSpan:Player.TICK_PLAY_SPAN,
        playerApplyDropTimeSpan:Player.TICK_APPLY_DROP_SPAN,
        playerApplyAnswerTimeSpan:Player.TICK_ANSWER_DROP_SPAN,
        playMethod:this.playMethod,//玩法
        allowGameTimes:this.allowGameTimes,//牌局里允许的游戏次数
        isCardCounting:this.isCardCounting,//是否记牌
        isApplyStage:this.isApplyStage,//是否处于申请阶段
        isStart:this.isStart,
        isStop:this.isStop,
        gameTimes:this.gameTimes,//游戏次数
        bottomFraction:this.bottomFraction,//底分
        tableNo:this.tableNo,
        creatorID:this.creatorID,
        bombLimitType:this.bombLimitType,
        isReplace:this.isReplace,
        fangOwnerID:this.fangOwnerID,
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
Table.prototype.startTickApplyDrop = function(player){
    logger.info("desk:",this.tableNo,"startTickApplyDrop:",player.uid);
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
    this.emit("ddz_onApplyDrop",player);
    this.startTickApplyDrop(player); //启动倒记时
}
Table.prototype.applyDropStop = function(){
    console.log('Table applyDropStop')
    var agreeList = this.players.filter(function(p){
        return !!p.chairNo && p.answerStatus == 1;
    });
    var answerList = this.players.filter(function(p){
        return (!!p.chairNo && p.answerStatus > 0 && !p.isApplier);
    });

    var self = this;
    this.players.forEach(function(p){
        if(!!p.isApplier){
            p.isApplier = false;//是否是申请者
            if(agreeList.length >= 1 || answerList.length <= 0){//有人同意或无人回答,解散房间
                self.drop(p);
                console.log('applyDropStop---', p.uid);
            }
            self.clearTickApplyDrop(p);
        }
    });
    this.isApplyStage = false;
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
    this.emit("ddz_onAnswerDrop",player,agree);

    var agreeList = this.players.filter(function(p){
        return !!p.chairNo && p.answerStatus == 1;
    });
    var answerList = this.players.filter(function(p){
        return (!!p.chairNo && p.answerStatus > 0 && !p.isApplier);
    });
    if(agreeList.length >= 1 || answerList.length >= 2){//有1人回答,结束申请
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
    this.robMultiple = 1;//抢地主倍数1,2,4,8,16,抢一次增加一倍
    this.springFaction = 1;//春天
    this.bombFraction = 1;//炸弹倍率
    this.gameRecord = {
        messageList:[]
    };//一局游戏的牌谱记录
    this.gameResult = {};
    this.rate = 1;//倍率
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
        rate:this.rate//总倍率
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

Game.prototype.dealHandCards = function(){
    var self = this;

    this.players.forEach(function(player){
        var cards = self.deck.dispatch(17);
        player.handCards = new poker.Cards();
        cards.forEach(function(card){
            player.handCards.add(card);
        })
        player.handCards.sort();
        self.table.emit("ddz_onDealHandCards",player);
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
    if(this.table.playMethod != '2'){
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

    this.rate = this.table.bottomFraction* this.callFraction*this.robMultiple;

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
    this.callFraction = msg.callFraction;
    if(player.callFraction == 3){
        this.landlord = player;
    }

    cb(null,{code:Code.OK});

    this.rate = this.table.bottomFraction* this.callFraction*this.robMultiple;

    this.table.emit("ddz_onCall",player);


    //处理叫牌流程
    this.progressCall(player);

}
Game.prototype.stopCall = function(){
    var pList = this.players.filter(function(player){//有三个pass
        return !!player.passCall;
    });

    if(!!pList && pList.length >=3){//三个pass
        if(this.table.gameTimes >= this.table.allowGameTimes){
            return this.table.stop();
        }
        else {
            return this.table.startGame();
        }
    } else {
        //取地主
        var pList = null;
        if (this.table.playMethod == '2' && this.table.game.robMultiple >=2) {//抢地主
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
    if (this.table.playMethod == '1') {//叫分
        if(this.callFraction >= 3){//有人叫3分,结束叫牌
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
    if (this.table.playMethod == '2') {//抢地主
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
    if (this.table.playMethod == '3') {//叫地主
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
        if((this.table.bombLimitType == 1)
            || (this.table.bombLimitType == 2 && this.bombFraction < 8)
            || (this.table.bombLimitType == 3 && this.bombFraction < 16)
            || (this.table.bombLimitType == 4 && this.bombFraction < 16)){
            this.bombFraction = this.bombFraction*2;
        }
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
            this.springFaction = 2;
            this.landlord.springNumber++;
        }
    } else  if(this.landlord.outList.length == 1){
            this.springFaction = 2;
    }

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
    if(!this.check(player,cardList)){
        cb(null,{code:Code.FAIL,msg:'牌型不符合或大不过上一家'})
        return;
    }

    player.isAllowOperate = false;

    player.outList.push(cardList);
    player.handCards.removeList(cardList);

    console.log('player.handCards',player.handCards.size,'uid:',player.uid);
    if(player.handCards.size <=0){
        this.table.firstOutAllCardPlayer = player;
    }
    player.pass = false;
    cb(null,{code:Code.OK});

    this.rate = this.table.bottomFraction* this.callFraction*this.robMultiple * this.bombFraction *this.springFaction;

    if(this.currentPlayer == this.firstPlayer){//出牌
        this.previousPlayer = null;
        this.table.emit("ddz_onOut",player,msg.cards,0);
    } else { //压牌
        this.firstPlayer = this.currentPlayer;

        this.table.emit("ddz_onOut",player,msg.cards,1);
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
    player.isAllowOperate = false;

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
    if (this.table.playMethod == '2') {//抢地主
        o.allowRob = true;
    } else if (this.table.playMethod == '3') {//叫地主
        o.callFraction = 3;
    }
    player.isAllowOperate = true;
    this.table.emit("ddz_onTurnToCaller",player,o);
}
Game.prototype.dealBoard = function(){
    this.board = [];
    var card1 = this.deck.dispatch();
    var card2 = this.deck.dispatch();
    var card3 = this.deck.dispatch();
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

Game.prototype.setFirstCaller = function(){
    //指定叫牌玩家
    if(!!this.table.firstOutAllCardPlayer){
        this.firstPlayer = this.table.firstOutAllCardPlayer;
        return this.table.firstOutAllCardPlayer.isFirstCaller = true;
    }
    else {
        if (!this.table.firstPlayer) {
            var i = random(0,this.players.length);
            this.firstPlayer = this.players[i];
            this.table.firstPlayer = this.players[i];
            return this.players[i].isFirstCaller = true;
        }
        else {
            this.firstPlayer = this.table.firstPlayer;
            return this.firstPlayer.isFirstCaller = true;
        }
    }
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
    this.table.emit("ddz_onOperateCode",player,this.getOperateCode(player));
}

Game.prototype.start = function(){
    this.table.gameTimes++;
    this.players.forEach(function(player){
        player.clear();
        player.isGaming = true;

    });
    this.deck = new poker.Deck();
    //this.deck.sort();
    this.deck.shuffle(100);
    this.table.emit("ddz_onStartGame");//一局游戏开始
    this.dealHandCards();//发17张牌

    this.gameRecord.table = this.table.getTableInfo();

    this.callStage();//叫地主阶段
    if(!! this.table.clubId){
        pomelo.app.rpc.clubsvr.clubRemote.onStartGame(null,{gameType:"gameDDZ",deskName:this.table.tableNo,
        clubId:this.table.clubId,boxId:this.table.boxId,gameCount:this.table.gameTimes,totalGameCount:this.table.allowGameTimes},function(){});
    }
}

Game.prototype.stop = function(){
    if(this.gameStage == GameStage.NULL){
        return;
    }
    this.gameStage = GameStage.NULL;
    console.log('stop')
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
    //摊牌
    var playerList = [];

    this.players.forEach(function(player){
        var p = {uid:player.uid,nickName:player.nickName,score:player.score,totalScore:player.totalScore,handCards:player.getHandCards()}
        playerList.push(p);
    });

    //更新数据记录
    for(var i in this.players){
        (function (player){
            ddz_db.TableMember.update({
                score: player.totalScore
           }, {
               where: {
                   tm_table_id:self.table.tableID,
                   tm_user_id:player.uid
               }
           });

            ddz_db.GameDDZRecord.findOrCreate({where:{uid:player.uid,tableID:self.table.tableID,number:self.table.gameTimes,tableNo:self.table.tableNo},defaults:{score:0}}).then(function(records){
                records[0].score = player.score;
                records[0].save({attributes:["score"]});
            });
        })(this.players[i]);

    }
    this.table.emit("ddz_onStopPlay");
    this.table.emit("ddz_onStopGame");//一局游戏结束
    this.table.emit("ddz_onResult",playerList);

    // this.saveWar();

    if(this.table.gameTimes >= this.table.allowGameTimes){
        this.table.stop();
    }
}
Game.prototype.saveWar = function(){
    //保存当局牌谱到数据库
    // var gameType = "gameDDZ"
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
        player.score = bottomFraction*winFraction * roleFaction* self.callFraction*self.robMultiple * self.bombFraction *self.springFaction;
        player.totalScore = player.score + player.totalScore;
    });
}

module.exports = {
    Player:Player,
    Table:Table,
    Game:Game,
    GameStage:GameStage,
}