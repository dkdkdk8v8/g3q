var logger = require('pomelo-logger').getLogger(__filename);
var processRecord = function(table,param){
    var message = {
        createdDateTime:Date.now().toString(),
        param:param
    }
    if(!!table.game){
        table.game.gameRecord.messageList.push(message);
    }
}

var gameType = "coinDDZ";
var tableEvent = function(app,table,channel) {
    var pushMessage = function(route, msg ,players){
        var uids = []
        for(var sid in channel.groups) {
            var group = channel.groups[sid];
            for(var i=0, l=group.length; i<l; i++) {
                var some = players.some(function(player){
                   return player.uid == group[i];
                });
                if(some){
                    uids.push({
                        sid:sid,
                        uid:group[i]
                    });
                }
            }
        }
        app.get('channelService').pushMessageByUids(route, msg, uids);
    }
    table.on("ddz_onTableSitDown",function(player,chairNo){
        logger.info("ddz_onTableSitDown,desk:",table.tableNo);
        var param = {
            route:  gameType + '_onTableSitDown',
            uid: player.uid,
            deskName:table.tableNo,
            chairNo:chairNo,
        }
        channel.pushMessage(param);

    });
    table.on("ddz_onTableStandUp",function(player,chairNo){
        logger.info("ddz_onTableStandUp,desk:",table.tableNo);
        var param = {
            uid: player.uid,
            chairNo:chairNo,
            deskName:table.tableNo,
            route:gameType + '_onTableStandUp'
        }
        channel.pushMessage(param);
    });
    table.on("ddz_onApplyDrop",function(player){
        logger.info("ddz_onApplyDrop,desk:",table.tableNo);
        var param = {
            route: gameType + '_onApplyDrop',
            uid:player.uid,
            deskName:table.tableNo
        };
        var sitPlayers = table.players.filter(function(p){
            return !!p.chairNo;
        });
        pushMessage(param.route,param,sitPlayers);
        //channel.pushMessage(param);
    });
    table.on("ddz_onAnswerDrop",function(player,agree){
        logger.info("ddz_onAnswerDrop,desk:",table.tableNo,'agree:',agree);
        var param = {
            route: gameType + '_onAnswerDrop',
            uid:player.uid,
            deskName:table.tableNo,
            agree:agree
        };
        var sitPlayers = table.players.filter(function(p){
            return !!p.chairNo;
        });
        pushMessage(param.route,param,sitPlayers);
        //channel.pushMessage(param);
    });
    table.on("ddz_onDropTable",function(player){
        logger.info("ddz_onDropTable,desk:",table.tableNo,"playerID:",player.uid);
        var param = {
            route: gameType + '_onDropTable',
            uid:player.uid,
            deskName:table.tableNo
        };
        channel.pushMessage(param);
        //在ddz_onTableStop中调用
        //table.players.forEach(function(player){
        //    app.rpc.usersvr.userRemote.leaveGame(player.playerID, {uid:player.playerID, gameType:"coinDDZ", deskName:table.tableNo}, function(){});
        //});
    });
    table.on("ddz_onDealHandCards",function(player){
        logger.info("ddz_onDealHandCards,desk:",table.tableNo,"dealHandCards:",player.uid);
        var cards = [];
        player.handCards.list.forEach(function(card){
            cards.push({value:card.value,type:card.type,marked:card.isMarked()})
        });
        var param = {
            cards:cards,
            route: gameType + '_onDealHandCards',
            deskName:table.tableNo,
            uid:player.uid
        };
        var uid = player.uid;
        var member = channel.getMember(uid);
        if(!member){
            return ;
        }
        var sid = member['sid'];
        var channelService = app.get('channelService');
        channelService.pushMessageByUids(gameType + "_onDealHandCards", param, [{
            uid: uid,
            sid: sid
        }]);
        // channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onDealDeck",function(index,card,uid){
        logger.info("ddz_onDealDeck,desk:",table.tableNo,"cardIndex:",index,"card",card);
        var card = {value:card.value,type:card.type,marked:card.isMarked()};
        var param = {
            card:card,
            index:index,
            route: gameType + '_onDealDeck',
            uid:uid,
            deskName:table.tableNo
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    // table.on("ddz_onMarkedCardOut",function(player,outMarkedCards){
    //     logger.info("ddz_onMarkedCardOut,desk:",table.tableNo,"uid:",player.uid);
    //     var cards = [];
    //     outMarkedCards.forEach(function (card) {
    //         var o = {value:card.value,type:card.type,marked:card.isMarked()}
    //         cards.push(o);
    //     })
    //     var param = {
    //         uid:player.uid,
    //         cards:cards,
    //         route: gameType + '_onDealDeck',
    //         deskName:table.tableNo
    //     };
    //     channel.pushMessage(param);
    //     processRecord(table,param);
    // });
    table.on("ddz_onRob",function(player){
        logger.info("ddz_onRob,desk:",table.tableNo,"rob:",player.uid);
        var param = {
            route: gameType + '_onRob',
            deskName:table.tableNo,
            uid:player.uid,
            rate:table.game.rate
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onPass",function(player){
        logger.info("ddz_onPass,desk:",table.tableNo,"ddz_onPass:",player.uid);
        var param = {
            route: gameType + '_onPass',
            deskName:table.tableNo,
            uid:player.uid,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onPassCall",function(player){
        logger.info("ddz_onPassCall,desk:",table.tableNo,"passCall:",player.uid);
        var param = {
            route: gameType + '_onPassCall',
            uid:player.uid,
            deskName:table.tableNo,
            isRob:(table.playMethod == 2 && table.game.callFraction >= 3)?1:0
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onCall",function(player){
        logger.info("ddz_onCall,desk:",table.tableNo,"call");
        var param = {
            route: gameType + '_onCall',
            rate:table.game.rate,
            deskName:table.tableNo,
            uid:player.uid,
            rate:this.game.rate,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onStartPlay",function(){
        logger.info("ddz_onStartPlay,desk:",table.tableNo,"startPlay");
        var param = {
            route: gameType + '_onStartPlay',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onStopPlay",function(){
        logger.info("ddz_onStopPlay,desk:",table.tableNo,"stopPlay");
        var param = {
            route: gameType + '_onStopPlay',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onOut",function(player,outCards,outType){
        logger.info("ddz_onOut,desk:",table.tableNo,"out:",player.uid);
        var cards = [];
        outCards.forEach(function(card){
            cards.push({value:card.value,type:card.type,marked:card.isMarked()})
        });
        var param = {
            route: gameType + '_onOut',
            cards:cards,
            deskName:table.tableNo,
            outType:outType,
            uid:player.uid,
            rate:this.game.rate
        };
        channel.pushMessage(param);
        processRecord(table,param);

        // var uids = []
        // for(var sid in channel.groups) {
        //     var group = channel.groups[sid];
        //     for(i=0, l=group.length; i<l; i++) {
        //         if(group[i] != player.playerID){
        //             uids.push({
        //                 sid:sid,
        //                 uid:group[i]
        //             });
        //         }
        //     }
        // }
        // var channelService = app.get('channelService');
        // channelService.pushMessageByUids('ddz_onOut', param, uids);
        // processRecord(table,param);
    });
    table.on("ddz_onTurnToCaller",function(player,o){
        logger.info("ddz_onTurnToCaller,desk:",table.tableNo,"turnToCaller:",player.uid);
        var param = {
            route: gameType + '_onTurnToCaller',
            playMethod:o.playMethod,
            deskName:table.tableNo,
            callFraction:o.callFraction,
            allowRob:o.allowRob?1:0,
            uid:player.uid,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onDealThreeCards",function(board){
        logger.info("ddz_onDealThreeCards,desk:",table.tableNo);
        var cards = [];
        board.forEach(function(card){
            cards.push({value:card.value,type:card.type,marked:card.isMarked()})
        });
        var param = {
            route: gameType + '_onDealThreeCards',
            deskName:table.tableNo,
            cards:cards,
            rate:this.game.rate
        };
        //console.log('ddz_onDealThreeCards:',channel)
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onLandLord",function(player){
        logger.info("ddz_onLandLord,desk:",table.tableNo,"landLord:",player.uid);
        var param = {
            route: gameType + '_onLandLord',
            deskName:table.tableNo,
            uid:player.uid,
            rate:table.game.rate
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onStopCall",function(player){
        logger.info("ddz_onStopCall,desk:",table.tableNo);
        var param = {
            route: gameType + '_onStopCall',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onStartCall",function(player){
        logger.info("ddz_onStartCall,desk:",table.tableNo);
        var param = {
            route: gameType + '_onStartCall',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onOperateCode",function(player,operateCode,waitTime){
        logger.info("ddz_onOperateCode,desk:",table.tableNo,"operateCode:",operateCode,'playerID:',player.uid);
        var param = {
            route: gameType + '_onOperateCode',
            type:operateCode.type,
            uid:player.uid,
            deskName:table.tableNo,
            waitTime:waitTime,
            previousPlayerID:operateCode.previousPlayerID
        };
        if(!!param.call){
            param.callValue = operateCode.callValue;
        }
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onStartGame",function(){
        logger.info("ddz_onStartGame,desk:",table.tableNo);
        var param = {
            route: gameType + '_onStartGame',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onStopGame",function(){
        logger.info("ddz_onStopGame,desk:",table.tableNo);
        var param = {
            route: gameType + '_onStopGame',
            deskName:table.tableNo,
           // gameRecordID:table.gameRecordID
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onResult",function(playerList,isSpring){
        logger.info("ddz_onResult,desk:",table.tableNo);
        var param = {
            route: "coinDDZ_onResult",
            deskName:table.tableNo,
            playerList:playerList,
            isSpring:isSpring
        };

        channel.pushMessage(param);
        table.game.players.forEach(function(player){
            app.rpc.usersvr.userRemote.refreshUserData(player.uid,{uid:player.uid,gameType:'coinDDZ'},
                [{key:"totalCount",deltaValue:1},
                    {key:"winCount",deltaValue:player.score > 0?1:0 }],
                function(err){
                    if(err){
                        console.log("ddz_onResult refreshUserData err:",err)
                    }
                });
                //table stop
                var arr = [
                    { key: "playCount", deltaValue: 1},
                    { key: "dzWinCount", deltaValue: player.dzWinNumber},
                    { key: "nmWinCount", deltaValue: player.nmWinNumber},
                    { key: "chunTianCount", deltaValue: player.springNumber},
                    { key: "rocketCount", deltaValue: player.rocketNumber},
                    { key: "bombCount", deltaValue: player.bombNumber},
                    { key: "totalScore", deltaValue: player.score}
                ];
                if(player.score > player.maxWinScore){
                    arr.push({ key: "maxWinScore", value: player.score});
                    arr.push({ key: "maxWinTime", value: new Date().getTime()/1000});
                }
                if(player.score < player.maxLoseScore){
                    arr.push({ key: "maxLoseScore", value: player.score});
                }
                app.rpc.usersvr.userRemote.refreshUserData(player.uid, {
                    uid: player.uid,
                    gameType: 'coinDDZ'
                }, arr, function (err) {
                    if (err) {
                        console.log("ddz_onTableStop refreshUserData err:", err)
                    }
                });
        });
        processRecord(table,param);
    });
    table.on("ddz_onTableStart",function(){
        logger.info("ddz_onTableStart,desk:",table.tableNo);
        var param = {
            route: gameType + '_onTableStart',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onPlayerReady",function(player){
        logger.info("ddz_onPlayerReady,desk:",table.tableNo);
        var param = {
            route: gameType + '_onPlayerReady',
            deskName:table.tableNo,
            uid:player.uid
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onTableStop",function(playerList){
        logger.info("ddz_onTableStop,desk:",table.tableNo);
        var param = {
            route: gameType + '_onTableStop',
            deskName:table.tableNo,
            playerList:playerList
        };
        channel.pushMessage(param);
        if(!!table.game) {
            table.game.players.forEach(function (player) {
                var arr = [
                    { key: "playCount", deltaValue: 1},
                    { key: "dzWinCount", deltaValue: player.dzWinNumber},
                    { key: "nmWinCount", deltaValue: player.nmWinNumber},
                    { key: "chunTianCount", deltaValue: player.springNumber},
                    { key: "rocketCount", deltaValue: player.rocketNumber},
                    { key: "bombCount", deltaValue: player.bombNumber},
                    { key: "totalScore", deltaValue: player.totalScore}
                ];
                if(player.totalScore > player.maxWinScore){
                    arr.push({ key: "maxWinScore", value: player.totalScore});
                    arr.push({ key: "maxWinTime", value: new Date().getTime()/1000});
                }
                if(player.totalScore < player.maxLoseScore){
                    arr.push({ key: "maxLoseScore", value: player.totalScore});
                }
                app.rpc.usersvr.userRemote.refreshUserData(player.uid, {
                    uid: player.uid,
                    gameType: 'coinDDZ'
                }, arr, function (err) {
                    if (err) {
                        console.log("ddz_onTableStop refreshUserData err:", err)
                    }
                });
            });
        }
        table.players.forEach(function(player){
            app.rpc.usersvr.userRemote.leaveGame(player.uid, {uid:player.uid, gameType:"coinDDZ", deskName:table.tableNo}, function(){});
        });

        var now = Math.round(new Date().getTime() / 1000);
        if (table.isReplace && table.isStart) {
            var DDZHistory = app.get('models').gameDDZReplaceHistory;
            DDZHistory.create({uid: table.creatorID, deskId: table.tableID, endTime: now});
        }

        channel.destroy();
        table.clear();
        app.get("tableService").remove(table.tableNo);
        //回收桌号
        app.rpc.desknamesvr.deskNameRemote.recycleDeskName(null, {
            deskName:table.tableNo,
            isDissolution:!table.isStart
        }, function () {});

    });
    table.on("ddz_onReconnect",function(player){
        logger.info("ddz_onReconnect,desk:",table.tableNo);
        var param = {
            route: gameType + '_onReconnect',
            deskName:table.tableNo,
            uid: player.uid
        };
        channel.pushMessage(param);
    });
    // table.on("ddz_onAddTable",function(player){
    //     logger.info("ddz_onAddTable,desk:",table.tableNo);
    //     var param = {
    //         route: gameType + '_onAddTable',
    //         deskName:table.tableNo,
    //         uid: player.uid
    //     };
    //     channel.pushMessage(param);
    // });
    table.on("ddz_onExitTable",function(player){
        logger.info("ddz_onExitTable,desk:",table.tableNo);
        var param = {
            route: gameType + '_onExitTable',
            deskName:table.tableNo,
            uid: player.uid
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onKickPlayer",function(player,reason){
        logger.info("ddz_onKickPlayer,desk:",table.tableNo);
        var param = {
            route: gameType +'_onKickPlayer',
            deskName:table.tableNo,
            uid: player.uid,
            reason:reason
        };
        channel.pushMessage(param);
        //remove from channel
        var member = channel.getMember(player.uid);
        if(!! member){
            channel.leave(player.uid.toString(),member.sid);
        }
        app.rpc.usersvr.userRemote.leaveGame(player.uid, {uid:player.uid, gameType:gameType, deskName:table.tableNo}, function(){});
    });

    table.on("ddz_onGameStopQuit",function(player){
        table.remove(player.uid);
        var member = channel.getMember(player.uid);
        if(!! member){
            channel.leave(player.uid.toString(),member.sid);
        }
        app.rpc.usersvr.userRemote.leaveGame(player.uid, {uid:player.uid, gameType:gameType, deskName:table.tableNo}, function(){});
    })
    
    table.on("ddz_OnPlayWile",function(msg){
        var param = {
            uid:msg.uid,
            fid:msg.fid,
            wid:msg.wid
        }
        channel.pushMessage(gameType+'_OnPlayWile',param);
    });
    table.on("ddz_onTrust",function(player){
        var param = {
            route: gameType+'_onTrust',
            deskName:table.tableNo,
            uid:player.uid,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });

    table.on("ddz_onCancelTrust",function(player){
        var param = {
            route: gameType+'_onCancelTrust',
            deskName:table.tableNo,
            uid:player.uid,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    //旁观
    table.on("ddz_onWatchCard",function(player){
        var member = channel.getMember(player.uid);
        if(! member){
            return;
        }
        var sid = member["sid"];
        var channelService = app.get("channelService");
        channelService.pushMessageByUids(gameType + "_OnWatchCard",{uid:player.uid},[{
            uid: player.uid,
            sid: sid
        }]);
    })
    table.on("ddz_onWatchAnswer", function(uid, data) {
        var member = channel.getMember(uid);
        if(!member){
            return ;
        }
        var sid = member['sid'];
        var channelService = app.get('channelService');

        channelService.pushMessageByUids(gameType+'_OnWatchAnswer', data, [{
            uid: uid,
            sid: sid
        }]);
    });
    table.on("ddz_onWatcherDealHandCards", function(data) {
        var param = {
            cards:[],
            route: gameType+'_onDealHandCards',
            deskName:table.tableNo
        };

        var channelService = app.get('channelService');
        for (var u in table.watcher) {
            var watcher = table.watcher[u];
            if(!! watcher.isAgree){
                var handCards = this.getPlayerByID(watcher.watcherUid).getHandCards();
                param.cards = handCards
            }

            var member = channel.getMember(u);
            if (member) {
                var sid = member['sid'];
                channelService.pushMessageByUids(gameType+'_onDealHandCards', param, [{
                    uid: u,
                    sid: sid
                }]);
            }
        }
    });
    table.on("ddz_updatePlayerCoin",function(player){
        var param = {
            uid:player.uid,
            coin:player.getTotalScore(),
            route: gameType+'_updatePlayerCoin',
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_OnPlayWile",function(msg){
        var param = {
            uid:msg.uid,
            fid:msg.fid,
            wid:msg.wid
        }
        channel.pushMessage(gameType+'_OnPlayWile',param);
    });

    table.on("ddz_onAward",function(uid,msg){
        var param = {
            uid:uid,
            msg:msg,
            route: gameType+'_onAward',
        };

        var channelService = app.get('channelService');
        var member = channel.getMember(uid);
        if (member) {
            var sid = member['sid'];
            channelService.pushMessageByUids(gameType+'_OnAward', param, [{
                uid: uid,
                sid: sid
            }]);
        }
    })
};

module.exports = tableEvent;