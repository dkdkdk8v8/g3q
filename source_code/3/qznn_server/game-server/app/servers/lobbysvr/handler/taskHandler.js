/**
 * Created by Administrator on 2017/1/13.
 */
var async = require("async");
var pomelo = require("pomelo");
var log = pomelo.app.get('mongodb');

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

// 获取任务信息
handler.getTaskInfo = function(msg, session, next) {
    var uid = msg.uid;
    var res;
    async.waterfall([
        // 获取每日信息
        function(cb) {
            pomelo.app.rpc.usersvr.userRemote.getMyUserAddInfo(uid, {uid:uid, keys:["guanZhuAward"]}, cb);
        },
        // 获取附加信息
        function(info, cb) {
            res = info;
            pomelo.app.rpc.usersvr.userRemote.getMyUserDailyInfo(uid, {uid:uid, keys:["shareGroupCount", "shareFriendCount"]}, cb);
        }
    ],
    function(err, r) {
        if (err) {
            return next(null, err);
        }
        res.shareGroupCount = r.shareGroupCount;
        res.shareFriendCount = r.shareFriendCount;
        next(null, res);
    });
};

// 获取任务奖励
handler.getTaskAward = function(msg, session, next) {
    var uid = msg.uid, taskId = msg.taskId;
    var taskAward = {
        1: {key:"shareGroupCount", maxCount: 1, coinNum:500, errMsg:"您今天已获得分享奖励!"},
        //2: {key:"shareFriendCount", maxCount: 1, cardNum:1, errMsg:"您今天已获得分享奖励，明天再来吧!"},
        // 1001: {key:"guanZhuAward", maxCount: 1, cardNum:5, errMsg:"您已经获得过关注奖励!"}
    };

    var taskInfo = taskAward[taskId];
    if (!taskInfo) {
        return next(null, {err:true, msg:"任务不存在!"});
    }
    async.waterfall([
            // 获取信息
            function(cb) {
                if (taskId > 1000) {
                    pomelo.app.rpc.usersvr.userRemote.getMyUserAddInfo(uid, {uid: uid, keys: ["guanZhuAward"]}, cb);
                }
                else {
                    pomelo.app.rpc.usersvr.userRemote.getMyUserDailyInfo(uid, {uid:uid, keys:["shareGroupCount", "shareFriendCount"]}, cb);
                }
            },
            // 判断领取条件
            function(info, cb) {
                if (info[taskInfo.key] >= taskInfo.maxCount) {
                    cb({err:true, msg:taskInfo.errMsg});
                }
                else {
                    // 更新数据
                    if (taskId > 1000) {
                        pomelo.app.rpc.usersvr.userRemote.refreshUserAddData(uid, {uid:uid},
                            [{key:taskInfo.key, value:info[taskInfo.key]+1}], cb);
                    }
                    else {
                        pomelo.app.rpc.usersvr.userRemote.refreshUserDailyData(uid, {uid:uid},
                            [{key:taskInfo.key, value:info[taskInfo.key]+1}], cb);
                    }
                }
            },
            // 增加奖励
            function(res, cb) {
                pomelo.app.rpc.usersvr.userRemote.addCoin(uid, {uid:uid, deltaCoin:taskInfo.coinNum}, cb);
            }
        ],
        function(err, r) {
            if (err) {
                return next(null, err);
            }
            log.insert({cmd:"getTaskAward", coin:taskInfo.coinNum, uid:uid, taskId:taskId});
            return next(null, {msg:"恭喜您完成分享,奖励 金币x"+taskInfo.coinNum+"!"});
        });
};

