var async = require("async")
var pomelo = require("pomelo")
var request = require('request');
var redis = require("redis");

/**
 * @profile:俱乐部相关接口
 * @struct:club->box->table
*/
module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
	this.clubService = app.get("clubService");
};

//获取验证码
Handler.prototype.getCheckCode = function(msg,session,next){
	var self = this;
    var redisClient = this.app.get("redisClient");

    var reg= /^0?(13\d|14[5,7]|15[0-3,5-9]|17[0135678]|18\d)\d{8}$/;
    var f = reg.test(msg.tel);
    if(!f){
        return next(null, {code:101, msg:"手机号错误!"});
    }

    var notifyurl = "http://daili.huomgame.com/club/smcode?t="+ (new Date()).getTime();
    request({
        uri : notifyurl,
        method : "POST",
        body : {
            tel:msg.tel
        },
        json : true,
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log("code: ",body);
            var ret = body;
            if(ret.code == 200){
                var key = "clubCheck:"+session.uid;
                redisClient.set(key,ret.msg);
                redisClient.expire(key,60);
                next(null,{code:200});
			} else {
                next(null,ret);
			}
        } else {
            console.log("http error:",error, response.statusCode, body);
            next(null,{code:500,msg:"验证网络出错！"});
        }
    });
}

//创建俱乐部
Handler.prototype.checkDaili = function(msg,session,next){
	var tel = msg.tel;
	var crCode = msg.code;

    var key = "clubCheck:"+session.uid;
    var self = this;
    var redisClient = this.app.get("redisClient");

    redisClient.get(key, function(err, reply) {
        if (err) {
            console.log("key err:" + err);
            return next(null, {code:101, msg: '验证失败1!'});
        }
        if(!!reply){
            var notifyurl = "http://daili.huomgame.com/club/validateUser?t="+ (new Date()).getTime();
            request({
                uri : notifyurl,
                method : "POST",
                body : {
                    tel:tel
                },
                json : true,
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                    var ret = body;
                    if(ret.code == 200){
                        next(null,{code:200});
                    } else {
                        next(null,ret);
                    }
                } else {
                    console.log("http error:",error, response.statusCode, body);
                    next(null,{code:500,msg:"验证网络出错！"});
                }
            });
        } else {
            next(null, {code:102, msg: '无效的验证码!'});
		}
    });
}

//创建俱乐部
Handler.prototype.createClub = function(msg,session,next){
	var uid = msg.uid;
	var self = this;
	var phone = msg.tel;
	//检查参数合法性
	if(! msg.clubName || msg.clubName.length < 4 || msg.clubName.length > 20){
		return next(null,{code:500,msg:"俱乐部名字字符应该在4~20字符之间"});
	}
	msg.clubIcon = !! msg.clubIcon ? msg.clubIcon : Math.floor(Math.random(0,1) * 8 + 1) + "";

    // var notifyurl = "http://daili.huomgame.com/club/create?t="+ (new Date()).getTime();
    // request({
    //     uri : notifyurl,
    //     method : "POST",
    //     body : {
    //         tel:msg.tel
    //     },
    //     json : true,
    // }, function (error, response, body) {
    //     if (!error && response.statusCode == 200) {
    //         console.log("code: ",body);
    //         var ret = body;
    //         if(ret.code == 200){
    //             pomelo.app.rpc.clubsvr.clubRemote.createClub(null,msg,function(err,res){
    //                 next(null,res);
    //             })
    //         } else {
    //             next(null,ret);
    //         }
    //     } else {
    //         console.log("http error:",error, response.statusCode, body);
    //         next(null,{code:500,msg:"验证网络出错！"});
    //     }
    // });
    pomelo.app.rpc.clubsvr.clubRemote.createClub(null,msg,function(err,res){
        next(null,res);
    })
}

//解散俱乐部
Handler.prototype.dissolutionClub = function(msg,session,next){
	var ClubModel = pomelo.app.get('models').Club;

	if(! msg.clubId || typeof msg.clubId  != "number" || msg.clubId  < 100000 || msg.clubId  > 999999){
		return next(null,{code:500,msg:"clubId 参数不合法"});
	}
	
	pomelo.app.rpc.clubsvr.clubRemote.dissolutionClub(null,msg,function(err,res){
		next(null,res);
	})
}

//申请加入club
Handler.prototype.applyJoinClub = function(msg,session,next){
	if(! msg.uid || ! msg.clubId){
		return next(null,{code:500,msg:"客户端参数不正确"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.applyJoinClub(null,msg,function(err,res){
		next(null,res);
	})
}

//拉取申请消息
Handler.prototype.fetchClubApply = function(msg,session,next){
	if(! msg.uid | ! msg.clubId){
		return next(null,{code:500,msg:"客户端参数不正确"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.fetchClubApply(null,msg,function(err,res){
		next(null,res);
	})
}

//处理申请消息
Handler.prototype.dealClubApply = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;
	var dealUid = msg.dealUid;//处理请求的uid
	var isAgree = msg.isAgree;//是否同意
	if(! uid || ! dealUid || ! clubId || typeof isAgree != "boolean"){
		return next(null,{code:500,msg:"客户端参数不正确"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.dealClubApply(null,msg,function(err,res){
		next(null,res);
	})
}

//拉取成员列表
Handler.prototype.fetchClubMember = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;
	if(! uid || ! clubId){
		return next(null,{code:500,msg:"客户端参数不正确"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.fetchClubMember(null,msg,function(err,res){
		next(null,res);
	})
}

//踢出成员
Handler.prototype.kickClubMember = function(msg,session,next){
	var uid = msg.uid;
	var kickUid = msg.kickUid;
	var clubId = msg.clubId;
	if(! uid || ! kickUid || ! clubId){
		return next(null,{code:500,msg:"客户端参数不正确"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.kickClubMember(null,msg,function(err,res){
		next(null,res);
	})
}

//退出club
Handler.prototype.exitClub = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;

	if(! uid || ! clubId){
		return next(null,{code:500,msg:"客户端参数不正确"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.exitClub(null,msg,function(err,res){
		next(null,res);
	})
}

//查询club信息
Handler.prototype.queryClubInfo = function(msg,session,next){
	if(! msg.uid || ! msg.clubId){
		return next(null,{code:500,msg:"客户端参数不正确"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.queryClubInfo(null,msg,function(err,res){
		next(null,res);
	})
}

//查询自己的club信息
Handler.prototype.queryMyClubInfo = function(msg,session,next){
	if(! msg.uid){
		return next(null,{code:500,msg:"客户端参数不正确"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.queryMyClubInfo(null,msg,function(err,res){
		next(null,res);
	})
}

//创建包厢
Handler.prototype.createBox = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;
	var tableInfo = msg.tableInfo;
	
	if(! uid || ! clubId || !tableInfo){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.createBox(null,msg,function(err,res){
		next(null,res);
	})
}

//解散包厢
Handler.prototype.dissolutionBox = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;
	var boxId = msg.boxId;

	if(! uid || ! clubId || !boxId){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.dissolutionBox(null,msg,function(err,res){
		next(null,res);
	})
}

//修改玩法
Handler.prototype.modifyBox = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;
	var boxId = msg.boxId;
	var tableInfo = msg.tableInfo;
	if(! uid || ! clubId || !tableInfo || ! boxId){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.modifyBox(null,msg,function(err,res){
		next(null,res);
	})
}

//查询包厢信息
Handler.prototype.fetchBoxInfo = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;

	if(! uid || ! clubId){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.fetchBoxInfo(null,msg,function(err,res){
		next(null,res);
	})
}

//查询包厢桌子信息
Handler.prototype.fetchDeskNameList = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;
	if(! clubId || ! uid){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.fetchDeskNameList(null,msg,function(err,res){
		next(null,res);
	})
}

//查询房间桌子基本信息
Handler.prototype.fetchDeskList = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;
	var deskNameList = msg.deskNameList;
	var boxId = msg.boxId;
	if(! deskNameList || ! uid || ! clubId || ! boxId){
		return next(null,{code:500,msg:"客户端参数错误"});
	}
	var self = this;
	pomelo.app.rpc.clubsvr.clubRemote.fetchDeskList(null,msg,function(err,res){
		if(res.code != 500){
			// 广播玩家进入游戏房间
			self.app.rpc.usersvr.userRemote.getMyUserInfo(session, {uid:uid,isNeedUserInfo:true}, function(err, user) {
				if (!! err) {
					next(null,{code:500,msg:err.msg});
					return;
				}
				else {
					pomelo.app.rpc.chatsvr.chatRemote.addToRoomChannel(null, user.uid, user.sid, clubId, boxId, function() {
						next(null, res);
					});
				}
			});
		}
		next(null,res);
	})
}

//邀请成员
Handler.prototype.invitePlayer = function(msg,session,next){
	var uid = msg.uid;
	var inviteGameId = msg.inviteGameId;
	var clubId = msg.clubId;

	if(! uid || ! inviteGameId || ! clubId){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.invitePlayer(null,msg,function(err,res){
		next(null,res);
	})
}

//邀请成员游戏
Handler.prototype.invitePlayGame = function(msg,session,next){
	var uid = msg.uid;
	var nickName = msg.nickName;
	var inviteUid = msg.inviteUid;
	var gameType = msg.gameType;
	var deskName = msg.deskName;

	if(! uid || ! inviteUid || ! gameType || ! deskName || ! nickName){
		return next(null,{code:500,msg:"参数错误"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.invitePlayGame(null,msg,function(err,res){
		next(null,res);
	})
}

//修改圈子名称
Handler.prototype.renameClub = function(msg,session,next){
	var uid = msg.uid;
	var clubId = msg.clubId;
	var newName = msg.newName;
	if(! uid || ! clubId || ! newName){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	pomelo.app.rpc.clubsvr.clubRemote.renameClub(null,msg,function(err,res){
		next(null,res);
	})
}

//开启茶楼
Handler.prototype.openClub = function(msg,session,next){
	var clubId = msg.clubId;
	var club = this.clubService.getClub(clubId);
	if(! club){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	if(club.managerId != session.uid){
		return next(null,{code:500,msg:"您不是管理员，不能进行此操作"});
	}

	if(club.isOpen == 1){
		return next(null,{code:500,msg:"亲友圈已经开启，请勿重复操作"});
	}

	club.isOpen = 1;
	var ClubModel = this.app.get('models').Club;
	ClubModel.update({isOpen:1},{where:{clubId:clubId}});
	next(null,{code:200,msg:"亲友圈已开启"});
}

//关闭茶楼
Handler.prototype.closeClub = function(msg,session,next){
	var clubId = msg.clubId;
	var club = this.clubService.getClub(clubId);
	if(! club){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	if(club.managerId != session.uid){
		return next(null,{code:500,msg:"您不是管理员，不能进行此操作"});
	}

	if(club.isOpen == 0){
		return next(null,{code:500,msg:"亲友圈已经关闭，请勿重复操作"});
	}

	club.isOpen = 0;
	var ClubModel = this.app.get('models').Club;
	ClubModel.update({isOpen:0},{where:{clubId:clubId}});
	next(null,{code:200,msg:"亲友圈已打烊"});
}

//转移俱乐部
Handler.prototype.transferClub = function(msg,session,next){
	var clubId = msg.clubId,optGameId = msg.optGameId;
	var club = this.clubService.getClub(clubId);
	if(! club){
		return next(null,{code:500,msg:"客户端参数错误"});
	}

	if(club.managerId != session.uid){
		return next(null,{code:500,msg:"您不是管理员，不能进行此操作"});
	}
	var self = this;
	UserInfo = this.app.get('models').UserInfo;
	UserInfo.findOne({where:{gameId:optGameId},raw:true}).then(function(user){
		var isExist = club.members.indexOf(user.uid) != -1;
		if(! isExist){
			return next(null,{code:500,msg:"该玩家不是俱乐部成员，转移失败"});
		}
		club.managerId = user.uid;
		var ClubModel = self.app.get('models').Club;
		ClubModel.update({managerId:user.uid},{where:{clubId:clubId}});
		var redisClient = self.app.get("redisClient");

		var key = "Club:" + clubId;
		redisClient.zrangebyscore([key,"-inf","+inf","WITHSCORES"],function(err,reply){
			if(reply.length == 0){
				return;
			}
			redisClient.zremrangebyscore([key,"-inf","+inf"],function(err,res){
				for(var i = 0,len = reply.length; i < len; i += 2){
					var boxInfo = JSON.parse(reply[i]);
					boxInfo.creatorUid = user.uid;
					var score = reply[i+1];
					redisClient.zadd([key,score,JSON.stringify(boxInfo)]);
				}
			})
		})
		next(null,{code:200,msg:"OK"});
	})
}



