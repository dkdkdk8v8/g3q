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
var tableEvent = function(app,table,channel) {
    var pushMessage = function(route, msg ,players){
        var uids = []
        for(var sid in channel.groups) {
            var group = channel.groups[sid];
            for(var i=0, l=group.length; i<l; i++) {
                var some = players.some(function(player){
                   return player.playerID == group[i];
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
    table.on("sss_onTableSitDown",function(player,chairNo){
        logger.info("sss_onTableSitDown,desk:",table.tableNo);
        var param = {
            route: 'sss_onTableSitDown',
            uid: player.playerID,
            deskName:table.tableNo,
            chairNo:chairNo,
        }
        channel.pushMessage(param);

    });
    table.on("sss_onTableStandUp",function(player,chairNo){
        logger.info("sss_onTableStandUp,desk:",table.tableNo);
        var param = {
            uid: player.playerID,
            chairNo:chairNo,
            deskName:table.tableNo,
            route:'sss_onTableStandUp'
        }
        channel.pushMessage(param);
    });
    table.on("sss_onApplyDrop",function(player){
        logger.info("sss_onApplyDrop,desk:",table.tableNo);
        var param = {
            route: 'sss_onApplyDrop',
            playerID:player.playerID,
            deskName:table.tableNo
        };
        var sitPlayers = table.players.filter(function(p){
            return !!p.chairNo;
        });
        pushMessage(param.route,param,sitPlayers);
        //channel.pushMessage(param);
    });
    table.on("sss_onAnswerDrop",function(player,agree){
        logger.info("sss_onAnswerDrop,desk:",table.tableNo,'agree:',agree);
        var param = {
            route: 'sss_onAnswerDrop',
            playerID:player.playerID,
            deskName:table.tableNo,
            agree:agree
        };
        var sitPlayers = table.players.filter(function(p){
            return !!p.chairNo;
        });
        pushMessage(param.route,param,sitPlayers);
        //channel.pushMessage(param);
    });
    table.on("sss_onDropTable",function(player){
        logger.info("sss_onDropTable,desk:",table.tableNo,"playerID:",player.playerID);
        var param = {
            route: 'sss_onDropTable',
            uid:player.playerID,
            deskName:table.tableNo
        };
        channel.pushMessage(param);
        //在sss_onTableStop中调用
        //table.players.forEach(function(player){
        //    app.rpc.usersvr.userRemote.leaveGame(player.playerID, {uid:player.playerID, gameType:"gameSSS", deskName:table.tableNo}, function(){});
        //});
    });
    table.on("sss_onDealHandCards",function(player){
        logger.info("sss_onDealHandCards,desk:",table.tableNo,"dealHandCards:",player.playerID);
        var cards = [];
        player.handCards.list.forEach(function(card){
            cards.push({value:card.value,type:card.type})
        });
        var param = {
            cards:cards,
            route: 'sss_onDealHandCards',
            deskName:table.tableNo,
            playerID:player.playerID
        };
        var uid = player.playerID;
        var member = channel.getMember(uid);
        if(!member){
            return ;
        }
        var sid = member['sid'];
        var channelService = app.get('channelService');

        channelService.pushMessageByUids('sss_onDealHandCards', param, [{
            uid: uid,
            sid: sid
        }]);
        // channel.pushMessage(param);
        processRecord(table,param);
    });

    table.on("sss_onOut",function(player){
        logger.info("sss_onOut,desk:",table.tableNo,"out:",player.playerID);

        var param = {
            route: 'sss_onOut',
            deskName:table.tableNo,
            playerID:player.playerID,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    
    table.on("sss_onStartGame",function(){
        logger.info("sss_onStartGame,desk:",table.tableNo);
        var param = {
            route: 'sss_onStartGame',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("sss_onStopGame",function(){
        logger.info("sss_onStopGame,desk:",table.tableNo);
        var param = {
            route: 'sss_onStopGame',
            deskName:table.tableNo,
           // gameRecordID:table.gameRecordID
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("sss_onResult",function(playerList){
        logger.info("sss_onResult,desk:",table.tableNo);
        var param = {
            route: 'sss_onResult',
            deskName:table.tableNo,
            playerList:playerList
        };
        channel.pushMessage(param);
        processRecord(table,param);
        // table.game.gameResult = param;
        var gameType = "gameSSS"
        var tableId = table.tableID;
        var deskName = table.tableNo;
        var roundIndex = table.gameTimes;
        var record = JSON.stringify(table.game.gameRecord);
        var result = JSON.stringify(param);
        //console.log("sss_onResult:--",playerList);
        app.rpc.singlesvr.gameRecordRemote.saveGameRecord(null,gameType, tableId, deskName, roundIndex, record, result,function () { });

        table.game.players.forEach(function(player){
            app.rpc.usersvr.userRemote.refreshUserData(player.playerID,{uid:player.playerID,gameType:'gameSSS'},
                [{key:"totalCount",deltaValue:1},
                    {key:"winCount",deltaValue:player.score > 0?1:0 }],
                function(err){
                    if(err){
                        console.log("sss_onResult refreshUserData err:",err)
                    }
                });
        });
    });
    table.on("sss_onTableStart",function(){
        logger.info("sss_onTableStart,desk:",table.tableNo);
        var param = {
            route: 'sss_onTableStart',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
    });
    table.on("sss_onWait",function(){
        logger.info("sss_onWait,desk:",table.tableNo);
        var param = {
            route: 'sss_onWait',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
    });
    table.on("sss_onPlayerReady",function(player){
        logger.info("sss_onPlayerReady,desk:",table.tableNo);
        var param = {
            route: 'sss_onPlayerReady',
            deskName:table.tableNo,
            playerID:player.playerID
        };
        channel.pushMessage(param);
    });
    table.on("sss_onTableStop",function(playerList,stopDate,creator){
        logger.info("sss_onTableStop,desk:",table.tableNo);
        var param = {
            route: 'sss_onTableStop',
            deskName:table.tableNo,
            playerList:playerList,
            stopDate:stopDate,
            creator:creator
        };
        channel.pushMessage(param);
        if(!!table.game) {
            table.game.players.forEach(function (player) {
                var arr = [
                    {key: "playCount", deltaValue: 1},
                    {key: "daQiangCount", deltaValue: player.gunNumber},
                    {key: "beiDaQiangCount", deltaValue: player.bGunNumber},
                    {key: "quanLeiDaCount", deltaValue: player.gunAllNumber},
                    {key: "specialCardCount", deltaValue: player.specialNumber},
                    {key: "tongHuaCount", deltaValue: player.sfNumber},
                    {key: "tieZhiCount", deltaValue: player.bombNumber},
                    {key: "totalScore",deltaValue:player.totalScore}
                ];
                if(player.totalScore > player.maxWinScore){
                    arr.push({ key: "maxWinScore", value: player.totalScore});
                    arr.push({ key: "maxWinTime", value: new Date().getTime()/1000});
                }
                if(player.totalScore < player.maxLoseScore){
                    arr.push({ key: "maxLoseScore", value: player.totalScore});
                }
                app.rpc.usersvr.userRemote.refreshUserData(player.playerID, {
                    uid: player.playerID,
                    gameType: 'gameSSS'
                }, arr, function (err) {
                    if (err) {
                        console.log("sss_onTableStop refreshUserData err:", err)
                    }
                });
            });
        }
        table.players.forEach(function(player){
            app.rpc.usersvr.userRemote.leaveGame(player.playerID, {uid:player.playerID, gameType:"gameSSS", deskName:table.tableNo}, function(){});
        });
        var now = Math.round(new Date().getTime() / 1000);
        if (table.isReplace && table.isStart) {
            var SSSHistory = app.get('models').gameSSSReplaceHistory;
            SSSHistory.create({uid: table.creatorID, deskId: table.tableID, endTime: now});
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
    table.on("sss_onReconnect",function(player){
        logger.info("sss_onReconnect,desk:",table.tableNo);
        var param = {
            route: 'sss_onReconnect',
            deskName:table.tableNo,
            playerID: player.playerID
        };
        channel.pushMessage(param);
    });
    table.on("sss_onAddTable",function(player){
        logger.info("sss_onAddTable,desk:",table.tableNo);
        var param = {
            route: 'sss_onAddTable',
            deskName:table.tableNo,
            uid: player.playerID
        };
        channel.pushMessage(param);
    });
    table.on("sss_onExitTable",function(player){
        logger.info("sss_onExitTable,desk:",table.tableNo);
        var param = {
            route: 'sss_onExitTable',
            deskName:table.tableNo,
            uid: player.playerID
        };
        channel.pushMessage(param);
    });
    table.on("sss_onKickPlayer",function(player,msg){
        logger.info("sss_onKickPlayer,desk:",table.tableNo);
        var param = {
            route: 'sss_onKickPlayer',
            deskName:table.tableNo,
            playerID: player.playerID,
            msg:msg
        };
        channel.pushMessage(param);
        app.rpc.usersvr.userRemote.leaveGame(player.playerID, {uid:player.playerID, gameType:"gameSSS", deskName:table.tableNo}, function(){});
    });

    table.on("sss_OnPlayWile",function(msg){
        var param = {
            uid:msg.uid,
            fid:msg.fid,
            wid:msg.wid
        }
        channel.pushMessage("gameSSS" + '_OnPlayWile',param);
    });

};

module.exports = tableEvent;