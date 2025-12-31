var async = require("async");
var pomelo = require('pomelo');
var log = pomelo.app.get('mongodb');
/**
 * @box in redis, ZSET{
 * 		score:create time
 * 		value:desk info
 * }
*/
//
var Create_Club_Fee = 400;
var Max_Create_Count = 8;
var Max_Join_Count = 8;
var Max_Box_Count = 4;
var Table_In_Box = 9;

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
    this.clubService = app.get("clubService");
};

remote.prototype.createClub = function(args,callback){
    var uid = args.uid;
	var self = this;
	var createTime = Date.now() / 1000
	//检测创建的圈子数量
	var countClub = function(cb){
		var ClubModel = self.app.get('models').Club
		ClubModel.count({where:{managerId:uid},raw:true}).then(function(count){
			if(count >= Max_Create_Count){
				return cb(new Error("您创建的圈子已达到上限"));
			}
			cb(null)
		})
	}

    //较验圈子是否重名
    var checkClubName = function(cb){
        var ClubModel = self.app.get('models').Club
        ClubModel.findOne({where:{clubName:args.clubName},raw:true}).then(function(club){
            if(!!club){
                return cb(new Error("圈子名字已存在！"));
            }
            cb(null)
        })
    }

    //TODO:向代理后台请求用户
	//获取一个随机clubId
	var getRandomClubId = function(cb){
		var clubId = null;
		var ClubIdSet = self.app.get('models').ClubIdSet;
		ClubIdSet.findOne({attributes:['clubId']}).then(function(result){
			clubId = result.clubId;
			return ClubIdSet.destroy({where:{clubId:clubId}})
		}).then(function(sth){
			cb(null,clubId);
		})
		// createClubInDB报错 在getRandomClubId里面捕捉到？？？
		// .catch(function(err){
		// 	console.log("2. ---------------->>> getRandomClubId:",err);
		// 	cb(err);
		// })
	}
	//创建圈子数据库内容
	var createClubInDB = function(clubId,cb){
		var ClubModel = self.app.get('models').Club
		var instance = ClubModel.build({clubId:clubId,clubName:args.clubName,roomCard:Create_Club_Fee,
            tel:args.tel, createTime:createTime,clubIcon:args.clubIcon,managerId:uid});
		instance.save().then(function(){
			cb(null,clubId);
		})
    }
    //将管理员写入clubMember
    var addToClubMember = function(clubId,cb){
        var ClubMember = self.app.get("models").ClubMember;
        var instance = ClubMember.build({clubId:clubId,userId:uid});
        instance.save().then(function(){
            cb(null,clubId);
        })
    }
	//
	async.waterfall([countClub,checkClubName,getRandomClubId,createClubInDB,addToClubMember],function(err,clubId){
		if(!! err){
			callback(null,{code:500,msg:err.message});
			return;
        }
        //
		var club = args;
		club.clubId = clubId;
		club.managerId = uid;
		club.roomCard = Create_Club_Fee;
        club.costRoomCard = 0;
        club.members = [uid];
		club.membersCnt = 1;
		club.createTime = createTime;
        self.clubService.addClub(club);
		callback(null,{code:200,club:club});
		log.insert({cmd:"addClubRoomCard", addNum: Create_Club_Fee, leftNum:Create_Club_Fee, clubId: clubId});
	})
}

//TODO:暂时不支持圈子解散
remote.prototype.dissolutionClub = function(args,callback){
    var uid = args.uid;
	var clubId = args.clubId;
	var self = this;
	var ClubModel = self.app.get("models").Club;
	var ClubMember = self.app.get("models").ClubMember;

	var club = self.clubService.getClub(clubId);
	if(! club){
		return callback(null,{code:500,msg:"未缓存的圈子 非法操作"});
	}

	if(club.managerId != uid){
		return callback(null,{code:500,msg:"不是圈子管理员 非法操作"});
	}

	//check box
	var checkBox = function(cb){
		var redisClient = self.app.get("redisClient");
		var params = ["Club:"+clubId,"-inf","+inf"]
		redisClient.zcount(params,function(err,replay){
			if(!! err){
				return cb(new Error("服务器未知错误，err:"+err.message));
			}

			if(replay != 0){
				return cb(new Error("仍有房间未解散 请先解散房间"));
			}
			
			cb(null);
		})
	}
	//解散成员
	var deleteMemberInDB = function(cb){
        ClubMember.destroy({where:{clubId:clubId}}).then(function(sth){cb(null);})
	}
	//删除圈子
	var deleteClubInDB = function(cb){
		ClubModel.destroy({where:{clubId:clubId}}).then(function(sth){cb(null);})
	}
	//
	async.waterfall([checkBox,deleteMemberInDB,deleteClubInDB],function(err,result){
		if(!! err){
			return callback(null,{code:500,msg:"遇到未知错误:"+err.message});
        }
        self.clubService.removeClub(clubId);
		callback(null,{code:200,msg:"您已经成功解散圈子"});
	})
}

remote.prototype.applyJoinClub = function(args,callback){
    var uid = args.uid;
    var clubId = args.clubId;
    var self = this;

	var applyUser = null;
	var applyClub = null;

	var getClubInfo = function(cb){
		var ClubModel = self.app.get('models').Club;
		var ClubMember = self.app.get('models').ClubMember;

		if(self.clubService.isClubExist(clubId)){
			applyClub = self.clubService.getClub(clubId);
			if(~ applyClub.members.indexOf(uid)){
				return cb(new Error("您已经在圈子里，不能重复加入"))
			}
			return cb(null)
		}

		ClubModel.findOne({where:{clubId:clubId},raw:true}).then(function(club){
			if(! club){
				throw new Error("申请加入的圈子信息不存在")
			}
			applyClub = club;
			return ClubMember.findAll({where:{clubId:clubId},attributes:["userId"]})
		}).then(function(project){
			applyClub.members = []
			project.forEach(function(item){
				applyClub.members.push(item.userId);
			})
			applyClub.membersCnt = applyClub.members.length;
			if(~ applyClub.members.indexOf(uid)){
				return cb(new Error("您已经在圈子里，不能重复加入"));
			}
			cb(null);
		}).catch(function(err){
			cb(err);
		})
	}
	//加入圈子数量是否达到上限
	var countClub = function(cb){
		var ClubMember = self.app.get('models').ClubMember;
		ClubMember.count({where:{userId:uid},raw:true}).then(function(count){
			if(count >= Max_Join_Count){
				return cb(new Error("您申请加入的圈子已达到上限"));
			}
			cb(null);
		})
	}
	//是否已经申请过
	var checkApplyExist = function(cb){
		var redisClient = self.app.get("redisClient");
		var managerId = applyClub.managerId;
		//
		redisClient.hexists("Apply:"+managerId+":"+clubId,uid,function(err,reply){
			if(!! err){
				return cb(new Error("服务器出现未知错误,redis:"+err.message));
			}
			
			if(reply == 1){
				return cb(new Error("您已经申请过加入圈子，请耐心等待群主回复"));
			}

			return cb(null);
		})
	}

	var getMyUserInfo = function(cb){
		self.app.rpc.usersvr.userRemote.getMyUserInfo(null,{uid:uid},function(err,user){
			if(!! err){
				return cb(err);
			}
			applyUser = user;
			cb(null);
		})
	}

	var saveOfflineMessage = function(cb){
		var redisClient = self.app.get("redisClient");
		var applyUid = applyUser.uid;
		var applyInfo = {uid:applyUid,nickName:applyUser.nickName,faceId:applyUser.faceId,clubId:clubId,
			applyTime:Math.round(Date.now()/1000),gameId:applyUser.gameId}
		var receiveId = applyClub.managerId;
		redisClient.hset("Apply:"+receiveId+":"+clubId,applyUid,JSON.stringify(applyInfo),cb);
	}

	async.waterfall([getClubInfo,countClub,checkApplyExist,getMyUserInfo,saveOfflineMessage],function(err,res){
		if(!! err){
			callback(null,{code:500,msg:"申请加入圈子失败,请稍后再试"+err.message});
			return;
		}
		
		//该圈子信息未缓存 就缓存
		if(! self.clubService.isClubExist(applyClub.clubId)){
			self.clubService.addClub(applyClub);
		}
		callback(null,{code:200});
	})
}

remote.prototype.fetchClubApply = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var self = this;
	var redisClient = self.app.get("redisClient");
	redisClient.hgetall("Apply:"+uid+":"+clubId,function(err,reply){
		if(!! err){
			callback(null,{code:500,msg:"获取申请列表失败"});
			return;
		}

		if(! reply || reply.length == 0){
			callback(null,{code:500,msg:"暂无申请"});
			return;
		}

		var applyList = [];
		for(var key in reply){
			applyList.push(reply[key])
		}
		callback(null,{code:200,applyList:applyList});
	});
}

remote.prototype.dealClubApply = function(args,callback){
	var uid = args.uid;
	var dealUid = args.dealUid;//处理请求的uid
	var isAgree = args.isAgree;//是否同意
	var clubId = args.clubId;

	var self = this;
	var redisClient = self.app.get("redisClient");
	//请求是否存在
	var isApplyExist = function(cb){
		redisClient.hexists("Apply:"+uid+":"+clubId,dealUid,function(err,reply){
			if(!! err){
				return cb(new Error("服务器发生未知错误，redis err:"+err.message));
			}

			if(reply == 0){
				return cb(new Error("处理的请求不存在或已失效"));
			}

			cb(null);
		})
	}
	//从申请列表中移除这个请求
	var rmApplyFromDB = function(cb){
		redisClient.hdel("Apply:"+uid+":"+clubId,dealUid,function(err,reply){
			if(!! err){
				return cb(new Error("处理的请求不存在或已失效"));
			}
			cb(null);
		})
	}
	//处理结果
	var addMemberToDB = function(cb){
		if(isAgree){
			var ClubMember = self.app.get("models").ClubMember;
			ClubMember.count({where:{userId:dealUid},raw:true}).then(function(count){
				if(count > Max_Join_Count){
					return cb(new Error("该申请已经失效"));
				}
				var instance = ClubMember.build({clubId:clubId,userId:dealUid});
				instance.save().then(function(reply){cb(null);})
			})
			return;
		}
		cb(null);
	}
	//
	async.waterfall([isApplyExist,rmApplyFromDB,addMemberToDB],function(err,result){
		if(!! err){
			return callback(null,{code:500,msg:err.message});
		}
		if(isAgree && self.clubService.isClubExist(clubId)){//必定已缓存
			var club = self.clubService.getClub(clubId);
			club.members.push(dealUid);
			club.membersCnt++;
		}
		callback(null,{code:200,msg:"ok"});
	})
}

remote.prototype.exitClub = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var self = this;
	var ClubMember = self.app.get("models").ClubMember;

	var getMyUserInfo = function(cb){
		pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(null,{uid:uid},function(err,user){
			if(!! user && user.gameType && user.deskName){
				return cb(new Error("玩家在桌上 不能进行此操作"));
			}

			cb(null);
		})
	}

	var delMemberInDB = function(cb){
		ClubMember.destroy({where:{userId:uid,clubId:clubId}}).then(function(delCnt){
			if(delCnt == 0){
				return cb(new Error("玩家不在此圈子"));
			}
	
			if(self.clubService.isClubExist(clubId)){
				var club = self.clubService.getClub(clubId);
				var index = club.members.indexOf(uid);
				club.members.splice(index,1);
				club.membersCnt = club.members.length;
			}else{
				console.log("player %d del in db but not in member club %d",uid,clubId);
			}
	
			cb(null);
		})
	}

	async.waterfall([getMyUserInfo,delMemberInDB],function(err,res){
		if(!! err){
			return callback(null,{code:500,msg:err.message});
		}
		callback(null,{code:200,msg:"OK"});
	})
}

remote.prototype.kickClubMember = function(args,callback){
	var uid = args.uid;
	var kickUid = args.kickUid;
	var clubId = args.clubId;
	var self = this;

	var ClubModel = self.app.get("models").Club;
	//是否是圈子管理员
	var authRight = function(cb){
		if(self.clubService.isClubExist(clubId)){
			var club = self.clubService.getClub(clubId);
			if(club.managerId != uid){
				return cb(new Error("您没有权限进行该操作"));
			}
			return cb(null);
		}

		ClubModel.findOne({where:{clubId:clubId},raw:true}).then(function(club){
			if(club.managerId != uid){
				return cb(new Error("您没有权限进行该操作"));
			}
			cb(null);
		})
	}
	//
	async.waterfall([authRight],function(err,result){
		if(!! err){
			return callback(null,{code:500,msg:err.message});
		}
		self.exitClub({uid:kickUid,clubId:clubId},callback);
	})
}

remote.prototype.fetchClubMember = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var self = this;

	var attrs = ["uid","nickName","faceId","gameId"];
	var managerId = null;
	var createTimeMap = {};//创建时间映射表
	//查找管理员信息
	var findClubManager = function(cb){
		var ClubModel = self.app.get("models").Club;
		ClubModel.findOne({where:{clubId:clubId}}).then(function(result){
			managerId = result.managerId;
			cb(null);
		})
	}
	//查找圈子成员uids
	var findClubMember = function(cb){
		var ClubMember = self.app.get("models").ClubMember;
		ClubMember.findAll({where:{clubId:clubId},attributes:["userId","createAt"],raw:true}).then(function(project){
			var quids = [];
			project.forEach(function(item){
				createTimeMap[item.userId] = Date.parse(item.createAt) / 1000;
				quids.push(item.userId);
			})
			cb(null,quids);
		})
	}
	//查找玩家的
	var queryMemberInfos = function(quids,cb){
		self.app.rpc.usersvr.userRemote.queryUsers(null,{quids:quids,attrs:attrs},function(err,qusers){
			if(!! err){
				return cb(err);
			}

			var onlineUsers = [];
			var offlineUsers = [];
			var sUsers = [];

			for(var i = 0; i < qusers.length; i++){
				var user = qusers[i];
				user.joinTime = createTimeMap[user.uid];//add joinTime field
				if(user.uid == managerId){
					sUsers.push(user);
					continue;
				}

				if(user.isonline){
					onlineUsers.push(user);
					continue;
				}

				offlineUsers.push(user);
			}
			
			sUsers = sUsers.concat(onlineUsers).concat(offlineUsers);
			cb(null,sUsers);
		})
	}
	//
	async.waterfall([findClubManager,findClubMember,queryMemberInfos],function(err,sUsers){
		if(!! err){
			return callback(null,{code:500,msg:err.message});
		}
		callback(null,{code:200,qusers:sUsers});
	})	
}

remote.prototype.queryClubInfo = function(args,callback){
    var uid = args.uid;
    var clubId = args.clubId;
    var self = this;
    var ClubModel = self.app.get('models').Club
    

    if(this.clubService.isClubExist(clubId)){
		if(this.clubService.getClub(clubId).members.indexOf(uid) != -1){
			console.log("player %d query club failed [1]",uid);
			return callback(null,{code:500,msg:"您已经加入该圈子"});
		}
        callback(null,{code:200,clubInfo:this.clubService.getClub(clubId)})
        return;
    }

	var queryClub = null;
	var getClubInfo = function(cb){
		ClubModel.findOne({where:{clubId:clubId},raw:true}).then(function(project){
			if(! project){
				return cb(new Error("无此圈子信息"));
			}
			queryClub = project;
			cb(null,queryClub.managerId);
		})
	}

	var getClubManagerInfo = function(managerId,cb){
		self.app.rpc.usersvr.userRemote.queryUser(null,{quid:managerId},function(err,user){
			if(!! err){
				return cb(err);
			}
			queryClub.managerInfo = {nickName:user.nickName,faceId:user.faceId};
			cb(null)
		})
    }
    
    var getClubMemberInfo = function(cb){
		var ClubMember = self.app.get("models").ClubMember;
		if(!! queryClub.members){
			return cb(null);
		}

        ClubMember.findAndCountAll({where:{clubId:clubId}}).then(function(res){
            queryClub.membersCnt = res.count;
            queryClub.members = [];
            res.rows.forEach(function(item){
                queryClub.members.push(item.userId);
			})

			if(queryClub.members.indexOf(uid) != -1){
				console.log("player %d query club failed [2]",uid);
				return cb(new Error("您已经加入该圈子"));
			}
			cb(null);
        })
    }

	async.waterfall([getClubInfo,getClubManagerInfo,getClubMemberInfo],function(err,info){
		if(!! err){
			callback(null,{code:500,msg:"没有查询到相应圈子信息，请联系管理员。"});
			return;
        }
		//
		if(! self.clubService.isClubExist(queryClub.clubId)){
			self.clubService.addClub(queryClub);
		}
		callback(null,{code:200,clubInfo:queryClub});
	})
}

remote.prototype.queryMyClubInfo = function(args,callback){
    var uid = args.uid;
    var self = this;
    var ClubMember = self.app.get('models').ClubMember;
    var ClubModel = self.app.get('models').Club;
    
	var queryClubs = [];
	var getClubIds = function(cb){
		ClubMember.findAll({where:{userId:uid}}).then(function(project){
			if(! project || project.length == 0){
				return cb(new Error("您还没有加入任何圈子"));
			}
			var clubIds = [];
			project.forEach(function(item){
				clubIds.push(item.clubId);
			})
			cb(null,clubIds);
		})
	}

	var getClubInfos = function(ids,cb){
        var queryIds = [];
		
        ids.forEach(function(clubId){
            if(self.clubService.isClubExist(clubId)){
                queryClubs.push(self.clubService.getClub(clubId));
            }else{
                queryIds.push(clubId)
            }
		})
		
		ClubModel.findAll({where:{clubId:queryIds},raw:true}).then(function(project){
			if(! project){
				return cb(new Error("服务器发生未知错误,请稍后再试"));
			}
			
			queryClubs = queryClubs.concat(project);
			cb(null,queryIds);
		})
	}

	var getClubMemberInfo = function(queryIds,cb){
		ClubMember.findAll({where:{clubId:queryIds}}).then(function(project){
			var clubSet = {}
			project.forEach(function(item){
				if(! clubSet[item.clubId]){
					clubSet[item.clubId] = [];
				}
				clubSet[item.clubId].push(item.userId);
			})

			queryClubs.forEach(function(club){
				if(! clubSet[club.clubId]){
					return;
				}
				club.members = clubSet[club.clubId];
				club.membersCnt = clubSet[club.clubId].length;
			})
			cb(null);
		})
	}

	async.waterfall([getClubIds,getClubInfos,getClubMemberInfo],function(err,result){
		if(!! err){
			callback(null,{code:500,msg:err.message});
			return;
		}
		//将没有的club加入
		queryClubs.forEach(function(club){
			if( self.clubService.isClubExist(club.clubId)){
				return ;
			}
			self.clubService.addClub(club);
		})
		callback(null,{code:200,clubInfo:queryClubs});
	})
}

remote.prototype.createBox = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var tableInfo = args.tableInfo;
	var gameType = tableInfo.gameType;
	var boxId = args.boxId;
	var self = this;

	var ClubModel = self.app.get("models").Club;
	var redisClient = self.app.get("redisClient");
	var applyClub = null;
	var authRight = function(cb){
		ClubModel.findOne({where:{clubId:clubId,managerId:uid}}).then(function(club){
			if(! club){
				return cb(new Error("非圈子管理员 不能创建包厢"));
			}
			applyClub = club;
			cb(null);
		})
	}

	var getBoxCount = function(cb){
		if(!! boxId){//如果invoke 传入boxId 不在检测。
			return cb(null,boxId);
		}
		var params = ["Club:"+clubId,"-inf","+inf"];
		redisClient.zcount(params,function(err,reply){
			if(! args.isResume && reply >= Max_Box_Count){
				return cb(new Error("圈子创建包厢数已满"));
			}

			boxId = Date.now()
			cb(null,boxId)
		})
	}

	var createBoxInDB = function(boxId,cb){
		//如果是服务器恢复玩家房间，将不检测玩家钻石是否满足
		var roomCard = args.isResume ? Number.MAX_SAFE_INTEGER : applyClub.roomCard;
		self.app.rpc.desknamesvr.deskNameRemote.createBox(null,{
			creatorUid:uid,
			createCnt:Table_In_Box,
			gameType:gameType,
			tableInfo:tableInfo,
			clubId:clubId,
			boxId:boxId},{roomCard:roomCard,uid:uid},function(err,deskNameList){
			if(!! err){
				return cb(new Error(err.msg));
			}
			//如果是恢复内存数据 不在将数据写入redis
			if(!! args.boxId){
				return cb(null);
			}
			var params = ["Club:"+clubId,boxId,JSON.stringify({tableInfo:tableInfo,creatorUid:uid,createTime:boxId})]
			redisClient.zadd(params,cb);
		})
	}

	async.waterfall([authRight,getBoxCount,createBoxInDB],function(err,res){
		if(!! err){
			callback(null,{code:500,msg:err.message});
			return;
		}
		console.log("createBox ------------>>>",boxId);
		callback(null,{code:200,boxId:boxId});
	})
}

remote.prototype.dissolutionBox = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var boxId = args.boxId;

	var self = this;
	var gameType = null;
	var creatorUid = null;
	//是否有权限解散桌子
	var authRight = function(cb){
		var redisClient = self.app.get("redisClient");
		var params = ["Club:"+clubId,boxId,boxId];
		redisClient.zrangebyscore(params,function(err,reply){
			if(!reply || reply.length == 0){
				return cb(new Error("解散的房间不存在 请稍后再试"));
			}

			try{
				var boxInfo = JSON.parse(reply[0]);
				var creatorUid = boxInfo.creatorUid;
				gameType = boxInfo.tableInfo.gameType;
				if(creatorUid != uid){
					return cb(new Error("您无权解散该圈子"));
				}
				cb(null)
			}catch(err){
				throw err
			}
		})
	}
	//解散桌子
	var dissolutionBox = function(cb){
		self.app.rpc.desknamesvr.deskNameRemote.dissolutionBox(null,{clubId:clubId,boxId:boxId,gameType:gameType,uid:uid},function(err,res){
			if(!! err){
				return cb(new Error(err));
			}
			cb(null);
		})
	}
	//解散包厢
	var dissolutionBoxInDB = function(cb){
		var redisClient = self.app.get("redisClient");
		var params = ["Club:"+clubId,boxId,boxId]
		redisClient.zremrangebyscore(params,function(err,reply){
			if(!! err){
				return cb(new Error("服务器发生未知错误:" + err.message));
			}
			cb(null);
		})
	}
	//
	async.waterfall([authRight,dissolutionBox,dissolutionBoxInDB],function(err,result){
		if(!! err){
			return callback(null,{code:500,msg:err.message});
		}
		callback(null,{code:200});
	})
}

remote.prototype.modifyBox = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var tableInfo = args.tableInfo;
	var gameType = tableInfo.gameType;
	var boxId = args.boxId;
	var self = this;

	self.dissolutionBox(args,function(err,result){
		if(result.code == 500){
			return callback(null,result);
		}
		delete args.boxId;//生成一个新的boxId
		self.createBox(args,callback);
	})
}

remote.prototype.fetchBoxInfo = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var self = this;
	var club = self.clubService.getClub(clubId);
	var clubIcon = club.clubIcon;
	var redisClient = self.app.get("redisClient");
	var params = ["Club:"+clubId,"-inf","+inf","WITHSCORES"];
	redisClient.zrangebyscore(params,function(err,reply){
		if(!! err){
			callback(null,{code:500,msg:"查询失败,请稍后再试"});
			return;
		}

		var boxInfo = []
		for(var i = 0; i < reply.length; i += 2){
			var item = JSON.parse(reply[i]);
			item.boxId = reply[i+1];
			item.clubIcon = clubIcon;
			boxInfo.push(item);
		}

		callback(null,{code:200,boxInfo:boxInfo});
	})
}

remote.prototype.fetchDeskNameList= function(args,callback){
	var clubId = args.clubId;
	var uid = args.uid;
	var boxId = !! args.boxId ? args.boxId : 0;
	var self = this;
	var boxInfo = null;
	var hasApply = false;
	var frozenGameType = null;

	var club = self.clubService.getClub(clubId);
	if(! club){
		return callback(null,{code:500,msg:"未缓存的圈子 非法操作"});
	}

	if(club.isOpen == 0){
		return callback(null,{code:500,msg:"亲友圈已经打样，请稍后再试"});
	}

	var countApply = function(cb){
		var redisClient = self.app.get("redisClient");
		if(club.managerId != uid){
			return cb(null);
		}

		redisClient.hlen("Apply:"+uid+":"+clubId,function(err,replay){
			if(!! err){
				return cb(new Error("服务器未知错误，Redis:"+err.message));
			}

			console.log("countApply replay is------->>>",replay);
			hasApply = replay == 0 ? false : true;
			cb(null);
		})
	}
	var isExistBox = function(cb){
		var redisClient = self.app.get("redisClient");
		if(!! boxId){
			var params = ["Club:"+clubId,boxId,boxId]
			redisClient.zrangebyscore(params,function(err,reply){
				if(!! err){
					return cb(err);
				}
				if(reply.length == 0){//没有房间
					boxId = 0;
				}
				cb(null);
			})
			return;
		}
		cb(null);
	}
	//如果服务器出现意外 此时尝试恢复包厢。
	var isNeedResumeBox = function(cb){
		var redisClient = self.app.get("redisClient");
		if(!! boxId){
			var params = ["Club:"+clubId,boxId,boxId]
			redisClient.zrangebyscore(params,function(err,reply){
				if(!! err){
					return cb(err);
				}
				if(reply.length == 0){//没有房间
					return cb(null,false);
				}

				boxInfo = JSON.parse(reply[0]);
				frozenGameType = boxInfo.tableInfo.gameType;
				self.app.rpc.desknamesvr.deskNameRemote.isExistBox(null,{clubId:clubId,boxId:boxId},function(err,isExist){
					if(reply.length == 1 && ! isExist){//在DB中有数据 而内存中没有
						return cb(null,reply[0]);
					}
					cb(null,false);
				})
			})
		}else{//第一次拉取信息的时候
			var params = ["Club:"+clubId,0,0,"WITHSCORES"]
			redisClient.zrange(params,function(err,reply){
				if(!! err){
					return cb(err);
				}
				if(reply.length == 0){//没有房间
					return cb(null,false);
				}

				boxInfo = JSON.parse(reply[0]);
				boxId = reply[1];
				frozenGameType = boxInfo.tableInfo.gameType;
				self.app.rpc.desknamesvr.deskNameRemote.isExistBox(null,{clubId:clubId,boxId:boxId},function(err,isExist){
					if(!! reply.length && ! isExist){//在DB中有数据 而内存中没有
						return cb(null,reply[0]);
					}
					cb(null,false);
				})
			})
		}
	}
	//该游戏类型是否冻结
	var isGameFreeze = function(createBoxInfo,cb){
		self.app.rpc.desknamesvr.deskNameRemote.isGameFrozen(null,{gameType:frozenGameType},function(err,res){
			if(res.isFrozen){
				return cb(new Error(res.msg));
			}
			cb(null,createBoxInfo);
		})
	}
	//尝试恢复房间
	var tryResumeBox = function(createBoxInfo,cb){
		if(!! createBoxInfo){
			try{
				createBoxInfo = JSON.parse(createBoxInfo);
				var creatorUid = createBoxInfo.creatorUid;
				var tableInfo = createBoxInfo.tableInfo;
				var gameType = tableInfo.gameType;
				self.createBox({uid:creatorUid,gameType:gameType,tableInfo:tableInfo,clubId:clubId,boxId:boxId,isResume:true},function(err,res){
					if(res.code == 500){
						return cb(new Error(res.msg));
					}
					cb(null);
				})
			}catch(err){
				throw(err);
			}
			return;
		}
		cb(null);
	}
	//获取房间名列表
	var getDeskBoxList = function(cb){
		self.app.rpc.desknamesvr.deskNameRemote.getBoxDeskList(null,{clubId:clubId,boxId:boxId},function(err,deskNameList){
			if(!! err){
				return cb(err);
			}
			cb(null,deskNameList)
		});
	}

	async.waterfall([countApply,isExistBox,isNeedResumeBox,isGameFreeze,tryResumeBox,getDeskBoxList],function(err,deskNameList){
		if(!! err){
			console.log("fetch deskName list err -------->>>",err);
			callback(null,{code:500,msg:err.message});
			return;
		}
		callback(null,{code:200,deskNameList:deskNameList,boxInfo:boxInfo,boxId:boxId,hasApply:hasApply});
	})
}

remote.prototype.fetchDeskList = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var boxId = args.boxId;
	var deskNameList = args.deskNameList;
	//
	var self = this;
	var getBoxInfo = function(cb){
		var redisClient = self.app.get("redisClient");
		var params = ["Club:"+clubId,boxId,boxId]
		redisClient.zrangebyscore(params,function(err,reply){
			if(!! err){
				return cb(err);
			}
			var boxInfo = JSON.parse(reply[0]);
			var gameType = boxInfo.tableInfo.gameType;
			cb(null,gameType);
		})
	}

	var getDeskInfo = function(gameType,cb){
		var fetchFuncs = [];
		var deskMap = {};
		var deskList = [];
		deskNameList.forEach(function(deskName){
			var fetchFunc = function(scb){
				self.app.rpc[gameType].gameRemote.queryDeskInfo(deskName,{deskName:deskName},function(err,result){
					if(!! err){
						return scb(err);
					}
					var xDeskName = result.deskInfo.tableNo || result.deskInfo.deskName;
					var totalGameCount = result.deskInfo.allowGameTimes || result.deskInfo.totalGameCount;
					var gameCount = result.deskInfo.gameTimes || result.deskInfo.gameCount;
					deskMap[deskName] = {deskName:xDeskName,totalGameCount:totalGameCount,gameCount:gameCount,playerInfo:result.playerInfo};
					scb(null);
				})
			}
			fetchFuncs.push(fetchFunc);
		})

		async.parallel(fetchFuncs,function(err,results){
			if(!! err){
				console.log("fetchDeskList err--------->>>",err);
				return cb(err);
			}
			for(var i = 0; i < deskNameList.length; i++){
				deskList.push(deskMap[deskNameList[i]]);
			}
			cb(null,deskList);
		})
	}

	async.waterfall([getBoxInfo,getDeskInfo],function(err,deskList){
		if(!! err){
			return callback(null,{code:500,msg:err.message});
		}
		callback(null,{code:200,deskList:deskList});
	})
}

remote.prototype.onPlayerSitdown = function(args,callback){
	var clubId = args.clubId;
    var boxId = args.boxId;
    pomelo.app.rpc.chatsvr.chatRemote.pushMessageToRoom(null, "OnUserSitDown", args, clubId, boxId, callback);
}

remote.prototype.onPlayerSitup = function(args,callback){
	var clubId = args.clubId;
	var boxId = args.boxId;
	var uid = args.uid;
	var deskName = args.deskName;
    pomelo.app.rpc.chatsvr.chatRemote.pushMessageToRoom(null, "OnUserSitUp", args, clubId, boxId, function(err,result){
		pomelo.app.rpc.chatsvr.chatRemote.leaveRoomChannel(null,uid,callback);
	});
}

remote.prototype.onStartGame = function(args,callback){
	var clubId = args.clubId;
	var boxId = args.boxId;
	var gameType = args.gameType;
	var deskName = args.deskName;
    pomelo.app.rpc.chatsvr.chatRemote.pushMessageToRoom(null, "OnClubGameStart", args, clubId, boxId, callback);
}

/**
 * @profile:为游戏服提供的相关服务
 * */
remote.prototype.costRoomCard = function(args,callback){
	var clubId = args.clubId;
	var costNum = args.costNum;
	var deskId = args.deskId;
	var self = this;
	var club = self.clubService.getClub(clubId);
	var ClubModel = self.app.get("models").Club;
    var ClubCost = self.app.get("models").ClubCost;
	if(! club){
		return callback({err:true,msg:"从一个未缓存亲友圈 非法操作"});
	}

    pomelo.app.rpc.usersvr.userRemote.costRoomCard(null,
        {uid:club.managerId, costNum:costNum},callback);

    // if(club.roomCard < costNum){
	// 	return callback({err:true,msg:"钻石不足 请联系管理员充值钻石"});
	// }
    //
	// ClubModel.update({roomCard:club.roomCard-costNum, costRoomCard:club.costRoomCard+costNum},{where:{clubId:clubId}}).then(function(res){
	// 	club.roomCard -= costNum;
	// 	club.costRoomCard += costNum;
	// 	callback(null,res);
     //    log.insert({cmd:"costClubRoomCard", costNum: costNum, deskId:deskId, leftNum: club.roomCard, clubId: clubId});
    //
	// 	ClubCost.create({clubId:clubId, roomCard:costNum, logData:JSON.stringify({deskId:deskId, leftCards:club.roomCard})});
	// }).catch(function(err){
	// 	console.log("[clubRemote] cost room card err --------->>>",err);
	// 	callback(err);
	// })
}

remote.prototype.addRoomCard = function(args,callback){
    var clubId = args.clubId;
    var cardNum = parseInt(args.cards||0);
    console.log("club addcard:", args);
    if(cardNum<1){
    	return callback(null, {code:102, msg:"钻石参数非法"});
	}
    var self = this;
    var ClubModel = self.app.get("models").Club;
    ClubModel.findOne({where:{clubId:clubId}}).then(function(club){
    	if(!club){
    		callback(null, {code:101, msg:"圈子不存在"});
		} else {
            club.roomCard += cardNum;
            club.save({attributes: ['roomCard']}).then(function(){
                var c = self.clubService.getClub(clubId);
                if(!!c){
                    c.roomCard += cardNum;
                }
                //todo: 这里没有通知客户端，导致要退出圈子重新进入才刷新
                log.insert({cmd:"addClubRoomCard", addNum: cardNum, leftNum: club.roomCard, clubId: clubId});
                callback(null,{code:200});
			})
		}
        // callback(null,res);
    }).catch(function(err){
    	console.log("club addcard:", errr);
        callback(err);
    })
}

remote.prototype.onEndGroupDesk = function(args,callback){
	var clubId = args.clubId;
	var boxId = args.boxId;
	var deskName = args.deskName;
	var self = this;
	//获取房间参数
	var getBoxInfo = function(cb){
		var redisClient = self.app.get("redisClient")
		var params = ["Club:"+clubId,boxId,boxId];
		redisClient.zrangebyscore(params,function(err,reply){
			if(!! err){
				return cb(err);
			}
			if(reply.length == 0){
				return cb(new Error("查询的包厢信息不存在"));
			}
			cb(null,JSON.parse(reply[0]));
		})
	}
	//创建桌子
	var createDesk = function(boxInfo,cb){
		var tableInfo = boxInfo.tableInfo;
		var creatorUid = boxInfo.creatorUid;
		var gameType = boxInfo.tableInfo.gameType;

		tableInfo.uid = creatorUid;
		tableInfo.isReplace = true;
		tableInfo.deskName = deskName;
		tableInfo.clubId = clubId;
		tableInfo.boxId = boxId;
		//无论圈子的房卡是否足够 桌子还是要重新创建的 只不过是开不了局
		pomelo.app.rpc.desknamesvr.deskNameRemote.lockDeskName(null,
			{gameType:gameType,deskName:deskName,uid:creatorUid,isReplace:true},function(err,res){
			self.app.rpc[gameType].gameRemote.createDesk(deskName,tableInfo,{roomCard:Number.MAX_SAFE_INTEGER,uid:creatorUid},cb);
		})
	}
	//
	async.waterfall([getBoxInfo,createDesk],function(err,result){
		if(!! err){
			return callback(err);
		}
		callback(null,"OK");
	})
}

/**
 * @profile: 添加
*/
remote.prototype.invitePlayer = function(args,callback){
	var uid = args.uid;
	var inviteGameId = args.inviteGameId;
	var clubId = args.clubId;
	var inviteUid = null;

	var self = this;
	var club = self.clubService.getClub(clubId);
	var ClubMember = self.app.get("models").ClubMember;
	if(! club){
		callback(null,{code:500,msg:"该圈子未缓存，非法操作，请联系管理员"});
		return;
	}

	if(club.managerId != uid){
		callback(null,{code:500,msg:"您不是圈子管理员 不能操作"});
		return;
	}

	var checkInvite = function(cb){
		self.app.get('models').UserInfo.findOne({where:{gameId:inviteGameId},raw:true}).then(function(project){
			if(! project){
				cb(new Error("邀请的玩家不存在，请仔细核对后，重新邀请"));
				return;
			}

			inviteUid = project.uid;

			if(club.members.indexOf(inviteUid) != -1){
				cb(new Error("该玩家已经是圈子成员"));
				return;
			}
			

			cb(null);
		})
	}

	var countClub = function(cb){
		ClubMember.count({where:{userId:inviteUid}}).then(function(count){
			if(typeof count == "number" && count >= Max_Join_Count){
				return cb(new Error("邀请的玩家加入圈子已达到上限"));
			}

			cb(null);
		})
	}

	var addMemberInDB = function(cb){
		var instance = ClubMember.build({userId:inviteUid,clubId:clubId})
		instance.save().then(function(reply){
			club.members.push(inviteUid);
			club.membersCnt++;
			cb(null)}
		)
	}

	async.waterfall([checkInvite,countClub,addMemberInDB],function(err,res){
		if(!! err){
			return callback(null,{code:500,msg:err.message});
		}

		callback(null,{code:200,msg:"成功添加玩家"})
	})
}

remote.prototype.invitePlayGame = function(args,callback){
	var uid = args.uid;
	var inviteUid = args.inviteUid;
	var gameType = args.gameType;
	var nickName = args.nickName;
	var deskName = args.deskName;

	var self = this;
	//玩家在线 且不在游戏中
	var checkPlayer = function(cb){
		self.app.rpc.usersvr.userRemote.queryUsers(null,{quids:[inviteUid],attrs:['uid','deskName','gameType','isOnline']},function(err,users){
			if(!! err){
				return cb(new Error("服务器未知错误:"+err.message));
			}

			var user = users[0];
			if(! user.isOnline){
				return cb(new Error("玩家不在线"));
			}

			if(!! user.gameType){
				return cb(new Error("玩家在正在游戏....."));
			}

			cb(null)
		})
	}

	async.waterfall([checkPlayer],function(err,result){
		if(!! err){
			return callback(null,{code:500,msg:err.message});
		}

		self.app.rpc.chatsvr.chatRemote.pushMessageToUsers(null,"OnClubInvite",[inviteUid],
		{nickName:nickName,uid:uid,gameType:gameType,deskName:deskName},function(){})

		callback(null,{code:200,msg:"邀请已发送！！！"});
	})
}

remote.prototype.renameClub = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;
	var newName = args.newName;

	var self = this;
	var club = self.clubService.getClub(clubId);
	var clubModel = self.app.get("models").Club;
	if(! club){
		return callback(null,{code:500,msg:"未缓存俱乐部，非法操作"});
	}

	if(club.managerId != uid){
		return callback(null,{code:500,msg:"不是俱乐部管理员 无权改名"});
	}

	clubModel.update({clubName:newName},{where:{clubId:clubId}}).then(function(res){
		club.clubName = newName;//update cache
		callback(null,{code:200,msg:"OK"});
	}).catch(function(err){
		callback(null,{code:500,msg:"服务器未知错误，mysql:" + err.message});
	})
}

remote.prototype.isMember = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;

	var club = this.clubService.getClub(clubId);
	var isExist = club.members.indexOf(uid) != -1;

	if(club.isOpen == 0){
		callback({err:true,msg:"亲友圈已打样，请稍后再试"});
	}

	callback(null,isExist);
}

remote.prototype.isManager = function(args,callback){
	var uid = args.uid;
	var clubId = args.clubId;

	var club = this.clubService.getClub(clubId);
	if(! club){
		return callback(new Error("非法操作，亲友圈未缓存"));
	}

	callback(null,club.managerId == uid);
}