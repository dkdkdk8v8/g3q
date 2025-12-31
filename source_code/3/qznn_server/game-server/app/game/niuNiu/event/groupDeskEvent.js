/**
 * Created by Administrator on 2016/9/13.
 */
var exp = module.exports;
var pomelo = require("pomelo");
var Player = require("../module/player");
var gDef = require("../globalDefine");
var CardUtils = require("../module/cardUtils");
var card = require("../module/cardSet");
var async = require("async");
var log = pomelo.app.get('mongodb');
var utils = require('../../../util/utils');

exp.addEventListener = function (desk) {
    var gameType = "gameNiuNiu";

    desk.tasks = [];

    desk.sids = {};

    var calCardTimeOut = 12000;
    var callTimeOut = 5000;
    var showBankTimeOut = 5000;
    var cardTimeOut = 500;
    var endTimeOut = 1000;
    var trustteeCount = 4;
    var trustteeTimeOut = 2000;

    desk.isStart = false;
    desk.isEnd = false;
    desk.opreatNum = 0;
    desk.calRes = {};
    desk.optUid = {};
    desk.runUid = {};

    var baseScore = 1;

    desk.playerCountInfo = {};

    // 解散
    desk.disFlag = {};
    desk.disTimer = setTimeout(function() {
        if (desk.fangOwnerUid) {
            desk.emit('dissolution', {uid: desk.fangOwnerUid});
        }
        else {
            desk.emit('dissolution', {uid: desk.createUid});
        }
    }, 1*60*60*1000);
    // 叫分
    desk.on('call', function(args) {
        // 只有抢庄和加注时候才能叫分
        if (desk.gameStatus != gDef.GameStatus.Point && desk.gameStatus != gDef.GameStatus.Bank) {
            desk.nextTask();
            return;
        }
        var uid = args.uid;
        // 不属于当前操作玩家
        if (!desk.optUid[uid]) {
            desk.nextTask();
            return;
        }
        var player = desk.getPlayerByUid(uid);
        if (!player) {
            desk.nextTask();
            return
        }

        if (player.isTrustee()) {
            player.setTrusttee(false);
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: false}, desk.getOnlineSids());
        }
        player.clearAutoOperateCount();
        // 已经叫过分 或者 叫分错误
        if (player.getPoint() >= 0 || args.point < 0) {
            desk.nextTask();
            return
        }
        // 庄家不能叫分
        if(desk.gameStatus == gDef.GameStatus.Point) {
            if (uid == desk.bankUid) {
                desk.nextTask();
                return;
            }
        }
        player.callPoint(args.point);

        desk.opreatNum += 1;

        // 提前进入下一步
        if (desk.gameStatus == gDef.GameStatus.Card || desk.gameStatus == gDef.GameStatus.Bank) {
            if (desk.opreatNum >= desk.uidArr.length) {
                desk.pushTask('next');
            }
        }
        else if (desk.gameStatus == gDef.GameStatus.Point) {
            if (desk.opreatNum >= (desk.uidArr.length-1)) {
                desk.pushTask('next');
            }
        }

        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnCall', {
            uid:uid,
            point:args.point
        }, desk.getOnlineSids());

        log.insert({cmd:"niuniu_playerCall", deskId:desk.deskId, uid:uid, point:args.point, gameStatus:desk.gameStatus});
        desk.nextTask();
    });
    // 进入桌子
    desk.on('enter', function(args) {
        // 新进游戏 自动入座
        if (!desk.getPlayerByUid(args.uid) && desk.canEnterDesk(args) == 0) {

            desk.sids[args.uid] = {uid:args.uid, sid:args.sid};
            args.bAuto = true;
            desk.pushTask('sitDown', args);
            log.insert({cmd:"enterDesk", gameType:gameType, deskId:desk.deskId, uid:args.uid});
            //desk.emit("sitDown", args);
        }
        else {
            desk.pushTask('reconnect', args);
        }
        desk.nextTask();
    });
    // 离开桌子
    desk.on('exit', function(args) {
        if (!desk.isStart && args.uid == desk.fangOwnerUid) {
            desk.pushTask('dissolution', args);
        }
        else {
            var uid = args.uid;
            var player = desk.getPlayerByUid(uid);
            if (player) {
                //player.setTrusttee(true);
                if (player.getPlayStatus() == gDef.PlayStatus.play) {

                    if (desk.infiniteThink()) {
                        desk.nextTask();
                        return;
                    }

                    desk.runUid[uid] = true;
                    player.setOfflineFlag(true);
                    player.setPlayStatus(gDef.PlayStatus.out);
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnExit',{uid:uid}, desk.getSid(uid));
                    // player.setTrusttee(true);
                    // pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
                    desk.trustPlayer(uid,true);
                    log.insert({cmd:"niuniu_exit", uid:args.uid, deskId: desk.deskId});
                }
                // 游戏还没有开始
                else if (player.getPlayStatus() == gDef.PlayStatus.ready) {
                    desk.deletePlayer(uid);
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnExit',{uid:uid}, desk.getSid(uid));
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnSitUp', {uid: uid}, desk.getOnlineSids());

                    log.insert({cmd:"niuniu_sitUp", deskId:desk.deskId, uid:uid});
                }
                player.leaveGame(gameType, desk.getDeskName());
            }
            delete desk.sids[args.uid];
        }
        if (desk.gameStatus == gDef.GameStatus.Wait) {
            desk.pushTask('start');
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
                    gameId: args.gameId
                });

                // 房主
                if (i == 0) {
                    if (desk.isReplace) {
                        desk.fangOwnerUid = uid;
                    }
                    else {
                        desk.fangOwnerUid = desk.createUid;
                    }
                }
                desk.players[i].readyGame();

                desk.players[i].setPlayStatus(gDef.PlayStatus.ready);
                desk.uidPosMap[uid] = i;
                desk.playerNum += 1;

                if (args.bAuto) {
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnEnterDesk', {
                            playerInfo: desk.getPlayersInfo(),
                            deskInfo: desk.getDeskInfo(),
                            gameType: gameType
                        },
                        desk.getSid(uid));
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnSitDown', desk.players[i].getBasicInfo(), desk.getOtherUids(uid));
                    if(desk.clubId){
                        pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitdown(null,{playerInfo:desk.players[i].getBasicInfo(),deskName:desk.deskName,clubId:desk.clubId,boxId:desk.boxId},function(){});
                    }
                }
                else {
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnSitDown', desk.players[i].getBasicInfo(), desk.getOnlineSids());
                }
                break;
            }
        }
        log.insert({cmd:"niuniu_sitDown", deskId:desk.deskId, uid:uid});
        desk.nextTask();
    });
    // 开始一局
    desk.on('start', function(args) {
        if (!desk.canStart()) {
            desk.nextTask();
            return;
        }
        desk.uidArr = [];
        desk.calRes = {};
        desk.optUid = {};

        for (var i = 0; i < desk.maxPlayer; i++) {
            // 不托管 不淘汰
            var player = desk.players[i];
            if (player && !player.isTrustee()) {
                var uid = player.getUid();
                desk.uidArr.push(uid);
                desk.optUid[uid] = true;
                player.setPlayStatus(gDef.PlayStatus.play);
            }
            else if(gDef.GroupDeskType.SequenceBank == desk.getDeskType())  {
                // 霸王庄特殊考虑
                if (desk.getZhuangType() == gDef.ZhuangType.Force) {
                    if(player && player.getUid() == desk.bankUid) {
                        if (player.getPlayStatus() != gDef.PlayStatus.out) {
                            var uid = player.getUid();
                            desk.uidArr.push(uid);
                            desk.optUid[uid] = true;
                            player.setPlayStatus(gDef.PlayStatus.play);
                        }
                        else {
                            desk.endGroupDesk();
                            return;
                        }
                    }
                }
            }
        }

        if (desk.uidArr.length <= 1) {
            var playCount = 0;
            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player && player.getPlayStatus() != gDef.PlayStatus.out) {
                    playCount++;
                }
            }
            // 游戏结束
            if (playCount>1) {
                desk.gameStatus = gDef.GameStatus.Wait;
                pomelo.app.get('channelService').pushMessageByUids("OnErrMsg", {err:true, msg:"当前在线人数不足以开始游戏"}, desk.getOnlineSids());
                desk.nextTask();
            }
            else {
                desk.endGroupDesk();
            }
            return;
        }

        var player = desk.getPlayerByUid(desk.bankUid);
        if (player && player.isTrustee()) {
            desk.bankUid = 0;
            pomelo.app.get('channelService').pushMessageByUids(gameType+"_OnDeskUpdate", {bankUid: desk.bankUid}, desk.getOnlineSids());
        }

        console.log("start New Game!!!", desk.deskName);

        desk.leftCount -= 1;

        for (var i = 0; i < desk.uidArr.length; i++) {
            var player = desk.getPlayerByUid(desk.uidArr[i]);
            if (player) {
                player.addUserDataCount('totalCount', 1);
            }
        }

        desk.card = new card();

        desk.gameStatus = gDef.GameStatus.Start;

        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnGameStart', {
                leftCount:desk.leftCount,
                playUids: desk.uidArr,
                gameStatus: desk.gameStatus
            }, desk.getOnlineSids());

        setTimeout(function () {
            desk.emit('next');
        }, 2000);

        log.insert({cmd:'niuniu_startGame', playUids:desk.uidArr, leftCount:desk.leftCount, deskId: desk.deskId});
        if(!! desk.clubId){
            pomelo.app.rpc.clubsvr.clubRemote.onStartGame(null,{gameType:gameType,deskName:desk.deskName,clubId:desk.clubId,boxId:desk.boxId,
            gameCount:desk.getGameCount() - desk.leftCount,totalGameCount:desk.getGameCount()},function(){});
        }
        desk.nextTask();
    });
    // 结束一局
    desk.on('end', function(args) {

        if (desk.gameStatus != gDef.GameStatus.End) {
            desk.nextTask();
            return ;
        }
        var res = [];
        var cardList = [];
        var endList = [];
        var lastBankUid = desk.bankUid;

        if (desk.deskType == gDef.GroupDeskType.TongBi) {
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                // 没有组牌  没牛处理
                if (!desk.calRes[uid]) {
                    var cards = player.getCards();
                    var cardRes = desk.GetCardResult(cards);
                    desk.calRes[uid] = cardRes.cardType;
                    desk.redpackage(uid, cardRes);

                    if (cardRes.cardType.weight > gDef.PAI_XING.CowNiu.weight) {
                        desk.playerCountInfo[uid].specialCount += 1;
                    }
        
                    if (cardRes.cardType.weight == gDef.PAI_XING.CowNiu.weight) {
                        desk.playerCountInfo[uid].niuCount += 1;
                    }

                    endList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
                    // 自动组牌
                    player.addAutoOperateCount();
                }
                cardList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
            }
            var sort = CardUtils.sortCardByType(cardList);

            var times = desk.calRes[sort[0].uid].times;
            // 赢家赢所有
            for (var i = 0; i < sort.length; i++) {
                var uid = sort[i].uid;
                var player = desk.getPlayerByUid(uid);
                if (i == 0) {
                    player.addScore(times*(sort.length-1)*baseScore);
                    res.push({uid: uid, score:times*(sort.length-1)*baseScore});
                    player.addUserDataCount('winCount', 1);

                    if (desk.uidArr.length > 2) {
                        desk.playerCountInfo[uid].tongShaCount += 1;
                    }
                    desk.playerCountInfo[uid].winCount += 1;
                }
                else {
                    player.addScore(-times*baseScore);
                    res.push({uid: uid, score:-times*baseScore});
                }
            }
        }
        else if (desk.deskType == gDef.GroupDeskType.Random) {
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                // 没有组牌  没牛处理
                if (!desk.calRes[uid]) {
                    var cards = player.getCards();
                    var cardRes = desk.GetCardResult(cards);
                    desk.calRes[uid] = cardRes.cardType;
                    desk.redpackage(uid, cardRes);

                    if (cardRes.cardType.weight > gDef.PAI_XING.CowNiu.weight) {
                        desk.playerCountInfo[uid].specialCount += 1;
                    }
        
                    if (cardRes.cardType.weight == gDef.PAI_XING.CowNiu.weight) {
                        desk.playerCountInfo[uid].niuCount += 1;
                    }

                    endList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
                    // 自动组牌
                    player.addAutoOperateCount();
                }
                cardList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
            }

            var bankWinScore = 0;

            var bankPlayer = desk.getPlayerByUid(desk.bankUid);

            var bankTimes = desk.calRes[desk.bankUid].times;

            var bTongSha = true;
            var bTongPei = true;
            if (desk.uidArr.length <= 2) {
                bTongSha = false;
                bTongPei = false;
            }
            // 跟庄家比较
            for (var uid in desk.calRes) {
                uid = Number(uid);
                if (uid != desk.bankUid) {
                    var player = desk.getPlayerByUid(uid);
                    // 闲家赢
                    var winScore = 0;
                    if (CardUtils.CompareCardByType({card:player.getCards(), cardType:desk.calRes[uid]}, {card:bankPlayer.getCards(), cardType:desk.calRes[desk.bankUid]})) {
                        winScore = desk.calRes[uid].times*baseScore*player.getPoint();
                    }
                    else {
                        winScore = -bankTimes*baseScore*player.getPoint();
                    }
                    if (winScore > 0) {
                        player.addUserDataCount('winCount', 1);
                        desk.playerCountInfo[uid].winCount += 1;
                        bTongSha = false;
                    }
                    else {
                        bTongPei = false;
                    }
                    res.push({uid:uid, score:winScore});
                    player.addScore(winScore);
                    bankWinScore -= winScore;
                }
            }
            if (bTongSha) {
                desk.playerCountInfo[desk.bankUid].tongShaCount += 1;
                bankPlayer.addUserDataCount('tongShaCount', 1);
            }
            if (bTongPei) {
                desk.playerCountInfo[desk.bankUid].tongPeiCount += 1;
                bankPlayer.addUserDataCount('tongPeiCount', 1);
            }
            bankPlayer.addScore(bankWinScore);
            if (bankWinScore > 0) {
                bankPlayer.addUserDataCount('winCount', 1);
                desk.playerCountInfo[desk.bankUid].winCount += 1;
            }
            res.push({uid:desk.bankUid, score:bankWinScore});

            // 没牛下庄
            if (desk.getZhuangType() == gDef.ZhuangType.NoCow) {
                if (desk.calRes[desk.bankUid].weight == gDef.PAI_XING.NoCow.weight) {
                    desk.bankUid = 0;
                }
            }
            else if (desk.getZhuangType() == gDef.ZhuangType.Lose) {
                if (bankWinScore < 0) {
                    desk.bankUid = 0;
                }
            }
            else if (desk.getZhuangType() == gDef.ZhuangType.Cow) {
                for (var uid in desk.calRes) {
                    if (desk.calRes[uid].weight >= gDef.PAI_XING.CowNiu.weight) {
                        desk.bankUid = 0;
                        break;
                    }
                }
            }
        }
        else if (desk.deskType == gDef.GroupDeskType.Card) {
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                // 没有组牌  没牛处理
                if (!desk.calRes[uid]) {
                    var cards = player.getCards();
                    var cardRes = desk.GetCardResult(cards);
                    desk.calRes[uid] = cardRes.cardType;
                    desk.redpackage(uid, cardRes);

                    if (cardRes.cardType.weight > gDef.PAI_XING.CowNiu.weight) {
                        desk.playerCountInfo[uid].specialCount += 1;
                    }
        
                    if (cardRes.cardType.weight == gDef.PAI_XING.CowNiu.weight) {
                        desk.playerCountInfo[uid].niuCount += 1;
                    }

                    endList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
                    // 自动组牌
                    player.addAutoOperateCount();
                }
                cardList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
            }

            var bankWinScore = 0;

            var bankPlayer = desk.getPlayerByUid(desk.bankUid);
            var bankTimes = desk.bankPoint;

            var bTongSha = true;
            var bTongPei = true;
            if (desk.uidArr.length <= 2) {
                bTongSha = false;
                bTongPei = false;
            }
            // 跟庄家比较
            for (var uid in desk.calRes) {
                uid = Number(uid);
                if (uid != desk.bankUid) {
                    var player = desk.getPlayerByUid(uid);
                    // 闲家赢
                    var winScore = 0;
                    if (CardUtils.CompareCardByType({card:player.getCards(), cardType:desk.calRes[uid]}, {card:bankPlayer.getCards(), cardType:desk.calRes[desk.bankUid]})) {
                        winScore = desk.calRes[uid].times*desk.bankPoint*player.getPoint()*baseScore;
                    }
                    else {
                        winScore = -desk.calRes[desk.bankUid].times*desk.bankPoint*player.getPoint()*baseScore;
                    }
                    if (winScore > 0) {
                        player.addUserDataCount('winCount', 1);
                        desk.playerCountInfo[uid].winCount += 1;
                        bTongSha = false;
                    }
                    else {
                        bTongPei = false;
                    }
                    if (winScore == 0) {
                        console.log("bank:", desk.bankUid, bankPlayer.getCards(), "player:", uid, player.getCards(), desk.calRes[uid], "point", player.getPoint());
                    }
                    res.push({uid:uid, score:winScore});
                    player.addScore(winScore);
                    bankWinScore -= winScore;
                }
            }
            if (bTongSha) {
                desk.playerCountInfo[desk.bankUid].tongShaCount += 1;
                bankPlayer.addUserDataCount('tongShaCount', 1);
            }
            if (bTongPei) {
                desk.playerCountInfo[desk.bankUid].tongPeiCount += 1;
                bankPlayer.addUserDataCount('tongPeiCount', 1);
            }

            if (bankWinScore > 0) {
                bankPlayer.addUserDataCount('winCount', 1);
                desk.playerCountInfo[desk.bankUid].winCount += 1;
            }
            bankPlayer.addScore(bankWinScore);
            res.push({uid:desk.bankUid, score:bankWinScore});

            desk.bankUid = 0;
        }
        else if (desk.deskType == gDef.GroupDeskType.SequenceBank) {
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                // 没有组牌  没牛处理
                if (!desk.calRes[uid]) {
                    var cards = player.getCards();
                    var cardRes = desk.GetCardResult(cards);
                    desk.calRes[uid] = cardRes.cardType;
                    desk.redpackage(uid, cardRes);
                    if (cardRes.cardType.weight > gDef.PAI_XING.CowNiu.weight) {
                        desk.playerCountInfo[uid].specialCount += 1;
                    }
        
                    if (cardRes.cardType.weight == gDef.PAI_XING.CowNiu.weight) {
                        desk.playerCountInfo[uid].niuCount += 1;
                    }

                    endList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
                    // 自动组牌
                    player.addAutoOperateCount();
                }
                cardList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
            }

            var bankWinScore = 0;

            var bankPlayer = desk.getPlayerByUid(desk.bankUid);

            var bankTimes = desk.calRes[desk.bankUid].times;

            var bTongSha = true;
            var bTongPei = true;
            if (desk.uidArr.length < 2) {
                bTongSha = false;
                bTongPei = false;
            }
            // 跟庄家比较
            for (var uid in desk.calRes) {
                uid = Number(uid);
                if (uid != desk.bankUid) {
                    var player = desk.getPlayerByUid(uid);
                    // 闲家赢
                    var winScore = 0;
                    if (CardUtils.CompareCardByType({card:player.getCards(), cardType:desk.calRes[uid]}, {card:bankPlayer.getCards(), cardType:desk.calRes[desk.bankUid]})) {
                        winScore = desk.calRes[uid].times*baseScore*player.getPoint();
                    }
                    else {
                        winScore = -bankTimes*baseScore*player.getPoint();
                    }
                    if (winScore > 0) {
                        player.addUserDataCount('winCount', 1);
                        desk.playerCountInfo[uid].winCount += 1;
                        bTongSha = false;
                    }
                    else {
                        bTongPei = false;
                    }
                    res.push({uid:uid, score:winScore});
                    player.addScore(winScore);
                    bankWinScore -= winScore;
                }
            }
            if (bTongSha) {
                desk.playerCountInfo[desk.bankUid].tongShaCount += 1;
                bankPlayer.addUserDataCount('tongShaCount', 1);
            }
            if (bTongPei) {
                desk.playerCountInfo[desk.bankUid].tongPeiCount += 1;
                bankPlayer.addUserDataCount('tongPeiCount', 1);
            }
            bankPlayer.addScore(bankWinScore);
            if (bankWinScore > 0) {
                bankPlayer.addUserDataCount('winCount', 1);
                desk.playerCountInfo[desk.bankUid].winCount += 1;
            }
            res.push({uid:desk.bankUid, score:bankWinScore});

            desk.lastBankPos = desk.getPosByUid(desk.bankUid);

            // 没牛下庄
            if (desk.getZhuangType() == gDef.ZhuangType.NoCow) {
                if (desk.calRes[desk.bankUid].weight == gDef.PAI_XING.NoCow.weight) {
                    desk.bankUid = 0;
                }
            }
            else if (desk.getZhuangType() == gDef.ZhuangType.Lose) {
                if (bankWinScore < 0) {
                    desk.bankUid = 0;
                }
            }
            else if (desk.getZhuangType() == gDef.ZhuangType.Cow) {
                for (var uid in desk.calRes) {
                    if (desk.calRes[uid].weight >= gDef.PAI_XING.CowNiu.weight) {
                        desk.bankUid = 0;
                        break;
                    }
                }
            }
            else if (desk.getZhuangType() == gDef.ZhuangType.Sequence) {
                desk.bankUid = 0;
            }
            else if (desk.getZhuangType() == gDef.ZhuangType.Force) {
                var player = desk.getPlayerByUid(desk.bankUid);
                if (player.getPlayStatus() == gDef.PlayStatus.out) {
                    desk.isEnd = true;
                }
            }

        }

        for (var i = 0 ; i < desk.uidArr.length; i++) {
            var uid = desk.uidArr[i];
            var player = desk.getPlayerByUid(uid);
            player.flushMaxCard(player.getCards());

            if (player.getAutoOperateCount() >= trustteeCount) {
                // player.setTrusttee(true);
                // pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
                desk.trustPlayer(uid,true);
            }
        }

        console.log("------------------->>>res", res);
        for(var i in res){
            var item = res[i]
            var player = desk.getPlayerByUid(item.uid);
            player.setTuizhuScore(lastBankUid,res[i].score);
        }

        pomelo.app.get('channelService').pushMessageByUids(gameType+"_OnGameEnd", {
                award:res,
                cardList:endList,
                bankUid: desk.bankUid
            },
            desk.getOnlineSids());

        desk.reset();

        var playCount = 0;
        for (var i = 0; i < desk.maxPlayer; i++) {
            var player = desk.players[i];
            if (player && player.getPlayStatus() != gDef.PlayStatus.out) {
                playCount++;
            }
        }

        // 游戏结束
        if (desk.canStart() && playCount>1) {
            setTimeout(function() {
                desk.emit('start');
            },6300);
        }
        else {
            setTimeout(function() {
                desk.endGroupDesk();
            },4000);
        }

        log.insert({cmd:"niuniu_endGame", deskId:desk.deskId, res:res, calRes:desk.calRes});
        desk.nextTask();
    });
    // 下一轮
    desk.on('next', function(args) {
        if (desk.timer) {
            clearTimeout(desk.timer);
            delete desk.timer;
        }

        if (desk.deskType == gDef.GroupDeskType.TongBi) {
            // 发牌 然后 组牌
            if (desk.gameStatus == gDef.GameStatus.Start) {
                desk.gameStatus = gDef.GameStatus.Card;
                var playerCards = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(5);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                            uid:uid,
                            cards:cards,
                            gameStatus:desk.gameStatus
                        }, desk.getSid(uid));
                    playerCards[uid] = cards;
                }
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    gameStatus:desk.gameStatus
                }, desk.getWatcherUids());

                desk.gameStatus = gDef.GameStatus.CalCard;
                log.insert({cmd:"niuniu_pushCard", cards:playerCards, deskId: desk.deskId});
                desk.autoNext(calCardTimeOut+cardTimeOut*desk.uidArr.length);
            }
            // 结束
            else if (desk.gameStatus == gDef.GameStatus.CalCard) {
                desk.gameStatus = gDef.GameStatus.End;
                setTimeout(function () {
                    desk.emit('end');
                }, endTimeOut);
            }
        }
        else if (desk.deskType == gDef.GroupDeskType.Random) {
            if (desk.gameStatus == gDef.GameStatus.Start) {
                // 抢庄
                if (!desk.bankUid || desk.getPlayerByUid(desk.bankUid).isTrustee()) {
                    desk.bankUid = 0;
                    desk.gameStatus = gDef.GameStatus.Bank;
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                        gameStatus:desk.gameStatus
                    }, desk.getOnlineSids());
                    desk.autoNext(callTimeOut);
                }
                // 闲家加注
                else {
                    desk.gameStatus = gDef.GameStatus.Point;
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                        gameStatus:desk.gameStatus,
                        tuiZhuInfo:desk.getTuizhuInfo()
                    }, desk.getOnlineSids());
                    desk.autoNext(callTimeOut);
                }
            }
            // 显示 庄家
            else if (desk.gameStatus == gDef.GameStatus.Bank) {
                // 自动加注
                var playerPoint = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player) {
                        if (player.getPoint() < 0) {
                            player.callPoint(0);
                            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnCall', {
                                uid:uid,
                                point:0
                            }, desk.getOnlineSids());
                            // 自动抢庄
                            player.addAutoOperateCount();
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }
                log.insert({cmd:"niuniu_callBank", points:playerPoint});

                desk.gameStatus = gDef.GameStatus.ShowBank;
                var maxUids = [];
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player) {
                        var point = player.getPoint();
                        if (point > desk.bankPoint) {
                            desk.bankPoint = point;
                            maxUids = [];
                            maxUids.push(uid);
                        }
                        else if (point == desk.bankPoint) {
                            maxUids.push(uid);
                        }
                    }
                }

                // 清理下注信息
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player) {
                        player.clearPoint();
                    }
                }

                var index = Math.floor(Math.random()*maxUids.length);
                desk.bankUid = maxUids[index];

                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    bankUid: desk.bankUid,
                    bankPoint: desk.bankPoint,
                    gameStatus: desk.gameStatus
                }, desk.getOnlineSids());
                if (maxUids.length > 1) {
                    desk.timer = setTimeout(function () {
                        desk.emit('next');
                    }, showBankTimeOut);
                }
                else {
                    desk.timer = setTimeout(function () {
                        desk.emit('next');
                    }, 1500);
                }
            }
            // 闲家加注
            else if (desk.gameStatus == gDef.GameStatus.ShowBank) {
                desk.gameStatus = gDef.GameStatus.Point;
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    gameStatus:desk.gameStatus,
                    tuiZhuInfo:desk.getTuizhuInfo()
                }, desk.getOnlineSids());
                desk.autoNext(callTimeOut);
            }
            // 发牌 然后 组牌
            else if (desk.gameStatus == gDef.GameStatus.Point) {
                // 自动加注
                var playerPoint = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player && uid != desk.bankUid) {
                        if (player.getPoint() < 0) {
                            player.callPoint(1);
                            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnCall', {
                                uid:uid,
                                point:1
                            }, desk.getOnlineSids());
                            // 自动叫分
                            player.addAutoOperateCount();
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }
                log.insert({cmd:"niuniu_addPoint", points:playerPoint, bankPoint: desk.bankPoint});

                desk.gameStatus = gDef.GameStatus.Card;
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(5);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                        uid:uid,
                        cards:cards,
                        gameStatus:desk.gameStatus
                    }, desk.getSid(uid));
                }
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    gameStatus:desk.gameStatus
                }, desk.getWatcherUids());
                desk.gameStatus = gDef.GameStatus.CalCard;
                desk.autoNext(calCardTimeOut+cardTimeOut*desk.uidArr.length);
            }
            // 游戏结束
            else if (desk.gameStatus == gDef.GameStatus.CalCard) {
                desk.gameStatus = gDef.GameStatus.End;
                setTimeout(function () {
                    desk.emit('end');
                }, endTimeOut);
            }
        }
        else if (desk.deskType == gDef.GroupDeskType.Card) {
            // 发牌 然后 抢庄
            if (desk.gameStatus == gDef.GameStatus.Start) {
                desk.gameStatus = gDef.GameStatus.Card;
                var playerCards = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(4);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                        uid:uid,
                        cards:cards,
                        gameStatus:desk.gameStatus
                    }, desk.getSid(uid));
                    playerCards[uid] = cards;
                }
                log.insert({cmd:"niuniu_pushCard", cards:playerCards, deskId: desk.deskId});
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    gameStatus:desk.gameStatus
                }, desk.getWatcherUids());
                desk.gameStatus = gDef.GameStatus.Bank;
                desk.autoNext(callTimeOut+cardTimeOut*desk.uidArr.length);
            }
            // 显示 庄家
            else if (desk.gameStatus == gDef.GameStatus.Bank) {
                var playerPoint = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player) {
                        if (player.getPoint() < 0) {
                            player.callPoint(0);
                            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnCall', {
                                uid:uid,
                                point:0
                            }, desk.getOnlineSids());
                            // 自动抢庄
                            player.addAutoOperateCount();
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }
                log.insert({cmd:"niuniu_callBank", points:playerPoint, deskId: desk.deskId});

                desk.gameStatus = gDef.GameStatus.ShowBank;
                var maxUids = [];
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player) {
                        var point = player.getPoint();
                        if (point > desk.bankPoint) {
                            maxUids = [];
                            maxUids.push(uid);
                            desk.bankPoint = point;
                        }
                        else if (point == desk.bankPoint) {
                            maxUids.push(uid);
                        }
                    }
                }
                var index = Math.floor(Math.random()*maxUids.length);
                desk.bankUid = maxUids[index];

                if (desk.bankPoint == 0) {
                    desk.bankPoint = 1;
                }

                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player) {
                        player.clearPoint();
                    }
                }

                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    bankUid: desk.bankUid,
                    bankPoint: desk.bankPoint,
                    gameStatus:desk.gameStatus
                }, desk.getOnlineSids());
                if (maxUids.length > 1) {
                    desk.timer = setTimeout(function () {
                        desk.emit('next');
                    }, showBankTimeOut);
                }
                else {
                    desk.timer = setTimeout(function () {
                        desk.emit('next');
                    }, 1500);
                }
            }
            // 闲家加注
            else if (desk.gameStatus == gDef.GameStatus.ShowBank) {
                desk.gameStatus = gDef.GameStatus.Point;
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    gameStatus:desk.gameStatus,
                    tuiZhuInfo:desk.getTuizhuInfo()
                }, desk.getOnlineSids());
                desk.autoNext(callTimeOut);
            }
            // 发最后一张牌
            else if (desk.gameStatus == gDef.GameStatus.Point) {
                var playerPoint = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player && uid != desk.bankUid) {
                        if (player.getPoint() <= 0) {
                            player.callPoint(1);
                            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnCall', {
                                uid:uid,
                                point:1
                            }, desk.getOnlineSids());
                            // 自动叫分
                            player.addAutoOperateCount();
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }

                log.insert({cmd:"niuniu_addPoint", points:playerPoint, bankPoint: desk.bankPoint, deskId: desk.deskId});

                desk.gameStatus = gDef.GameStatus.LeftCard;
                var leftCards = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(1);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                        uid:uid,
                        cards:cards,
                        gameStatus:desk.gameStatus
                    }, desk.getSid(uid));
                    leftCards[uid] = cards;
                }
                log.insert({cmd:"niuniu_pushCard", cards:leftCards, deskId: desk.deskId});
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    gameStatus:desk.gameStatus
                }, desk.getWatcherUids());

                desk.gameStatus = gDef.GameStatus.CalCard;
                //desk.pushTask('next');
                desk.autoNext(calCardTimeOut);
            }
            else if (desk.gameStatus == gDef.GameStatus.CalCard) {
                desk.gameStatus = gDef.GameStatus.End;
                //没翻牌的做没牛处理
                for(var i = 0; i < desk.uidArr.length; i++){
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if(!! player && ! desk.calRes[uid]){
                        var cards = player.getCards();
                        var res = desk.GetCardResult(cards);
                        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnCalCard', 
                        {uid: uid, card:player.getCards(), cardType:res.cardType}, desk.getOnlineSids());
                    }
                }
                setTimeout(function () {
                    desk.emit('end');
                }, endTimeOut);
            }
        }
        else if (desk.deskType == gDef.GroupDeskType.SequenceBank) {
            if (desk.gameStatus == gDef.GameStatus.Start) {
                if (desk.getZhuangType() != gDef.ZhuangType.Force) {
                    if (!desk.bankUid || desk.getPlayerByUid(desk.bankUid).isTrustee()) {
                        if (desk.lastBankPos != undefined) {
                            var pos = desk.nextPos(desk.lastBankPos);
                            while (desk.players[pos].isTrustee() || !desk.optUid[desk.players[pos].getUid()]) {
                                pos = desk.nextPos(pos);
                            }
                            desk.bankUid = desk.players[pos].getUid();
                        }
                        else {
                            desk.bankUid = desk.fangOwnerUid;
                        }
                    }
                }
                else {
                    desk.bankUid = desk.fangOwnerUid;
                }
                // 显示 庄家
                desk.gameStatus = gDef.GameStatus.ShowBank;
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    bankUid: desk.bankUid,
                    bankPoint: desk.bankPoint,
                    gameStatus: desk.gameStatus
                }, desk.getOnlineSids());

                desk.timer = setTimeout(function () {
                    desk.emit('next');
                }, 1500);
            }
            // 闲家加注
            else if (desk.gameStatus == gDef.GameStatus.ShowBank) {
                desk.gameStatus = gDef.GameStatus.Point;
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    gameStatus:desk.gameStatus,
                    tuiZhuInfo:desk.getTuizhuInfo()
                }, desk.getOnlineSids());
                desk.autoNext(callTimeOut);
            }
            // 发牌 然后 组牌
            else if (desk.gameStatus == gDef.GameStatus.Point) {
                // 自动加注
                var playerPoint = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (player && uid != desk.bankUid) {
                        if (player.getPoint() < 0) {
                            player.callPoint(1);
                            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnCall', {
                                uid:uid,
                                point:1
                            }, desk.getOnlineSids());
                            // 自动叫分
                            player.addAutoOperateCount();
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }
                log.insert({cmd:"niuniu_addPoint", points:playerPoint, bankPoint: desk.bankPoint});

                desk.gameStatus = gDef.GameStatus.Card;
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(5);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                        uid:uid,
                        cards:cards,
                        gameStatus:desk.gameStatus
                    }, desk.getSid(uid));
                }
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnNewStep', {
                    gameStatus:desk.gameStatus
                }, desk.getWatcherUids());
                desk.gameStatus = gDef.GameStatus.CalCard;
                desk.autoNext(calCardTimeOut+cardTimeOut*desk.uidArr.length);
            }
            // 游戏结束
            else if (desk.gameStatus == gDef.GameStatus.CalCard) {
                desk.gameStatus = gDef.GameStatus.End;
                setTimeout(function () {
                    desk.emit('end');
                }, endTimeOut);
            }
        }

        for (var i = 0; i < desk.uidArr.length; i++) {
            var uid = desk.uidArr[i];
            var player = desk.getPlayerByUid(uid);
            if (!player.isTrustee()) {
                if (player.getAutoOperateCount() >= trustteeCount) {
                    // player.setTrusttee(true);
                    // pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
                    desk.trustPlayer(uid,true);
                }
            }
        }
        desk.opreatNum = 0;

        desk.nextTask();
    });
    // 有人断线
    desk.on('offline', function(args) {
        console.log("offline", args);

        var uid = args.uid;
        var player = desk.getPlayerByUid(uid);
        if (player) {
            delete desk.sids[uid];
            if (desk.isStart) {
                player.setOfflineFlag(true);
                // player.setTrusttee(true);
                // pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
                desk.trustPlayer(uid,true);
            }
            log.insert({cmd:"niuniu_offline", deskId:desk.deskId, uid:uid});
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
        player.setOfflineFlag(false);

        desk.sids[uid] = {uid: uid, sid: args.sid};

        // pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnEnterDesk', {
        //         playerInfo: desk.getPlayersInfo(),
        //         deskInfo: desk.getDeskInfo(),
        //         gameType: gameType
        //     },
        //     desk.getSid(uid));

        // 游戏进行中
        // if (desk.getGameStatus() != gDef.GameStatus.null) {
        //      // setTimeout(function () {
        //         // var uid = args.uid;
        //         var points = desk.getPointInfo();
        //         var cards = desk.getPlayerCardsByUid(uid);
        //
        //         var cal = [];
        //         for (var tmpUid in desk.calRes) {
        //             tmpUid = Number(tmpUid);
        //             var card = desk.getPlayerByUid(tmpUid).getCards();
        //             cal.push({uid:tmpUid, cardType:desk.calRes[tmpUid], card:card});
        //         }
        //         var data = {
        //             leftCount: desk.leftCount,
        //             points: points,
        //             bankPoint: desk.bankPoint,
        //             bankUid: desk.bankUid,
        //             cards: cards,
        //             gameStatus: desk.getGameStatus(),
        //             calRes: cal,
        //             playUids: desk.uidArr,
        //             disFlag: desk.disFlag
        //         };
        //         pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnGameStart', data, desk.getSid(uid));
        //         desk.pushTask('canceltrusttee', args);
        //      // }, 500);
        // }
        // else {
             // setTimeout(function () {
            desk.pushTask('canceltrusttee', args);
             // }, 500);
        // }

        log.insert({cmd:"niuniu_reconnect", deskId:desk.deskId, uid:uid});
        desk.nextTask();
    });
    // 取消托管
    desk.on('canceltrusttee', function(args) {
        var uid = args.uid;
        var player = desk.getPlayerByUid(uid);
        if (player) {
            if (player.isTrustee()) {
                player.setTrusttee(false);
                player.clearAutoOperateCount();

                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {
                    uid: uid,
                    bTrusttee: false
                }, desk.getOnlineSids());
                log.insert({cmd:"niuniu_canceltrusttee", deskId:desk.deskId, uid:uid});
            }
        }
        if (desk.getGameStatus() == gDef.GameStatus.Wait) {
            desk.pushTask('start');
        }
        desk.nextTask();
    });
    // 解散房间
    desk.on('dissolution', function(args) {
        var uid = args.uid;
        if (desk.canDissolutionDesk(uid)) {
            desk.isEnd = true;

            clearTimeout(desk.disTimer);

            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnDissolutionDesk', {}, desk.getOnlineSids());

            desk.players.forEach(function(p){
                if(desk.clubId){
                    pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitup(null,{uid:p.uid,clubId:desk.clubId,boxId:desk.boxId,deskName:desk.deskName},function(){});
                }
            })

            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player) {
                    player.leaveGame(gameType, desk.getDeskName());
                    desk.deletePlayer(player.getUid());
                }
            }
            pomelo.app.rpc[gameType].gameRemote.clearDesk(desk.deskName, {deskName: desk.deskName}, function () {
                pomelo.app.rpc.desknamesvr.deskNameRemote.recycleDeskName(null, {
                    deskName: desk.deskName,
                    isDissolution: true
                }, function () {
                    //通知clubsvr 桌子解散 重新去克隆一张
                    if(!! desk.clubId && !! desk.deskName && !! desk.boxId){
                        var clubId = desk.clubId;
                        var boxId = desk.boxId
                        pomelo.app.rpc.clubsvr.clubRemote.onEndGroupDesk(null,{clubId:desk.clubId,boxId:desk.boxId,deskName:desk.deskName},function(){});
                    }
                });
            });


            log.insert({cmd:"niuniu_dissolution", deskId:desk.deskId, uid:uid});
        }
        desk.nextTask();
    });
    // 踢人
    desk.on('kickplayer', function(args) {
        var uid = args.uid;
        var isIp = args.isIp;
        if (desk.canKickPlayer(uid)) {
            var uids = args.kickUids;
            for (var i = 0; i < uids.length; i++) {
                var player = desk.getPlayerByUid(uids[i]);
                if (player) {
                    var msg = ""
                    if(isIp){
                        msg = "玩家：" + player.nickName + "因同IP限制被踢出房间"
                    }

                    pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnKickPlayer', {
                        uid: uids[i],
                        msg: msg == "" ? undefined : msg
                    }, desk.getOnlineSids());

                    delete desk.sids[uids[i]];

                    desk.deletePlayer(uids[i]);

                    //pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnSitUp', {uid: uids[i]}, desk.getOnlineSids());

                    player.leaveGame(gameType, desk.getDeskName());
                }
            }
            log.insert({cmd:"niuniu_kickplayer", deskId:desk.deskId, uid:uid, kickUids:uids});
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
    // 房主开始游戏
    desk.on('startgame', function(args) {
        // 第一局开始初始化信息
        if (!desk.canStart()) {
            desk.nextTask();
            return;
        }
        if (!desk.isStart) {
            var uid = args.uid;
            if (uid != desk.fangOwnerUid) {
                return;
            }
            desk.isStart = true;
            desk.leftCount = desk.getGameCount();

            var player = desk.getPlayerByUid(uid);
            if (player) {
                // 扣除开房费
                var num = desk.costNum;
                desk.costRoomCard(num,function(err, res) {
                    if (err) {
                        desk.isStart = false;
                        pomelo.app.get('channelService').pushMessageByUids("OnErrMsg", err, desk.getSid(uid));
                        return;
                    }
                    log.insert({cmd:"createCostCard", gameType:gameType, deskId:desk.deskId, uid:desk.createUid, num:num});

                    clearTimeout(desk.disTimer);

                    desk.startTime = Math.round(new Date().getTime()/1000);

                    var playerUids = [];
                    for (var i = 0; i < desk.maxPlayer; i++) {
                        if (desk.players[i]) {
                            desk.players[i].addUserDataCount('playCount', 1);
                            desk.players[i].setPlayStatus(gDef.PlayStatus.play);
                            playerUids.push(desk.players[i].getUid());

                            desk.playerCountInfo[desk.players[i].getUid()] = {
                                tongShaCount:0,
                                tongPeiCount:0,
                                winCount:0,
                                niuCount:0,
                                specialCount:0};
                        }
                    }

                    var NiuNiuGroupInfo = pomelo.app.get('models').NiuNiuGroupInfo;
                    NiuNiuGroupInfo.update({startTime:desk.startTime, uids:JSON.stringify(playerUids)}, {where:{deskId:desk.deskId}})
                        .then(function(count) {

                        });
                    desk.pushTask('start', args);

                    log.insert({cmd:"niuniu_startPlayGame", deskId:desk.deskId, uids: playerUids});
                    desk.nextTask();
                });
            }
        }
    });
    // 组牌
    desk.on('cal', function(args) {
        if (desk.gameStatus != gDef.GameStatus.CalCard) {
            desk.nextTask();
            return;
        }
        var uid = args.uid;
        // 不属于当前操作玩家
        if (!desk.optUid[uid]) {
            desk.nextTask();
            return;
        }
        if (desk.calRes[uid]) {
            desk.nextTask();
            return;
        }
        var player = desk.getPlayerByUid(uid);
        if (!player) {
            desk.nextTask();
            return;
        }

        if (player.isTrustee()) {
            player.setTrusttee(false);
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: false}, desk.getOnlineSids());
        }
        player.clearAutoOperateCount();

        var cards = player.getCards();

        var res = desk.GetCardResult(cards);
        // 上报牌型错误
        if (args.hasCow && res.cardType == gDef.PAI_XING.NoCow) {
            desk.nextTask();
            return;
        }
        if (!args.hasCow) {
            desk.calRes[uid] = gDef.PAI_XING.NoCow;
        }
        else {
            desk.calRes[uid] = res.cardType;
    
            desk.redpackage(uid, res);

            if (res.cardType.weight > gDef.PAI_XING.CowNiu.weight) {
                desk.playerCountInfo[uid].specialCount += 1;
            }

            if (res.cardType.weight == gDef.PAI_XING.CowNiu.weight) {
                desk.playerCountInfo[uid].niuCount += 1;
            }
        }

        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnCalCard', {uid: uid, card:cards, cardType:desk.calRes[uid]}, desk.getOnlineSids());

        desk.opreatNum += 1;
        if (desk.opreatNum >= desk.uidArr.length) {
            desk.pushTask('next');
        }

        log.insert({cmd:"niuniu_playerCalCard", deskId:desk.deskId, uid: uid, card:cards, cardType:res.cardType});
        desk.nextTask();
    });
    // 申请解散房间
    desk.on('disapply', function(args) {
        if (!desk.isDissolution && desk.infiniteThink()) {
            desk.isDissolution = true;
            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player) {
                    var uid = player.getUid();
                    if (uid != args.uid) {
                        desk.disFlag[uid] = gDef.DisFlag.WaitOpt;
                    }
                    else {
                        desk.disFlag[uid] = gDef.DisFlag.Apply;
                    }
                }
            }
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnDisApply', {
                uid: args.uid
            }, desk.getOnlineSids());

            log.insert({cmd:"niuniu_disApply", deskId:desk.deskId, uid:args.uid});

            desk.disTimer = setTimeout(function() {
                clearTimeout(desk.disTimer);
                delete desk.disTimer;
                for (var i = 0; i < desk.maxPlayer; i++) {
                    var player = desk.players[i];
                    if (player) {
                        var uid = player.getUid();
                        if (desk.disFlag[uid] == gDef.DisFlag.WaitOpt) {
                            desk.emit('disopreat', {uid: uid, isAgree: true});
                        }
                    }
                }
            }, 300*1000);
        }
        desk.nextTask();
    });
    // 解散房间操作
    desk.on('disopreat', function(args) {
        if (desk.isDissolution && desk.disFlag[args.uid] == gDef.DisFlag.WaitOpt && desk.infiniteThink()) {
            desk.disFlag[args.uid] = args.isAgree ? gDef.DisFlag.Agree : gDef.DisFlag.DisAgree;
            var agreeNum = 0;
            var disAgreeNum = 0;
            var leftNum = 0;
            var agreeUids = [];

            var playerCount = 0;
            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player) {
                    var uid = player.getUid();
                    if (desk.disFlag[uid] == gDef.DisFlag.Agree) {
                        agreeNum += 1;
                        agreeUids.push(uid);
                    }
                    if (desk.disFlag[uid] == gDef.DisFlag.DisAgree) {
                        disAgreeNum += 1;
                    }
                    if (desk.disFlag[uid] == gDef.DisFlag.WaitOpt) {
                        leftNum += 1;
                    }
                    playerCount += 1;
                }
            }

            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnDisOpreat', {
                uid: args.uid,
                disFlag: desk.disFlag[args.uid]
            }, desk.getOnlineSids());

            log.insert({cmd:"niuniu_disOpreat", deskId:desk.deskId, uid:args.uid, isAgree:args.isAgree});

            // 大半人同意解散
            if (agreeNum >= Math.ceil((playerCount-1)/2)) {
                if (desk.disTimer) {
                    clearTimeout(desk.disTimer);
                    delete desk.disTimer;
                }
                desk.isDissolution = false;
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnDissolutionDesk', {agreeUids:agreeUids}, desk.getOnlineSids());

                desk.endGroupDesk();

                desk.nextTask();
                return;
            }
            if (disAgreeNum >= Math.ceil(playerCount/2)) {
                if (desk.disTimer) {
                    clearTimeout(desk.disTimer);
                    delete desk.disTimer;
                }
                leftNum = 0;
            }
            if (leftNum == 0) {
                if (desk.disTimer) {
                    clearTimeout(desk.disTimer);
                    delete desk.disTimer;
                }
                desk.isDissolution = false;
                desk.disFlag = {};
            }
        }
        desk.nextTask();
    });

    desk.on('prop', function(args) {
        var res = {};
        res.fromUid = args.uid;
        res.targetUid = args.targetUid;
        res.itemId = args.itemId;
        res.itemNum = args.itemNum;
        pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnUseProp', {
            uid: args.uid,
            data: res
        }, desk.getOnlineSids());
    });

    desk.queryDeskInfo = function(args) {
        var uid = args.uid;
        var info = {};
        if (desk.isStart) {
            var points = desk.getPointInfo();
            var cards = desk.getPlayerCardsByUid(uid);

            var cal = [];
            for (var tmpUid in desk.calRes) {
                tmpUid = Number(tmpUid);
                var card = desk.getPlayerByUid(tmpUid).getCards();
                cal.push({uid: tmpUid, cardType: desk.calRes[tmpUid], card: card});
            }
            var data = {
                leftCount: desk.leftCount,
                points: points,
                bankPoint: desk.bankPoint,
                bankUid: desk.bankUid,
                cards: cards,
                calRes: cal,
                playUids: desk.uidArr,
                gameStatus: desk.getGameStatus(),
                disFlag: desk.disFlag,
                tuiZhuInfo: desk.getTuizhuInfo()
            };
            info.reconnectData = data;
        }
        info.playerInfo = desk.getPlayersInfo();
        info.deskInfo = desk.getDeskInfo();
        return info;
    };

    desk.getDeskBasicInfo = function( ) {
        var info = {};
        info.playerInfo = desk.getPlayersInfo();
        info.deskInfo = desk.getDeskInfo();
        return info;
    };

    // 系统发红包
    desk.redpackage = function (uid, res) {
        var player = desk.getPlayerByUid(uid);
        // 五花牛
        var num;
        var hasSpecial = false;
        var redInfo = {uid: uid, nickName:player.getNickName()};
        if (res.cardType.weight == gDef.PAI_XING.CowFace.weight) {
            num = 0;
            redInfo.totalCoin = 3;
            redInfo.totalCount = 3;
            hasSpecial = true;
            player.addUserDataCount('wuHuaNiuCount', 1);
        }
        // 炸弹
        else if (res.cardType.weight == gDef.PAI_XING.CowBoom.weight) {
            num = 0;
            redInfo.totalCoin = 3;
            redInfo.totalCount = 3;
            hasSpecial = true;
            player.addUserDataCount('zhaDanCount', 1);
        }
        // 五小牛
        else if (res.cardType.weight == gDef.PAI_XING.CowLittle.weight) {
            num = 0;
            redInfo.totalCoin = 3;
            redInfo.totalCount = 3;
            hasSpecial = true;
            player.addUserDataCount('wuXiaoNiuCount', 1);

        }
        // 牛牛
        else if (res.cardType.weight == gDef.PAI_XING.CowNiu.weight) {
            player.addUserDataCount('niuNiuCount', 1);
        }
        if (hasSpecial) {
            if (num > 0) {
                player.addRoomCard(num, function () {
                    log.insert({cmd: 'specialCard', uid: uid, cardName: res.cardType.name, deskId: desk.deskId, cardNum: num});
                    var msg = "<font>恭喜您抽中</font><font color=0,255,0>" + res.cardType.name + "</font><font>牌型，获得</font><font color=255,255,0>" + num + "钻</font><font>奖励</font>";
                    pomelo.app.get('channelService').pushMessageByUids("OnScrollMsg", {msg: msg, type: 1},
                        desk.getSid(uid)
                    );
                });
            }
            if (redInfo.totalCoin) {
                var bMsg = "<font>玩家</font><font color=255,255,0>" + player.getNickName() + "</font><font>在</font><font color=0,255,0>牛牛</font><font>游戏中抽中了</font><font color=0,255,0>" + res.cardType.name + "</font><font>牌型。</font>";
                // pomelo.app.rpc.singlesvr.redPackageRemote.addRedPackage(null,
                //     redInfo,
                //     function (err, packageId) {
                //         pomelo.app.rpc.chatsvr.chatRemote.pushMessageToWorld(null, "OnScrollMsg", {
                //             msg: bMsg,
                //             type: 2,
                //             packageId: packageId,
                //             timestamp: Math.floor(new Date().getTime()/1000)
                //         }, function () {
                //         });
                //     });
                pomelo.app.rpc.chatsvr.chatRemote.pushMessageToWorld(null, "OnScrollMsg", {
                    msg: bMsg,
                    type: 1
                }, function () {
                });
            }
        }
    };

    desk.canKickPlayer = function(uid) {
        return (uid == desk.fangOwnerUid && !desk.isStart);
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
        for (var i = 0; i < desk.maxPlayer; i++) {
            var player = desk.players[i];
            if (player) {
                if (desk.sids[player.getUid()]) {
                    res.push(desk.sids[player.getUid()]);
                }
            }
        }
        return res;
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
    
    desk.getWatcherUids = function () {
        var res = [];
        for (var i = 0; i < desk.maxPlayer; i++) {
            var player = desk.players[i];
            if (player) {
                var uid = player.getUid();
                if (!desk.optUid[uid]) {
                    if (desk.sids[uid]) {
                        res.push(desk.sids[uid]);
                    }
                }
            }
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

    desk.canStart = function () {
        if (desk.isEnd) {
            return false;
        }
        if (desk.isStart) {
            return ((desk.gameStatus == gDef.GameStatus.null || desk.gameStatus == gDef.GameStatus.Wait) && desk.leftCount > 0);
        }
        else {
            if (desk.playerNum < 2) {
                return false;
            }
            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player) {
                    if (!player.isReadyGame()) {
                        return false;
                    }
                }
            }
            return true;
        }
    };

    desk.canEnterDesk = function (user) {
        var player = desk.getPlayerByUid(user.uid);
        if (desk.isStart) {
            if (player) {
                if (player.getPlayStatus() != gDef.PlayStatus.out) {
                    return 0;
                }
            }
            else {
                return 3;
            }
        }
        else {
            if (player) {
                return 0;
            }
            if (desk.maxPlayer <= desk.playerNum) {
                return 1;
            }
        }
        return 0;
    };

    desk.autoNext = function (timeOut) {
        if (!desk.infiniteThink()) {
            desk.timer = setTimeout(function () {
                desk.emit('next');
            }, timeOut);
        }
    };

    desk.canDissolutionDesk = function (uid) {
        if(uid == "XAdmin"){
            return true;
        }

        if (uid != desk.createUid && uid != desk.fangOwnerUid) {
            return false;
        }

        if(uid == desk.createUid){
            return ! desk.isStart;
        }

        if (uid != desk.fangOwnerUid) {
            if (desk.isReplace) {
                if (uid == desk.createUid) {
                    if (desk.playerNum == 0) {
                        return true;
                    }
                }
            }
            return false;
        }
        return !desk.isStart;
    };

    desk.endGroupDesk = function () {

        var res = [];
        // 决胜场排行
        var now = Math.round(new Date().getTime() / 1000);

        for (var i = 0; i < desk.maxPlayer; i++) {
            var player = desk.players[i];
            if (player) {
                var uid = player.getUid();
                var info = utils.clone(desk.playerCountInfo[uid]);
                info.uid = uid;
                info.nickName = player.getNickName();
                info.score = player.getScore();
                info.gameId = player.getGameId();
                info.isRun = desk.runUid[uid] || false;
                res.push(info);

                // player.addUserDataCount('totalScore', info.score);
                player.flushWinScore(info.score);
            }
        }
        res.sort(function (a, b) {
            return a.score < b.score;
        });



        // 战绩保存
        async.waterfall([function (cb) {
                var NiuNiuGroupInfo = pomelo.app.get('models').NiuNiuGroupInfo;
                NiuNiuGroupInfo.update({endTime: now, res: JSON.stringify(res)}, {where: {deskId: desk.deskId}})
                    .then(function (count) {
                        cb();
                    });
                },
                function (cb) {
                    var historys = [];

                    for (var i = 0; i < desk.maxPlayer; i++) {
                        player = desk.players[i];
                        if (player) {
                            historys.push({uid: player.getUid(), deskId: desk.deskId, endTime: now,clubId:!! desk.clubId ? desk.clubId:0});
                        }
                    }
                    var NiuNiuGroupHistory = pomelo.app.get('models').NiuNiuGroupHistory;
                    NiuNiuGroupHistory.bulkCreate(historys)
                        .then(function (res) {
                            cb();
                        });
                },
                function (cb) {
                    if (desk.isReplace) {
                        var NiuNiuGroupHistory = pomelo.app.get('models').gameNiuNiuReplaceHistory;
                        NiuNiuGroupHistory.create({uid: desk.createUid, deskId: desk.deskId, endTime: now})
                            .then(function(res) {
                                cb();
                            })
                    }
                    else {
                        cb();
                    }
                }
            ]
            , function (err) {
                if (err) {
                    console.log("endGroupDesk save err", err);
                }
            });
        
        if(desk.isReplace){
            pomelo.app.rpc.usersvr.userRemote.queryUsers(desk.createUid,{quids:[desk.createUid],attrs:["uid","faceId","gameId","nickName"]},function(err,users){
                var user = users[0];
                var uid = user.uid;
                var faceId = user.faceId;
                var gameId  = user.gameId;
                var nickName = user.nickName;
                pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnGroupEnd', {creator:{uid:uid,gameId:gameId,faceId:faceId,nickName:nickName},res:res}, desk.getOnlineSids());
            });
        }else{
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnGroupEnd', {creator:null,res:res}, desk.getOnlineSids());
        }
        log.insert({cmd:"endDesk", gameType:3, deskId:desk.deskId, uid:desk.fangOwnerUid, flag:desk.flag, deskType:desk.deskType, res:res});

        var newPlayerCount = 0;

        function checkNewPlayer(player) {
            return function (cb) {
                player.isNewPlayer(function (err) {
                    if (!err) {
                        newPlayerCount += 1;
                    }
                    cb();
                })
            }
        }

        var funcs = [];
        for (var i = 0; i < desk.maxPlayer; i++) {
            var player = desk.players[i];
            if (player) {
                player.leaveGame(gameType, desk.getDeskName());
                if (player.getUid() != desk.fangOwnerUid) {
                    funcs.push(checkNewPlayer(player));
                }
            }
        }
        async.waterfall(funcs,
            function (err) {
                if (newPlayerCount > 0) {
                    var player = desk.getPlayerByUid(desk.fangOwnerUid);
                    // player.addRoomCard(newPlayerCount * 5, function (err, res) {
                    //     if (res) {
                    //         log.insert({cmd:"invitePlayer", gameType:gameType, deskId:desk.deskId, uid:desk.fangOwnerUid, addNum:newPlayerCount * 5});
                    //         pomelo.app.get('channelService').pushMessageByUids('OnMsg',
                    //             {msg: "您邀请了" + newPlayerCount + "位新朋友，获得" + newPlayerCount * 5 + "钻奖励。"},
                    //             desk.getSid(player.getUid()));
                    //     }
                    // });
                }
            });
        pomelo.app.rpc[gameType].gameRemote.clearDesk(desk.deskName, {deskName: desk.deskName}, function () {
            pomelo.app.rpc.desknamesvr.deskNameRemote.recycleDeskName(null, {
                deskName: desk.deskName
            }, function () {
                //通知clubsvr 桌子解散 重新去克隆一张
                if(!! desk.clubId && !! desk.deskName){
                    var clubId = desk.clubId;
                    var boxId = desk.boxId
                    pomelo.app.rpc.clubsvr.clubRemote.onEndGroupDesk(null,{clubId:clubId,boxId:boxId,deskName:desk.deskName},function(){});
                }
            });
        });
        //
        desk.players.forEach(function(p){
            if(desk.clubId){
                pomelo.app.rpc.clubsvr.clubRemote.onPlayerSitup(null,{uid:p.uid,clubId:desk.clubId,boxId:desk.boxId,deskName:desk.deskName},function(){});
            }
        })
    };

    desk.trustPlayer = function(uid,toTrust){
        var player = desk.getPlayerByUid(uid);
        if(! player){
            return;
        }

        if(toTrust && ! player.isTrustee()){
            player.setTrusttee(true);
            pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
        }
    }
};