var Matcher = require("./Matcher");

var Match = function(opts){
    //Configurable
    this.mid = opts.mid;
    this.name = opts.name;
    this.fee = opts.fee;
    this.Max_Round = opts.round;
    this.Count_Per_Round = opts.matchCount;
    this.limit = opts.limit;//人数限制
    this.award = opts.award;//TODO:剥离award
    this.initScore = opts.initScore;//初始得分
    this.type = opts.type;
    this.ppt= opts.ppt;//player per table
    this.forwardCount = opts.forwardCount;//晋级人数
    this.index = opts.index;
    //Status
    this.isStarted = false;//比赛开始
    this._isForbiddenExit = false;
    this.isEnded = false;//比赛结束
    this.round = 1;//当前第几轮
    this.tableInfo = {};//tableInfo[tableNo] = {matchCount:0}
    this.matcherInfo = {};
    this.waitAwardMatcher = [];//淘汰后等待发奖的选手
}


Match.prototype.start = function(){
    if(Object.keys(this.matcherInfo).length != this.limit){
        return false;
    }

    this.isEnded = false;
    this.isStarted = true;

    //isMatching
    for(var uid in this.matcherInfo){
        var matcher = this.matcherInfo[uid];
        matcher.status = Matcher.Match_Status.InGame;
    }
    return true;
}

Match.prototype.isStart = function(){
    return this.isStarted;
}

Match.prototype.endGame = function(){
    //结束的时候给所有人发奖;
    this.waitAwardMatcher = [];
    for(var uid in this.matcherInfo){
        this.waitAwardMatcher.push(this.matcherInfo[uid]);
    }

    this.matcherInfo = null;
    this.isStarted = false;
    this.isEnded = true;
}

Match.prototype.isEnd = function(){
    return this.isEnded;
}

Match.prototype.addTable = function(tableNo){
    this.tableInfo[tableNo] = {
        matchCount:0
    };
    console.log("addTable--------->>>",tableNo);
}

Match.prototype.getTableNoList = function(){
    return Object.keys(this.tableInfo);
}

Match.prototype.dealMatcherForward = function(uids){
    //打完这一轮了 看看玩家能不能晋级
    var theMatcherList = [];

    for(var i = 0; i < uids.length; i++){
        theMatcherList.push(this.matcherInfo[uids[i]]);
    }

    theMatcherList.sort(function(m1,m2){
        if(m1.score == m2.score){
            return m1.applyIndex - m2.applyIndex;
        }
        return m2.score - m1.score;
    })

    for(var i = 0; i < this.forwardCount; i++){
        theMatcherList[i].isUpgrade = true;//标记玩家晋级
    }
}

Match.prototype.forward = function(deskName,uids){
    var item = this.tableInfo[deskName];
    if(item.matchCount < this.Count_Per_Round){
        item.matchCount ++;
    }

    //打完这一轮了 看看玩家能不能晋级
    if(item.matchCount == this.Count_Per_Round){
        this.dealMatcherForward(uids);
    }

    return item.matchCount == this.Count_Per_Round;
}

Match.prototype._getRoundForwordCount = function(){
    return Object.keys(this.tableInfo).length * this.forwardCount;//基于桌子数固定的情况
}

Match.prototype.dealTableRoundForward = function(){
    var roundFordwordCount = this._getRoundForwordCount();
    var tableCount = roundFordwordCount / this.ppt;
    var tmp = {}
    for(var tableNo in this.tableInfo){
        var table = this.tableInfo[tableNo];
        table.matchCount = 0;
        tmp[tableNo] = table;
        if(Object.keys(tmp).length == tableCount){
            break;
        }
    }
    this.tableInfo = tmp;
}

Match.prototype.dealMatcherRoundForward = function(){
    var roundFordwordCount = this._getRoundForwordCount();
    var winners = []
    var losers = []
    if(Object.keys(this.matcherInfo).length <= roundFordwordCount){
        for(var uid in this.matcherInfo){
            var matcher = this.matcherInfo[uid];
            matcher.isUpgrade = false;
            winners.push(matcher);
        }
    }else{
        for(var uid in this.matcherInfo){
            var matcher = this.matcherInfo[uid];
            if(matcher.isUpgrade){
                matcher.isUpgrade = false;
                winners.push(matcher);
            }else{
                matcher.uid = uid;
                losers.push(matcher);
            }
        }
        //按名次排一次
        losers.sort(function(a,b){
            if(a.score == b.score){
                return a.applyIndex - b.applyIndex;
            }
            return a.score - b.score
        })
        //补位
        var miss = Math.min(losers.length,roundFordwordCount - Object.keys(winners).length);
        for(var i = 0; i < miss; i++){
            var matcher = losers[i];
            matcher.isUpgrade = false;
            winners[matcher.uid] = matcher;
        }
        losers.splice(0,miss);
        //this.waitAwardMatcher = losers;
    }

    //refresh rank # winners
    winners.sort(function(w1,w2){
        if(w1.score == w2.score){
            return w1.applyIndex - w2.applyIndex;
        }
        return w2.score - w1.score;
    })

    var winnerObj = {};
    for(var i = 0; i < winners.length; i++){
        var item = winners[i];
        item.rank =  i + 1;
        winnerObj[item.uid] = item;
    }
    //refersh rank # losers
    losers.sort(function(l1,l2){
        if(l1.score == l2.score){
            return l1.applyIndex - l2.applyIndex;
        }
        return l2.score - l1.score;
    })

    for(var i = 0; i < losers.length; i++){
        var item = losers[i];
        item.rank = winners.length + i + 1;
    }

    this.waitAwardMatcher = losers;

    this.matcherInfo = winnerObj;//重置选手
}

Match.prototype.forwardRound = function(){
    for(var tableNo in this.tableInfo){//所有桌子都打满N盘
        if(this.tableInfo[tableNo].matchCount != this.Count_Per_Round){
            return false;
        }
    }

    if(this.round < this.Max_Round){//晋级必须第N-1轮
        this.dealMatcherRoundForward();
        this.dealTableRoundForward();
        this.round ++;
    }else{
        this.endGame();//比赛结束了
    }

    return true;
}

Match.prototype.canForwardRound = function(){
    for(var tableNo in this.tableInfo){//所有桌子都打满N盘
        if(this.tableInfo[tableNo].matchCount != this.Count_Per_Round){
            return false;
        }
    }

    return true;
}

Match.prototype.getBasicInfo = function(uid){
    return {
        mid:this.mid,
        type:this.type,
        name:this.name,
        fee:this.fee,
        limit:this.limit,
        championAward:this.award[0],
        matcherCount:Object.keys(this.matcherInfo).length,
        isJoinMatch:!! this.matcherInfo[uid]
    }
}

Match.prototype.isExistMatcher = function(uid){
    return !! this.matcherInfo[uid]
}

Match.prototype.addMatcher = function(uid){
    if(this.isExistMatcher(uid)){
        return false;//已经在比赛中了
    }

    this.matcherInfo[uid] = new Matcher({
        uid:uid,
        score:this.initScore,
        rank:1,
        applyIndex:Object.keys(this.matcherInfo).length + 1,
    })
}

Match.prototype.removeMatcher = function(uid){
    if(! this.isExistMatcher(uid)){
        return false;//没在比赛当中
    }

    delete this.matcherInfo[uid];
    this.updateRank();
}

Match.prototype.getMatcher = function(uid){
    return this.matcherInfo[uid];
}

Match.prototype.wait = function(uids){
    for(var i = 0; i < uids.length; i++){
        if(!! this.matcherInfo[uids[i]]){
            this.matcherInfo[uids[i]].status = Matcher.Match_Status.Waitting;
        }
    }
}

Match.prototype.startGame = function(uids){
    for(var i = 0; i < uids.length; i++){
        var matcher = this.matcherInfo[uids[i]];
        matcher.status = Matcher.Match_Status.InGame;
    }
}

Match.prototype.isLessThanLimit= function(uid){//人数不足 玩家补位 不能退出
    var needMatcher = this.round >= this.Max_Round ? this.ppt : Object.keys(this.tableInfo).length * this.forwardCount;
    var matcherCount = Object.keys(this.matcherInfo).length;

    return needMatcher >= matcherCount;
}

Match.prototype.getMatchingTableCount = function(){
    var matchingCount = 0;
    for(var tableNo in this.tableInfo){//所有桌子都打满N盘
        if(this.tableInfo[tableNo].matchCount != this.Count_Per_Round){
            matchingCount++;
        }
    }

    return matchingCount;
}

Match.prototype.canExit = function(){
    return ! this._isForbiddenExit;
}

Match.prototype.forbiddenExit = function(){
    this._isForbiddenExit = true;
}

Match.prototype.allowExit = function(){
    this._isForbiddenExit = false;
}

/**
 * @profile: 匹配队列中的选手
 * @return: result[deskName] = [uid1,uid2...]
 * 
*/
Match.prototype.matchingUserInQueue = function(){
    var tArr = [];
    var rArr = [];
    var result = {};
    for(var uid in this.matcherInfo){
        var matcher = this.matcherInfo[uid];
        matcher.status = Matcher.Match_Status.InGame;//matching set matcher InGame
        tArr.push(uid);
    }

    while(!! tArr.length){
        var index = Math.floor(Math.random() * tArr.length);
        rArr = rArr.concat(tArr.splice(index,1));
    }
    
    var skip = 0;
    for(var tableNo in this.tableInfo){
        for(var i = 0; i < this.ppt; i++){
            result[tableNo] = !! result[tableNo] ? result[tableNo] : []
            if(!! rArr[i + skip]){
                result[tableNo].push(rArr[i + skip]);
            }
        }
        skip += this.ppt
    }

    return result;
}

//#Rank
Match.prototype.getRankByUid = function(uid){
    return this.matcherInfo[uid].rank;
}

Match.prototype.getRankCount = function(){
    return Object.keys(this.matcherInfo).length;
}

Match.prototype.updateRank = function(){//排行榜排列规则
    var rankList = [];
    for(var uid in this.matcherInfo){
        rankList.push(this.matcherInfo[uid]);
    }

    rankList.sort(function(a,b){
        if(a.score == b.score){
            return a.applyIndex - b.applyIndex
        }

        return b.score - a.score
    })

    for(var uid in this.matcherInfo){
        var item = this.matcherInfo[uid];
        for(var i = 0; i < rankList.length; i++){
            if(uid == rankList[i].uid){
                item.rank = i + 1;
            }
        }
    }
}

Match.prototype.addScore = function(uid,score){
    var item = this.matcherInfo[uid];
    item.score += score;
    this.updateRank();
}

Match.prototype.getRankUids = function(){
    var rankList = [];
    for(var uid in this.matcherInfo){
        rankList.push(uid);
    }
    return rankList;
}

//#Award
Match.prototype.getAwardInfo = function(){
    var waitAwardMatcher = this.waitAwardMatcher;
    var result = {};//result[uid] = {name:x,key:z,value:1}
    for(var i = 0; i < waitAwardMatcher.length; i++){
        var matcher = waitAwardMatcher[i];
        var awardObj =  this.award[matcher.rank - 1];
        if(!! awardObj){
            awardObj.rank = matcher.rank;
            result[matcher.uid] = awardObj;
        }else{
            result[matcher.uid] = {rank:matcher.rank};
        }
    }
    this.waitAwardMatcher = [];//重置发奖信息
    return result;
}

module.exports = Match;