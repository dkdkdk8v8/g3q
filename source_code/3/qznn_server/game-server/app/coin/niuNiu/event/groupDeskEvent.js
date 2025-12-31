/**
 * Created by Administrator on 2016/9/13.
 */
var exp = module.exports;
var pomelo = require("pomelo");
var crypto = require("crypto");
var Player = require("../../../coin/niuNiu/module/player");
var gDef = require("../../../coin/niuNiu/globalDefine");
var CardUtils = require("../../../coin/niuNiu/module/cardUtils");
var card = require("../../../coin/niuNiu/module/cardSet");
var async = require("async");
var log = pomelo.app.get('mongodb');
var utils = require('../../../util/utils');
var async = require("async");


//obj --->>> 0x encode string
var serializeDeck = function (deck) {
    var sDeck = "";
    deck.forEach(function (item) {
        var value = new Number(item & 0x000F).toString(16);
        var type = new Number(item >> 8).toString(16);
        sDeck = sDeck + type + value;
    })
    return sDeck;
}

var unSerializeDeck = function (sDeck) {
    if (sDeck.length % 2 != 0) {
        console.log("unserialze deck occour error,length shouled be even");
        return;
    }

    var cards = []
    for (var i = 0; i < sDeck.length; i += 2) {
        var card = Number.parseInt('0x' + sDeck[i]) << 8 | Number.parseInt('0x' + sDeck[i + 1]);
        cards.push(card);
    }

    return cards;
}

exp.addEventListener = function (desk) {
    var gameType = "coinNiuNiu4";

    desk.tasks = [];

    desk.sids = {};

    var calCardTimeOut = 6000;
    var callTimeOut = 5000;
    var showBankTimeOut = 3000;
    var cardTimeOut = 500;
    var endTimeOut = 1000;
    var trustteeCount = 4;
    var trustteeTimeOut = 2000;

    desk.isStart = false;
    desk.isEnd = false;
    desk.opreatNum = 0;
    desk.calRes = {};
    desk.optUid = {};

    desk.autoTimer = {};
    desk.deckMD5 = null;
    //
    desk.watcher = {};

    var baseScore = desk.getBaseScore();

    var addCoinFunc = function (uid, coin) {
        return function (cb) {
            var player = desk.getPlayerByUid(uid);
            player.addScore(coin, cb);
        };
    };

    desk.gameStatus = gDef.GameStatus.Ready;

    // / 叫分
    desk.on('call', function (args) {
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

        if (player.isTrusttee()) {
            player.setTrusttee(false);
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {uid: uid, bTrusttee: false}, desk.getOnlineSids());
        }
        player.clearAutoOperateCount();
        // 已经叫过分 或者 叫分错误
        if (player.getPoint() >= 0 || args.point < 0) {
            desk.nextTask();
            return
        }
        // 庄家不能叫分
        if (desk.gameStatus == gDef.GameStatus.Point) {
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
        } else if (desk.gameStatus == gDef.GameStatus.Point) {
            if (desk.opreatNum >= (desk.uidArr.length - 1)) {
                desk.pushTask('next');
            }
        }

        pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnCall', {
            uid: uid,
            point: args.point
        }, desk.getOnlineSids());

        log.insert({cmd: "coin_niuniu_playerCall", uid: uid, point: args.point, gameStatus: desk.gameStatus});
        desk.nextTask();
    });
    // 进入桌子
    desk.on('enter', function (args) {
        // 新进游戏 自动入座
        console.log(">>> [玩家进入房间] UID:", args.uid);
        if (!desk.getPlayerByUid(args.uid) && desk.canEnterDesk(args) == 0) {

            desk.sids[args.uid] = {uid: args.uid, sid: args.sid};
            args.bAuto = true;
            desk.pushTask('sitDown', args);
            //desk.emit("sitDown", args);
        } else {
            desk.pushTask('reconnect', args);
        }
        desk.nextTask();
    });
    // 离开桌子
    desk.on('exit', function (args) {
        var uid = args.uid;


        var player = desk.getPlayerByUid(uid);

        if (!player) {
            desk.nextTask();
            return;
        }

        // 游戏还没有开始
        if (desk.gameStatus == gDef.GameStatus.Ready || player.playStatus != gDef.PlayStatus.play) {
            desk.deletePlayer(uid);
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnExit', {
                uid: uid,
                msg: args.msg
            }, desk.getOnlineSids());
            log.insert({cmd: "coin_niuniu_exit", uid: args.uid});
            console.log(">>> [玩家离开房间] UID:", uid, "房间:", desk.deskName);
            player.leaveGame(gameType, desk.getDeskName());
            player.stopReadyCount();
            delete desk.sids[args.uid];
        } else {
            // 玩家没有加入当前游戏
            // if (player.getPlayStatus() != gDef.PlayStatus.play) {
            //     desk.deletePlayer(uid);
            //     log.insert({cmd: "coin_niuniu_sitUp", uid: args.uid});
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
        //玩家离桌 开始游戏
        if (desk.canStart()) {
            setTimeout(function () {
                desk.emit('start');
            }, 100);
        }
        //robot#3:玩家离桌通知
        pomelo.app.rpc.robotMaster.masterRemote.onPlayerExitDesk(null, {uid: uid, deskName: desk.getDeskName(), gameType: gameType}, function (err, res) {
            if (!!err) {
                console.log('notify robot exit desk failed with err message', err.message);
            }
        });

        desk.nextTask();
    });
    // 起坐
    desk.on('sitUp', function (args) {
        var uid = args.uid;
        var player = desk.getPlayerByUid(uid);
        if (!player) {
            desk.nextTask();
            return;
        }

        // 游戏还没有开始
        if (desk.gameStatus == gDef.GameStatus.Ready) {
            desk.watcher[uid] = player.getBasicInfo();
            desk.watcher[uid].sid = desk.sids[uid].sid;
            delete desk.sids[uid];

            desk.deletePlayer(uid);
            log.insert({cmd: "coin_niuniu_sitUp", uid: args.uid});
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnSitUp', {uid: uid}, desk.getOnlineSids());
        } else {
            // 玩家没有加入当前游戏
            if (player.getPlayStatus() != gDef.PlayStatus.play) {
                desk.watcher[uid] = player.getBasicInfo();
                desk.watcher[uid].sid = desk.sids[uid].sid;
                delete desk.sids[uid];

                desk.deletePlayer(uid);
                log.insert({cmd: "coin_niuniu_sitUp", uid: args.uid});
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnSitUp', {uid: uid}, desk.getOnlineSids());
            } else {
                pomelo.app.get('channelService').pushMessageByUids("OnErrMsg", {err: true, msg: "当前游戏状态下无法退出游戏!"}, desk.getSid(uid));
                desk.nextTask();
                return;
            }
        }
        desk.nextTask();
    });
    // 坐下
    desk.on('sitDown', function (args) {
        var uid = args.uid;
        console.log(">>> [玩家坐下] UID:", uid, "位置:", args.pos);

        var pos = args.pos;

        if (desk.players[pos]) {
            desk.nextTask();
            pomelo.app.get('channelService').pushMessageByUids("OnErrMsg", {err: true, msg: "该位置上已经有人!"}, desk.getSid(uid));
            delete desk.sids[uid];
            return;
        }

        if (desk.watcher[uid]) {
            delete desk.watcher[uid];
        }

        // 限时场
        desk.players[pos] = new Player({
            uid: uid,
            nickName: args.nickName,
            pos: pos,
            faceId: args.faceId,
            userData: args.userData,
            coin: args.coin,
            ownGoods: args.ownGoods,
            vipLevel: args.vipLevel
        });

        // 自动准备
        // if (uid == desk.createUid) {
        //desk.players[pos].readyGame();
        // }

        desk.players[pos].setPlayStatus(gDef.PlayStatus.watch);
        desk.players[pos].setTrusttee(false);
        desk.players[pos].clearAutoOperateCount();
        desk.uidPosMap[uid] = pos;
        desk.playerNum += 1;
        //desk.timeOutKick(uid);
        desk.players[pos].startReadyCount(desk);
        log.insert({cmd: "coin_niuniu_sitDown", uid: args.uid, pos: pos, coin: args.coin});

        if (args.bAuto) {
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnSitDown', desk.players[pos].getBasicInfo(), desk.getOtherUids(uid));
        } else {
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnSitDown', desk.players[pos].getBasicInfo(), desk.getOnlineSids());
        }

        //robot#2:玩家入桌
        if (desk.roomIndex < 4) {
            pomelo.app.rpc.robotMaster.masterRemote.onPlayerEnterDesk(null, {uid: uid, deskName: desk.deskName, gameType: gameType}, function (err, res) {
                if (!!err) {
                    console.log('notify robot sitdown err', err.message);
                }
            });
        }
        desk.nextTask();
    });
    // 开始一局
    desk.restoreDeck = function (rDeck) {
        var luckOne = 0;
        var self = desk;
        for (var i = 0; i < self.uidArr.length; i++) {
            //TODO:桌上第一个机器人拿到好牌
            if (self.uidArr[i] > 1000000) {
                luckOne = i;
                break;
            }
        }

        var deck = new card();
        var sDeck = serializeDeck(deck.card);
        //转换成数组
        var sDeckArr = [];
        for (var i = 0; i < sDeck.length; i += 2) {
            sDeckArr.push(sDeck[i] + sDeck[i + 1]);
        }
        //删除重组
        for (var i = 0; i < self.uidArr.length; i++) {
            var restoreCards = rDeck[i];
            for (var j = 0; j < restoreCards.length; j += 2) {
                var rCard = restoreCards[j] + restoreCards[j + 1];
                for (var k = 0; k < sDeckArr.length; k++) {
                    if (rCard == sDeckArr[k]) {
                        sDeckArr.splice(k, 1);
                        break;
                    }
                }
            }
            sDeck = sDeckArr.join('');
            //最大这手在首位
            if (i == 0) {
                var player = self.getPlayerByUid(self.uidArr[luckOne]);
                player.sDeck = restoreCards;
                continue;
            }

            for (var k = 0; k < self.uidArr.length; k++) {
                var player = self.getPlayerByUid(self.uidArr[k]);
                if (!player.sDeck) {
                    player.sDeck = restoreCards;
                    break;
                }
            }
        }
        //重组牌堆
        var tmp = "";
        for (var i = 0; i < self.uidArr.length; i++) {
            var player = self.getPlayerByUid(self.uidArr[i]);
            tmp += player.sDeck.substr(0, 8);//前4
        }

        for (var i = 0; i < self.uidArr.length; i++) {
            var player = self.getPlayerByUid(self.uidArr[i]);
            tmp += player.sDeck.substr(-2, 2);//后1
            delete player.sDeck;
        }
        console.log("befor unSerializeDeck deck is", tmp);
        sDeck = tmp + sDeck;

        self.card = new card();
        console.log("befor unSerializeDeck deck is", sDeck);
        self.card.card = unSerializeDeck(sDeck);
    }


    desk.on('start', function (args) {
        if (!desk.canStart()) {
            desk.nextTask();
            return;
        }

        if (!!desk.endTimer) {
            clearTimeout(desk.endTimer)
            desk.endTimer = null
        }

        desk.uidArr = [];
        desk.calRes = {};
        desk.optUid = {};

        for (var i = 0; i < desk.maxPlayer; i++) {
            // 不托管 不淘汰
            var player = desk.players[i];
            if (player && player.score >= desk.getMinCoin()) {
                var uid = player.getUid();
                desk.uidArr.push(uid);
                desk.optUid[uid] = true;
                player.setPlayStatus(gDef.PlayStatus.play);
                player.addUserDataCount('totalCount', 1);
            }
        }

        if (desk.uidArr.length <= 1) {
            pomelo.app.get('channelService').pushMessageByUids("OnErrMsg", {err: true, msg: "当前在线人数不足以开始游戏"}, desk.getOnlineSids());
            desk.nextTask();
            return;
        }

        var player = desk.getPlayerByUid(desk.bankUid);
        if (!player) {
            desk.bankUid = 0;
            pomelo.app.get('channelService').pushMessageByUids("OnDeskUpdate", {bankUid: desk.bankUid}, desk.getOnlineSids());
        }
        //
        desk.gameStatus = gDef.GameStatus.Start;
        console.log(">>> [游戏开始] 房间:", desk.deskName, "模式:", desk.deskType, "参与玩家:", desk.uidArr);
        //cost fee
        var costDeskFee = function (cb) {
            var funcs = [];
            var costFunc = function (uid) {
                var cf = function (callback) {
                    var player = desk.getPlayerByUid(uid);
                    player.addScore(-desk.getDeskFee(), callback);
                    log.insert({cmd: "coin_tax", gameType: gameType, uid: player.uid, deskName: desk.deskName, coin: desk.getDeskFee()});
                }
                return cf;
            }

            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                funcs.push(costFunc(uid));
            }

            async.parallel(funcs, function (err, results) {

                if (!!err) {
                    return cb(err);
                }
                cb(null);
            })
        }

        var freezePlayerCoin = function (cb) {
            var funcs = [];
            var freezeFunc = function (uid) {
                var ff = function (callback) {
                    var player = desk.getPlayerByUid(uid);
                    pomelo.app.rpc.usersvr.userRemote.freezeAllCoin(null, {uid: uid}, function (err, res) {
                        if (!!err) {
                            //return callback(err);
                        }
                        callback(null);
                    })
                }
                return ff;
            }

            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                funcs.push(freezeFunc(uid));
            }

            async.parallel(funcs, function (err, results) {
                if (!!err) {
                    return cb(err);
                }
                cb(null);
            })
        }
        //final func
        var generateDeck = function (cb) {
            // pomelo.app.rpc.robotMaster.masterRemote.getGameDeck(null,{gameType:gameType,deskName:desk.deskName},function(err,result){
            //     if(result.isLuckDeck){
            //         desk.restoreDeck(result.rDeck);
            //         desk.deckMD5 = null;
            //     }else{
            //         desk.card = new card();
            //         var sDeck = serializeDeck(desk.card.card);
            //         desk.deckMD5 = crypto.createHash("md5").update(sDeck).digest("base64");
            //     }
            //     cb(null);
            // });
            desk.card = new card()
            cb(null)
        }

        var finalFunc = function (err, res) {
            if (!!err) {
                log.insert({cmd: gameType + "start_error", msg: err.message});
                desk.gameStatus = gDef.GameStatus.Ready;//恢复准备状态 可退出
            }

            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnGameStart', {
                playUids: desk.uidArr,
                gameStatus: desk.gameStatus,
                deskFee: -desk.getDeskFee()
            }, desk.getOnlineSids());
            for (var i = 0; i < desk.uidArr.length; i++) {
                var player = desk.getPlayerByUid(desk.uidArr[i]);
                pomelo.app.get('channelService').pushMessageByUids(gameType + "_updatePlayerCoin", {uid: player.uid, coin: player.score}, desk.getOnlineSids());
            }

            pomelo.app.rpc.robotMaster.masterRemote.onGameStart(null, {deskName: desk.deskName, gameType: gameType}, function (err, res) {
                if (!!err) {
                    console.log('notify robot start game failed', err.message);
                }
            });

            setTimeout(function () {
                desk.emit('next');
            }, 2000);

            log.insert({cmd: 'coin_niuniu_startGame', playUids: desk.uidArr});
            desk.nextTask();
        }

        async.waterfall([costDeskFee, freezePlayerCoin, generateDeck], finalFunc);
    });
    // 结束一局
    desk.notifyRobotGameEnd = function (award) {
        var self = desk;
        award.sort(function (obj1, obj2) {
            return obj2.score - obj1.score;
        })

        var rDeck = [];

        //人满才记录
        if (award.length != 5) {
            self.deckMD5 = null;
        }

        for (var i = 0; i < award.length && !!self.deckMD5; i++) {
            var player = self.getPlayerByUid(award[i].uid);
            rDeck.push(serializeDeck(player.cards));
        }

        pomelo.app.rpc.robotMaster.masterRemote.onGameEnd(null, {
            deskName: desk.deskName,
            gameType: gameType,
            award: award,
            deckMD5: self.deckMD5,
            rDeck: rDeck
        }, function (err, res) {
            if (!!err) {
                console.log('notify robot game end failed', err.message);
            }
        })
    }


    desk.on('end', function (args) {
        if (desk.gameStatus != gDef.GameStatus.End) {
            desk.nextTask();
            return;
        }

        var res = [];
        var cardList = [];
        var endList = [];

        if (desk.deskType == gDef.GroupDeskType.TongBi) {
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                // 没有组牌  没牛处理
                if (!desk.calRes[uid]) {
                    var cards = player.getCards();
                    var cardRes = CardUtils.GetCardResult(cards);
                    desk.calRes[uid] = cardRes.cardType;
                    endList.push({uid: uid, card: player.getCards(), cardType: desk.calRes[uid]});
                }
                cardList.push({uid: uid, card: player.getCards(), cardType: desk.calRes[uid]});
            }
            var sort = CardUtils.sortCardByType(cardList);

            var times = desk.calRes[sort[0].uid].times;
            // 赢家赢所有
            for (var i = 0; i < sort.length; i++) {
                var uid = sort[i].uid;
                if (i == 0) {
                    res.push({uid: uid, score: times * (sort.length - 1) * baseScore});
                } else {
                    res.push({uid: uid, score: -times * baseScore});
                }
            }
        } else if (desk.deskType == gDef.GroupDeskType.Random) {
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                // 没有组牌  没牛处理
                if (!desk.calRes[uid]) {
                    var cards = player.getCards();
                    var cardRes = CardUtils.GetCardResult(cards);
                    desk.calRes[uid] = cardRes.cardType;
                }
                endList.push({uid: uid, card: player.getCards(), cardType: desk.calRes[uid]});
                //cardList.push({uid:uid, card:player.getCards(), cardType:desk.calRes[uid]});
            }

            endList.sort(function (a, b) {
                if (a.uid == desk.bankUid) {
                    return 1;
                }
                if (b.uid == desk.bankUid) {
                    return -1;
                }
                return a.cardType - b.cardType;

            });

            var bankWinScore = 0;

            var bankPlayer = desk.getPlayerByUid(desk.bankUid);

            var bankTimes = desk.calRes[desk.bankUid].times;

            // 跟庄家比较
            for (var uid in desk.calRes) {
                uid = Number(uid);
                if (uid != desk.bankUid) {
                    var player = desk.getPlayerByUid(uid);
                    // 闲家赢
                    var winScore = 0;
                    if (CardUtils.CompareCardByType({card: player.getCards(), cardType: desk.calRes[uid]}, {card: bankPlayer.getCards(), cardType: desk.calRes[desk.bankUid]})) {
                        winScore = desk.calRes[uid].times * baseScore * player.getPoint();
                    } else {
                        winScore = -bankTimes * baseScore * player.getPoint();
                    }
                    res.push({uid: uid, score: winScore});
                    bankWinScore -= winScore;
                }
            }
            res.push({uid: desk.bankUid, score: bankWinScore});

            // 没牛下庄
            if (desk.getZhuangType() == gDef.ZhuangType.NoCow) {
                if (desk.calRes[desk.bankUid].weight == gDef.PAI_XING.NoCow.weight) {
                    desk.bankUid = 0;
                }
            } else if (desk.getZhuangType() == gDef.ZhuangType.Lose) {
                if (bankWinScore < 0) {
                    desk.bankUid = 0;
                }
            } else if (desk.getZhuangType() == gDef.ZhuangType.Cow) {
                for (var uid in desk.calRes) {
                    if (desk.calRes[uid].weight >= gDef.PAI_XING.CowNiu.weight) {
                        desk.bankUid = 0;
                        break;
                    }
                }
            }
        } else if (desk.deskType == gDef.GroupDeskType.Card) {
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                // 没有组牌  没牛处理
                if (!desk.calRes[uid]) {
                    var cards = player.getCards();
                    var cardRes = CardUtils.GetCardResult(cards);
                    desk.calRes[uid] = cardRes.cardType;
                    if (cardRes.cardType == gDef.PAI_XING.CowFace) {
                        player.addUserDataCount('wuHuaNiuCount', 1);
                    } else if (cardRes.cardType == gDef.PAI_XING.CowBoom) {
                        player.addUserDataCount('zhaDanCount', 1);
                    } else if (cardRes.cardType == gDef.PAI_XING.CowBoom) {
                        player.addUserDataCount('wuXiaoNiuCount', 1);
                    } else if (cardRes.cardType == gDef.PAI_XING.CowNiu) {
                        player.addUserDataCount('niuNiuCount', 1);
                    }
                }
                //
                var finalCards = player.selectedCardList.concat([]);
                var handCards = player.getCards();
                for (var k in handCards) {
                    var isInFinal = false;
                    for (var j in player.selectedCardList) {
                        if (handCards[k] == player.selectedCardList[j]) {
                            isInFinal = true;
                            break;
                        }
                    }
                    if (!isInFinal) {
                        finalCards.push(handCards[k]);
                    }
                }
                endList.push({uid: uid, card: finalCards, cardType: desk.calRes[uid], selectedCardList: player.selectedCardList});
                cardList.push({uid: uid, card: finalCards, cardType: desk.calRes[uid], selectedCardList: player.selectedCardList});
            }

            endList.sort(function (a, b) {
                if (a.uid == desk.bankUid) {
                    return 1;
                }
                if (b.uid == desk.bankUid) {
                    return -1;
                }
                return a.cardType - b.cardType;

            });

            var bankWinScore = 0;
            var bankLoseScore = 0;

            var bankPlayer = desk.getPlayerByUid(desk.bankUid);

            var loseCoinArr = [];
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
                    var tmpCoin = player.score;
                    // 闲家赢
                    var winScore = 0;
                    if (CardUtils.CompareCardByType({card: player.getCards(), cardType: desk.calRes[uid]}, {card: bankPlayer.getCards(), cardType: desk.calRes[desk.bankUid]})) {

                        winScore = desk.calRes[uid].times * desk.bankPoint * player.getPoint() * baseScore;
                        bankLoseScore += winScore;
                        loseCoinArr.push({uid: uid, score: winScore});
                    } else {
                        // 闲家可以确定输多少
                        winScore = desk.calRes[desk.bankUid].times * desk.bankPoint * player.getPoint() * baseScore;
                        if (winScore > tmpCoin) {
                            winScore = tmpCoin;
                        }
                        bankWinScore += winScore;
                        res.push({uid: uid, score: -winScore});
                    }

                    if (winScore > 0) {
                        bTongSha = false;
                    } else {
                        bTongPei = false;
                    }
                    if (winScore == 0) {
                        console.log("bank:", desk.bankUid, bankPlayer.getCards(), "player:", uid, player.getCards(), desk.calRes[uid], "point", player.getPoint());
                    }
                }
            }

            if (bTongSha) {
                bankPlayer.addUserDataCount('tongShaCount', 1);
            }
            if (bTongPei) {
                bankPlayer.addUserDataCount('tongPeiCount', 1);
            }

            var bankCoin = bankPlayer.score;

            // 金币不够输
            if (bankLoseScore > bankCoin) {
                for (var i = 0; i < loseCoinArr.length; i++) {
                    loseCoinArr[i].score = Math.floor(loseCoinArr[i].score * bankCoin / bankLoseScore);
                }
                bankLoseScore = bankCoin;
            }
            res = res.concat(loseCoinArr);
            bankWinScore -= bankLoseScore;

            res.push({uid: desk.bankUid, score: bankWinScore});

            desk.bankUid = 0;
            //robot#5 通知机器人游戏结束
            desk.notifyRobotGameEnd(res);
        } else if (desk.deskType == gDef.GroupDeskType.SequenceBank) {
            for (var i = 0; i < desk.uidArr.length; i++) {
                var uid = desk.uidArr[i];
                var player = desk.getPlayerByUid(uid);
                // 没有组牌  没牛处理
                if (!desk.calRes[uid]) {
                    var cards = player.getCards();
                    var cardRes = CardUtils.GetCardResult(cards);
                    desk.calRes[uid] = cardRes.cardType;
                    endList.push({uid: uid, card: player.getCards(), cardType: desk.calRes[uid]});
                }
                cardList.push({uid: uid, card: player.getCards(), cardType: desk.calRes[uid]});
            }

            var bankWinScore = 0;

            var bankPlayer = desk.getPlayerByUid(desk.bankUid);

            var bankTimes = desk.calRes[desk.bankUid].times;

            // 跟庄家比较
            for (var uid in desk.calRes) {
                uid = Number(uid);
                if (uid != desk.bankUid) {
                    var player = desk.getPlayerByUid(uid);
                    // 闲家赢
                    var winScore = 0;
                    if (CardUtils.CompareCardByType({card: player.getCards(), cardType: desk.calRes[uid]}, {card: bankPlayer.getCards(), cardType: desk.calRes[desk.bankUid]})) {
                        winScore = desk.calRes[uid].times * baseScore * player.getPoint();
                    } else {
                        winScore = -bankTimes * baseScore * player.getPoint();
                    }
                    res.push({uid: uid, score: winScore});
                    bankWinScore -= winScore;
                }
            }
            res.push({uid: desk.bankUid, score: bankWinScore});

            desk.lastBankPos = desk.getPosByUid(desk.bankUid);

            // 没牛下庄
            if (desk.getZhuangType() == gDef.ZhuangType.NoCow) {
                if (desk.calRes[desk.bankUid].weight == gDef.PAI_XING.NoCow.weight) {
                    desk.bankUid = 0;
                }
            } else if (desk.getZhuangType() == gDef.ZhuangType.Lose) {
                if (bankWinScore < 0) {
                    desk.bankUid = 0;
                }
            } else if (desk.getZhuangType() == gDef.ZhuangType.Cow) {
                for (var uid in desk.calRes) {
                    if (desk.calRes[uid].weight >= gDef.PAI_XING.CowNiu.weight) {
                        desk.bankUid = 0;
                        break;
                    }
                }
            } else if (desk.getZhuangType() == gDef.ZhuangType.Sequence) {
                desk.bankUid = 0;
            } else if (desk.getZhuangType() == gDef.ZhuangType.Force) {
                var player = desk.getPlayerByUid(desk.bankUid);
                if (player.getPlayStatus() == gDef.PlayStatus.out) {
                    desk.isEnd = true;
                }
            }
        }

        for (var i = 0; i < desk.uidArr.length; i++) {
            var uid = desk.uidArr[i];
            var player = desk.getPlayerByUid(uid);
            player.flushMaxCard(player.getCards());
            // if (player.getAutoOperateCount() >= trustteeCount) {
            //player.setTrusttee(true);
            //pomelo.app.get('channelService').pushMessageByUids(gameType+'_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
            //}
        }

        var winfee = 0;
        var totalLoseScore = 0;
        for (var i = 0; i < res.length; i++) {
            var player = desk.getPlayerByUid(res[i].uid);
            //pomelo.app.rpc.usersvr.userRemote.addGameCount(res[i].uid, {uid:res[i].uid, gameType:gameType, isWin:res[i].score > 0}, function(){});
            if (res[i].score > 0) {
                player.addUserDataCount('winCount', 1); // 统一记录赢局
                res[i].acScore = Math.min(res[i].score, player.score);//不能以小博大
                log.insert({cmd: "coin_win", gameType: gameType, deskName: desk.deskName, coin: res[i].acScore, uid: res[i].uid});
            } else if (res[i].score < 0) {
                player.addUserDataCount('loseCount', 1); // 统一记录输局
                res[i].acScore = -Math.min(Math.abs(res[i].score), player.score);//不够扣
                log.insert({cmd: "coin_lose", gameType: gameType, deskName: desk.deskName, coin: res[i].acScore, uid: res[i].uid});
            }
        }

        var unfreezePlayerCoin = function (cb) {
            var funcs = [];
            desk.players.forEach(function (p) {
                var func = function (callback) {
                    pomelo.app.rpc.usersvr.userRemote.unfreezeCoin(null, {
                        uid: p.uid
                    }, function (err, user) {
                        callback(null);
                    })
                }
                funcs.push(func);
            })
            async.parallel(funcs, function (err, res) {
                if (!!err) {
                    return cb(err);
                }
                cb(null);
            })
        }

        var costScore = function (cb) {
            var funcs = []
            res.forEach(function (item) {
                var uid = item.uid;
                var score = item.acScore;
                var player = desk.getPlayerByUid(uid);
                var func = function (callback) {
                    console.log(">>> [结算] UID:", player.uid, "分数变动:", score, "当前余额:", player.score + score);
                    player.flushWinScore(score);
                    player.addScore(score, callback);
                }
                funcs.push(func);
            })

            async.parallel(funcs, function (err, res) {
                if (!!err) {
                    return cb(err);
                }
                cb(null);
            })
        }

        var finalFunc = function (err, results) {
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnGameEnd', {
                    award: res,
                    cardList: endList,
                    bankUid: desk.bankUid
                },
                desk.getOnlineSids());
            log.insert({cmd: "niuniu_endGame", deskName: desk.deskName, res: res, cardList: endList, bankUid: desk.bankUid})
            desk.reset();
            // 踢掉 钱不够 托管 玩家
            desk.endTimer = setTimeout(function () {
                for (var i = 0; i < desk.maxPlayer; i++) {
                    var player = desk.players[i];
                    if (player) {
                        if (player.offlineFlag) {
                            var msg = "由于您掉线，即将退出房间！";
                            log.insert({cmd: "niuniu_kick", deskName: desk.deskName, uid: player.uid, code: 3})
                            desk.emit('exit', {uid: player.uid, msg: msg});
                        } else if (player.score < desk.getMinCoin()) {
                            var msg = "你的金币不足，即将退出房间！";
                            log.insert({cmd: "niuniu_kick", deskName: desk.deskName, uid: player.uid, code: 1})
                            desk.emit('exit', {uid: player.uid, msg: msg});
                        }
                    }
                }
                clearTimeout(desk.endTimer)
                desk.endTimer = null
            }, 5500)

            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player) {
                    if (player.isTrusttee() && player.score >= desk.getMinCoin()) {
                        player.setPlayStatus(gDef.PlayStatus.ready);
                    } else {
                        player.setPlayStatus(gDef.PlayStatus.watch);
                        player.startReadyCount(desk);
                    }
                }
            }
            desk.gameStatus = gDef.GameStatus.Ready;
            //desk.timeOutKick();

            if (desk.canStart()) {
                setTimeout(function () {
                    desk.emit('start');
                }, 100);
            }
            log.insert({cmd: "coin_niuniu_endGame", res: res, calRes: desk.calRes});
            desk.nextTask();
        }
        async.waterfall([unfreezePlayerCoin, costScore], finalFunc);
    });
    // 下一轮
    desk.on('next', function (args) {
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
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                        uid: uid,
                        cards: cards,
                        gameStatus: desk.gameStatus
                    }, desk.getSid(uid));
                    console.log(">>> [发牌] UID:", uid, "手牌:", CardUtils.formatCards(cards));
                    playerCards[uid] = cards;
                }
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    gameStatus: desk.gameStatus
                }, desk.getWatcherUids());

                desk.gameStatus = gDef.GameStatus.CalCard;
                log.insert({cmd: "coin_niuniu_pushCard", cards: playerCards});
                desk.autoNext(calCardTimeOut + cardTimeOut * desk.uidArr.length);
            }
            // 结束
            else if (desk.gameStatus == gDef.GameStatus.CalCard) {
                desk.gameStatus = gDef.GameStatus.End;
                setTimeout(function () {
                    desk.emit('end');
                }, endTimeOut);
            }
        } else if (desk.deskType == gDef.GroupDeskType.Random) {
            if (desk.gameStatus == gDef.GameStatus.Start) {
                // 抢庄
                if (!desk.bankUid) {
                    desk.bankUid = 0;
                    desk.gameStatus = gDef.GameStatus.Bank;
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                        gameStatus: desk.gameStatus
                    }, desk.getOnlineSids());
                    desk.autoNext(callTimeOut);
                }
                // 闲家加注
                else {
                    desk.gameStatus = gDef.GameStatus.Point;
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                        gameStatus: desk.gameStatus
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
                            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnCall', {
                                uid: uid,
                                point: 0
                            }, desk.getOnlineSids());
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }
                log.insert({cmd: "coin_niuniu_callBank", points: playerPoint});

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
                        } else if (point == desk.bankPoint) {
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

                var index = Math.floor(Math.random() * maxUids.length);
                desk.bankUid = maxUids[index];

                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    bankUid: desk.bankUid,
                    bankPoint: desk.bankPoint,
                    gameStatus: desk.gameStatus
                }, desk.getOnlineSids());
                if (maxUids.length > 1) {
                    desk.timer = setTimeout(function () {
                        desk.emit('next');
                    }, showBankTimeOut);
                } else {
                    desk.timer = setTimeout(function () {
                        desk.emit('next');
                    }, 1500);
                }
            }
            // 闲家加注
            else if (desk.gameStatus == gDef.GameStatus.ShowBank) {
                desk.gameStatus = gDef.GameStatus.Point;
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    gameStatus: desk.gameStatus
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
                            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnCall', {
                                uid: uid,
                                point: 1
                            }, desk.getOnlineSids());
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }
                log.insert({cmd: "coin_niuniu_addPoint", points: playerPoint, bankPoint: desk.bankPoint});

                desk.gameStatus = gDef.GameStatus.Card;
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(5);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                        uid: uid,
                        cards: cards,
                        gameStatus: desk.gameStatus
                    }, desk.getSid(uid));
                    console.log(">>> [发牌] UID:", uid, "手牌:", CardUtils.formatCards(cards));
                }
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    gameStatus: desk.gameStatus
                }, desk.getWatcherUids());
                desk.gameStatus = gDef.GameStatus.CalCard;
                desk.autoNext(calCardTimeOut + cardTimeOut * desk.uidArr.length);
            }
            // 游戏结束
            else if (desk.gameStatus == gDef.GameStatus.CalCard) {
                desk.gameStatus = gDef.GameStatus.End;
                setTimeout(function () {
                    desk.emit('end');
                }, endTimeOut);
            }
        } else if (desk.deskType == gDef.GroupDeskType.Card) {
            // 发牌 然后 抢庄
            if (desk.gameStatus == gDef.GameStatus.Start) {
                desk.gameStatus = gDef.GameStatus.Card;
                var playerCards = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(4);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                        uid: uid,
                        cards: cards,
                        gameStatus: desk.gameStatus
                    }, desk.getSid(uid));
                    console.log(">>> [发牌-4张] UID:", uid, "手牌:", CardUtils.formatCards(cards));
                    playerCards[uid] = cards;
                }
                log.insert({cmd: "niuniu_pushCard", cards: playerCards, deskId: desk.deskId});
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    gameStatus: desk.gameStatus
                }, desk.getWatcherUids());
                desk.gameStatus = gDef.GameStatus.Bank;
                desk.autoNext(callTimeOut + cardTimeOut * desk.uidArr.length);
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
                            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnCall', {
                                uid: uid,
                                point: 0
                            }, desk.getOnlineSids());
                            // 自动抢庄
                            player.addAutoOperateCount();
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }
                log.insert({cmd: "niuniu_callBank", points: playerPoint, deskId: desk.deskId});

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
                        } else if (point == desk.bankPoint) {
                            maxUids.push(uid);
                        }
                    }
                }
                var index = Math.floor(Math.random() * maxUids.length);
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

                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    bankUid: desk.bankUid,
                    bankPoint: desk.bankPoint,
                    gameStatus: desk.gameStatus
                }, desk.getOnlineSids());
                if (maxUids.length > 1) {
                    desk.timer = setTimeout(function () {
                        desk.emit('next');
                    }, showBankTimeOut);
                } else {
                    desk.timer = setTimeout(function () {
                        desk.emit('next');
                    }, 1500);
                }
            }
            // 闲家加注
            else if (desk.gameStatus == gDef.GameStatus.ShowBank) {
                desk.gameStatus = gDef.GameStatus.Point;
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    gameStatus: desk.gameStatus
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
                            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnCall', {
                                uid: uid,
                                point: 1
                            }, desk.getOnlineSids());
                            // 自动叫分
                            player.addAutoOperateCount();
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }

                log.insert({cmd: "niuniu_addPoint", points: playerPoint, bankPoint: desk.bankPoint, deskId: desk.deskId});

                desk.gameStatus = gDef.GameStatus.LeftCard;
                var leftCards = {};
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(1);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                        uid: uid,
                        cards: cards,
                        gameStatus: desk.gameStatus
                    }, desk.getSid(uid));
                    console.log(">>> [发最后一张牌] UID:", uid, "牌面:", CardUtils.formatCard(cards[0]));
                    leftCards[uid] = cards;
                }
                log.insert({cmd: "niuniu_pushCard", cards: leftCards, deskId: desk.deskId});
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    gameStatus: desk.gameStatus
                }, desk.getWatcherUids());

                desk.gameStatus = gDef.GameStatus.CalCard;
                //desk.pushTask('next');
                desk.autoNext(calCardTimeOut);
            } else if (desk.gameStatus == gDef.GameStatus.CalCard) {
                desk.gameStatus = gDef.GameStatus.End;
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    if (!player.isTrusttee() && !player.hasCalCards()) {
                        player.setTrusttee(true);
                        pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
                    }
                }
                setTimeout(function () {
                    desk.emit('end');
                }, endTimeOut);
            }
        } else if (desk.deskType == gDef.GroupDeskType.SequenceBank) {
            if (desk.gameStatus == gDef.GameStatus.Start) {
                if (desk.getZhuangType() != gDef.ZhuangType.Force) {
                    if (!desk.bankUid) {
                        if (desk.lastBankPos != undefined) {
                            var pos = desk.nextPos(desk.lastBankPos);
                            desk.bankUid = desk.players[pos].getUid();
                        } else {
                            desk.bankUid = desk.createUid;
                        }
                    }
                } else {
                    desk.bankUid = desk.createUid;
                }
                // 显示 庄家
                desk.gameStatus = gDef.GameStatus.ShowBank;
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
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
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    gameStatus: desk.gameStatus
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
                            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnCall', {
                                uid: uid,
                                point: 1
                            }, desk.getOnlineSids());
                        }
                        playerPoint[uid] = player.getPoint();
                    }
                }
                log.insert({cmd: "coin_niuniu_addPoint", points: playerPoint, bankPoint: desk.bankPoint});

                desk.gameStatus = gDef.GameStatus.Card;
                for (var i = 0; i < desk.uidArr.length; i++) {
                    var uid = desk.uidArr[i];
                    var player = desk.getPlayerByUid(uid);
                    var cards = desk.card.getCard(5);
                    player.addCard(cards);
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                        uid: uid,
                        cards: cards,
                        gameStatus: desk.gameStatus
                    }, desk.getSid(uid));
                    console.log(">>> [发牌] UID:", uid, "手牌:", CardUtils.formatCards(cards));
                }
                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnNewStep', {
                    gameStatus: desk.gameStatus
                }, desk.getWatcherUids());
                desk.gameStatus = gDef.GameStatus.CalCard;
                desk.autoNext(calCardTimeOut + cardTimeOut * desk.uidArr.length);
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
            if (!player.isTrusttee()) {
                if (player.getAutoOperateCount() >= trustteeCount) {
                    player.setTrusttee(true);
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
                }
            }
        }
        desk.opreatNum = 0;

        desk.nextTask();
    });
    // 有人断线
    desk.on('offline', function (args) {
        var uid = args.uid;
        if (desk.watcher[uid]) {
            desk.pushTask('exit', {uid: uid});
        } else {
            var player = desk.getPlayerByUid(uid);
            if (player) {
                delete desk.sids[uid];
                console.log(">>> [玩家掉线] UID:", uid, "是否在局中:", desk.gameStatus != gDef.GameStatus.Ready);
                if (desk.gameStatus != gDef.GameStatus.Ready) {
                    player.setTrusttee(true);
                    player.setOfflineFlag(true);
                    log.insert({cmd: "niuniu_offline", deskName: desk.deskName, uid: uid, isInGame: true});
                    pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {uid: uid, bTrusttee: true}, desk.getOnlineSids());
                } else {
                    log.insert({cmd: "niuniu_offline", deskName: desk.deskName, uid: uid, isInGame: false});
                    desk.pushTask('exit', {uid: uid});
                }
                log.insert({cmd: "coin_niuniu_offline", uid: uid});
            }
        }
        desk.nextTask();
    });
    // 有人重连
    desk.on('reconnect', function (args) {
        var uid = args.uid;
        var player = desk.getPlayerByUid(uid);
        if (!player) {
            desk.nextTask();
            return;
        }
        player.setOfflineFlag(false);
        desk.sids[uid] = {uid: uid, sid: args.sid};

        player.setTrusttee(false);
        player.clearAutoOperateCount();

        // 通知所有人该玩家已取消托管
        pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {uid: uid, bTrusttee: false}, desk.getOnlineSids());

        if (desk.gameStatus >= gDef.GameStatus.Start && desk.gameStatus < gDef.GameStatus.End) {
            pomelo.app.rpc.usersvr.userRemote.freezeAllCoin(null, {uid: player.uid}, function (err, res) {
                if (!!err) {
                    console.log("reconnect ---->>> 冻结房费失败")
                }
            })
        }
        log.insert({cmd: "niuniu_reconnect", deskId: desk.deskId, uid: uid});
        desk.nextTask();
    });
    // 取消托管
    desk.on('canceltrusttee', function (args) {
        var uid = args.uid;
        var player = desk.getPlayerByUid(uid);
        if (player) {
            if (player.isTrusttee()) {
                player.setTrusttee(false);
                player.clearAutoOperateCount();

                pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {
                    uid: uid,
                    bTrusttee: false
                }, desk.getOnlineSids());
                log.insert({cmd: "coin_niuniu_canceltrusttee", deskId: desk.deskId, uid: uid});
            }
        }
        if (desk.getGameStatus() == gDef.GameStatus.Ready) {
            desk.pushTask('start');
        }
        desk.nextTask();
    });
    // 快捷发言
    desk.on('chat', function (args) {
        var uid = args.uid;
        var data = args.data;
        pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnChat', {
            uid: uid,
            data: data
        }, desk.getOnlineSids());
        desk.nextTask();
    });
    // 组牌
    desk.on('cal', function (args) {
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

        if (player.hasCalCards()) {
            desk.nextTask();
            return;
        }

        if (player.isTrusttee()) {
            player.setTrusttee(false);
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {uid: uid, bTrusttee: false}, desk.getOnlineSids());
        }
        player.clearAutoOperateCount();

        var cards = player.getCards();

        var res = CardUtils.GetCardResult(cards);

        // 上报的牌型错误
        if (args.hasCow && res.cardType == gDef.PAI_XING.NoCow) {
            desk.nextTask();
            return;
        }
        if (!args.hasCow) {
            desk.calRes[uid] = gDef.PAI_XING.NoCow;
        } else {
            desk.calRes[uid] = res.cardType;
        }

        player.calCard();
        var selectedCardList = !!args.selectedCardList ? args.selectedCardList : [];
        player.selectedCardList = selectedCardList;
        pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnCalCard', {uid: uid, card: cards, cardType: desk.calRes[uid]}, desk.getOnlineSids());

        console.log(">>> [玩家组牌] UID:", uid, "手牌:", CardUtils.formatCards(cards), "牌型权重:", desk.calRes[uid].weight);
        desk.opreatNum += 1;
        if (desk.opreatNum >= desk.uidArr.length) {
            desk.pushTask('next');
        }

        log.insert({cmd: "niuniu_out", deskId: desk.deskId, uid: uid, card: cards, cardType: res.cardType});
        desk.nextTask();
    });

    // 准备
    desk.on('ready', function (args) {
        if (gDef.GameStatus.Ready != desk.gameStatus) {
            desk.nextTask();
            return;
        }
        var player = desk.getPlayerByUid(args.uid);
        if (!player || player.getPlayStatus() == gDef.PlayStatus.ready) {
            desk.nextTask();
            return;
        }
        //钱不够了
        if (player.score < desk.minCoin) {
            desk.emit("exit", {uid: args.uid, msg: "金币不足，请先充值"});
            desk.nextTask();
            return;
        }

        console.log(">>> [玩家准备] UID:", args.uid);
        desk.clearTimer(args.uid);
        player.setPlayStatus(gDef.PlayStatus.ready);
        player.stopReadyCount();

        // 如果玩家手动准备，则必须清除托管状态
        if (player.isTrusttee()) {
            player.setTrusttee(false);
            player.clearAutoOperateCount();
            pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnTrusttee', {uid: args.uid, bTrusttee: false}, desk.getOnlineSids());
        }

        pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnReady', {
            uid: args.uid
        }, desk.getOnlineSids());


        if (desk.canStart()) {
            setTimeout(function () {
                desk.emit('start');
            }, 100);
        }
        desk.nextTask();
    });
    // 请求看牌
    desk.on('watchapply', function (args) {
        var player = desk.getPlayerByUid(args.uid);
        if (!player) {
            desk.nextTask();
            return;
        }
        var watcher = desk.watcher[args.watcherUid];
        if (!watcher) {
            desk.nextTask();
            return;
        }
        pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnWatchCard', {
            uid: args.uid
            // watcherUid: args.watcherUid,
            // nickName: watcher.nickName
        }, desk.getSid(args.uid));
        desk.nextTask();
    });
    // 看牌回应
    desk.on('watchanswer', function (args) {
        var player = desk.getPlayerByUid(args.uid);
        if (!player) {
            desk.nextTask();
            return;
        }
        var watcher = desk.watcher[args.watcherUid];
        if (!watcher) {
            desk.nextTask();
            return;
        }
        var data = {
            uid: args.watcherUid,
            targetUid: args.uid,
            isAgree: args.isAgree
        };
        if (args.isAgree) {
            watcher.watcherUid = args.uid;
            data.cards = player.getCards();
        } else {
            if (watcher.watcherUid) {
                delete watcher.watcherUid;
            }
        }
        pomelo.app.get('channelService').pushMessageByUids(gameType + '_OnWatchAnswer', data, desk.getSid(args.watcherUid));
        desk.nextTask();
    });
    desk.getMyWatcher = function (uid) {
        var player = desk.getPlayerByUid(uid);
        if (!player) {
            return [];
        }
        ;
        var watchers = [];
        for (var u in desk.watcher) {
            if (desk.watcher[u].pos == player.pos) {
                watchers.push({uid: u, isAgree: desk.watcher[u].watcherUid == uid, nickName: desk.watcher[u].nickName});
            }
        }
        return watchers;
    };

    desk.queryDeskInfo = function (args) {
        var uid = args.uid;
        var info = {};
        if (desk.gameStatus != gDef.GameStatus.Ready) {
            var points = desk.getPointInfo();
            var cards = desk.getPlayerCardsByUid(uid);
            var player = desk.getPlayerByUid(uid);
            var cal = [];
            for (var tmpUid in desk.calRes) {
                tmpUid = Number(tmpUid);
                var card = desk.getPlayerByUid(tmpUid).getCards();
                if (desk.gameStatus == gDef.GameStatus.End) {
                    cal.push({uid: tmpUid, cardType: desk.calRes[tmpUid], card: card, selectedCardList: player.selectedCardList});
                }
            }
            var data = {
                points: points,
                bankPoint: desk.bankPoint,
                bankUid: desk.bankUid,
                cards: cards,
                calRes: cal,
                playUids: desk.uidArr,
                gameStatus: desk.gameStatus
            };
            info.reconnectData = data;
        }
        info.playerInfo = desk.getPlayersInfo();
        info.deskInfo = desk.getDeskInfo();

        return info;
    };

    // desk.canKickPlayer = function(uid) {
    //     return (uid == desk.createUid && !desk.isStart);
    // };

    desk.nextTask = function () {
        if (desk.tasks.length > 0) {
            var task = desk.tasks.pop();
            desk.emit(task.event, task.args);
        }
    };

    desk.pushTask = function (event, args) {
        desk.tasks.push({event: event, args: args})
    };

    desk.getOnlineSids = function () {
        var res = [];
        // for (var i = 0; i < desk.maxPlayer; i++) {
        //     var player = desk.players[i];
        //     if (player) {
        //         if (desk.sids[player.getUid()]) {
        //             res.push(desk.sids[player.getUid()]);
        //         }
        //     }
        // }
        for (var uid in desk.sids) {
            res.push(desk.sids[uid]);
        }
        for (var u in desk.watcher) {
            res.push({uid: u, sid: desk.watcher[u].sid});
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
        for (var u in desk.watcher) {
            if (desk.watcher[u].watcherUid != myUid) {
                res.push({uid: u, sid: desk.watcher[u].sid});
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
        for (var u in desk.watcher) {
            if (!desk.watcher[u].watcherUid) {
                res.push({uid: u, sid: desk.watcher[u].sid});
            }
        }
        return res;
    };

    desk.getSid = function (uid) {
        if (desk.sids[uid]) {
            var res = [];
            res.push(desk.sids[uid]);
            for (var u in desk.watcher) {
                if (desk.watcher[u].watcherUid == uid) {
                    res.push({uid: u, sid: desk.watcher[u].sid});
                }
            }
            return res;
        } else {
            if (desk.watcher[uid]) {
                return [{uid: uid, sid: desk.watcher[uid].sid}];
            }
            return [];
        }
    };

    desk.canStart = function () {
        if (desk.gameStatus != gDef.GameStatus.Ready) {
            return false;
        }
        var count = 0;
        for (var i = 0; i < desk.maxPlayer; i++) {
            var player = desk.players[i];
            if (player) {
                if (player.getPlayStatus() == gDef.PlayStatus.ready) {
                    count++;
                }
            }
        }

        if (count == desk.playerNum && count >= 2) {
            return true;
        } else {
            return false;
        }
    };

    desk.canEnterDesk = function (user) {
        var player = desk.getPlayerByUid(user.uid);
        if (player) {
            return 0;
        }

        if (user.pos == undefined) {
            return 4;
        }
        var posSet = [1, 1, 1, 1, 1, 1];
        if (!posSet[user.pos]) {
            return 4;
        }

        if (desk.players[user.pos]) {
            return 5;
        }

        if (desk.maxPlayer <= desk.playerNum) {
            return 1;
        }
        var maxCoin = desk.getMaxCoin();
        var minCoin = desk.getMinCoin();

        if (user.coin > maxCoin) {
            return 2;
        }
        if (user.coin < minCoin) {
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

        for (var i = 0; i < desk.maxPlayer; i++) {
            if (!desk.players[i]) {
                return i;
            }
        }

        return -1;
    };

    desk.canSitDown = function (user) {
        var player = desk.getPlayerByUid(user.uid);
        if (player) {
            return 0;
        }

        if (user.pos != undefined) {
            if (desk.players[user.pos]) {
                return 4;
            }
        }

        if (desk.maxPlayer <= desk.playerNum) {
            return 1;
        }
        var maxCoin = desk.getMaxCoin();
        var minCoin = desk.getMinCoin();

        if (user.coin > maxCoin) {
            return 2;
        }
        if (user.coin < minCoin) {
            return 3;
        }
        return 0;
    };
    //TODO:后面根据需求开启超时踢人
    desk.timeOutKick = function (uid) {
        if (uid) {
            var player = desk.getPlayerByUid(uid);
            if (player) {
                desk.autoTimer[uid] = setTimeout(function (uid) {
                    var player = desk.getPlayerByUid(uid);
                    if (player && player.getPlayStatus() != gDef.PlayStatus.ready) {
                        desk.emit("exit", {uid: uid, msg: "坐下 由于您长时间未操作，即将退出房间！"});
                    }
                    delete desk.autoTimer[uid];
                }.bind(null, uid), 25000);
            }
        } else {
            for (var i = 0; i < desk.maxPlayer; i++) {
                var player = desk.players[i];
                if (player) {
                    var uid = player.getUid();
                    desk.autoTimer[uid] = setTimeout(function (uid) {
                        var player = desk.getPlayerByUid(uid);
                        if (player && player.getPlayStatus() != gDef.PlayStatus.ready) {
                            desk.emit("exit", {uid: uid, msg: "游戏结束 由于您长时间未操作，即将退出房间！"});
                        }
                        delete desk.autoTimer[uid];
                    }.bind(null, uid), 15000);
                }
            }
        }
    };

    desk.clearTimer = function (uid) {
        if (uid) {
            if (desk.autoTimer[uid]) {
                clearTimeout(desk.autoTimer[uid]);
                delete desk.autoTimer[uid];
            }
        } else {
            for (var u in desk.autoTimer) {
                if (desk.autoTimer[u]) {
                    clearTimeout(desk.autoTimer[u]);
                    delete desk.autoTimer[u];
                }
            }
        }
    }

    desk.autoNext = function (timeOut) {
        desk.timer = setTimeout(function () {
            desk.emit('next');
        }, timeOut);
    };

    desk.addWatcher = function (user) {
        desk.watcher[user.uid] = user;
    };
};
