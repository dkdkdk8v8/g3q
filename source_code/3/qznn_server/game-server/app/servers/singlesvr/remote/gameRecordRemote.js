/**
 * Created by Administrator on 2017/3/20.
 */

var war_record_db = require('../../../../lib/war_record_db');
var utils = require("../../../util/utils");

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
};

var randomCode = function(length) {
    length = length || 8;
    var codeDic = "QWERTYUIOPASDFGHJKLMNBVCXCZ23456789";
    var code = "";
    for (var i = 0; i < length; i++) {
        var index = Math.floor(Math.random()*codeDic.length);
        code += codeDic[index];
    }
    return code;
};

remote.prototype.saveGameRecord = function(gameType, deskId, deskName, roundIndex, record, result, callback) {
    if (gameType == "gameDDZ" || gameType == "gameSSS" || gameType == "gameMaJiang_nd") {
        var now = Math.floor(new Date().getTime() / 1000);
        this.getRecordCode(gameType, function (err, replayCode) {
            if (err) {
                utils.invokeCallback(callback, err);
                return;
            }
            war_record_db[gameType].create({
                replayCode: replayCode,
                deskId: deskId,
                deskName: deskName,
                roundIndex: roundIndex,
                content: record,
                result: result,
                createDate: now
            }).then(function (r) {
                if (r) {
                    utils.invokeCallback(callback, null, "ok");
                }
                else {
                    utils.invokeCallback(callback, {err: true, msg: "记录保存,数据库错误!"});
                }
            });
        });
    }
    else {
        utils.invokeCallback(callback, null, "ok");
    }
};

remote.prototype.getRecordCode = function(gameType, callback) {
    var self = this;
    if (!this.codeSet) {
        this.codeSet = [];
        war_record_db.recordCode.findAll({attributes:['replayCode']}).then(function (res) {
            for (var i = 0; i < res.length; i++) {
                self.codeSet[res[i].replayCode] = true;
            }
            var length = 8;
            var code = randomCode(length);
            var tryCount = 0;
            while(self.codeSet[code]) {
                tryCount++;
                if (tryCount > 10000) {
                    tryCount = 0;
                    length++;
                }
                code = randomCode(length);
            }
            self.codeSet[code] = true;
            war_record_db.recordCode.create({replayCode:code, gameType:gameType}).then(function(c) {
                if (c) {
                    callback(null, c.replayCode);
                }
                else {
                    callback({err:true, msg:"回放码,数据库错误!"});
                }
            });
        });
    }
    else {
        var length = 8;
        var code = randomCode(length);
        var tryCount = 0;
        while(self.codeSet[code]) {
            tryCount++;
            if (tryCount > 10000) {
                tryCount = 0;
                length++;
            }
            code = randomCode(length);
        }
        self.codeSet[code] = true;
        war_record_db.recordCode.create({replayCode:code, gameType:gameType}).then(function(c) {
            if (c) {
                callback(null, c.replayCode);
            }
            else {
                callback({err:true, msg:"数据库错误!"});
            }
        });
    }
};

