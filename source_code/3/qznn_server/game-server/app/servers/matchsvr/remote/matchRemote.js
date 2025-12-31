var pomelo = require("pomelo")
var async = require("async");

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
    this.matchService = app.get("matchService");
};

remote.prototype.getMyUserInfo = function(args,callback){
    var uid = args.uid;
    var self = this;
    pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(uid, {
        keys:args.keys,
        gameType:args.gameType,
        deskName:args.deskName,
        uid:uid
    }, function(err,user){
        if(!! err){
            callback(err);
        }
        var match = self.matchService.getMatchByUid(uid);
        user.coin = match.matcherInfo[uid].score;
        callback(null,user);
    });
}

remote.prototype.addMatchScore = function(args,callback){
    var uid = args.uid;
    var score = args.score;
    var match = this.matchService.getMatchByUid(uid);
    match.addScore(uid,score);
    //通知玩家分数更新
    var info = match.getMatcher(uid)
    callback(null,{coin:info.score});
    // this.app.rpc.chatsvr.chatRemote.pushMessageToUsers(null,"OnUserUpdate",[uid],{uid:uid,coin:info.score},function(err,res){
    //     if(!! err){
    //         return callback(err);
    //     }
    //     callback(null,{coin:info.score});
    // });
}

remote.prototype.onGameEnd = function(args,callback){
    var gameType = args.gameType;
    var deskName = args.deskName;
    var mid = args.mid;
    var uids = args.uids;
    var self = this;
    var match = self.matchService.getMatch(mid);
    //通知排名
    var isForward = match.forward(deskName,uids);//这样写的原因是 forward 处理了match的matchCount 会影响onRankUpdate中的等待桌数 要先处理。
    self.matchService.notifyRank(match);
    //晋级
    if(isForward){
        var tableNoList = match.getTableNoList();//forwardRound会砍掉桌子 所以放这个前面
        if(match.canForwardRound()){
            //0. wait
            var toWait = function(cb){
                if(! match.isEnd()){
                    setTimeout(function(){
                        self.app.rpc.chatsvr.chatRemote.pushMessageToUsers(null,"OnMatchWait",uids,
                        {msg:"正在等待其他玩家结束游戏，请稍后...."},function(){});
                    }.bind(null,uids),4000)
                }

                setTimeout(function(){
                    match.forwardRound();
                    self.matchService.notifyRank(match);
                    match.forbiddenExit();
                    cb(null);
                }.bind(null,uids),6000)
            } 
            //1. 站起
            var leaveGame = function(cb){
                var tFuncs = [];
                var tFunc = function(tableNo){
                    return function(scb){
                        self.app.rpc[gameType].gameRemote.onMatchRoundEnd(tableNo,{gameType:gameType,deskName:tableNo},function(err,result){
                            if(!! err){
                                return scb(err);
                            }
                            scb(null);
                        })
                    }
                }
                for(var i = 0; i < tableNoList.length; i++){
                    var tableNo = Number(tableNoList[i]);
                    tFuncs.push(tFunc(tableNo));
                }

                async.parallel(tFuncs,function(err,results){
                    if(!! err){
                        return cb(err);
                    }
                    cb(null);
                })
            }

            //2. 发奖
            var awardMatcher = function(cb){
                self.matchService.awardMatcher(match,cb);
            }
            //3. 结束 or 继续匹配
            var dealMatch = function(x,cb){
                if(match.isEnd()){
                    //TODO:gameType == undefined deskName == undefined == undefined??? 为什么？
                    self.app.rpc[args.gameType].gameRemote.onMatchEnd(args.deskName,{mid:match.mid},function(err,result){
                        if(!! err){
                            return cb(err);
                        }
                        self.app.rpc.desknamesvr.deskNameRemote.recycleMatchDeskName(deskName,{mid:match.mid},cb);
                        self.matchService.removeMatch(match)
                    })
                }else{
                    var result = match.matchingUserInQueue();
                    var nFuncs = [];
                    for(var deskName in result){
                        var genFunc = function(gameType,deskName,forwardUids){
                            return function(scb){
                                //3.1 请求sid
                                var getPlayerUidMap = function(sscb){
                                    self.app.rpc.chatsvr.chatRemote.getSidInfo(null,forwardUids,sscb);
                                }
                                //3.2 拉玩家入桌
                                var sitDownPlayer = function(uidMap,sscb){
                                    var args = {
                                        gameType:gameType,
                                        deskName:deskName,
                                        uidMap:uidMap,
                                        
                                    }
                                    self.app.rpc[gameType].gameRemote.addPlayers(deskName,args,sscb);
                                }   
                                //3.3 通知玩家
                                var notifyPlayer = function(uidTableMap,sscb){
                                    var winners = [];
                                    for(var uid in uidTableMap){winners.push(uid);}
                                    match.startGame(winners);
                                    for(var uid in uidTableMap){
                                        self.app.rpc.chatsvr.chatRemote.pushMessageToUsers(null,"OnMatchForward",[uid],
                                        {   table:uidTableMap[uid],
                                            gameType:gameType,
                                            msg:"恭喜你晋级了~~~",},function(){});
                                    }
                                    sscb(null);
                                }
                                async.waterfall([getPlayerUidMap,sitDownPlayer,notifyPlayer],scb);
                            }
                        }
            
                        var gameType = match.type;
                        nFuncs.push(genFunc(gameType,deskName,result[deskName]));
                    }
                    setTimeout(function(){
                        async.parallel(nFuncs,cb);
                    },3000);
                }
            }
            
            async.waterfall([toWait,leaveGame,awardMatcher,dealMatch],function(err,result){
                if(!! err){
                    console.log("err is----------->>>",err);
                }
                match.allowExit();
            });
        }else{
            //通知客户端等待
            setTimeout(function(){
                self.matchService.wait(uids);
                self.app.rpc.chatsvr.chatRemote.pushMessageToUsers(null,"OnMatchWait",uids,
                {msg:"正在等待其他玩家结束游戏，请稍后...."},function(){});
            }.bind(null,uids),4000)
        }
    }else{
        setTimeout(function(){
            self.app.rpc[gameType].gameRemote.onContinueMatch(deskName,{gameType:gameType,deskName:deskName,uids:uids},function(){});
        },3000);
    }
    callback(null);
}

remote.prototype.getMatcherStatus = function(args,callback){
    var uid = args.uid;
    var match = this.matchService.getMatchByUid(uid);
    if(!! match){
        var matcher = match.matcherInfo[uid];
        return callback(null,matcher.status);
    }
    callback(null,0);//没有比赛的情况
}

remote.prototype.getMatherWaitInfo = function(args,callback){
    var uid = args.uid;
    var mid = args.mid;
    var match = this.matchService.getMatch(mid);

    var matcher = match.getMatcher(uid);
    if(matcher.status == 2){//is waiting
        callback(null,{round:match.round,totalRank:match.getRankCount(),rank:match.getRankByUid(uid),
            matchingCount:match.getMatchingTableCount(),gameType:args.gameType,maxRound:match.Max_Round})
    }

    callback(null);
}