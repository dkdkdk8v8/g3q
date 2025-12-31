var utils = require("../../../util/utils");
var async = require("async");
var pomelo = require("pomelo");
var log = pomelo.app.get('mongodb');
var war_record_db = require('../../../../lib/war_record_db');
var daily_score_db = require('../../../../lib/daily_score_db');
var coinList = require("../../../../config/coinList.json");

var ddz_db = require('../../../../lib/ddz_db');
var sss_db = require('../../../../lib/sss_db');
var pdk_db = require('../../../../lib/pdk_db');
var redis = require("redis");

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
	this.gameList = app.get('games');
};

var handler = Handler.prototype;

handler.getGameType = function(msg, session, next) {
	msg.uid = session.uid;

	var user;
	var info = {deskName:msg.deskName};
	var self = this;
	async.waterfall([
		function(cb) {
			pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
				uid: msg.uid
			}, cb);
		},
		function(res, cb) {
			user = res;
			if (user.gameType && user.deskName) {
                var infotip = user.gameType == user.deskName ? "您已经报名比赛 请先退赛" : "当前游戏还未结束,无法进入新游戏!";
				cb({err:true, msg:infotip, gameType:user.gameType, deskName:user.deskName});
			}
			else {
				pomelo.app.rpc.desknamesvr.deskNameRemote.getDeskInfo(session, {
					deskName: msg.deskName
				}, cb);
			}
		},
		function (res, cb) {
			info.gameType = res.gameType;
			session.set("deskName", info.deskName);

			if (self.gameList[res.gameType]) {
				pomelo.app.rpc[res.gameType].gameRemote.canEnterDesk(session, {
					uid: msg.uid,
					deskName: msg.deskName
				}, user, cb);
			}
			else {
				cb({err: true, msg: "游戏类型错误!"});
			}
		}
	],
	function (err, res) {
		if (err) {
			next(null, err);
		}
		else {
			next(null, info);
		}
	});

};

handler.createDesk = function(msg, session, next) {
	msg.uid = session.uid;
	var deskName;
	var user;
	var self = this;
	async.waterfall([
			function (cb) {
				pomelo.app.rpc.desknamesvr.deskNameRemote.getDeskName(session, {
					gameType:msg.gameType,
					uid: msg.uid,
					isReplace: msg.isReplace
				}, cb);
			},
			function (res, cb) {
				deskName = res;
				pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
					uid:msg.uid
				}, cb);
			},
			function (res, cb) {
				user = res;
				if (user.gameType && user.deskName) {
                    var info = "当前游戏还未结束!无法创建新房间!"
                    if(user.gameType == user.deskName){
                        info = "您已经报名比赛，请先退赛！！"
                    }
					cb({err:true, msg:info, gameType:user.gameType, deskName:user.deskName});
				}
				else {
					session.set('deskName', deskName);
					msg.deskName = deskName;
					if (self.gameList[msg.gameType]) {
						pomelo.app.rpc[msg.gameType].gameRemote.createDesk(session, msg, user, cb);
					}
					else {
						cb({err:true, msg:"游戏类型错误!"});
					}
				}
			},
			function (res, cb) {
				if (msg.isReplace) {
                    pomelo.app.rpc.usersvr.userRemote.addReplaceRoom(session, {
                        uid: msg.uid,
                        gameType: msg.gameType,
                        deskName: deskName,
						costNum: res.costNum
                    }, cb);
				}
				else {
                    pomelo.app.rpc.usersvr.userRemote.enterGame(session, {
                        uid: msg.uid,
                        gameType: msg.gameType,
                        deskName: deskName,
                        costNum: res.costNum
                    }, cb);
                }
			}
		],
		function (err, res) {
			if (err) {
				if (deskName) {
					pomelo.app.rpc.desknamesvr.deskNameRemote.recycleDeskName(session, {deskName: deskName}, function () {});
				}
				next(null, err);
				return;
			}
			next(null, {deskName:deskName, gameType: msg.gameType, isReplace: msg.isReplace});
		});
};

handler.queryUserInfo = function (msg, session, next) {
	this.app.rpc.usersvr.userRemote.queryUserInfo(session, msg, function (err, res) {
		if (err) {
			next(null, err);
		}
		else {
			next(null, res);
		}
	});
};

handler.modifyUserInfo = function (msg, session, next) {
	this.app.rpc.usersvr.userRemote.modifyUserInfo(session, msg, function (err, res) {
		if (err) {
			next(null, err);
		}
		else {
			next(null, res);
		}
	});
};

var convertToTimeString = function(time){
    var date = new Date(time * 1000);
    var timeString = ""
    timeString += date.getFullYear()
    timeString += "-"
    timeString += date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1;
    timeString += "-"
    timeString += date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
    timeString += " "
    timeString += date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
    timeString += ":"
    timeString += date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
    timeString += ":"
    timeString += date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();
    return timeString;
}
        
var modifyObj = function(obj,target,invokeFun){
    for(var key in obj){
        if(! obj.hasOwnProperty(key)){
            continue;
        }

        if(obj[key] instanceof Object){
            modifyObj(obj[key],target,invokeFun);
        }

        if(key == target){
            obj[key] = invokeFun(obj[key]);
        }
    }

    return obj;
}

handler.queryCombatHistory = function (msg, session, next) {
	var perCount = 15;
	if (!msg.page || msg.page < 1) {
		msg.page = 1;
    }
    var clubId = !! msg.clubId ? msg.clubId : 0;
    var self = this;
    var authUid = function(cb){
        if(!! clubId){
            return pomelo.app.rpc.clubsvr.clubRemote.isManager(null,{clubId:clubId,uid:msg.uid},cb);
        }

        cb(null,false);
    }

    var queryHistory = function(isClubManager,cb){
        var elapse = isClubManager ? 24*60*60 : 7*24*60*60;
        var now = Math.round(new Date().getTime()/1000) - elapse;
        var d = new Date();
        var xnow = d.getTime();
        d.setTime(xnow-elapse*1000);
        var qObj1 = isClubManager ? {where:{clubId:clubId,endTime:{gte:now}}} : {where:{uid:msg.uid, clubId:clubId,endTime:{gte:now}}};
        var qObj2 = isClubManager ? {where:{tm_created_date:{gte:d}}}:{where:{uid:msg.uid, tm_created_date:{gte:d}}};


        if (msg.gameType == "gameNiuNiu") {
            var NiuNiuGroupInfo = self.app.get('models').NiuNiuGroupInfo;
            var NiuNiuGroupHistory = self.app.get('models').NiuNiuGroupHistory;
            NiuNiuGroupHistory.findAll(qObj1)
                .then(function (res) {
                    var ids = [];
                    for (var i = 0; i < res.length; i++) {
                        ids.push(res[i].deskId);
                    }
                    NiuNiuGroupInfo.findAndCountAll({attributes:['deskId', 'deskName', 'deskType', 'endTime', 'flag', 'res', 'createId'],
                        where:{deskId:{$in:ids}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['endTime', 'DESC']],raw:true})
                        .then(function (logs) {
                            logs = modifyObj(logs,"endTime",convertToTimeString);
                            cb(null, logs);
                        });
                });
        } else if (msg.gameType == "gameTexasPoker") {
            var now = Math.round(new Date().getTime()/1000) - 7*24*60*60;
            var TexasPokerGroupInfo = self.app.get('models').TexasPokerGroupInfo;
            var TexasPokerGroupHistory = self.app.get('models').TexasPokerGroupHistory;
            TexasPokerGroupHistory.findAll({where:{uid:msg.uid, endTime:{gte:now}}})
                .then(function (res) {
                    var ids = [];
                    for (var i = 0; i < res.length; i++) {
                        ids.push(res[i].deskId);
                    }
                    TexasPokerGroupInfo.findAndCountAll({attributes:['deskId', 'deskName', 'deskType', 'endTime', 'flag', 'res', 'createId'],
                        where:{deskId:{$in:ids}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['endTime', 'DESC']]})
                        .then(function (logs) {
                            cb(null, logs);
                        });
                });
        }
        else if (msg.gameType == "gameMaJiang_nd") {
            //var now = Math.round(new Date().getTime()/1000) - elapse;
            var MaJiangNDGroupInfo = self.app.get('models').MaJiangNDGroupInfo;
            var MaJiangNDGroupHistory = self.app.get('models').MaJiangNDGroupHistory;
            MaJiangNDGroupHistory.findAll(qObj1)
                .then(function (res) {
                    var ids = [];
                    for (var i = 0; i < res.length; i++) {
                        ids.push(res[i].deskId);
                    }
                    MaJiangNDGroupInfo.findAndCountAll({attributes:['deskId', 'deskName', 'deskType', 'endTime', 'flag', 'res', 'createId'],
                        where:{deskId:{$in:ids}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['endTime', 'DESC']],raw:true})
                        .then(function (logs) {
                            logs = modifyObj(logs,"endTime",convertToTimeString);
                            cb(null, logs);
                        });
                });
        }
        else if (msg.gameType == "gameMaJiang_gtz") {
            //var now = Math.round(new Date().getTime()/1000) - elapse;
            var MaJiangGTZGroupInfo = self.app.get('models').MaJiangGTZGroupInfo;
            var MaJiangGTZGroupHistory = self.app.get('models').MaJiangGTZGroupHistory;
            MaJiangGTZGroupHistory.findAll(qObj1)
                .then(function (res) {
                    var ids = [];
                    for (var i = 0; i < res.length; i++) {
                        ids.push(res[i].deskId);
                    }
                    MaJiangGTZGroupInfo.findAndCountAll({attributes:['deskId', 'deskName', 'deskType','startTime','endTime', 'flag', 'res', 'createId'],
                        where:{deskId:{$in:ids}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['endTime', 'DESC']]})
                        .then(function (logs) {
                            cb(null, logs);
                        });
                });
        }
        else if (msg.gameType == "gameDDZ") {
            var tableHistory = ddz_db.TableMember;
            var tableInfo = ddz_db.Table;
            tableHistory.findAll(qObj2)
                .then(function (res) {
                    var ids = [];
                    for (var i = 0; i < res.length; i++) {
                        ids.push(res[i].tableID);
                    }
                    tableInfo.findAndCountAll({where:{table_id:{$in:ids}, table_res:{$ne:""},clubId:clubId}, limit:perCount, offset:(msg.page-1)*perCount, order:[['table_created_date', 'DESC']]})
                        .then(function (logs) {
                            cb(null, logs);
                        });
                });
        }
        else if (msg.gameType == "gamePDK") {
            // var d = new Date();
            // var now = d.getTime();
            // d.setTime(now-elapse*1000);
            var tableHistory = pdk_db.TableMember;
            var tableInfo = pdk_db.Table;
            tableHistory.findAll(qObj2)
                .then(function (res) {
                    var ids = [];
                    for (var i = 0; i < res.length; i++) {
                        ids.push(res[i].tableID);
                    }
                    tableInfo.findAndCountAll({where:{table_id:{$in:ids}, table_res:{$ne:""},clubId:clubId}, limit:perCount, offset:(msg.page-1)*perCount, order:[['table_created_date', 'DESC']]})
                        .then(function (logs) {
                            cb(null, logs);
                        });
                });
        }
        else if (msg.gameType == "gameSSS") {
            // var d = new Date();
            // var now = d.getTime();
            // d.setTime(now-elapse*1000);
            var tableHistory = sss_db.TableMember;
            var tableInfo = sss_db.Table;
            tableHistory.findAll(qObj2)
                .then(function (res) {
                    var ids = [];
                    for (var i = 0; i < res.length; i++) {
                        ids.push(res[i].tableID);
                    }
                    tableInfo.findAndCountAll({where:{table_id:{$in:ids}, table_res:{$ne:""},clubId:clubId}, limit:perCount, offset:(msg.page-1)*perCount, order:[['table_created_date', 'DESC']]})
                        .then(function (logs) {
                            cb(null, logs);
                        });
                });
        }
        else {
            cb(null, {err:true, msg:"游戏类型不存在!"});
        }
    }
    
    async.waterfall([authUid,queryHistory],function(err,logs){
        if(!! err){
            return next(null,{err:true,msg:err.message});
        }

        next(null,logs);
    })
};

handler.queryReplaceHistory = function (msg, session, next) {
    var perCount = 15;
    if (!msg.page || msg.page < 1) {
        msg.page = 1;
    }
    if (msg.gameType == "gameNiuNiu") {
        var now = Math.round(new Date().getTime()/1000) - 7*24*60*60;
        var NiuNiuGroupInfo = this.app.get('models').NiuNiuGroupInfo;
        var NiuNiuGroupHistory = this.app.get('models').gameNiuNiuReplaceHistory;
        NiuNiuGroupHistory.findAll({where:{uid:msg.uid, endTime:{gte:now}}})
            .then(function (res) {
                var ids = [];
                for (var i = 0; i < res.length; i++) {
                    ids.push(res[i].deskId);
                }
                NiuNiuGroupInfo.findAndCountAll({attributes:['deskId', 'deskName', 'deskType', 'endTime', 'flag', 'res', 'createId'],
                    where:{deskId:{$in:ids}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['endTime', 'DESC']]})
                    .then(function (logs) {
                        next(null, logs);
                    });
            });
    }
    else if (msg.gameType == "gameTexasPoker") {
        var now = Math.round(new Date().getTime()/1000) - 7*24*60*60;
        var TexasPokerGroupInfo = this.app.get('models').TexasPokerGroupInfo;
        var TexasPokerGroupHistory = this.app.get('models').gameTexasPokerReplaceHistory;
        TexasPokerGroupHistory.findAll({where:{uid:msg.uid, endTime:{gte:now}}})
            .then(function (res) {
                var ids = [];
                for (var i = 0; i < res.length; i++) {
                    ids.push(res[i].deskId);
                }
                TexasPokerGroupInfo.findAndCountAll({attributes:['deskId', 'deskName', 'deskType', 'endTime', 'flag', 'res', 'createId'],
                    where:{deskId:{$in:ids}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['endTime', 'DESC']]})
                    .then(function (logs) {
                        next(null, logs);
                    });
            });
    }
    else if (msg.gameType == "gameMaJiang_nd") {
        var now = Math.round(new Date().getTime()/1000) - 7*24*60*60;
        var TexasPokerGroupInfo = this.app.get('models').MaJiangNDGroupInfo;
        var TexasPokerGroupHistory = this.app.get('models').gameMaJiang_ndReplaceHistory;
        TexasPokerGroupHistory.findAll({where:{uid:msg.uid, endTime:{gte:now}}})
            .then(function (res) {
                var ids = [];
                for (var i = 0; i < res.length; i++) {
                    ids.push(res[i].deskId);
                }
                TexasPokerGroupInfo.findAndCountAll({attributes:['deskId', 'deskName', 'deskType', 'endTime', 'flag', 'res', 'createId'],
                    where:{deskId:{$in:ids}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['endTime', 'DESC']]})
                    .then(function (logs) {
                        next(null, logs);
                    });
            });
    }
    else if (msg.gameType == "gameDDZ") {
        var now = Math.round(new Date().getTime()/1000) - 7*24*60*60;
        var DDZReplaceHistory = this.app.get('models').gameDDZReplaceHistory;
        var tableInfo = ddz_db.Table;
        DDZReplaceHistory.findAll({where:{uid:msg.uid, endTime:{gte:now}}})
            .then(function (res) {
                var ids = [];
                for (var i = 0; i < res.length; i++) {
                    ids.push(res[i].deskId);
                }
                tableInfo.findAndCountAll({where:{table_id:{$in:ids}, table_res:{$ne:""}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['table_created_date', 'DESC']]})
                    .then(function (logs) {
                        next(null, logs);
                    });
            });
    }
    else if (msg.gameType == "gamePDK") {
        var now = Math.round(new Date().getTime()/1000) - 7*24*60*60;
        var PDKReplaceHistory = this.app.get('models').gamePDKReplaceHistory;
        var tableInfo = pdk_db.Table;
        PDKReplaceHistory.findAll({where:{uid:msg.uid, endTime:{gte:now}}})
            .then(function (res) {
                var ids = [];
                for (var i = 0; i < res.length; i++) {
                    ids.push(res[i].deskId);
                }
                tableInfo.findAndCountAll({where:{table_id:{$in:ids}, table_res:{$ne:""}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['table_created_date', 'DESC']]})
                    .then(function (logs) {
                        next(null, logs);
                    });
            });
    }
    else if (msg.gameType == "gameSSS") {
        var now = Math.round(new Date().getTime()/1000) - 7*24*60*60;
        var SSSReplaceHistory = this.app.get('models').gameSSSReplaceHistory;
        var tableInfo = sss_db.Table;
        SSSReplaceHistory.findAll({where:{uid:msg.uid, endTime:{gte:now}}})
            .then(function (res) {
                var ids = [];
                for (var i = 0; i < res.length; i++) {
                    ids.push(res[i].deskId);
                }
                tableInfo.findAndCountAll({where:{table_id:{$in:ids}, table_res:{$ne:""}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['table_created_date', 'DESC']]})
                    .then(function (logs) {
                        next(null, logs);
                    });
            });
    }else if (msg.gameType == "gameMaJiang_gtz") {
        var now = Math.round(new Date().getTime()/1000) - 7*24*60*60;
        var GTZGroupInfo = this.app.get('models').MaJiangGTZGroupInfo;
        var GTZGroupHistory = this.app.get('models').gameMaJiang_gtzReplaceHistory;
        GTZGroupHistory.findAll({where:{uid:msg.uid, endTime:{gte:now}}})
            .then(function (res) {
                var ids = [];
                for (var i = 0; i < res.length; i++) {
                    ids.push(res[i].deskId);
                }
                GTZGroupInfo.findAndCountAll({attributes:['deskId', 'deskName', 'deskType', 'endTime', 'flag', 'res', 'createId'],
                    where:{deskId:{$in:ids}}, limit:perCount, offset:(msg.page-1)*perCount, order:[['endTime', 'DESC']]})
                    .then(function (logs) {
                        next(null, logs);
                    });
            });
    }
    else {
        next(null, {err:true, msg:"游戏类型不存在!"});
    }
};

handler.getSysMessage = function (msg, session, next) {
	this.app.rpc.lobbysvr.lobbyRemote.getSysMessage(session, msg, function (err, res) {
		if (err) {
			next(null, err);
		}
		else {
			next(null, res);
		}
	});
};

handler.getRechargeMsg = function (msg, session, next) {
	this.app.rpc.lobbysvr.lobbyRemote.getRechargeMsg(session, msg, function (err, res) {
		if (err) {
			next(null, err);
		}
		else {
			next(null, res);
		}
	});
};

handler.certificationPlayer = function (msg, session, next) {
	msg.uid = session.get('uid');
	this.app.rpc.usersvr.userRemote.certificationPlayer(session, msg, function (err, res) {
		if (err) {
			next(null, err);
		}
		else {
			next(null, res);
		}
	});
};

handler.writeMessage = function (msg, session, next) {
    return next(null, {err:true, msg:"该功能已关闭!开放时间待定!"});
    /*
	var user;
	var self = this;
	async.waterfall([function(cb) {
			pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
				uid:msg.uid
			}, cb);
		},
		function(res, cb) {
			user = res;
			pomelo.app.rpc.usersvr.userRemote.costRoomCard(session, {uid:msg.uid, costNum:1}, cb);
		},
		function (res, cb) {
			var now = Math.round(new Date().getTime()/1000);
			var MessageBoard = self.app.get('models').MessageBoard;
			MessageBoard.create({uid:msg.uid, timestamp:now, message:msg.msg, nickName:user.nickName, faceId:user.faceId})
				.then(function (res) {
					if (res) {
						cb(false, res);
					}
					else {
						cb({err:true, msg:"留言失败!!"});
					}
				});
		}],
		function (err, res) {
			if (err) {
				next(null, err);
			}
			else {
				log.insert({cmd:"writeMessage", msg:msg.msg, uid:msg.uid});
				next(null, res);
			}
		});
		*/
};

handler.getMessageBoard = function (msg, session, next) {
    return next(null, {err:true, msg:"该功能已关闭!开放时间待定!"});
    /*
	var MessageBoard = this.app.get('models').MessageBoard;
	msg.page = msg.page || 1;
	msg.page = msg.page < 1 ? 1 : msg.page;
	MessageBoard.findAndCountAll({limit:15, offset:(msg.page-1)*15, order:[['id', 'DESC']], top:150})
		.then(function (res) {
			if (res) {
				next(null, res);
			}
			else {
				next(null, {err:true, msg:"留言版获取失败!!"});
			}
		});
		*/
};


var getInfoFunc = function(uid, keys, res) {
	return function(cb) {
		pomelo.app.rpc.usersvr.userRemote.getUserAttr(uid, {uid:uid, keys:keys}, function(err, r) {
			if (!err) {
				res.push(r);
				cb();
			}
			else {
				cb(err);
			}
		});
	}
};

handler.queryUsersInfo = function (msg, session, next) {

	var keys = {'faceId':1, 'nickName':1, 'gameId':1, 'GPSInfo':1};

	if (!msg.keys || !msg.keys.length || !msg.uids || !msg.uids.length) {
		return next(null, {err:true, msg:"请求错误!"});
	}
	for (var i = 0; i < msg.keys.length; i++) {
		if (!keys[msg.keys[i]]) {
			return next(null, {err:true, msg:"请求错误!"});
		}
	}
	var uids = msg.uids;

	var funcs = [];
	var res = [];
	for (var i = 0; i < uids.length; i++) {
		funcs.push(getInfoFunc(uids[i], msg.keys, res));
	}

	async.waterfall(funcs,
		function (err, r) {
			if (err) {
				next(null, err);
			}
			else {
				next(null, res);
			}
		});
};

// handler.getFreeCoin = function (msg, session, next) {
// 	pomelo.app.rpc.usersvr.userRemote.getFreeCoin(session, {uid:msg.uid}, function(err, res) {
// 		if (err) {
// 			next(null, err);
// 		}
// 		else {
// 			next(null, res);
// 		}
// 	});
// };

handler.queryCombatInfo = function (msg, session, next) {
	var gameType = msg.gameType;
	var deskId = msg.deskId;
	if (!gameType || !deskId) {
        next(null, {err:true, msg:"数据错误!!"});
        return;
	}
	if (!war_record_db[gameType]) {
		next(null, []);
		return;
	}

    var now = Math.floor(new Date().getTime()/1000) - 24*60*60;
	war_record_db[gameType].findAll({attributes:['replayCode', 'deskId', 'deskName', 'roundIndex', 'result', 'createDate'], where:{deskId:deskId,createDate:{gt:now}},  order:[['roundIndex', 'DESC']]})
		.then(function (res) {
			if (res) {
				next(null, res);
			}
			else {
				next(null, {err:true, msg:"牌局不存在!!"});
			}
		});
};

handler.queryReplayGameType = function (msg, session, next) {
    var replayCode = msg.replayCode;
    if (!replayCode) {
        next(null, {err:true, msg:"数据错误!!"});
        return;
    }
    war_record_db.recordCode.findOne({attributes:['gameType'], where:{replayCode:replayCode.toUpperCase()}})
        .then(function (res) {
            if (res) {
                next(null, res);
            }
            else {
                next(null, {err:true, msg:"牌局不存在!!"});
            }
        });
};

handler.queryCombatRecord = function (msg, session, next) {
    var gameType = msg.gameType;
    var replayCode = msg.replayCode;
    if (!gameType || !replayCode) {
        next(null, {err:true, msg:"数据错误!!"});
        return;
    }

    war_record_db[gameType].findOne({attributes:['content'], where:{replayCode:replayCode}})
        .then(function (res) {
            if (res) {
                next(null, res.content);
            }
            else {
                next(null, {err:true, msg:"牌局不存在!!"});
            }
        });
};


// 金币场
handler.getDeskName = function(msg, session, next) {
	var gameType = msg.gameType;
	var self = this;

	var svrs = pomelo.app.getServersByType(gameType);

	if (!svrs || svrs.length == 0) {
		return next(null, {err:true, msg:"游戏不存在!"});
	}

	var funcs = [];
	var user;
	var deskName;
	// 获取用户信息
	funcs.push(function(cb) {
		pomelo.app.rpc.usersvr.userRemote.getMyUserInfo(session, {
			uid:msg.uid
		}, function(err, res) {
			if (err) {
				cb(err);
			}
			else {
				user = res;
				cb(null, "ok");
			}
		});
	});
    // 离开原来房间
    funcs.push(function(res, cb) {
        if (user.deskName && user.gameType) {
            user.isChange = true;
            pomelo.app.rpc[user.gameType].gameRemote.exitDesk(user.deskName, user, function(err, res) {
                if (err) {
                    cb(err);
                }
                else {
                    setTimeout(function() {
                        cb(null, "ok");
                    }, 1500);
                }
            });
        }
        else {
            cb(null, "ok");
        }
    });
	var checkFunc = function (svrId) {
		return function(res, cb) {
			if (deskName) {
				cb(null, "ok");
			}
			else if (!deskName && res.deskName) {
				deskName = res.deskName;
			}
			else {
				if (user.deskName && user.gameType) {
					if (user.gameType == msg.gameType) {
						msg.deskName = user.deskName;
					}
					else {
                        return cb({err:true, msg:"当前游戏还未结束,无法进入新游戏!", gameType:user.gameType, deskName:user.deskName});
					}
				}
				pomelo.app.rpc[gameType].gameRemote.getFreeDeskName.toServer(svrId, msg, user, cb);
			}
		}
	};
	// 获取能用房间号
    utils.shuffle(svrs);
	for (var i = 0; i < svrs.length; i++) {
		funcs.push(checkFunc(svrs[i].id));
	}
	// 获取房间号
	funcs.push(function(res, cb) {
		if (res.deskName) {
			deskName = res.deskName;
		}
		if (deskName) {
			cb(null, "ok");
		}
		else {
			pomelo.app.rpc.desknamesvr.deskNameRemote.getDeskName(session, {
				gameType: msg.gameType,
				isCoin: true
			}, cb);
		}
	});
	// 创建房间
	funcs.push(function(res, cb) {
		if (deskName) {
			cb(null, "ok");
		}
		else {
			deskName = res;
            session.set('deskName', deskName);
			msg.deskName = deskName;
			pomelo.app.rpc[gameType].gameRemote.createDesk(session, msg, cb);
		}
	});

	async.waterfall(funcs,
		function (err, res) {
			if (err) {
				if (deskName) {
					pomelo.app.rpc.desknamesvr.deskNameRemote.recycleDeskName(session, {deskName: deskName}, function () {});
				}
				next(null, err);
				return;
			}
			next(null, {deskName:deskName, gameType: msg.gameType});
		});
};

handler.registerNewUser = function(msg,session,next){
    pomelo.app.rpc.loginsvr.loginRemote.registerNewUser(session, msg, function(err, res){
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    });
};

// 游戏中聊天
handler.chat = function(msg, session, next) {
	var gameType = msg.gameType;
	var deskName = msg.deskName;
	if (!gameType || !deskName) {
		next(null, {err:true, code:500, msg:"聊天数据错误!"});
		return;
	}
    pomelo.app.rpc[gameType].gameRemote.onChat(session, msg, function (err, res) {
		if (err) {
            next(null, err);
		}
		else {
            next(null, res);
		}
    })
};

// 游戏中使用道具
handler.useProp = function(msg, session, next) {
    var gameType = msg.gameType;
    var deskName = msg.deskName;
    if (!gameType || !deskName) {
        next(null, {err:true, code:500, msg:"游戏道具使用错误!"});
        return;
    }
    pomelo.app.rpc[gameType].gameRemote.onUseProp(session, msg, function (err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
    })
};

handler.addCollection = function(msg, session, next) {
	var uid = msg.uid;
	var replayCode = msg.replayCode;
	var gameType = msg.gameType;

	if (!replayCode || !gameType) {
		next(null, {err:true, msg:"数据错误!"});
		return;
	}

    var UserCollectInfo = this.app.get('models').UserCollectInfo;

    async.waterfall([function(cb) {
            UserCollectInfo.count({where:{uid:uid}}).then(function (count) {
				if (count >= 50) {
					cb({err:true, msg:"已达收藏上限!"});
				}
				else {
					cb(null, "ok");
				}
            });
		},
		function(res, cb) {
            war_record_db[gameType].findOne({attributes:['index', 'result', 'createDate', 'collectionCount'], where:{replayCode:replayCode}})
                .then(function (res) {
                    if (res) {
                        cb(null, res);
                    }
                    else {
                        cb({err:true, msg:"回放码不存在!!"});
                    }
                });
		},
		function(res, cb) {
            UserCollectInfo.findOrCreate({where:{uid:uid, replayCode:replayCode}, defaults:{uid:uid, gameType:gameType, createDate:res.createDate, result:res.result, replayCode:replayCode}}).spread(function(info, bcreated) {
                if (bcreated) {
                    res.collectionCount += 1;
                    res.save({fileds: ['collectionCount']}).then(function() {
                        cb(null, "ok");
					});
                }
                else {
                    cb({err:true, msg:"已经收藏该条!"});
                }
            });
		}
		],
	function (err, res) {
		if (err) {
			next(null, err);
		}
		else {
            next(null, res);
		}
    });
};

handler.delCollection = function(msg, session, next) {
    var replayCode = msg.replayCode;
    var uid = msg.uid;
    var UserCollectInfo = this.app.get('models').UserCollectInfo;
    UserCollectInfo.findOne({where:{uid:uid, replayCode:replayCode}}).then(function (res) {
		if (res) {
            war_record_db[res.gameType].findOne({where:{replayCode:replayCode}}).then(function (r) {
				r.collectionCount -= 1;
                r.save({fileds: ['collectionCount']}).then(function() {
                    res.destroy().then(function(){
                        next(null, "ok");
                    });
                });
            });
		}
		else {
			next(null, {err:true, msg:"记录不存在!"});
		}
    });
};

handler.getCollection = function(msg, session, next) {
    var uid = msg.uid;
    var page = msg.page || 1;
    if (page <= 0) {
    	page = 1;
	}
    var perCount = 15;
    var UserCollectInfo = this.app.get('models').UserCollectInfo;
    UserCollectInfo.findAndCountAll({where:{uid:uid}, limit:perCount, offset:(page-1)*perCount, order:[['id', 'DESC']]})
        .then(function (res) {
            next(null, res);
        });
};

handler.getDailyScoreInfo = function(msg, session, next) {
	var gameType = msg.gameType;
	var uid = msg.uid;
	if (!uid || !gameType || !daily_score_db[gameType]) {
        next(null, {err:true, msg:"数据错误!"});
	}
    var dayIndex = utils.getCurPassDay();
    daily_score_db[gameType].findAll({where:{uid:uid, dayIndex:{$gt:dayIndex-15}}, attributes:['score', 'dayIndex'], order:[['dayIndex', 'DESC']]}).then(function(infos) {
    	var res = [];
    	var start = 0;
       	for (var i = 0; i < 15; i++) {
			if (infos[start] && infos[start].dayIndex == dayIndex-i) {
                res.push({dayIndex:dayIndex, score:infos[start].score});
                start++;
			}
			else {
                res.push({dayIndex:dayIndex, score:0});
			}
		}
        next(null, res);
    });
};

handler.getWeekScoreInfo = function(msg, session, next) {
    var gameType = msg.gameType;
    var uid = msg.uid;
    if (!uid || !gameType || !daily_score_db[gameType]) {
        next(null, {err:true, msg:"数据错误!"});
    }
    var dayIndex = utils.getCurPassDay();
    var dayCount = (dayIndex+4)%7 + 14*7;
    daily_score_db[gameType].findAll({where:{uid:uid, dayIndex:{$gt:dayIndex-dayCount}}, attributes:['score', 'dayIndex'], order:[['dayIndex', 'DESC']]}).then(function(infos) {
    	if (infos.length == 0) {
    		infos.push({dayIndex:dayIndex, score:0});
		}
		var res = [];
		var weekIndex = 15;
		var score = 0;
		var start = 0;
    	for (var i = 0; i < dayCount; i++) {
            if (infos[start] && infos[start].dayIndex == dayIndex-i) {
                score += infos[start].score;
                start++;
            }
            if((dayIndex+3-i)%7 == 0) {
                res.push({weekIndex:weekIndex, score:score});
                weekIndex--;
                score = 0;
            }
		}
        next(null, res);
    });
};

handler.getRechargeInfo = function(msg, session, next) {
	var uid = msg.uid;
    pomelo.app.rpc.usersvr.userRemote.getMyUserDailyInfo(uid, {uid:uid, keys:["appleRecharge1Count", "appleRecharge2Count", "appleRecharge3Count"]}, function(err, res) {
    	if (err) {
    		next(null, err);
		}
		else {
    		next(null, res);
		}
	});
};

handler.bindWeiXin = function(msg, session, next) {
    pomelo.app.rpc.usersvr.userRemote.bindWeiXin(msg.uid, msg, function(err, res) {
        if (err) {
            next(null, err);
        }
        else {
            next(null, res);
        }
	});
};

handler.bindPhoneNum = function(msg, session, next) {
	var phoneNum = msg.phoneNum;
	var identifyingCode = msg.identifyingCode;
	var reg= /^0?(13\d|14[5,7]|15[0-3,5-9]|17[0135678]|18\d)\d{8}$/;
    var f = reg.test(phoneNum);
    if(!f){
        return next(null, {err:true, msg:"手机号错误!"});
    }
    var reg2 = /^\d{6}$/;
    f = reg2.test(identifyingCode);
    if (!f) {
        return next(null, {err:true, msg:"验证码错误!"});
    }
    if (!this.redisClient) {
        var redisConfig = pomelo.app.get('redis');
        this.redisClient = redis.createClient({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db
        });
    }
    var uinkey = "tel:" + phoneNum;
    this.redisClient.get(uinkey, function(err, reply) {
        if (err) {
            console.log("uinkey err:" + err);
            return next(null, {err:true, msg: 'redis错误!'});
        }
        var code = reply;
        if (!code || identifyingCode != code) {
            return next(null, {err:true, msg: "验证码错误!"});
        }
        pomelo.app.rpc.usersvr.userRemote.bindPhoneNum(msg.uid, msg, function(err, res) {
            if (err) {
                next(null, err);
            }
            else {
                next(null, res);
            }
        });
    });
};

handler.queryMatchInfo = function(msg, session, next) {
    var MatchCode = this.app.get('models').MatchCode;
    MatchCode.findOne({where:{uid:msg.uid}}).then(function(info) {
    	next(null, info || {});
	});
};

function pad(num, n) {
    var len = num.toString().length;
    while(len < n) {
        num = "0" + num;
        len++;
    }
    return num;
}

handler.signUpMatch = function (msg, session, next) {
    var MatchCode = this.app.get('models').MatchCode;
    MatchCode.findOne({where:{uid:msg.uid}}).then(function(info) {
        if (info) {
            next(null, {err:true, msg:"已经报过名了!"});
		}
		else {
        	var d = new Date();
        	var str = pad(d.getMonth()+1, 2) +
				pad(d.getDate(), 2) +
				pad(d.getHours(), 2) +
				pad(d.getMinutes(), 2) +
                pad(d.getSeconds(), 2) +
                pad(d.getMilliseconds(), 3);

        	var num = pad(Math.floor(Math.random()*900)+100, 3);
            str += num;

			MatchCode.create({uid:msg.uid, code:str}).then(function(info) {
                next(null, info);
			})
		}
    });
};

handler.uploadGPSInfo = function (msg, session, next) {
	var uid = msg.uid;
    pomelo.app.rpc.usersvr.userRemote.refreshGPSInfo(uid, msg, function(err, res) {
		if (err) {
            next(null, err);
		}
		else {
            next(null, res);
		}
	});
};

handler.queryReplaceRoomInfo = function (msg, session, next) {
    var uid = msg.uid;
    var roomInfo = [];
    var getInfo = function(gameType, deskName) {
        return function(cb) {
            pomelo.app.rpc[gameType].gameRemote.queryDeskInfo(deskName, {deskName:deskName}, function(err, res) {
                if (!err) {
                    res.gameType = gameType;
                    roomInfo.push(res);
                }
                cb();
            });
        }
    };
    pomelo.app.rpc.usersvr.userRemote.queryReplaceRoomList(uid, msg, function(err, res) {
        if (err) {
            return next(null, err);
        }
        else {
            var roomList = res;
            var funcs = [];
            for (var i = 0; i < roomList.length; i++) {
                var gameType = roomList[i].gameType;
                var deskName = roomList[i].deskName;
                funcs.push(getInfo(gameType, deskName));
            }
            async.waterfall(funcs, function(err, res) {
                if (err) {
                    return next(null, err);
                }
                else {
                    return next(null, roomInfo);
                }
            });
        }
    });
};



handler.dissolutionDesk = function (msg, session, next) {
    var uid = msg.uid;
    var deskName = msg.deskName;
    pomelo.app.rpc.usersvr.userRemote.queryReplaceRoomList(uid, msg, function(err, res) {
        if (err) {
            return next(null, err);
        }
        else {
            var roomList = res;
            var roomIndex = -1;
            for (var i = 0; i < roomList.length; i++) {
            	if (roomList[i].deskName == deskName) {
            		roomIndex = i;
            		break;
				}
            }
            if (roomIndex == -1) {
                return next(null, {err:true, msg:"房间不存在!"});
			}

        	var gameType = roomList[roomIndex].gameType;
            pomelo.app.rpc[gameType].gameRemote.dissolutionDesk(deskName, {deskName:deskName, uid:uid}, function(err, res) {
                if (err) {
                    return next(null, err);
                }
                else {
                    return next(null, res);
				}
            });
        }
    });
};

handler.queryPeopleNum = function(msg,session,next){
    var uid = msg.uid;
    var gameTypes = msg.gameTypes;

    gameTypes = typeof gameTypes == 'string' ? [gameTypes] : gameTypes;
    if(! gameTypes || ! (gameTypes instanceof Array) || gameTypes.length == 0){
        return next(null,{code:500,msg:"参数不正确"});
    }
    var funcs = [];
    var infos = {};
    gameTypes.forEach(function(gameType){
        if(!! pomelo.app.rpc[gameType] && !! pomelo.app.rpc[gameType].gameRemote.getPlayerCount){//有服务 && 服务提供该接口
            var getPlayerCount = function(callback){
                pomelo.app.rpc[gameType].gameRemote.getPlayerCount(uid,{uid:uid},function(err,result){
                    /**
                     * infos:{
                     *      gameType:{
                     *          roomIndex:peopleNum   
                     *      }
                     * }
                     * 
                    */
                    //infos[gameType] = result;
                    infos = result;
                    callback(null); 
                });
            }
            funcs.push(getPlayerCount);            
        }
    })

    async.parallel(funcs,function(err,result){
        if(!! err){
            return next(null,{code:500,msg:"查询接口出错"})
        }
        next(null,{code:200,infos:infos});
    })
}

handler.queryRoomBasicInfo = function(msg,session,next){
    var uid = msg.uid;
    var gameTypes = msg.gameTypes;

    gameTypes = typeof gameTypes == 'string' ? [gameTypes] : gameTypes;
    if(! gameTypes || ! (gameTypes instanceof Array) || gameTypes.length == 0){
        return next(null,{code:500,msg:"参数不正确"});
    }
    var funcs = [];
    var infos = {};
    gameTypes.forEach(function(gameType){
        if(!! pomelo.app.rpc[gameType] && !! pomelo.app.rpc[gameType].gameRemote.getPlayerCount){//有服务 && 服务提供该接口
            var getPlayerCount = function(callback){
                pomelo.app.rpc[gameType].gameRemote.getPlayerCount(uid,{uid:uid},function(err,result){
                    if(!! err){
                        console.log("queryRoomBasicInfo failed -------->>>",gameType);
                        return
                    }

                    var rooms = coinList[gameType];
                    for(var i = 0; i < rooms.length; i++){
                        var room = rooms[i];
                        room.playerNum = result[(i+1).toString()];
                    }
                    infos = rooms;
                    callback(null); 
                });
            }
            funcs.push(getPlayerCount);            
        }
    })

    async.parallel(funcs,function(err,result){
        if(!! err){
            return next(null,{code:500,msg:"查询接口出错"})
        }
        next(null,{code:200,infos:infos});
    })
}