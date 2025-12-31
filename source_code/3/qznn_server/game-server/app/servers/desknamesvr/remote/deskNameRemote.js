/**
 * Created by Administrator on 2016/10/25.
 */
var async = require("async");
var utils = require("../../../util/utils");
var coinList = require("../../../../config/coinList.json");

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
    this.deskList = {};
    this.isOpen = true;
    this.msg = "服务器将于不久后重启,请稍后再进行游戏!";
    this.stopGameSet = {};
    this.isStopAll = false;
    //this.app.set('deskList', this.deskList);//不能加这里,加这里收不到
    // 老虎机
    this.deskList[10001] = {gameType:"coinLHJ"};
    this.coinDeskList = {};
    // 0: 未初始化
    // 1: 正在初始化
    // 2: 初始化完成
    this.initSetp = 0;
    this.clubDeskList = {};
    this.matchDeskList = {};
};

remote.prototype.getDeskName = function(args, callback) {
    if (!this.isOpen && (this.stopGameSet[args.gameType] || this.isStopAll)) {
        utils.invokeCallback(callback, {err:true, msg:this.msg});
        return;
    }
    var times = 1;
    if (args.isCoin) {
        times = 1000;
    }
    var deskName = parseInt(Math.random()*799999*times) + 100001*times;
    while(this.deskList[deskName]) {
        deskName = parseInt(Math.random()*799999*times) + 100001*times;
    }
    this.deskList[deskName] = {gameType:args.gameType, uid:args.uid, isReplace:args.isReplace};
    if (!this.app.get('deskList')) {
        this.app.set('deskList', this.deskList);//只能加这里
    }
    //console.log("---------------------------------->>>创建房间", args.gameType, deskName);
    utils.invokeCallback(callback, false, deskName);
};

//TODO:因为茶楼桌子是桌号是一样的，所以新增这个接口，有很大的局限性。
remote.prototype.lockDeskName = function(args,callback){
    var deskName = args.deskName;
    this.deskList[deskName] = {gameType:args.gameType, uid:args.uid, isReplace:args.isReplace};
    utils.invokeCallback(callback, false, deskName);
}

remote.prototype.recycleDeskName = function (args, callback) {
    if (this.deskList[args.deskName]) {
        var info = this.deskList[args.deskName];
        delete this.deskList[args.deskName];
        // 是代开房
        if (info.isReplace) {
            console.log("---------------------------------->>>代开房回收房间", args.deskName, info);
            args.uid = info.uid;
            // 通知回收房间
            this.app.rpc.usersvr.userRemote.recycleReplaceRoom(info.uid, args, function(err,res) {
                utils.invokeCallback(callback, false, "ok");
            });
            return;
        }
    }
    console.log("---------------------------------->>>回收房间", args.deskName);
    if (!this.isOpen) {
        console.log("--->>this.deskList", JSON.stringify(this.deskList));
    }
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.getDeskInfo = function (args, callback) {
    if (!this.isOpen && this.isStopAll) {
        utils.invokeCallback(callback, {err:true, msg:this.msg});
        return;
    }
    if (this.deskList[args.deskName]) {
        if (!this.isOpen && this.stopGameSet[this.deskList[args.deskName].gameType]) {
            utils.invokeCallback(callback, {err:true, msg:this.msg});
            return;
        }
        utils.invokeCallback(callback, false, this.deskList[args.deskName]);
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"桌子不存在!"});
    }
};

remote.prototype.svrCtrl = function (args, callback) {
    this.isOpen = args.isOpen;
    if (args.msg && args.msg != "") {
        this.msg = args.msg;
    }
    this.stopGameSet = {};
    this.isStopAll = false;
    if (args.games && args.games.length>0) {
        for (var i = 0; i < args.games.length; i++) {
            this.stopGameSet[args.games[i]] = true;
        }
    }
    else {
        this.isStopAll = true;
    }
    utils.invokeCallback(callback, false, "ok");
};

remote.prototype.initCoinRoom = function (args,cb) {
    if (this.initSetp == 0) {
        this.initSetp = 1;
        this.totalCount = 0;
        this.finishCount = 0;
        var self = this;
        for (var gameType in coinList) {
            var games = coinList[gameType];
            this.coinDeskList[gameType] = {};
            for (var i = 0; i < games.length; i++) {
                var game = games[i];
                game.gameType = gameType;
                this.totalCount += game.deskNum;

                this.coinDeskList[gameType][game.roomIndex] = [];
                //var roomIndex = game.roomIndex;

                for (var j = 0; j < game.deskNum; j++) {
                    var createDesk = function(tmpArgs){
                        self.getDeskName({isCoin: true, gameType: tmpArgs.gameType}, function (err, deskName) {
                            tmpArgs.deskName = deskName;
                            // tmpArgs.roomIndex = tmpArgs.roomIndex;
                            self.coinDeskList[tmpArgs.gameType][tmpArgs.roomIndex].push(deskName);
                            pomelo.app.rpc[tmpArgs.gameType].gameRemote.createDesk(deskName, tmpArgs, function (err, res) {
                                self.finishCount += 1;
                                if (self.totalCount <= self.finishCount) {
                                    self.initSetp = 2;
                                }
                            });
                            // pomelo.app.rpc.chatsvr.chatRemote.initRoomChannel(null, gameType, roomIndex, function() {
    
                            // })
                            //初始化机器人监听
                            var deskBasicInfo = {
                                deskName:deskName,//加监听的桌子号
                                baseScore:tmpArgs.baseCoin,//桌子底分
                                maxCoin:tmpArgs.maxCoin,//入场金币上限
                                minCoin:tmpArgs.minCoin,//入场金币下限
                                gameType:tmpArgs.gameType,//游戏类型
                                roomIndex:tmpArgs.roomIndex,//RoomId = gameType_roomIndex
                                maxPlayer:tmpArgs.maxPlayer//桌子人数上限
                            }
                            self.initRobotMonitor(deskBasicInfo);
                        });
                    }
                    //
                    createDesk(utils.clone(game));
                }
            }
        }
    }
    cb(null,'ok');
};

remote.prototype.initRobotMonitor = function (deskBasicInfo) {
    var allowMonitorGameList = this.app.get("robotConfig")["allowMonitorGameList"];
    if(~ allowMonitorGameList.indexOf(deskBasicInfo.gameType)){
        pomelo.app.rpc.robotMaster.masterRemote.onDeskCreate(null,deskBasicInfo,function (err,res) {
            if(!! err){
                console.error('init robot monitor with err message:',err.message);
            }
        })
    }
}

//club
remote.prototype.createBox = function(args,user,callback){
    var creatorUid = args.creatorUid;
    var gameType = args.gameType;
    var tableInfo = args.tableInfo;
    var createCnt = args.createCnt;
    var clubId = args.clubId;
    var boxId = args.boxId;
    
    var self = this;
    var createFuncs = [];
    for(var i = 0; i < createCnt; i++){
        var createFunc = function(cb){
            self.getDeskName({isReplace:true,uid:creatorUid,gameType:gameType},function(err,deskName){
                if(!! err){
                    return callback(err);
                }

                if(! self.clubDeskList[clubId]){
                    self.clubDeskList[clubId] = {};
                }

                if(! self.clubDeskList[clubId][boxId]){
                    self.clubDeskList[clubId][boxId] = [];
                }
                self.clubDeskList[clubId][boxId].push(deskName);
                //完善客户端参数
                var cloneTable = utils.clone(tableInfo);
                //TODO:创建房卡 参数不统一 后期修改
                cloneTable.deskName = deskName;
                cloneTable.clubId = clubId;
                cloneTable.boxId = boxId;
                cloneTable.isReplace = true;
                cloneTable.uid = creatorUid;
                
                pomelo.app.rpc[gameType].gameRemote.createDesk(deskName,cloneTable,user,cb);
            })
        }
        createFuncs.push(createFunc);
    }

    async.parallel(createFuncs,function(err,results){
        if(!! err){
            console.log("desknamesvr 1 err:---------->>>",err);
            delete self.clubDeskList[clubId][boxId];//失败的话 从内存中把房间删除
            return callback(err);
        }
        console.log("desknamesvr 2 success:---------->>>",self.clubDeskList[clubId][boxId]);
        callback(null,"OK");
    })
}

remote.prototype.dissolutionBox = function(args,callback){
    var clubId = args.clubId;
    var boxId = args.boxId;
    var gameType = args.gameType;
    var uid = args.uid;

    var self = this;
    //检测是否能解散桌子
	var canDissolutionBox = function(cb){
        var clubList = self.clubDeskList[clubId];
        var deskNameList = !! clubList ? clubList[boxId] : null;

		if(! deskNameList){//服务器出现意外 内存数据消失
			return cb(null,null);
		}

		var checkFuncs = [];
		deskNameList.forEach(function(deskName){
			var checkFunc = function(scb){
				self.app.rpc[gameType].gameRemote.queryDeskInfo(deskName,{deskName:deskName},function(err,result){
					if(!! err){
						return scb(new Error("服务器未知错误,请稍后再试"));
					}
					if(result.playerInfo.length != 0){
						return scb(new Error("有玩家正在游戏，请稍后再试"));
					}
					scb(null);
				})
			}
			checkFuncs.push(checkFunc);
		})

		async.parallel(checkFuncs,function(err,results){
			if(!! err){
				return cb(err);
			}
			cb(null,deskNameList);
		})
    }
    
    var dissolutionBox = function(deskNameList,cb){
		if(! deskNameList){//服务器出现意外 内存数据消失
			return cb(null);
		}

		var checkFuncs = [];
		deskNameList.forEach(function(deskName){
			var checkFunc = function(scb){
				self.app.rpc[gameType].gameRemote.dissolutionDesk(deskName,{uid:uid,deskName:deskName},function(err,result){
					if(!! err){
						console.log("dissolutionBox--------->>>",err);
						return scb(new Error("服务器未知错误,请联系管理员"+err.message));
					}
					scb(null);
				})
			}
			checkFuncs.push(checkFunc);
		})

		async.parallel(checkFuncs,function(err,results){
			if(!! err){
				return cb(err);
			}
			cb(null);
		})
    }

    async.waterfall([canDissolutionBox,dissolutionBox],function(err,result){
        if(! err && !! self.clubDeskList[clubId] && !! self.clubDeskList[clubId][boxId]){
            self.clubDeskList[clubId][boxId] = null;//清空内存数据
        }
        
        if(!! err){
            callback(err.message);
        }else{
            callback(null);
        }
    })
}

remote.prototype.isExistBox = function(args,callback){
    var clubId = args.clubId;
    var boxId = args.boxId;

    if(! this.clubDeskList[clubId]){
        this.clubDeskList[clubId] = {};
    }
    
    callback(null, !! this.clubDeskList[clubId][boxId]);
}

remote.prototype.getBoxDeskList = function(args,callback){
    var clubId = args.clubId;
    var boxId = args.boxId;
    
    if(! this.clubDeskList[clubId]){
        this.clubDeskList[clubId] = {};
    }

    var deskNameList = !! this.clubDeskList[clubId][boxId] ? this.clubDeskList[clubId][boxId] : [];

    callback(null,deskNameList);
}

remote.prototype.isGameFrozen = function(args,callback){
    if(this.isStopAll && ! this.isOpen){//所有游戏被限制开房
        return callback(null,{isFrozen:true,msg:this.msg});
    }

    if(! this.isOpen && this.stopGameSet[args.gameType]){//所有游戏被限制开房
        return callback(null,{isFrozen:true,msg:this.msg});
    }

    callback(null,{isFrozen:false})
}

//match
remote.prototype.getMatchDeskName = function(args,callback){
    var mid = args.mid;
    var self = this;
    self.getDeskName(args,function(err,deskName){
        if(! self.matchDeskList[mid]){
            self.matchDeskList[mid] = [];
        }
        self.matchDeskList[mid].push(deskName);
        callback(err,deskName);
    })
}

remote.prototype.recycleMatchDeskName = function(args,callback){
    var mid = args.mid;
    deskNames = this.matchDeskList[mid];
    for(var i in deskNames){
        var deskName = deskNames[i];
        if (this.deskList[deskName]) {
            delete this.deskList[deskName];
            console.log("---------------------------------->>>回收房间",deskName);
        }
    }
    callback(null,"OK");
}
