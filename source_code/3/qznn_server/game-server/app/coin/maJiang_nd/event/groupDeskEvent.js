/**
 * Created by Administrator on 2016/9/13.
 */
var exp = module.exports;
var pomelo = require("pomelo");
var Player = require("../module/player");
var gDef = require("../globalDefine");
var Card = require("../module/cardSet");
var CardUtils = require('../module/cardUtils');
var async = require("async");
var log = pomelo.app.get('mongodb');
var utils = require('../../../util/utils');

exp.addEventListener = function (desk) {
    var gameType = "coinMaJiang_nd";

    desk.tasks = [];

    desk.sids = {};

    var crapsTimeOut = 3000;
    var initCardTimeOut = 5000;
    var popCardTimeOut = 200;

    desk.endCards = {};

    desk.runUid = {};
    desk.optUid = {};
    desk.optNum = 0;

    // 解散
    desk.disFlag = {};

    // 是否一炮多响
    desk.multiHu = {};

    desk.finishOptUid = [];
    desk.totalRecord = [];
    desk.gameStatus = gDef.GameStatus.Ready;
    // 进入桌子
    desk.on('enter', function(args) {
        // 新进游戏 自动入座
        if (!desk.getPlayerByUid(args.uid) && desk.canEnterDesk(args) == 0) {

            desk.sids[args.uid] = {uid:args.uid, sid:args.sid};

            console.log("自动入座");
            args.bAuto = true;
            desk.pushTask('sitDown', args);
            //desk.emit("sitDown", args);
        }
        else {
            desk.pushTask('reconnect', args);
        }
        desk.nextTask();
    });
    // 坐下
    desk.on('sitDown', function(args) {
        var uid = args.uid;

        for (var i = 0; i < desk.maxPlayer; i++) {
            if (!desk.players[i]) {
                // 限时场
                desk.players[i] = new Player({
                    uid: uid,
                    nickName: args.nickName,
                    pos: i,
                    faceId: args.faceId,
                    userData: args.userData,
                    ip: args.ip,
                    gameId: args.gameId,
                    coin: args.coin,
                    sex: args.sex,
                    isMatcher: !! desk.mid
                });

                if(desk.isMatch()){
                    desk.players[i].setPlayStatus(gDef.PlayStatus.null);
                }else{
                    desk.players[i].setPlayStatus(gDef.PlayStatus.ready);
                }
                desk.uidPosMap[uid] = i;
                desk.playerNum += 1;

                if (args.bAuto) {
                    if (desk.playerNum > 1 && ! desk.isMatch()) {
                        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnSitDown', desk.players[i].getBasicInfo(), desk.getOtherUids(uid));
                    }
                }
                else {
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnSitDown', desk.players[i].getBasicInfo(), desk.getOnlineSids());
                }
                //检测开始
                var checkStart = function(){            
                    // 游戏可以开始了
                    var every = desk.players.every(function(player){
                        return player.getPlayStatus() == gDef.PlayStatus.ready;
                    })

                    if (desk.playerNum == desk.maxPlayer && !! every) {
                        setTimeout(function() {
                            desk.gameStatus = gDef.GameStatus.Craps1;
                            desk.emit('start');
                        }, 1000);
                    }
                }
                checkStart();
                break;
            }
        }

        if(! desk.isMatch() && desk.roomIndex < 4){
            pomelo.app.rpc.robotMaster.masterRemote.onPlayerEnterDesk(null,{uid:uid,deskName:desk.deskName,gameType:gameType},function (err,res) {
                if(!! err){
                    console.log('notify robot sitdown err',err.message);
                }
            });
        }
        log.insert({cmd:gameType+"_sitDown", deskId:desk.deskId, uid:uid});
        desk.nextTask();
    });
    // 离开桌子
    desk.on('exit', function(args) {
        var uid = args.uid;
        var player = desk.getPlayerByUid(uid);
        if (!player) {
            desk.nextTask();
            return;
        }

        // 游戏还没有开始
        if (desk.gameStatus == gDef.GameStatus.Ready && ! desk.isMatch()) {
            desk.deletePlayer(uid);
            if(! args.isGameEnd ){
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnExit', {
                    uid: uid,
                    msg: args.msg
                }, desk.getOnlineSids());
            }
            log.insert({cmd: gameType + "_exit", uid: args.uid});

            console.log("exit", args);
            player.leaveGame(gameType, desk.getDeskName());
            delete desk.sids[args.uid];
        }
        else {
            // 玩家没有加入当前游戏
            // if (player.getPlayStatus() != gDef.PlayStatus.play) {
            //     desk.deletePlayer(uid);
            //     log.insert({cmd: gameType + "_sitUp", uid: args.uid});
            //     pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnSitUp', {uid: uid}, desk.getOnlineSids());
            // }
            // else {
                pomelo.app.get('channelService').pushMessageByUids("OnErrMsg", {
                    err: true,
                    msg: "当前游戏状态下无法退出游戏!"
                }, desk.getSid(uid));
                desk.nextTask();
                return;
            // }
        }

        if(! desk.isMatch()){
            pomelo.app.rpc.robotMaster.masterRemote.onPlayerExitDesk(null,{uid:uid,deskName:desk.getDeskName(),gameType:gameType},function (err,res) {
                if(!! err){
                    console.log('notify robot exit desk failed with err message',err.message);
                }
            });
        }
        desk.nextTask();
    });
    // 开始一局
    desk.on('start', function(args) {
        if (!desk.canStart()) {
            desk.nextTask();
            return;
        }

        if (desk.gameStatus != gDef.GameStatus.Craps1) {
            desk.nextTask();
            return;
        }

        desk.uidArr = [];
        for (var i = 0; i < desk.maxPlayer; i++) {
            if (desk.players[i]) {
                desk.cardGetInfo[desk.players[i].getUid()] = [];
                desk.cardPutInfo[desk.players[i].getUid()] = [];
                desk.uidArr.push(desk.players[i].uid);
            }
        }

        console.log("start New Game!!!");
        var costDeskFee = function(cb){
            var funcs = [];
            var costFunc = function(uid){
                var cf = function(callback){
                    var player = desk.getPlayerByUid(uid);
                    player.addScore(- desk.getDeskFee(),callback);
                    log.insert({cmd:"coin_tax",gameType:gameType,uid:player.uid,deskName:desk.deskName,coin:desk.getDeskFee()});
                }
                return cf;
            }

            for(var i = 0; i < desk.uidArr.length; i++){
                var uid = desk.uidArr[i];
                funcs.push(costFunc(uid));
            }

            async.parallel(funcs,function(err,results){
                
                if(!! err){
                    return cb(err);
                }
                cb(null);
            })
        }

        var freezePlayerCoin = function(cb){
            var funcs = [];
            var freezeFunc = function(uid){
                var ff = function(callback){
                    var player = desk.getPlayerByUid(uid);
                    pomelo.app.rpc.usersvr.userRemote.freezeCoin(null,{uid:player.uid,freezeCoin:desk.minCoin - desk.getDeskFee()},function(err,res){
                        if(!! err){
                            //return callback(err);
                        }
                        callback(null);
                    })
                }
                return ff;
            }

            for(var i = 0; i < desk.uidArr.length; i++){
                var uid = desk.uidArr[i];
                funcs.push(freezeFunc(uid));
            }

            async.parallel(funcs,function(err,results){
                if(!! err){
                    return cb(err);
                }
                cb(null);
            })
        }

        var finalFunc = function(err,res){
            if(! desk.isMatch){
                pomelo.app.rpc.robotMaster.masterRemote.onGameStart(null,{deskName:desk.deskName,gameType:gameType},function (err,res) {
                    if(!!err){
                        console.log('notify robot start game failed',err.message);
                    }
                });
            }

            desk.uidArr = [];
            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player && !player.isTrusted() && player.score >= desk.getMinCoin()) {
                    // var uid = player.getUid();
                    // desk.uidArr.push(uid);
                    // player.addGameCount();
                    // desk.optUid[uid] = true;
                    // player.setPlayStatus(gDef.PlayStatus.play);
                }else{
                    if(! player){
                        console.log("1.nd start no player------------>>>>");
                    }else{
                        if(player.isTrusted()){
                            console.log("2.nd start player------------>>>>",player.uid,"is trustted");
                        }else{
                            console.log("3.nd start player------------>>>>",player.uid,"mini coin",desk.minCoin,"has coin",player.score);
                        }
                    }
                }
            }
            desk.uidArr = [];
            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player) {
                    var uid = player.getUid();
                    desk.uidArr.push(uid);
                    player.addGameCount();
                    player.setFirstRound(true);
                }
            }
    
            if (desk.bankPos == -1) {
                desk.bankPos = Math.floor(Math.random()*desk.maxPlayer);
                desk.bankUid = desk.players[desk.bankPos].getUid();
            }
    
    
            //初始化跟庄
            if(desk.isGenZhuang()){
                desk.roundCount=0;
                desk.genZhuangCard=null;
                desk.genZhuangCount=0;
                desk.genZhuangSuccess=false;
            }
    
    
    
            //本局分数初始为0
            // for (var j = 0; j < desk.maxPlayer; j++) {
            //     desk.playerRoundScores[j].roundScores.push(0);
            // }
    
            //计算风位
            var tmpPos=desk.bankPos;
            switch(desk.playerNum)
            {
                case 2:
                    desk.players[tmpPos].setFengWei(0);
                    tmpPos=desk.nextPos(tmpPos);
                    desk.players[tmpPos].setFengWei(2);
                    break;
                case 3:
                    for(var i=0;i<3;i++)
                    {
                        if(tmpPos>=desk.bankPos)
                            desk.players[tmpPos].setFengWei(i);
                        else
                            desk.players[tmpPos].setFengWei(4-(desk.bankPos-tmpPos));
                        tmpPos=desk.nextPos(tmpPos);
                    }
                    break;
                case 4:
                    for(var i=0;i<4;i++)
                    {
                        desk.players[tmpPos].setFengWei(i);
                        tmpPos=desk.nextPos(tmpPos);
                        console.log("index:",i,"tmpPos is:",tmpPos);
                    }
                    break;
                default:
            }
    
            var data =  {
                playUids: desk.uidArr,
                gameStatus: desk.gameStatus,
                bankUid:desk.bankUid
            };
    
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnGameStart', data, desk.getOnlineSids());
    
            // desk.roundRecord.records.push({cmd:gameType+"_OnGameStart", data:data});
    
            desk.card = new Card();
    
            //根据买马数量，抽牌保存下来
            desk.maCards=desk.card.getCard(desk.maiMaAmount());
            // 第一次掷骰子
            var nums = [];
            var total = 0;
            for (var i = 0; i < 2; i++) {
                var tmp = Math.floor(Math.random() * 6 + 1);
                nums.push(tmp);
                total += tmp;
            }
            data = {gameStatus:desk.gameStatus, nums:nums,bankUid:desk.bankUid, caiShen:[]};
            pomelo.app.get('channelService').pushMessageByUids(gameType+"_OnCraps", data, desk.getOnlineSids());
            // desk.roundRecord.records.push({cmd:gameType+"_OnCraps", data:data});
    
            desk.curPos = desk.bankPos;
    
            desk.gameStatus = gDef.GameStatus.Craps2;
    
    
            setTimeout(function () {
                if (desk.gameStatus != gDef.GameStatus.Craps2) {
                    return;
                }
                var nums = [];
                for (var i = 0; i < 2; i++) {
                    var tmp = Math.floor(Math.random() * 6 + 1);
                    nums.push(tmp);
                }
                data = {gameStatus:desk.gameStatus, nums:nums,bankUid:desk.bankUid, caiShen:[]};
                pomelo.app.get('channelService').pushMessageByUids(gameType+"_OnCraps", data, desk.getOnlineSids());
                //desk.roundRecord.records.push({cmd:gameType+"_OnCraps", data:data});
    
                log.insert({cmd:gameType+"_craps", deskId:desk.deskId});
    
                setTimeout(function () {
                    desk.gameStatus = gDef.GameStatus.InitCard;
                    desk.emit('initcard');
                }, 1000);
            }, crapsTimeOut);
        }

        async.waterfall([costDeskFee,freezePlayerCoin],finalFunc);
    });

    desk.on('initcard', function (args) {
        if (desk.gameStatus != gDef.GameStatus.InitCard) {
            desk.nextTask();
            return;
        }

        var playerCards = [];
        var cards;
        cards = desk.card.getCard(13);
        desk.players[desk.bankPos].addHandCards(cards);
        desk.players[desk.bankPos].setPlayStatus(gDef.PlayStatus.play);
        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnInitCard', {
                cards: cards,
                uid:desk.bankUid
            },
            desk.getSid(desk.players[desk.bankPos].getUid()));
        playerCards.push({uid:desk.bankUid, cards:cards});
        log.insert({cmd:gameType+"_initcard", deskId:desk.deskId, cards:cards, uid:desk.bankUid});

        var pos = desk.nextPos(desk.bankPos);
        
        while (pos != desk.bankPos) {
            cards = desk.card.getCard(13);
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnInitCard', {
                    cards: cards,
                    uid:desk.players[pos].getUid()
                },
                desk.getSid(desk.players[pos].getUid()));
            desk.players[pos].addHandCards(cards);
            playerCards.push({uid:desk.players[pos].getUid(), cards:cards});
            desk.players[pos].setPlayStatus(gDef.PlayStatus.play);
            log.insert({cmd:gameType+"_initcard", deskId:desk.deskId, cards:cards, uid:desk.players[pos].getUid()});
            pos = desk.nextPos(pos);
        }

        //desk.roundRecord.records.push({cmd:gameType+"_OnInitCard", data:playerCards});
        //TODO:Remove
        // var watcher = desk.getWatcherUids();
        // if (watcher.length > 0) {
        //     pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnInitCard', {
        //             gameStatus:desk.gameStatus
        //         },
        //         watcher);
        // }
        if(desk.huanPaiType()!=1) {
            setTimeout(function () {
                desk.curPos = desk.bankPos;
                desk.emit('huan');
            }, 600*desk.maxPlayer+500);
        }
        else {
            setTimeout(function () {
                desk.gameStatus = gDef.GameStatus.PushCard;
                desk.curPos = desk.bankPos;
                desk.emit('pushcard');
            }, 600*desk.maxPlayer+500);
        }
    });
    // 结束一局
    desk.notifyRobotGameEnd = function(award){
        var self = desk;
        if(! self.isMatch()){
            pomelo.app.rpc.robotMaster.masterRemote.onGameEnd(null, {
                deskName: desk.deskName,
                gameType: gameType,
                award: award,
            }, function (err, res) {
                if (!!err) {
                    console.log('notify robot game end failed', err.message);
                }
            })
        }
    }


    desk.on('end', function(args) {
        console.log("----------------------------->>>end 1111");
        if (desk.gameStatus == gDef.GameStatus.End) {
            desk.nextTask();
            return ;
        }
        desk.gameStatus = gDef.GameStatus.End;
        desk.clearOptTimeout();
        var optUid = args || [];

        if(!args) {
            console.log("流局");
            for (var i = 0; i < desk.uidArr.length; i++) {
                var player = desk.getPlayerByUid(desk.uidArr[i]);
                player.addLiuCount();
            }
        }
        console.log("---------------------------------------------->>>>end", optUid);
        var changeBank = true;
        var winPos;
        var huUids = [];
        var huUidSet = {};
        for (var i = optUid.length-1; i >= 0; i--) {
            if (optUid[i].optCode != gDef.OptCardCode.Hu) {
                optUid.splice(i, 1);
            }
            else {
                huUidSet[optUid[i].uid] = true;
            }
        }

        if (huUidSet[desk.bankUid] || optUid.length == 0 ) {
            changeBank = false;
        }

        // 有人胡
        var scoreInfos = {};
        var score = {};
        var playerCards = [];

        for (var i = 0; i < desk.uidArr.length; i++) {
            var player = desk.getPlayerByUid(desk.uidArr[i]);
            playerCards.push({uid: player.getUid(), lastCard: player.getLastCard(), cards: player.getHandCards(), optCards: player.getOptCards(),myMaCards:[]});
            score[desk.uidArr[i]] = 0;
        }

        console.log("score",score);
        // 胡牌得分
        for (var i = 0; i < optUid.length; i++) {
            var winUid = optUid[i].uid;
            var player = desk.getPlayerByUid(winUid);
            for (var j = 0; j < desk.uidArr.length; j++) {
                if(desk.uidArr[j]==winUid)
                    winPos=j;
            }


            //把最后一张牌放进胡牌人的手牌
            if(desk.curCard){
                for(var j=0;j<playerCards.length;j++) {
                    if(playerCards[j].uid==winUid){
                        playerCards[j].cards.push(desk.curCard);
                        playerCards[j].cards.sort(function (a, b) {
                            return a-b;
                        });
                    }
                }
            }

            player.addHuCount();
            var optCards = player.getOptCards();

            var lastGetCard = player.getLastCard() || desk.curCard;
            huUids.push(winUid);
            // 自摸的话
            if (player.getLastCard()) {}
            else {

                var cuid = desk.players[desk.curPos].getUid();

                desk.players[desk.curPos].qiangGangRollback(desk.lastGangCard);

                if (desk.lastGangInfo[cuid]) {
                    optUid[i].huTypes.push({huType: gDef.HuType.QiangGang,
                        score: gDef.HuTypeInfo[gDef.HuType.QiangGang].score,
                        name: gDef.HuTypeInfo[gDef.HuType.QiangGang].name});
                }
            }



            var totalScore = 0;
            var tmpHuType=null;
            var tmpscore = 0;
            var scrollMsg=""
            console.log("huTypes",optUid[i].huTypes);
            //选出分数最高的牌型，然后按照是否加大给相应的分数
            for (var j = 0; j < optUid[i].huTypes.length; j++) {
                //打出大吊车牌型的时候发送滚动消息
                switch(optUid[i].huTypes[j].huType){
                    case gDef.HuType.QuanQiuRen:
                        scrollMsg="大吊车";
                        player.addDaDiaoCheCount();
                        console.log("大吊车");
                        break;
                    case  gDef.HuType.PengPenghu:
                        console.log("大胡");
                        player.addDaHuCount();
                        break;
                    case  gDef.HuType.QiDui:
                        console.log("七对");
                        player.addQiDuiCount();
                        break;
                    default:
                        break;
                }
                if(!tmpHuType||tmpHuType.score<optUid[i].huTypes[j].score)
                    tmpHuType=optUid[i].huTypes[j];
            }
            if(desk.isJiaDa()) {
                tmpHuType.score=gDef.HuTypeInfo[tmpHuType.huType].bigscore;
                optUid[i].huTypes=[tmpHuType];
                totalScore = tmpHuType.score;
            }
            else {
                optUid[i].huTypes=[tmpHuType];
                totalScore = tmpHuType.score;
            }
            console.log("maxhuTypes",optUid[i].huTypes);
            console.log("totalScore",totalScore);
            // 自摸的话
            var isGangShangKaiHua=false;
            var scoreMultiply=1;
            if (player.getLastCard()) {
                // 杠上开花
                if (desk.lastGangInfo[winUid]) {
                    isGangShangKaiHua=true;
                    if(optUid[i].huTypes[0].huType==gDef.HuType.PingHu){
                        optUid[i].huTypes[0]={huType: gDef.HuType.GangShangKaiHua,
                            score: gDef.HuTypeInfo[gDef.HuType.GangShangKaiHua].score,
                            name: gDef.HuTypeInfo[gDef.HuType.GangShangKaiHua].name}
                    }
                    else{
                    optUid[i].huTypes[0].name=optUid[i].huTypes[0].name+" 杠上开花";
                    scoreMultiply*=2;}
                }

            if(desk.isHaiDiLao()){
            // 海底捞月
            if (desk.card.getLeftCard() == 0) {
                //打出海底捞牌型的时候发送滚动消息
                scrollMsg="海底捞";
                player.addHaiDiLaoCount();
                if(isGangShangKaiHua){
                    if(optUid[i].huTypes[0].huType==gDef.HuType.GangShangKaiHua){
                        scrollMsg="杠开海底捞平胡";
                        optUid[i].huTypes[0]={huType: gDef.HuType.GangShangKaiHuaHaiDiLao,
                            score: gDef.HuTypeInfo[gDef.HuType.GangShangKaiHuaHaiDiLao].score,
                            name: gDef.HuTypeInfo[gDef.HuType.GangShangKaiHuaHaiDiLao].name}
                    }
                    else if(optUid[i].huTypes[0].huType==gDef.HuType.PengPenghu){
                        scrollMsg="杠开海底捞大胡";
                        optUid[i].huTypes[0]={huType: gDef.HuType.GangShangKaiHuaHaiDiLaoDaHu,
                            score: gDef.HuTypeInfo[gDef.HuType.GangShangKaiHuaHaiDiLaoDaHu].score,
                            name: gDef.HuTypeInfo[gDef.HuType.GangShangKaiHuaHaiDiLaoDaHu].name}
                            scoreMultiply/=2;
                    }
                    else if(optUid[i].huTypes[0].huType==gDef.HuType.QuanQiuRen){
                        scrollMsg="杠开海底捞大吊车";
                        optUid[i].huTypes[0]={huType: gDef.HuType.GangShangKaiHuaHaiDiLaoDaDiaoChe,
                            score: gDef.HuTypeInfo[gDef.HuType.GangShangKaiHuaHaiDiLaoDaDiaoChe].score,
                            name: gDef.HuTypeInfo[gDef.HuType.GangShangKaiHuaHaiDiLaoDaDiaoChe].name}
                            scoreMultiply/=2;
                    }

                }
                else{

                    if(optUid[i].huTypes[0].huType==gDef.HuType.QuanQiuRen){
                        scrollMsg="海底捞大吊车";
                    }
                    if(optUid[i].huTypes[0].huType==gDef.HuType.HaoHuaQidui){
                        scrollMsg="海底捞豪华七对";
                    }
                    if(optUid[i].huTypes[0].huType==gDef.HuType.ShuangHaoHuaQidui){
                        scrollMsg="海底捞双豪华七对";
                    }

                optUid[i].huTypes[0].name=optUid[i].huTypes[0].name+" 海底捞";

                    if(optUid[i].huTypes[0].huType==gDef.HuType.PingHu){
                        scrollMsg="海底捞";
                        optUid[i].huTypes[0]={huType: gDef.HuType.HaiDiLaoYue,
                            score: gDef.HuTypeInfo[gDef.HuType.HaiDiLaoYue].score,
                            name: gDef.HuTypeInfo[gDef.HuType.HaiDiLaoYue].name}
                    }
                    else
                        scoreMultiply*=2;
                }
            }
            }
            console.log("huTypes",optUid[i].huTypes);
            console.log("totalScore",totalScore);
            }
            //如果加大，则改成加大分
            if(desk.isJiaDa()) {
                optUid[i].huTypes[0].score=gDef.HuTypeInfo[optUid[i].huTypes[0].huType].bigscore;
            }
            //不论结果如何，刷新totalscore
            totalScore=optUid[i].huTypes[0].score;

            if (player.getLastCard()) {
                // 庄家天胡
                if (desk.bankUid == winUid) {
                    if (desk.cardGetInfo[winUid].length == 1 && player.getOptCards().length == 0) {
                        //打出天胡牌型的时候发送滚动消息
                        scrollMsg = "天胡";
                        if (desk.isJiaDa()) {
                            if ((totalScore * 4) > gDef.HuTypeInfo[gDef.HuType.TianHu].bigscore) {
                                optUid[i].huTypes[0].name = optUid[i].huTypes[0].name + " 天胡";
                                scoreMultiply *= 4;
                            }
                            else {
                                totalScore = gDef.HuTypeInfo[gDef.HuType.TianHu].bigscore;
                                optUid[i].huTypes = [{
                                    huType: gDef.HuType.TianHu,
                                    score: gDef.HuTypeInfo[gDef.HuType.TianHu].bigscore,
                                    name: gDef.HuTypeInfo[gDef.HuType.TianHu].name
                                }];
                            }

                        }
                        else {
                            if ((totalScore * 4) > gDef.HuTypeInfo[gDef.HuType.TianHu].score) {
                                optUid[i].huTypes[0].name = optUid[i].huTypes[0].name + " 天胡";
                                scoreMultiply *= 4;
                            }
                            else {
                                totalScore = gDef.HuTypeInfo[gDef.HuType.TianHu].score;
                                optUid[i].huTypes = [{
                                    huType: gDef.HuType.TianHu,
                                    score: gDef.HuTypeInfo[gDef.HuType.TianHu].score,
                                    name: gDef.HuTypeInfo[gDef.HuType.TianHu].name
                                }];
                            }
                        }

                    }
                }
                // 闲家地胡
                else {
                    if (desk.cardGetInfo[winUid].length == 1 && player.getOptCards().length == 0) {
                        //打出地胡牌型的时候发送滚动消息
                        scrollMsg = "地胡";


                        if (desk.cardGetInfo[winUid].length == 1 && player.getOptCards().length == 0) {
                            if (desk.isJiaDa()) {
                                if ((totalScore * 3) > gDef.HuTypeInfo[gDef.HuType.DiHu].bigscore) {
                                    scoreMultiply *= 3;
                                    optUid[i].huTypes[0].name = optUid[i].huTypes[0].name + " 地胡";
                                }
                                else {
                                    totalScore = gDef.HuTypeInfo[gDef.HuType.DiHu].bigscore;
                                    optUid[i].huTypes = [{
                                        huType: gDef.HuType.DiHu,
                                        score: gDef.HuTypeInfo[gDef.HuType.DiHu].bigscore,
                                        name: gDef.HuTypeInfo[gDef.HuType.DiHu].name
                                    }];
                                }

                            }
                            else {
                                if ((totalScore * 3) > gDef.HuTypeInfo[gDef.HuType.DiHu].score) {
                                    scoreMultiply *= 3;
                                    optUid[i].huTypes[0].name = optUid[i].huTypes[0].name + " 地胡";
                                }
                                else {
                                    totalScore = gDef.HuTypeInfo[gDef.HuType.DiHu].score;
                                    optUid[i].huTypes = [{
                                        huType: gDef.HuType.DiHu,
                                        score: gDef.HuTypeInfo[gDef.HuType.DiHu].score,
                                        name: gDef.HuTypeInfo[gDef.HuType.DiHu].name
                                    }];
                                }
                            }

                        }
                    }
                }

            }

            if(scrollMsg!="")
            desk.scrollMsg(player.getNickName(),scrollMsg);

            console.log("maxhuTypes",optUid[i].huTypes);
            console.log("totalScore",totalScore);

            var maCount=1;
            console.log("风位是",player.getFengWei());

            for(var j=0; j<desk.maCards.length;j++)
            {
                console.log("抽马",desk.maCards[j]);
                if(((CardUtils.getCardValue(desk.maCards[j])-1)%4)==player.getFengWei()) {
                    for(var k=0;k<playerCards.length;k++){
                        if(playerCards[k].uid==player.getUid())
                        {playerCards[k].myMaCards.push(desk.maCards[j]);}
                    }

                    maCount++;
                    console.log("马牌符合风位，倍率+1，目前为",maCount);
                }
            }
            scoreMultiply*=maCount;

            console.log("计算倍率之前的分数是",totalScore);
            optUid[i].huTypes[0].score=optUid[i].huTypes[0].score*=scoreMultiply;
            totalScore*=scoreMultiply;
            console.log("计算倍率之后的分数是",totalScore);

            // 自摸
            if (player.getLastCard()) {
                player.addZiMoCount();
                for (var k = 0; k < desk.uidArr.length; k++) {
                    if (desk.uidArr[k] != player.getUid()) {
                            score[desk.uidArr[k]] -= totalScore;
                            score[winUid] += totalScore;
                    }
                }
            }
            // 点炮
            else {
                var curPlayer = desk.players[desk.curPos];
                var curUid = curPlayer.getUid();
                score[curUid] -= totalScore;
                score[winUid] += totalScore;
            }

            scoreInfos[player.getUid()] = {uid: player.getUid(), scoreInfo: optUid[i].huTypes};

        }



        // 额外加分 (杠分,跟庄)
        var gangScore=[];
        for (var i = 0; i < desk.uidArr.length; i++) {
            gangScore[i]=0;
        }
        for (var i = 0; i < desk.uidArr.length; i++) {
            var uid = desk.uidArr[i];
            var player = desk.getPlayerByUid(uid);

            var optCards = player.getOptCards();
            var handCards = player.getHandCards();

            for (var k = 0; k < optCards.length ; k++) {
                if (optCards[k].optCode == gDef.OptCardCode.MingGang && !optCards[k].isBuGang) {
                    for (var j = 0; j < desk.uidArr.length; j++) {
                        if(i==j){
                            gangScore[i]+=3;
                        }
                        else if(desk.uidArr[j]==optCards[k].fromUid){
                            gangScore[j]-=3;
                        }

                    }
                }
                if (optCards[k].optCode == gDef.OptCardCode.AnGang && !optCards[k].fromUid) {
                    for (var j = 0; j < desk.uidArr.length; j++) {
                        if(i==j){
                            gangScore[i]+=2*(desk.uidArr.length-1);
                        }
                        else{
                            gangScore[j]-=2;
                        }
                    }
                }
                if (optCards[k].optCode == gDef.OptCardCode.MingGang && optCards[k].isBuGang) {
                    for (var j = 0; j < desk.uidArr.length; j++) {
                        if(i==j){
                            gangScore[i]+=(desk.uidArr.length-1);
                        }
                        else{
                            gangScore[j]-=1;
                        }
                    }
                }
            }
        }
        console.log("gangScore",gangScore);
        //跟庄

        var genZhuangScore = [];
        for (var i = 0; i < desk.uidArr.length; i++) {
            genZhuangScore[i] = 0;
        }
        if(desk.genZhuangSuccess){
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                player.addGenZhuangCount();
                if (uid == desk.bankUid) {
                    genZhuangScore[i] -= (desk.uidArr.length - 1);
                }
                else {
                    genZhuangScore[i] += 1;
                }
            }
        }
        console.log("genZhuangScore",genZhuangScore);

        for (var i = 0; i < desk.uidArr.length; i++) {
            //给没有胡牌的人加个占位的空牌型
            if(!scoreInfos[desk.uidArr[i]])
            {scoreInfos[desk.uidArr[i]] = {uid: desk.uidArr[i], scoreInfo: [{huType: -1, score: score[desk.uidArr[i]], name: ""}]};}
           else
               {scoreInfos[desk.uidArr[i]].scoreInfo[0].score=score[desk.uidArr[i]];}


            score[desk.uidArr[i]]+=genZhuangScore[i]
            scoreInfos[desk.uidArr[i]].scoreInfo.push({huType: 4050,
                score: genZhuangScore[i],
                name: gDef.HuTypeInfo[gDef.HuType.GenZhuang].name});

            score[desk.uidArr[i]]+=gangScore[i];

            scoreInfos[desk.uidArr[i]].scoreInfo.push({huType: gDef.HuType.Gang,
                score: gangScore[i],
                name: gDef.HuTypeInfo[gDef.HuType.Gang].name});
        }
        var award = [];
        console.log("before score",score,"baseCoin:",desk.baseCoin);

        for(var uid in score){
            score[uid] *= desk.baseCoin;
        }
        // console.log("desk.playerRoundScores",desk.playerRoundScores);
        var tmpPos =desk.bankPos;
        for (var i = 0; i < desk.uidArr.length; i++){
            for (var u in score) {
                u = Number(u);
                if(u==desk.players[tmpPos].getUid())
                {award.push({uid: u, score: score[u]/desk.baseCoin});}
            }
            tmpPos = desk.nextPos(tmpPos);
        }
        //console.log("desk.playerRoundScores",desk.playerRoundScores);
        var info = [];
        for (var u in scoreInfos) {
            info.push(scoreInfos[u]);
        }
        desk.awardCoupon(score);

        /*<---------------解冻金币--------------->*/
        var unfreezePlayerCoin = function(cb){
            var funcs = [];
            desk.players.forEach(function(p){
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
        /*<---------------扣费--------------->*/
        var costScore = function(cb){
            var funcs = []
            for (var u in score) {
                var func = function(uid){
                    var player = desk.getPlayerByUid(uid);
                    var rFunc = function(callback){
                        if(score[u] > 0){
                            player.addWinCount();
                            if(score[uid] > player.userData.maxWinScore){
                                player.setMaxWinScore(player.getScore());
                                player.setMaxWinTime(Math.round(new Date().getTime()/1000));
                            }
                            log.insert({cmd:"coin_win",gameType:gameType,deskName:desk.deskName,coin:score[uid],uid:uid});
                        }else if(score[uid] < 0){
                            if(player.userData.maxLoseScore < score[uid]){
                                player.setMaxLoseScore(player.getScore())
                            }
                            log.insert({cmd:"coin_lose",gameType:gameType,deskName:desk.deskName,coin:score[uid],uid:uid});
                        }
                        player.addScore(score[uid],callback);
                    }
                    return rFunc
                }
                funcs.push(func(Number(u)));
            }

            async.parallel(funcs,function(err,res){
                if(!! err){
                    return cb(err);
                }
                cb(null);
            })
        }
        /*<---------------发送结果--------------->*/
        var finalFunc = function(err,result){
            var data = {huUids:huUids,
                scoreInfos: info,
                playerCards: playerCards,
                curCard: desk.curCard,
                maCards: desk.maCards,
                baseCoin: desk.baseCoin,
                award: award};
            
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnGameEnd', data, desk.getOnlineSids());
            desk.notifyRobotGameEnd(award)
            //desk.roundRecord.records.push({cmd:gameType+"_OnGameEnd", data:data});
            // pomelo.app.rpc.singlesvr.gameRecordRemote.saveGameRecord(null, gameType,
            //     desk.deskId,
            //     desk.deskName,
            //     JSON.stringify(desk.roundRecord), JSON.stringify(data),
            //     function(err, res) {
            //     });
            //desk.roundRecord = {};
            desk.reset();
    
            log.insert({cmd:gameType+"_endGame", deskId:desk.deskId, scoreInfos:scoreInfos, award:award});
    
            // 继续游戏
            desk.gameStatus = gDef.GameStatus.Ready;
            desk.multiHu = {};
            desk.optUid = {};
            desk.optNum = 0;
            desk.finishOptUid = [];
            for (var i = 0; i < desk.uidArr.length; i++) {
                desk.optUid[desk.uidArr[i]] = true;
                desk.optNum += 1;
            }
            if (desk.isChangMao()) {
                if (!changeBank) {
                    desk.zhangMao += 1;
                }
                else {
                    desk.zhangMao = 0;
                }
            }
            desk.bankPos = -1;
            if(desk.isMatch()){
                pomelo.app.rpc.matchsvr.matchRemote.onGameEnd(null,
                    {gameType:gameType,deskName:desk.deskName,uids:desk.uidArr,mid:desk.mid},function(){});
            }else{
                for(var i = 0; i < desk.maxPlayer; i ++ ){
                    var player = desk.players[i];
                    if(!! player){
                        desk.emit("exit",{uid:player.uid,isGameEnd:true});
                    }
                }
            }
            desk.nextTask();
        }
        async.waterfall([unfreezePlayerCoin,costScore],finalFunc);
    });

    // 换牌
    desk.on('huan',function(args){
        if(desk.curPos == desk.bankPos) {
            if (desk.gameStatus == gDef.GameStatus.Huan) {
                setTimeout(function () {
                    desk.gameStatus = gDef.GameStatus.PushCard;
                    desk.emit('pushcard');
                }, 300);
                console.log("from huan to pushcard");
                return;
            }
            if (desk.gameStatus == gDef.GameStatus.InitCard) {
                desk.gameStatus=gDef.GameStatus.Huan;
            }

        }
        if (desk.gameStatus != gDef.GameStatus.Huan) {
            desk.nextTask();
            return;
        }
        console.log("pos",desk.curPos,"ready to huan");
        var player = desk.players[desk.curPos];
        var uid = player.getUid();



        desk.gameStatus = gDef.GameStatus.WaitOpt;
        desk.optUid[uid] = {optCode:gDef.OptCardCode.Huan , huTypes:[]};
        desk.optNum = 1;

        // 自己能操作
        if (desk.gameStatus == gDef.GameStatus.WaitOpt) {
            // 发自己
            console.log("gDef.OptCardCode.Huan",gDef.OptCardCode.Huan);
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCode', {
                optCode:gDef.OptCardCode.Huan,
                uid: uid
            }, desk.getOnlineSids());
        }
        desk.nextTask();

    });

    // 发牌
    desk.on('pushcard', function(args) {
        if (desk.gameStatus != gDef.GameStatus.PushCard) {
            desk.nextTask();
            return;
        }
        desk.optUid = {};
        desk.optNum = 0;
        var cards = desk.card.getCard(1);
        //如果没牌则流局
        if (cards.length == 0) {
            // 流局结束
            desk.pushTask('end');
            desk.nextTask();
            return;
        }

        var player = desk.players[desk.curPos];
        var uid = player.getUid();

        // console.log("pushcard---------------------------->>>>>", desk.deskId, uid, cards[0]);

        desk.cardGetInfo[uid].push(cards[0]);

        player.addHandCards(cards);

        log.insert({cmd:gameType+"_pushCard", deskId:desk.deskId, card:cards[0], uid:uid});

        var optInfo = player.canOptCard();

        // 能操作 吃 碰 杠
        if (optInfo.optCode & gDef.OptCardCode.MingGang ||
            optInfo.optCode & gDef.OptCardCode.Hu ||
            optInfo.optCode & gDef.OptCardCode.AnGang) {
                desk.gameStatus = gDef.GameStatus.WaitOpt;
                desk.optUid[uid] = optInfo;
                desk.optNum = 1;
        }
        // 不能操作 出牌
        else {
            desk.gameStatus = gDef.GameStatus.WaitCard;
            desk.optUid[uid] = true;
            desk.optNum = 1;
        }

        // 玩家摸牌 设置超时出牌
        desk.setPlayerOptTimeout();
        
        var data = {
            uid: uid,
            card:cards[0],
            curPos:desk.curPos,
            gameStatus:desk.gameStatus,
            leftCardCount: desk.card.getLeftCard()
        };
        // 发自己
        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnPushCard', data, desk.getSid(uid));

        //desk.roundRecord.records.push({cmd:gameType+"_OnPushCard", data:data});
        // 发别人
        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnPushCard', {
                uid: uid,
                curPos:desk.curPos,
                gameStatus:desk.gameStatus,
                leftCardCount: desk.card.getLeftCard()
            }, desk.getOtherUids(uid));

        // 自己能操作
        if (desk.gameStatus == gDef.GameStatus.WaitOpt) {
            // 发自己
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCode', {
                optCode:optInfo.optCode,
                uid: uid
            }, desk.getSid(uid));
        }
        desk.nextTask();
    });
    // 有人断线
    desk.on('offline', function(args) {
        console.log("offline", args);

        var uid = args.uid;
        var player = desk.getPlayerByUid(uid);
        if (player) {
            delete desk.sids[uid];
            if (desk.gameStatus != gDef.GameStatus.Ready || !! desk.mid) {
                player.setTrusttee(true);
                player.setOfflineFlag(true);
                log.insert({cmd:gameType + "_offline",deskName:desk.deskName,uid:uid,isInGame:true});
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
            }
            else {
                log.insert({cmd:gameType + "_offline",deskName:desk.deskName,uid:uid,isInGame:false});
                desk.pushTask('exit', {uid: uid});
            }
            log.insert({cmd:gameType + "_offline", uid:uid});
        }
        desk.nextTask();
    });
    // 有人重连
    desk.on('reconnect', function(args) {
        var uid = args.uid;

        var player = this.getPlayerByUid(uid);
        if (!player) {
            desk.nextTask();
            return;
        }
        desk.sids[args.uid] = {uid:args.uid, sid:args.sid};

        player.setTrusttee(false);

        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: false}, desk.getOtherUids(uid));

        log.insert({cmd:gameType+"_reconnect", deskId:desk.deskId, uid:uid});
        desk.nextTask();
    });
    // // 取消托管
    desk.on('canceltrusttee', function(args) {
        var uid = args.uid;
        var player = desk.getPlayerByUid(uid);
        if (player) {
            if (player.isTrusted()) {
                player.setTrusttee(false);
                //player.clearAutoBetCount();
                // if (desk.curPos == player.getPos()) {
                //     desk.autoBet();
                // }
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {
                    uid: uid,
                    bTrusttee: false
                }, desk.getOnlineSids());
                desk.resetOptTimeout(uid);
                //log.insert({cmd:"dzpk_canceltrusttee", deskId:desk.deskId, uid:uid});
            }
            // if (desk.getGameStatus() == gDef.GameStatus.Wait) {
            //     desk.pushTask('start');
            // }
        }
        desk.nextTask();
    });
    // 快捷发言
    desk.on('chat', function(args) {
        var uid = args.uid;
        var data = args.data;
        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnChat', {
            uid: uid,
            data: data
        }, desk.getOnlineSids());
        desk.nextTask();
    });
    // 吃碰杠胡
    desk.on('optcard', function (args) {
        var uid = args.uid;
        if (desk.gameStatus != gDef.GameStatus.WaitOpt || !uid || !desk.optUid[uid]) {
            desk.nextTask();
            return;
        }

        var player = desk.getPlayerByUid(uid);
        if (!player) {
            desk.nextTask();
            return;
        }
        //清除超时
        desk.clearOptTimeout();
        
        var data;
        log.insert({cmd:gameType+"_optCard", deskId:desk.deskId, uid:uid, optCode:args.optCode, cards:args.cards});

        if(args.optCode == gDef.OptCardCode.Huan) {
            if(args.cards.length!=(desk.huanPaiType()-1)){
                desk.nextTask();
                return;
            }

            var optUid = uid;
            var optPlayer = desk.getPlayerByUid(optUid);

            optPlayer.popHandCards(args.cards);


            console.log('_OnPopHuan');
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnPopHuan',{cards:args.cards ,uid:optUid }, desk.getSid(optUid));
            //desk.roundRecord.records.push({cmd:gameType+"_OnPopHuan", data:{cards:args.cards, uid: optUid}});

            //抽牌
            var cards = desk.card.getCard(args.cards.length);

            optPlayer.setHuanCards(cards);

            //把弃牌放回牌组里面
            desk.card.insertCards(args.cards);
            console.log("liuju -------->>> cards.length",cards.length,"---------->>>args.cards.length",args.cards.length);
            if (cards.length <args.cards.length) {
                // 流局结束
                desk.pushTask('end');
                desk.nextTask();
                return;
            }
            desk.cardGetInfo[optUid]=desk.cardGetInfo[optUid].concat(cards);
            player.addHandCards(cards, true);
            console.log('_OnBuHuan',cards);
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnBuHuan',{cards:cards ,uid:optUid }, desk.getSid(optUid));
            //desk.roundRecord.records.push({cmd:gameType+"_OnBuHuan", data:{cards:cards, uid: optUid}});

            // console.log("desk.curPos",desk.curPos);
            desk.curPos = desk.nextPos(desk.curPos);
            // console.log("desk.curPos",desk.curPos);

            desk.gameStatus = gDef.GameStatus.Huan;

            desk.optUid[optUid] = true;
            setTimeout(function() {
                desk.emit('huan');
            }, 500);
            return;
        }

        // 取消操作
        if (args.optCode == gDef.OptCardCode.Null) {
            if (desk.multiHu.optCount && desk.multiHu.optCount[args.uid] != undefined) {
                desk.multiHu.optCount[args.uid] += 1;
            }
            delete desk.optUid[uid];
            desk.optNum -= 1;
        }
        else if (args.optCode & desk.optUid[uid].optCode) {
            var optCount = 0;
            for (var i = 0 ; i < 32; i++) {
                if (args.optCode & (1<<i)) {
                    optCount += 1;
                }
            }
            // 只能有一种操作
            if (optCount > 1) {
                desk.nextTask();
                return;
            }
            if (desk.curCard && args.cards) {
                for (var i = 0; i < args.cards.length; i++) {
                    if (args.cards[i] == desk.curCard) {
                        args.cards.splice(i, 1);
                        break;
                    }
                }
            }
            // 判断手上的牌存不存在
            if (args.cards && !player.checkCards(args.cards)) {
                desk.nextTask();
                return;
            }

            // 检查 牌型
            if (args.optCode == gDef.OptCardCode.Chi ||
            args.optCode == gDef.OptCardCode.Peng ||
            args.optCode == gDef.OptCardCode.MingGang ||
            args.optCode == gDef.OptCardCode.AnGang) {
                if (args.optCode & CardUtils.OptCardCode(args.cards, player.getOptCards(), desk.curCard)) {
                }
                else {
                    desk.nextTask();
                    return;
                }
            }
            desk.finishOptUid.push({uid:uid, optCode:args.optCode, cards:args.cards, huTypes:desk.optUid[uid].huTypes});
            if (args.optCode == gDef.OptCardCode.Hu) {
                if (desk.multiHu.huInfo && desk.multiHu.huInfo[args.uid]) {
                    delete desk.multiHu.huInfo[args.uid];
                    delete desk.multiHu.optCount[args.uid];
                    desk.multiHu.optNum -= 1;
                }
            }
            delete desk.optUid[uid];
            desk.optNum -= 1;
        }
        else {
            desk.nextTask();
            return;
        }
        // 判断操作先后
        if (desk.optNum == 0) {
            // 没有人操作
            if (desk.finishOptUid.length == 0) {
                desk.multiHu = {};
                // 如果是在别人出牌阶段
                if (desk.curCard) {
                    // 桌子增加玩家出牌信息
                    var u = desk.getUidByPos(desk.curPos);
                    // desk.addPlayerPopCard(u, desk.curCard);

                    // 没有人抢杠
                    if (desk.lastGangInfo[u]) {
                    }
                    else {
                        // 发牌给下一个人
                        desk.curPos = desk.nextPos(desk.curPos);
                    }
                    delete desk.curCard;
                    desk.gameStatus = gDef.GameStatus.PushCard;
                    // pomelo.app.get('channelService').pushMessageByUids('mj_jdz_OnDeskUpdate', {gameStatus:desk.gameStatus}, desk.getOnlineSids());
                    setTimeout(function () {
                        desk.emit('pushcard');
                    }, popCardTimeOut);
                }
                //
                else {
                    desk.optUid = [];
                    desk.optUid[uid] = true;
                    desk.gameStatus = gDef.GameStatus.WaitCard;
                }
                //自摸杠超时出牌
                desk.setPlayerOptTimeout();//碰杠后出牌
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCard', {uid:args.uid,optCards:{optCode:gDef.OptCardCode.Null}}, desk.getOnlineSids());
                desk.nextTask();
                return;
            }
            else {
                // 排出操作优先
                desk.finishOptUid.sort(function(a, b) {
                    return b.optCode-a.optCode;
                });
                var code = desk.finishOptUid[0].optCode;
                // 胡的情况
                if (code == gDef.OptCardCode.Hu) {
                    if (args.optCode == gDef.OptCardCode.Hu) {
                        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCard', {
                            optCards: {
                                //cards:optPlayer.getHandCards(),
                                optCode: gDef.OptCardCode.Hu
                            },
                            uid: args.uid
                        }, desk.getOnlineSids());
                    }
                    if (desk.multiHu.optNum == 0) {
                        desk.pushTask('end', desk.finishOptUid.concat([]));
                        desk.finishOptUid = [];
                    }
                    else {
                        var leftOptCount = 0;
                        for (var u in desk.multiHu.huInfo) {
                            if (desk.multiHu.optCount[u] <= 1) {
                                leftOptCount++;
                                desk.optUid[u] = desk.multiHu.huInfo[u];
                                desk.optNum++;
                            }
                        }
                        desk.multiHu = {};
                        if (leftOptCount > 0) {
                            for (var u in desk.optUid) {
                                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCode', {
                                    uid: u,
                                    optCode: desk.optUid[u].optCode
                                }, desk.getSid(u));
                            }
                        }
                        else {
                            desk.pushTask('end', desk.finishOptUid.concat([]));
                            desk.finishOptUid = [];
                        }
                    }
                }
                else {
                    if(desk.isGenZhuang())
                    {desk.roundCount++;}

                    desk.optUid = {};
                    var optCards = {cards : desk.finishOptUid[0].cards.concat(desk.curCard || []),
                                    optCode : desk.finishOptUid[0].optCode,
                                    cardType : CardUtils.getCardColor(desk.finishOptUid[0].cards[0])};
                    if (desk.curCard) {
                        var tmpUid = desk.players[desk.curPos].getUid();
                        if (desk.tingFlag[tmpUid] == 2) {
                            optCards.isTing = true;
                        }
                        optCards.fromUid = tmpUid;
                    }
                    var optUid = desk.finishOptUid[0].uid;
                    var optPlayer = desk.getPlayerByUid(optUid);
                    // 手中的拍出掉
                    optPlayer.popHandCards(desk.finishOptUid[0].cards);
                    // 加入刻牌或吃牌中
                    optPlayer.addOptCards(optCards);
                    desk.curPos = desk.getPosByUid(optUid);
                    desk.optUid[optUid] = true;
                    // 杠牌的话需要发一张牌
                    if (desk.finishOptUid[0].optCode == gDef.OptCardCode.AnGang || desk.finishOptUid[0].optCode == gDef.OptCardCode.MingGang) {
                        desk.lastGangInfo[optUid] = true;
                        console.log("optCards.fromUid",optCards.fromUid,"optCards.cards.length",optCards.cards.length);
                        // 明杠特殊处理
                        if (desk.finishOptUid[0].optCode == gDef.OptCardCode.MingGang ) {
                            console.log("明杠特殊处理");
                            desk.lastGangCard=optCards.cards[0];
                            // 判断抢杠
                            desk.optUid = {};
                            desk.optNum = 0;
                            var pos = desk.nextPos(desk.curPos);
                            while(pos != desk.curPos) {
                                var p = desk.players[pos];
                                var optInfo = p.canOptCardQiangGang(desk.finishOptUid[0].cards[0]);
                                if (optInfo.optCode & gDef.OptCardCode.Hu) {
                                        desk.optUid[p.getUid()] = {
                                            optCode: gDef.OptCardCode.Hu,
                                            huTypes: optInfo.huTypes
                                        };
                                        desk.optNum += 1;

                                }
                                pos = desk.nextPos(pos);
                            }
                            // 有人可以抢杠
                            if (desk.optNum > 0) {
                                data = {optCards: optCards,
                                    uid: optUid};
                                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCard', data, desk.getOnlineSids());

                                desk.gameStatus = gDef.GameStatus.WaitOpt;
                                desk.curCard = desk.finishOptUid[0].cards[0];
                                if (desk.optNum >= 2) {
                                    desk.multiHu = {};
                                    desk.multiHu.optCount = {};
                                    desk.multiHu.huInfo = {};
                                    desk.multiHu.optNum = 0;
                                }
                                for (var u in desk.optUid) {
                                    u = Number(u);
                                    if (desk.multiHu.optCount != undefined) {
                                        if (desk.optUid[u].optCode & gDef.OptCardCode.Hu) {
                                            desk.multiHu.huInfo[u] = desk.optUid[u];
                                            desk.multiHu.optCount[u] = 0;
                                            desk.multiHu.optNum += 1;
                                        }
                                    }
                                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCode', {uid: u, optCode:desk.optUid[u].optCode}, desk.getSid(u));
                                }
                                desk.finishOptUid = [];
                                desk.nextTask();
                                return;
                            }
                        }
                        desk.gameStatus = gDef.GameStatus.PushCard;
                        setTimeout(function() {
                            desk.emit('pushcard');
                        }, 500);
                    }
                    else {
                        // 吃碰过后可能可以摆牌
                        if (desk.finishOptUid[0].optCode == gDef.OptCardCode.Chi || desk.finishOptUid[0].optCode == gDef.OptCardCode.Peng) {
                            var optInfo = optPlayer.canOptCard();
                            if (optInfo.optCode & gDef.OptCardCode.MingGang) {
                                var code = gDef.OptCardCode.null;

                                if (optInfo.optCode & gDef.OptCardCode.MingGang) {
                                    code |= gDef.OptCardCode.MingGang
                                }
                                if (optInfo.optCode & gDef.OptCardCode.AnGang) {
                                    code |= gDef.OptCardCode.AnGang
                                }
                                desk.optUid[optUid] = {uid:optUid, optCode:code};
                                desk.gameStatus = gDef.GameStatus.WaitOpt;
                                desk.optNum = 1;
                                setTimeout(function () {
                                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCode',{
                                        uid: optUid, optCode:desk.optUid[optUid].optCode
                                    }, desk.getSid(optUid));
                                }, 0);
                            }
                            else {
                                desk.gameStatus = gDef.GameStatus.WaitCard;
                            }
                        }
                        else {
                            desk.gameStatus = gDef.GameStatus.WaitCard;
                        }
                    }
                    data = {optCards: optCards,
                    uid: optUid};
                    // 暗杠特殊处理
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCard', data, desk.getOnlineSids());
                    delete desk.curCard;
                    desk.deletLastPopCard();
                    desk.finishOptUid = [];
                }
            }
        }
        //
        desk.setPlayerOptTimeout();//选择过牌后出牌
        desk.nextTask();
    });

    // 出牌
    desk.on('popcard', function (args) {
        //console.log("popcard--------->>>1",args.uid,"desk.gameStatus:",desk.gameStatus,"card:",args.card);
        var uid = args.uid;
        if (desk.gameStatus != gDef.GameStatus.WaitCard || !uid || !desk.optUid[uid]) {
            desk.nextTask();
            return;
        }

        var curPlayer = desk.getPlayerByUid(args.uid);
        if (!curPlayer) {
            desk.nextTask();
            return;
        }

        // 清除掉杠信息
        if (desk.lastGangInfo[uid]) {
            delete desk.lastGangInfo[uid];
        }
        // 清除桌子超时
        desk.clearOptTimeout();

        if (desk.tingFlag[uid] == 1) {
            desk.tingFlag[uid] = 2;
        }

        // 出牌
        if (!curPlayer.popHandCards([args.card])) {
            desk.nextTask();
            return;
        }
        if(desk.isGenZhuang()){
            if(uid==desk.bankUid){
                desk.roundCount++;
                if(desk.roundCount==1)
                {desk.genZhuangCard=args.card;}

            }
            else{
                if(desk.roundCount==1&&desk.genZhuangCard==args.card) {
                    desk.genZhuangCount++;
                    if(desk.genZhuangCount==desk.maxPlayer-1)
                        desk.genZhuangSuccess=true;
                }
            }
        }



        desk.cardPutInfo[uid].push(args.card);

        log.insert({cmd:gameType+"_popCard", deskId:desk.deskId, uid:uid, card:args.card});

        desk.curCard = args.card;
        desk.optUid = {};
        desk.optNum = 0;

        var pos = desk.nextPos(desk.curPos);
        while(pos != desk.curPos) {
            var player = desk.players[pos];
            var optInfo = player.canOptCard(args.card);

            if (optInfo.optCode != gDef.OptCardCode.Null) {
                if (optInfo.optCode == gDef.OptCardCode.Chi) {
                    if (pos == desk.nextPos(desk.curPos)) {
                        desk.optUid[player.getUid()] = optInfo;
                        desk.optNum += 1;
                    }
                }
                else {
                    if (pos == desk.nextPos(desk.curPos)) {
                        desk.optUid[player.getUid()] = optInfo;
                        desk.optNum += 1;
                    }
                    else {
                        desk.optUid[player.getUid()] = optInfo;
                        desk.optUid[player.getUid()].optCode = optInfo.optCode & ~gDef.OptCardCode.Chi;
                        desk.optNum += 1;
                    }

                }
            }
            pos = desk.nextPos(pos);
        }
        // 增加打出的牌
        desk.addPlayerPopCard(uid, args.card);

        // 有人可以操作
        if (desk.optNum > 0) {
            desk.gameStatus = gDef.GameStatus.WaitOpt;
        }
        else {
            // 发牌给下一个人
            desk.curPos = desk.nextPos(desk.curPos);
            desk.gameStatus = gDef.GameStatus.PushCard;
            delete desk.curCard;
            setTimeout(function() {
                desk.emit('pushcard');
            }, popCardTimeOut);
        }
        
        var data = {uid: uid, card:args.card, gameStatus:desk.gameStatus};
        // 出牌
        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnPopCard', data, desk.getOnlineSids());

        //desk.roundRecord.records.push({cmd:gameType+"_OnPopCard", data:data});

        var huCount = 0;
        desk.multiHu = {};
        desk.multiHu.huInfo = {};
        desk.multiHu.optCount = {};
        desk.multiHu.optNum = 0;
        for (var u in desk.optUid) {
            u = Number(u);
            if (desk.optUid[u].optCode & gDef.OptCardCode.Hu) {
                desk.multiHu.huInfo[u] = desk.optUid[u];
                desk.multiHu.optCount[u] = 0;
                desk.multiHu.optNum += 1;
                huCount += 1;
            }
            desk.setPlayerOptTimeout(u);//给碰杠 这张牌的玩家 设置超时(其实就是碰杠超时)
            //
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnOptCode', {uid: u, optCode:desk.optUid[u].optCode}, desk.getSid(u));
        }
        if (huCount < 2) {
            desk.multiHu = {};
        }
        desk.nextTask();
    });
    // 准备
    desk.on('ready', function (args) {
        if (gDef.GameStatus.Ready != desk.gameStatus) {
            desk.nextTask();
            return;
        }

        var player = desk.getPlayerByUid(args.uid);
        if(!player || player.getPlayStatus() == gDef.PlayStatus.ready){
            desk.nextTask();
            return;
        }
        //钱不够了
        if(player.score < desk.minCoin){
            desk.emit("exit", {uid: args.uid, msg: "金币不足，请先充值"});
            desk.nextTask();
            return;
        }

        player.setPlayStatus(gDef.PlayStatus.ready);

        delete desk.optUid[args.uid];
        desk.optNum -= 1;
        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnReady', {
            uid: args.uid
        }, desk.getOnlineSids());

        log.insert({cmd:gameType+"_ready", deskId:desk.deskId, uid:args.uid});

        // 游戏可以开始了
        var every = desk.players.every(function(p){
            return !! p.getPlayStatus() == gDef.PlayStatus.ready;
        })

        if (desk.players.length == desk.maxPlayer && !! every) {
            desk.optNum == 0;
            desk.gameStatus = gDef.GameStatus.Craps1;
            setTimeout(function() {
                desk.emit('start');
            }, 1000);
        }
        desk.nextTask();
    });

    desk.queryDeskInfo = function(args) {
        var uid = args.uid;
        var info = {};
        console.log("--------->>> Now desk gameStatus:",desk.gameStatus);
        if (desk.gameStatus != gDef.GameStatus.Ready) {
            var cards = desk.getPlayerCards(uid);

            var data = {
                bankUid: desk.bankUid,
                cards: cards,
                gameStatus: desk.getGameStatus(),
                playUids: desk.uidArr,
                curCard: desk.curCard
            };

            var curPlayer = desk.players[desk.curPos];
            if (curPlayer) {
                data.curUid = curPlayer.getUid();
            }

            if (desk.card) {
                data.leftCardCount = desk.card.getLeftCard();
            }

            if (desk.optUid[uid] && desk.optUid[uid].optCode) {
                data.optInfo = {optCode: desk.optUid[uid].optCode, uid:uid};
            }
            info.reconnectData = data;
        }
        info.playerInfo = desk.getPlayersInfo();
        info.deskInfo = desk.getDeskInfo();
        return info;
    };
    
    desk.nextTask = function() {
        if (desk.tasks.length > 0) {
            var task = desk.tasks.pop();
            desk.emit(task.event, task.args);
        }
    };

    desk.pushTask = function(event, args) {
        desk.tasks.push({event:event, args:args})
    };

    desk.getOnlineSids = function () {
        var res = [];
        for (var uid in desk.sids) {
            res.push(desk.sids[uid]);
        }
        return res;
    };

    desk.getSid = function (uid) {
        if (desk.sids[uid]) {
            return [desk.sids[uid]];
        }
        else {
            return [];
        }
    };

    desk.getOtherUids = function (myUid) {
        var res = [];
        for (var i = 0; i < desk.maxPlayer; i++) {
            var player = desk.players[i];
            if (player) {
                if (desk.sids[player.getUid()]) {
                    if (player.getUid() != myUid) {
                        res.push(desk.sids[player.getUid()]);
                    }
                }
            }
        }
        return res;
    };
    
    // desk.getWatcherUids = function () {
    //     var res = [];
    //     // for (var i = 0; i < desk.maxPlayer; i++) {
    //     //     var player = desk.players[i];
    //     //     if (player) {
    //     //         var uid = player.getUid();
    //     //         if (desk.sids[uid]) {
    //     //             res.push(desk.sids[uid]);
    //     //         }
    //     //     }
    //     // }
    //     return res;
    // };

    desk.canStart = function () {
        return desk.playerNum == desk.maxPlayer;
    };

    desk.isStart = function() {
        return desk.gameStatus != gDef.GameStatus.Ready
    }

    desk.canEnterDesk = function (user) {
        var player = desk.getPlayerByUid(user.uid);

        if(player){
            return 0;//断线回来
        }

        if(desk.players[user.pos]){//位置上有人
            return 4;
        }

        if(desk.maxPlayer <= desk.playerNum){
            return 1;
        }
        
        if(user.coin > desk.getMaxCoin()){
            return 2;
        }

        if(user.coin < desk.getMinCoin()){
            return 3;
        }

        return 0;
    };

    desk.pickupChair = function (user) {
        var player = desk.getPlayerByUid(user.uid);
        if (player) {
            return player.pos;
        }

        var maxCoin = desk.getMaxCoin();
        var minCoin = desk.getMinCoin();

        if (user.coin > maxCoin) {
            return -2;
        }
        if (user.coin < minCoin) {
            return -3;
        }

        for(var i=0;i<desk.maxPlayer;i++){
            if(!desk.players[i]){
                return i;
            }
        }

        return -1;
    };

    desk.getDeskBasicInfo = function( ) {
        var info = {};
        info.playerInfo = desk.getPlayersInfo();
        info.deskInfo = desk.getDeskInfo();
        return info;
    };

    desk.scrollMsg = function (playerName,msg) {
        var bMsg = "<font>玩家</font><font color=255,255,0>" + playerName + "</font><font>在</font><font color=0,255,0>宁都麻将</font><font>中打出了</font><font color=0,255,0>" + msg
            + "</font><font>牌型。</font>";
        pomelo.app.rpc.chatsvr.chatRemote.pushMessageToWorld(null, "OnScrollMsg", {
            msg: bMsg,
            type: 3,
            timestamp: Math.floor(new Date().getTime()/1000)
        }, function () {
        });
    }

    desk.trustPlayer = function(uid,toTrust){
        var player = desk.getPlayerByUid(uid)
        if(! player){
            return;
        }

        player.setTrusttee(toTrust);
        pomelo.app.get('channelService').pushMessageByUids(gameType 
            + '_OnTrusttee', {
            uid: uid,
            bTrusttee: toTrust
        }, desk.getOnlineSids());
    }

    desk.awardCoupon = function(score){
        //礼券功能 高级场 或者 精英场才有
        var self = this;
        if(desk.roomIndex >= 3){
            var uids = [];
            var result = {}
            for(var uid in score){
                uids.push(uid);
                result[uid] = score[uid];
            }
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
                        if(info.giftGameType == gameType && info.giftRoomIndex == desk.roomIndex){
                            info.giftWinTimes++;
                            if(info.giftWinTimes == 5){
                                info.giftWinTimes = 0;
                                var awardCouponCount = 0;
                                if(desk.roomIndex == 3){
                                    awardCouponCount = 15;
                                }else if(desk.roomIndex == 4){
                                    awardCouponCount = 100;
                                }
                                pomelo.app.rpc.usersvr.userRemote.addCoupon(null,{uid:key,deltaCoupon:awardCouponCount},function(err,result){
                                    if(!! err){
                                        return;
                                    }
                                    var player = desk.getPlayerByUid(result.uid);
                                    if(!! player){
                                        var msg = "恭喜您 获得" + result.coupon + "张礼券";
                                        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnAward', {uid: result.uid, msg:msg}, desk.getSid(result.uid));
                                    }
                                })
                            }
                        }else{
                            info.giftGameType = gameType;
                            info.giftRoomIndex = desk.roomIndex;
                            info.giftWinTimes = 1;
                        }
                    }else{
                        info.giftGameType = gameType;
                        info.giftRoomIndex = desk.roomIndex;
                        info.giftWinTimes = 0;
                    }
                }
                //存数据
                pomelo.app.rpc.usersvr.userRemote.setGameData(null,{response:response},function(err,result){})
            })
        }
    }

    desk.setPlayerOptTimeout = function(uid,time){
        var player = null;//desk.players[desk.curPos];
        if(!! uid){
            player = desk.getPlayerByUid(uid);
        }else{
            player = desk.players[desk.curPos];
        }

        if(! player){
            return;
        }
        var delayTime = player.isTrusted() ? 6000 : 16000;
        delayTime = !! time ? time : delayTime;
        desk.delayUid = player.getUid();
        desk.setOptTimeout(function(player){
            
            var uid = player.getUid();
            //托管玩家
            if(! player.isTrusted()){
                desk.trustPlayer(uid,true);
            }
            console.log("player:",uid,"desk gameStatus",desk.gameStatus);
            if(desk.gameStatus == gDef.GameStatus.WaitOpt){
                //
                var optInfo = desk.optUid[uid];
                if(!! optInfo && (optInfo.optCode & gDef.OptCardCode.Hu)){
                    desk.emit("optcard",{uid:uid,optCode:gDef.OptCardCode.Hu});//能胡则胡
                }else{
                    desk.emit("optcard",{uid:uid,optCode:gDef.OptCardCode.Null});//暗杠->超时过
                }
            }

            if(desk.gameStatus == gDef.GameStatus.WaitCard){
                if(! player.lastGetCard){
                    console.log("timeout pop card is null !!!");
                }
                var outCard = !! player.lastGetCard ? player.lastGetCard : player.cards[0];
                desk.emit("popcard",{uid:uid,card:outCard});
            }
        }.bind(null,player),delayTime);
    }

    desk.resetOptTimeout = function(uid){
        if(uid != desk.delayUid){
            return;
        }

        desk.clearOptTimeout();
        desk.setPlayerOptTimeout(uid,10000);//取消托管后 重新计算托管时间
    }
};