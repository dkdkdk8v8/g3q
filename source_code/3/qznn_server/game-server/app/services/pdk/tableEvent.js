var logger = require('pomelo-logger').getLogger(__filename);
var async = require('async');
var pomelo = require('pomelo');
var log = pomelo.app.get('mongodb');
var utils = require('../../util/utils');

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
    table.on("pdk_onTableSitDown",function(player,chairNo){
        logger.info("pdk_onTableSitDown,desk:",table.tableNo);
        var param = {
            route: 'pdk_onTableSitDown',
            uid: player.playerID,
            deskName:table.tableNo,
            chairNo:chairNo,
        }
        channel.pushMessage(param);

    });
    table.on("pdk_onTableStandUp",function(player,chairNo){
        logger.info("pdk_onTableStandUp,desk:",table.tableNo);

        var param = {
            uid: player.playerID,
            chairNo:chairNo,
            deskName:table.tableNo,
            route:'pdk_onTableStandUp'
        }
        channel.pushMessage(param);
    });
    table.on("pdk_onApplyDrop",function(player){
        logger.info("pdk_onApplyDrop,desk:",table.tableNo);
        var param = {
            route: 'pdk_onApplyDrop',
            playerID:player.playerID,
            deskName:table.tableNo
        };
        var sitPlayers = table.players.filter(function(p){
            return !!p.chairNo;
        });
        pushMessage(param.route,param,sitPlayers);
        //channel.pushMessage(param);
    });
    table.on("pdk_onAnswerDrop",function(player,agree){
        logger.info("pdk_onAnswerDrop,desk:",table.tableNo,'agree:',agree);
        var param = {
            route: 'pdk_onAnswerDrop',
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
    table.on("pdk_onDropTable",function(player){
        logger.info("pdk_onDropTable,desk:",table.tableNo,"playerID:",player.playerID);
        var param = {
            route: 'pdk_onDropTable',
            uid:player.playerID,
            deskName:table.tableNo
        };
        channel.pushMessage(param);
        table.players.forEach(function(player){
            app.rpc.usersvr.userRemote.leaveGame(player.playerID, {uid:player.playerID, gameType:"gamePDK", deskName:table.tableNo}, function(){});
        });
    });
    table.on("pdk_onDealHandCards",function(player){
        logger.info("pdk_onDealHandCards,desk:",table.tableNo,"dealHandCards:",player.playerID);
        var cards = [];
        player.handCards.list.forEach(function(card){
            cards.push({value:card.value,type:card.type})
        });
        var param = {
            cards:cards,
            deskName:table.tableNo,
            route: 'pdk_onDealHandCards',
            playerID:player.playerID
        };
        var uid = player.playerID;
        var member = channel.getMember(uid);
        if(!member){
            return ;
        }
        var sid = member['sid'];
        var channelService = app.get('channelService');

        channelService.pushMessageByUids('pdk_onDealHandCards', param, [{
            uid: uid,
            sid: sid
        }]);
        // channel.pushMessage(param);
        processRecord(table,param);
    });

    table.on("pdk_onPass",function(player){
        logger.info("pdk_onPass,desk:",table.tableNo,"pdk_onPass:",player.playerID);
        var param = {
            route: 'pdk_onPass',
            deskName:table.tableNo,
            playerID:player.playerID,
        };
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("pdk_onSwapSeat",function(playerList){
        var param = {
            route: 'pdk_onSwapSeat',
            playerList:playerList,
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
        processRecord(table,param);

    });
    table.on("pdk_onOut",function(player,outCards,outType){
        logger.info("pdk_onOut,desk:",table.tableNo,"out:",player.playerID);
        var cards = [];
        outCards.forEach(function(card){
            cards.push({value:card.value,type:card.type})
        });

        var channelService = app.get('channelService');

        for(var i=0;i<table.players.length;i++){
            var p = table.players[i];
            var param = {
                route: 'pdk_onOut',
                cards:cards,
                outType:outType,
                playerID:player.playerID,
                deskName:table.tableNo,
            };
            var uid = p.playerID;
            var member = channel.getMember(uid);
            if(!member){
                return ;
            }
            var sid = member['sid'];


            channelService.pushMessageByUids('pdk_onOut', param, [{
                uid: uid,
                sid: sid
            }]);
            if(i==0){
                processRecord(table,param);
            }
        }

        //channel.pushMessage(param);


    });


    table.on("pdk_onOperateCode",function(player,operateCode){
        logger.info("pdk_onOperateCode,desk:",table.tableNo,"operateCode:",operateCode,'playerID:',player.playerID);
        var param = {
            route: 'pdk_onOperateCode',
            type:operateCode.type,
            playerID:player.playerID,
            previousPlayerID:operateCode.previousPlayerID,
            deskName:table.tableNo,
        };
        if(!!param.call){
            param.callValue = operateCode.callValue;
        }
        channel.pushMessage(param);
        processRecord(table,param);
    });
    table.on("pdk_onStartGame",function(){
        logger.info("pdk_onStartGame,desk:",table.tableNo);
        var param = {
            deskName:table.tableNo,
            route: 'pdk_onStartGame',
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("pdk_onStopGame",function(){
        logger.info("pdk_onStopGame,desk:",table.tableNo);
        var param = {
            route: 'pdk_onStopGame',
            deskName:table.tableNo,
           // gameRecordID:table.gameRecordID
        };
        channel.pushMessage(param);
        //processRecord(table,param);
    });
    table.on("pdk_onResult",function(playerList){
        logger.info("pdk_onResult,desk:",table.tableNo);
        var param = {
            route: 'pdk_onResult',
            deskName:table.tableNo,
            playerList:playerList,
        };
        // table.game.gameResult = param;
        var gameType = "gamePDK"
        var tableId = table.tableID;
        var deskName = table.tableNo;
        var roundIndex = table.gameTimes;
        var record = JSON.stringify(table.game.gameRecord);
        var result = JSON.stringify(param);
        app.rpc.singlesvr.gameRecordRemote.saveGameRecord(null,gameType, tableId, deskName, roundIndex, record, result,function () { });

        channel.pushMessage(param);
        processRecord(table,param);

        table.game.players.forEach(function(player){
            app.rpc.usersvr.userRemote.refreshUserData(player.playerID,{uid:player.playerID,gameType:'gamePDK'},
                [{key:"totalCount",deltaValue:1},
                    {key:"winCount",deltaValue:player.score > 0?1:0 }],
                function(err){
                  if(err){
                      console.log("pdk_onResult refreshUserData err:",err)
                  }
                });
        });
    });
    table.on("pdk_onTableStart",function(){
        logger.info("pdk_onTableStart,desk:",table.tableNo);
        var param = {
            deskName:table.tableNo,
            route: 'pdk_onTableStart',
        };
        channel.pushMessage(param);
    });
    table.on("pdk_onWait",function(){
        logger.info("pdk_onWait,desk:",table.tableNo);
        var param = {
            route: 'pdk_onWait',
            deskName:table.tableNo,
        };
        channel.pushMessage(param);
    });
    table.on("pdk_onPlayerReady",function(player){
        logger.info("pdk_onPlayerReady,desk:",table.tableNo);
        var param = {
            route: 'pdk_onPlayerReady',
            deskName:table.tableNo,
            playerID:player.playerID
        };
        channel.pushMessage(param);
    });
    table.on("pdk_onTableStop",function(playerList,creator){
        logger.info("pdk_onTableStop,desk:",table.tableNo);
        var param = {
            route: 'pdk_onTableStop',
            deskName:table.tableNo,
            playerList:playerList,
            creator:creator
        };
        channel.pushMessage(param);
        if(!!table.game){
            table.game.players.forEach(function(player){
                var arr = [
                    {key:"playCount",deltaValue:1},
                    {key:"bombCount",deltaValue:player.bombNumber},
                    {key:"guanMenCount",deltaValue:player.gNumber},
                    {key:"quanGuanCount",deltaValue:player.qgNumber},
                    {key:"totalScore",deltaValue:player.totalScore}
                ];
                if(player.totalScore > player.maxWinScore){
                    arr.push({ key: "maxWinScore", value: player.totalScore});
                    arr.push({ key: "maxWinTime", value: new Date().getTime()/1000});
                }
                if(player.totalScore < player.maxLoseScore){
                    arr.push({ key: "maxLoseScore", value: player.totalScore});
                }

                app.rpc.usersvr.userRemote.refreshUserData(player.playerID,{uid:player.playerID,gameType:'gamePDK'},
                    arr, function(err){
                    if(err){
                        console.log("pdk_onTableStop refreshUserData err:",err)
                    }
                });
            });
        }

        table.players.forEach(function(player){
            app.rpc.usersvr.userRemote.leaveGame(player.playerID, {uid:player.playerID, gameType:"gamePDK", deskName:table.tableNo}, function(){});
        });

        var now = Math.round(new Date().getTime() / 1000);
        if (table.isReplace && table.isStart) {
            var PDKHistory = app.get('models').gamePDKReplaceHistory;
            PDKHistory.create({uid: table.creatorID, deskId: table.tableID, endTime: now});
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
    table.on("pdk_onReconnect",function(player){
        logger.info("pdk_onReconnect,desk:",table.tableNo);
        var param = {
            route: 'pdk_onReconnect',
            deskName:table.tableNo,
            playerID: player.playerID
        };
        channel.pushMessage(param);
    });
    table.on("pdk_onAddTable",function(player){
        logger.info("pdk_onAddTable,desk:",table.tableNo);
        var param = {
            route: 'pdk_onAddTable',
            deskName:table.tableNo,
            uid: player.playerID
        };
        channel.pushMessage(param);
    });
    table.on("pdk_onExitTable",function(player){
        logger.info("pdk_onExitTable,desk:",table.tableNo);
        var param = {
            route: 'pdk_onExitTable',
            deskName:table.tableNo,
            uid: player.playerID
        };
        channel.pushMessage(param);
    });
    table.on("pdk_onKickPlayer",function(player,msg){
        logger.info("pdk_onKickPlayer,desk:",table.tableNo);
        var param = {
            route: 'pdk_onKickPlayer',
            deskName:table.tableNo,
            playerID: player.playerID,
            msg:msg
        };
        channel.pushMessage(param);
        app.rpc.usersvr.userRemote.leaveGame(player.playerID, {uid:player.playerID, gameType:"gamePDK", deskName:table.tableNo}, function(){});
    });

    table.on("pdk_OnPlayWile",function(msg){
        var param = {
            uid:msg.uid,
            fid:msg.fid,
            wid:msg.wid
        }
        channel.pushMessage("gamePDK" + '_OnPlayWile',param);
    });
};

module.exports = tableEvent;