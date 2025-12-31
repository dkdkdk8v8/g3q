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

var gameType = "gameDDZ"

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
        logger.info(gameType ,"_onTableSitDown,desk:",table.tableNo);
        var param = {
            route: gameType + '_onTableSitDown',
            uid: player.uid,
            deskName:table.tableNo,
            chairNo:chairNo,
        }
        channel.pushMessage(param);

    });
    table.on("ddz_onTableStandUp",function(player,chairNo){
        logger.info(gameType ,"_onTableStandUp,desk:",table.tableNo);
        var param = {
            uid: player.uid,
            chairNo:chairNo,
            deskName:table.tableNo,
            route:gameType + '_onTableStandUp'
        }
        channel.pushMessage(param);
    });
    table.on("ddz_onApplyDrop",function(player){
        logger.info(gameType ,"_onApplyDrop,desk:",table.tableNo);
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
        logger.info(gameType ,"_onAnswerDrop,desk:",table.tableNo,'agree:',agree);
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
        logger.info(gameType ,"_onDropTable,desk:",table.tableNo,"uid:",player.uid);
        var param = {
            route: gameType + '_onDropTable',
            uid:player.uid,
            deskName:table.tableNo
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onDealHandCards",function(player){
        logger.info(gameType ,"_onDealHandCards,desk:",table.tableNo,"dealHandCards:",player.uid);
        var cards = [];
        player.handCards.list.forEach(function(card){
            cards.push({value:card.value,type:card.type})
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

        channelService.pushMessageByUids(gameType + '_onDealHandCards', param, [{
            uid: uid,
            sid: sid
        }]);
        // channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onRob",function(player){
        logger.info(gameType ,"_onRob,desk:",table.tableNo,"rob:",player.uid);
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
        logger.info(gameType ,"_onPass,desk:",table.tableNo,"ddz_onPass:",player.uid);
        var param = {
            route: gameType + '_onPass',
            deskName:table.tableNo,
            uid:player.uid,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onPassCall",function(player){
        logger.info(gameType ,"_onPassCall,desk:",table.tableNo,"passCall:",player.uid);
        var param = {
            route: gameType + '_onPassCall',
            uid:player.uid,
            deskName:table.tableNo,
            isRob:(table.playMethod == '2' && table.game.callFraction >= 3)?1:0
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onCall",function(player){
        logger.info(gameType ,"_onCall,desk:",table.tableNo,"call");
        var param = {
            route: gameType + '_onCall',
            rate:table.game.rate,
            deskName:table.tableNo,
            uid:player.uid,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onStartPlay",function(){
        logger.info(gameType ,"_onStartPlay,desk:",table.tableNo,"startPlay");
        var param = {
            route: gameType + '_onStartPlay',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onStopPlay",function(){
        logger.info(gameType ,"_onStopPlay,desk:",table.tableNo,"stopPlay");
        var param = {
            route: gameType + '_onStopPlay',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onOut",function(player,outCards,outType){
        logger.info(gameType,"_onOut,desk:",table.tableNo,"out:",player.uid);
        var cards = [];
        outCards.forEach(function(card){
            cards.push({value:card.value,type:card.type})
        });
        var param = {
            route: gameType + '_onOut',
            cards:cards,
            deskName:table.tableNo,
            outType:outType,
            uid:player.uid,
            rate:table.game.rate
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onTurnToCaller",function(player,o){
        logger.info(gameType,"_onTurnToCaller,desk:",table.tableNo,"turnToCaller:",player.uid);
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
        logger.info(gameType,"_onDealThreeCards,desk:",table.tableNo);
        var cards = [];
        board.forEach(function(card){
            cards.push({value:card.value,type:card.type})
        });
        var param = {
            route: gameType + '_onDealThreeCards',
            deskName:table.tableNo,
            cards:cards,
        };
        //console.log('ddz_onDealThreeCards:',channel)
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onLandLord",function(player){
        logger.info(gameType,"_onLandLord,desk:",table.tableNo,"landLord:",player.uid);
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
        logger.info(gameType ,"_onStopCall,desk:",table.tableNo);
        var param = {
            route: gameType + '_onStopCall',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onStartCall",function(player){
        logger.info(gameType,"_onStartCall,desk:",table.tableNo);
        var param = {
            route: gameType + '_onStartCall',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onOperateCode",function(player,operateCode){
        logger.info(gameType ,"_onOperateCode,desk:",table.tableNo,"operateCode:",operateCode,'uid:',player.uid);
        var param = {
            route: gameType + '_onOperateCode',
            type:operateCode.type,
            uid:player.uid,
            deskName:table.tableNo,
            previousPlayerID:operateCode.previousPlayerID
        };
        if(!!param.call){
            param.callValue = operateCode.callValue;
        }
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("ddz_onStartGame",function(){
        logger.info(gameType ,"_onStartGame,desk:",table.tableNo);
        var param = {
            route: gameType + '_onStartGame',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onStopGame",function(){
        logger.info(gameType,"_onStopGame,desk:",table.tableNo);
        var param = {
            route: gameType + '_onStopGame',
            deskName:table.tableNo,
           // gameRecordID:table.gameRecordID
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("ddz_onResult",function(playerList){
        //var gameType = "gameDDZ"
        logger.info(gameType ,"_onResult,desk:",table.tableNo);
        var param = {
            route: gameType + '_onResult',
            deskName:table.tableNo,
            isSpring:(table.game.springFaction == 2) ? 1:0,
            // gameRecordID:table.gameRecordID,
            playerList:playerList
        };
        channel.pushMessage(param);
        processRecord(table,param);
        // table.game.gameResult = param;
        //保存当局牌谱到数据库
        var tableId = table.tableID;
        var deskName =  table.tableNo;
        var roundIndex =  table.gameTimes;
        var record = JSON.stringify(table.game.gameRecord);
        var result = JSON.stringify(param);

        app.rpc.singlesvr.gameRecordRemote.saveGameRecord(null,gameType, tableId, deskName, roundIndex, record, result,function () { });

        table.game.players.forEach(function(player){
            app.rpc.usersvr.userRemote.refreshUserData(player.uid,{uid:player.uid,gameType:'gameDDZ'},
                [{key:"totalCount",deltaValue:1},
                    {key:"winCount",deltaValue:player.score > 0?1:0 }],
                function(err){
                    if(err){
                        console.log("ddz_onResult refreshUserData err:",err)
                    }
                });
        });
    });
    table.on("ddz_onTableStart",function(){
        logger.info(gameType,"_onTableStart,desk:",table.tableNo);
        var param = {
            route: gameType + '_onTableStart',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onPlayerReady",function(player){
        logger.info(gameType ,"_onPlayerReady,desk:",table.tableNo);
        var param = {
            route: gameType +'_onPlayerReady',
            deskName:table.tableNo,
            uid:player.uid
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onTableStop",function(playerList,creator){
        logger.info(gameType ,"_onTableStop,desk:",table.tableNo);
        var param = {
            route: gameType + '_onTableStop',
            deskName:table.tableNo,
            playerList:playerList,
            creator:creator
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
                    gameType: 'gameDDZ'
                }, arr, function (err) {
                    if (err) {
                        console.log("ddz_onTableStop refreshUserData err:", err)
                    }
                });
            });
        }

        table.players.forEach(function(player){
            app.rpc.usersvr.userRemote.leaveGame(player.uid, {uid:player.uid, gameType:"gameDDZ", deskName:table.tableNo}, function(err,res){});
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
        }, function () {
            if(!! table.clubId && !! table.tableNo && !! table.boxId){
                pomelo.app.rpc.clubsvr.clubRemote.onEndGroupDesk(null,{clubId:table.clubId,boxId:table.boxId,deskName:table.tableNo},function(){});
            }
        });

    });
    table.on("ddz_onReconnect",function(player){
        logger.info(gameType ,"_onReconnect,desk:",table.tableNo);
        var param = {
            route: gameType +'_onReconnect',
            deskName:table.tableNo,
            uid: player.uid
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onAddTable",function(player){
        logger.info(gameType ,"_onAddTable,desk:",table.tableNo);
        var param = {
            route: gameType +'_onAddTable',
            deskName:table.tableNo,
            uid: player.uid
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onExitTable",function(player){
        logger.info(gameType ,"_onExitTable,desk:",table.tableNo);
        var param = {
            route: gameType +'_onExitTable',
            deskName:table.tableNo,
            uid: player.uid
        };
        channel.pushMessage(param);
    });
    table.on("ddz_onKickPlayer",function(player,msg){
        logger.info(gameType ,"_onKickPlayer,desk:",table.tableNo);
        var param = {
            route: gameType +'_onKickPlayer',
            deskName:table.tableNo,
            uid: player.uid,
            msg:msg
        };
        channel.pushMessage(param);
        app.rpc.usersvr.userRemote.leaveGame(player.uid, {uid:player.uid, gameType:"gameDDZ", deskName:table.tableNo}, function(){});
    });
    table.on("ddz_OnPlayWile",function(msg){
        var param = {
            uid:msg.uid,
            fid:msg.fid,
            wid:msg.wid
        }
        channel.pushMessage(gameType+'_OnPlayWile',param);
    });
};

module.exports = tableEvent;