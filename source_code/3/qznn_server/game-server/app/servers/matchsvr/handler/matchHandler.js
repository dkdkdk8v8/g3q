var async = require("async");
var pomelo = require("pomelo")
var log = pomelo.app.get('mongodb');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
	this.matchService = this.app.get("matchService")
};

//获取当前比赛列表
Handler.prototype.fetchMatchList = function(msg,session,next){
	var uid = msg.uid;

	if(uid != session.uid){
		return next(null,{code:500,msg:"参数信息不正确"});
	}	
	//init match
	if(this.matchService.getMatchCount() == 0){
		var keys = this.app.get("config")["matchList"]
		for(var i = 0; i < keys.length; i++){
			this.matchService.addMatch(i);
		}
	}
	//
	next(null,{code:200,matchInfos:this.matchService.getMatchInfo(uid)});
}

//报名参赛
Handler.prototype.applyJoinMatch = function(msg,session,next){
	var uid = msg.uid;
	var mid = msg.mid;
	var self = this;
	if(! uid || ! mid){
		return next(null,{code:500,msg:"参数信息不正确"});
	}

	var match = self.matchService.getMatch(mid);

	if(match.isStart() || match.isEnd()){
		return next(null,{code:500,msg:"比赛已经开始 请刷新页面 重新选择一场比赛"});
	}
	//是否再其它游戏
	var isJoinOtherGame = function(cb){
		self.app.rpc.usersvr.userRemote.getMyUserInfo(uid,{uid:uid},function(err,user){
			if(!! err){
				return cb(new Error(err.msg));
			}

			if(user.gameType && user.deskName){
				return cb(new Error("您已加入其他游戏 不能报名比赛"));
			}

			cb(null);
		})
	}
	//扣钻 加入比赛
	var costMatchFee = function(cb){
		if(!! self.matchService.getMatchByUid(uid)){
			return cb(new Error("您已报名参加其它比赛，请耐心等候~~"));
		}

		self.app.rpc.usersvr.userRemote.costRoomCard(null,{uid:uid,costNum:match.fee},function(err,result){
			if(!! err){
				return cb(new Error(err.msg));
			}
			log.insert({cmd:"match_cost_fee","uid":uid,"costNum":match.fee,"type":match.type});
			cb(null)
		})
	}
	//TODO:锁死玩家---->>>这里是一种取巧的写法 将玩家的桌子信息设为mid
	var joinMatch = function(cb){
		match.addMatcher(uid);
		self.matchService.notifyNewEnter(match);//通知有人加入比赛
		self.matchService.checkStart(mid);//检查是否能开赛
		cb(null);
	}

	async.waterfall([isJoinOtherGame,costMatchFee,joinMatch],function(err,result){
		if(!! err){
			var errCode = err.code || 500;
			return next(null,{code:errCode,msg:err.message});
		}
		next(null,{code:200,msg:"恭喜您报名成功,请耐心等候~"});
	})
}

//退出游戏
Handler.prototype.exitMatch = function(msg,session,next){
	var uid = session.uid;
	var mid = msg.mid;
	var self = this;
	if(! uid || ! mid){
		return next(null,{code:500,msg:"参数信息不正确"});
	}
	var match = self.matchService.getMatch(mid);

	if(! match){
		return next(null,{code:500,msg:"无法查询到该比赛信息 请检查信息正确性"});
	}

	if(! match.isExistMatcher(uid)){
		return next(null,{code:500,msg:"您没有参与该场比赛 非法操作!!!"});
	}

	if(match.isStart() && match.isLessThanLimit()){
		return next(null,{code:500,msg:"您已晋级 不能退出比赛 请耐心等候"});
	}

	if(! match.canExit()){
		return next(null,{code:500,msg:"此阶段不能退出 请稍后再试"});
	}

	var addRoomCard = function(cb){
		if(match.isStart()){//比赛开始不退钻
			return cb(null,true);
		}
		log.insert({cmd:"match_back_fee","uid":uid,"addNum":match.fee,"type":match.type});
		self.app.rpc.usersvr.userRemote.addRoomCard(null,{uid:uid,cardNum:match.fee},cb);
	}

	var leaveGame = function(isSuccessed,cb){
		if(match.isStart()){//比赛开始了 先退出桌子
			var gameType = msg.gameType;
			var deskName = msg.deskName;
			self.app.rpc[gameType].gameRemote.leaveMatchTable(deskName,{deskName:deskName,gameType:gameType,uid:uid},cb);
		}else{
			self.app.rpc.usersvr.userRemote.leaveGame(null,{uid:uid,gameType:match.type,deskName:match.mid},cb);
		}
	}

	async.waterfall([addRoomCard,leaveGame],function(err,result){
		if(!! err){
			return next(null,{code:500,msg:"退还房卡产生错误，请稍后再尝试!!!"});
		}
		match.removeMatcher(uid);
		self.matchService.notifyNewEnter(match);//通知有人加入比赛
		self.matchService.notifyRank(match);
		next(null,{code:200,msg:"OK"});
	})
}

//获取排行榜
Handler.prototype.fetchMyRank = function(msg,session,next){
	var uid = msg.uid;

	if(! uid){
		return next(null,{code:500,msg:"参数信息不正确"});
	}

	var match = this.matchService.getMatchByUid(uid);

	next(null,{
		code:200,
		totalRank:match.getRankCount(),
		rank:match.getRankByUid(uid),
	});
}

//获取战绩
Handler.prototype.fetchMyAwardHistory = function(msg,session,next){
	var uid = msg.uid;
	if(! uid || uid != session.uid){
		return next(null,{code:500,msg:"参数信息不正确"});
	}

	var MatchAward = this.app.get("models").MatchAward;
	MatchAward.findAll({where:{uid:uid},raw:true}).then(function(results){
		var awardList = [];
		for(var i = results.length - 1; i >= 0; i --){
			var item = results[i];
			var date = new Date(item.time);
			var month = date.getMonth() + 1;
			month = month < 10 ? "0" + month : month;
			var day = date.getDate();
			day = day < 10 ? "0" + day : day;
			var hour = date.getHours();
			hour = hour < 10 ? "0" + hour : hour;
			var minute = date.getMinutes();
			minute = minute < 10 ? "0" + minute : minute;

			var sDate = month + "月" + day + "日" + hour + ":" + minute;
			var name = item.matchName;
			var awardName = "其它";
			if(item.awardName == "roomCard"){
				awardName = "钻石"
			}else if(item.awardName == "coupon"){
				awardName = "礼券"
			}
			var awardNum = item.awardNumber;
			var result = "恭喜您在" + sDate + "时开始的“" + name + "”中获得了" + awardName + "X" + awardNum;
			awardList.push(result);
		}
		next(null,{code:200,awardList:awardList});
	})
}

