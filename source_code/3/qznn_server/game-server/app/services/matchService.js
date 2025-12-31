var async = require("async");
var Match = require("../domain/match/Match");


var DeskConfig = {
    "coinDDZ":{
        deskType:1,
        minCoin:0,
        maxCoin:0,
        baseCoin:1,
        roomIndex:0,
    },
    "coinMaJiang_nd":{
        deskType:1,
        minCoin:0,
        maxCoin:0,
        baseCoin:1,
        roomIndex:0,
    }
}

var Match_Tip = "比赛开始，点击确定加入比赛~~~";

var MatchService = function(app){
    this.matchMap = {}//matchMap[createTime] = match
    this.activeMid = [];//可以报名的比赛
    this.app = app;
    this.redisClient = null;
}
MatchService.previousID = 0;

MatchService.prototype.getMatchCount = function(){
    return Object.keys(this.matchMap).length;
}

var _getUniqueID = function(){
    var nowID = Date.now();

    if(nowID <= MatchService.previousID){
        nowID = ++ MatchService.previousID;
    }else{
        MatchService.previousID = nowID;
    }
    return nowID;
}

MatchService.prototype.addMatch = function(index){
    var mCoinfig = this.app.get("config");
    var opts = mCoinfig["matchList"][index];
    var matchId = _getUniqueID();
    opts.mid = matchId;
    opts.index = index;
    //
    var match = new Match(opts);
    this.matchMap[matchId] = match;
    this.activeMid.push(matchId);
}

//正在报名的比赛的信息
MatchService.prototype._getActiveMatchInfo = function(uid){
    var matchBasicInfo = []
    for(var i = 0; i < this.activeMid.length; i++){
        var match = this.matchMap[this.activeMid[i]];
        matchBasicInfo.push(match.getBasicInfo(uid));
    }

    return matchBasicInfo;
}

MatchService.prototype.getMatchInfo = function(uid){
    return this._getActiveMatchInfo(uid);
}

MatchService.prototype.getMatch = function(mid){
    return this.matchMap[mid];
}

MatchService.prototype.removeMatch = function(match){
    delete this.matchMap[match.mid];
}

//根据玩家id寻找match
MatchService.prototype.getMatchByUid = function(uid){
    for(var mid in this.matchMap){
        var match = this.matchMap[mid];
        if(match.isExistMatcher(uid)){
            return match;
        }
    }
    return null
}

MatchService.prototype.checkStart = function(mid){
    var match = this.matchMap[mid];
    var self = this;
    if(! match.start()){//人未满 不能开赛
        return;
    }
    var deskNames = [];
    //标记比赛不能退出了
    match.forbiddenExit();
    //解锁玩家
    var unlockMatcher = function(cb){
        var matchers = match.matcherInfo;
        var unlockFuncs = []
        for(var uid in matchers){
            var genFunc = function(uid){
                return function(scb){
                    self.app.rpc.usersvr.userRemote.leaveGame(null,{uid:uid,gameType:match.type,deskName:match.mid},scb);
                }
            }
            unlockFuncs.push(genFunc(uid));
        }

        async.parallel(unlockFuncs,cb);
    }
    //获取桌号
    var getDeskNameList = function(x,cb){
        var needCount = match.limit / match.ppt;
        var gFuncs = [];
        for(var i = 0; i < needCount; i++){
            var genFunc = function(){
                return function(scb){
                    self.app.rpc.desknamesvr.deskNameRemote.getMatchDeskName(null,{mid:mid,gameType:match.type,isCoin:true},function(err,deskName){
                        deskNames.push(deskName);
                        scb(null);
                    })
                }  
            }
            gFuncs.push(genFunc());
        }

        async.parallel(gFuncs,cb);
    }
    //创建比赛桌子
    var createMatchDesk = function(x,cb){
        var gameType = match.type;
        var cFuncs = [];
        for(var i = 0; i < deskNames.length; i++){
            var genFunc = function(gameType,deskName){
                return function(scb){
                    var opts = {};
                    for(var key in DeskConfig[match.type]){
                        opts[key] = DeskConfig[match.type][key];
                    }
                    opts.mid = match.mid;
                    opts.deskName = deskName;
                    opts.gameType = gameType;
                    opts.maxPlayer = match.ppt;
                    self.app.rpc[gameType].gameRemote.createDesk(deskName,opts,function(err,result){
                        if(!! err){
                            return scb(err);
                        }
                        match.addTable(deskName);
                        scb(null);
                    });
                }
            }

            cFuncs.push(genFunc(gameType,deskNames[i]));
        }

        async.parallel(cFuncs,cb);
    }
    //入桌
    var notifyMatcherEnter = function(x,cb){
        var result = match.matchingUserInQueue();
        var nFuncs = [];
        for(var deskName in result){
            var genFunc = function(gameType,deskName,uids){
                return function(scb){
                    self.app.rpc.chatsvr.chatRemote.getSidInfo(null,uids,function(err,uidMap){
                        self.app.rpc[gameType].gameRemote.addPlayers(deskName,{
                            gameType:gameType,
                            deskName:deskName,
                            uidMap:uidMap,
                            isFirstRound: match.round == 1
                        },function(err,uidTableMap){
                            if(!! err){
                                return scb(err);
                            }
                            for(var uid in uidTableMap){
                                self.app.rpc.chatsvr.chatRemote.pushMessageToUsers(null,"OnMatchStart",[uid],{
                                    table:uidTableMap[uid],
                                    gameType:gameType,
                                    msg:"比赛已经开始 即将入桌~~~",
                                },function(){});
                            }
                            scb(null);
                        })
                    })
                }
            }
            var gameType = match.type;
            nFuncs.push(genFunc(gameType,deskName,result[deskName]));
        }

        async.parallel(nFuncs,cb);
    }

    async.waterfall([unlockMatcher,getDeskNameList,createMatchDesk,notifyMatcherEnter],function(err,result){
        //TODO:失败怎么处理?
        if(!! err){
            console.log("check start err:"+JSON.stringify(err));
        }
        //remove start match from active array
        var startIndex = self.activeMid.indexOf(match.mid);
        self.activeMid.splice(startIndex,1);
        self.addMatch(match.index);
        match.allowExit();//比赛解锁
    })
}

MatchService.prototype.wait = function(uids){
    var match = null;
    for(var i in uids){
        match = this.getMatchByUid(uids[i]);
        if(!! match) break;
    }
    var self = this;

    if(!! match){
        match.wait(uids);
    }
}

MatchService.prototype.notifyRank = function(match){
    var self = this;
    var uidRank = match.getRankUids();
    var rFuncs = []
    for(var i = 0; i < uidRank.length; i++){
        var genFunc = function(uid){
            return function(scb){
                self.app.rpc.chatsvr.chatRemote.pushMessageToUsers(null,"OnRankUpdate",[uid],{
                    totalRank:match.getRankCount(),
                    rank:match.getRankByUid(uid),
                    matchingCount:match.getMatchingTableCount(),
                    round:match.round,
                    maxRound:match.Max_Round,
                },scb);
            }
        }
        rFuncs.push(genFunc(uidRank[i]));
    }
    async.parallel(rFuncs,function(){});
}

MatchService.prototype.awardMatcher = function(match,callback){
    var self = this;
    var awardInfo = match.getAwardInfo();
    var aFuncs = [];
    for(var uid in awardInfo){
        var genFunc = function(uid,item){
            return function(cb){
                self.app.rpc.usersvr.userRemote.leaveGame(match.type,{
                    uid:uid,
                    gameType:match.type,
                    deskName:match.mid
                },function(err,result){

                    if(item.key && item.value != 0){
                        var log = self.app.get("mongodb");
                        log.insert({cmd:"match_award","uid":uid,"value":item.value,"name":item.key,"type":match.type});
                        var MatchAward = self.app.get("models").MatchAward;
                        MatchAward.build({uid:uid,matchName:match.name,awardName:item.key,awardNumber:item.value}).save();
                    }

                    if(item.key == "roomCard" && item.value != 0){
                        self.app.rpc.usersvr.userRemote.addRoomCard(match.mid,{uid:uid,cardNum:item.value},function(){})
                    }else if(item.key == "coupon" && item.value != 0){
                        self.app.rpc.usersvr.userRemote.addCoupon(match.mid,{uid:uid,deltaCoupon:item.value},function(){})
                    }
                    
                    self.app.rpc.chatsvr.chatRemote.pushMessageToUsers(match.mid,"OnMatchAward",[uid],{uid:uid,award:item},cb);
                })
            }
        }

        aFuncs.push(genFunc(uid,awardInfo[uid]));
    }
    async.parallel(aFuncs,callback);
}

MatchService.prototype.notifyNewEnter = function(match){
    var uids = match.getRankUids();
    this.app.rpc.chatsvr.chatRemote.pushMessageToWorld(match.mid,"OnUpdateMatcherCount",
        {matchId:match.mid,matcherCount:uids.length},function(){});
}

module.exports = MatchService;