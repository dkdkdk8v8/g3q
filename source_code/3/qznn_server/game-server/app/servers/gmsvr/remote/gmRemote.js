/**
 * Created by Administrator on 2016/11/25.
 */

var utils = require("../../../util/utils");
var async = require("async");
var pomelo = require("pomelo");

var ddz_db = require('../../../../lib/ddz_db');
var sss_db = require('../../../../lib/sss_db');

module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
};

var remote = Remote.prototype;

remote.deleteGameRecord = function (args, callback) {
    var now = Math.round(new Date().getTime()/1000) - 3*24*60*60;

    var res = {};

    var delFunc = function(gameType) {
        return function(cb) {
            war_record_db[gameType].destroy({where:{collectionCount:{$eq:0}, createDate:{$lt:now}}})
                .then(function (count) {
                    res[gameType] = {c1:count, c2:0};
                    war_record_db[gameType].findAll({attributes:['replayCode']}).then(function(r1) {
                        var cs = [];
                        for (var i = 0; i < r1.length; i++) {
                            cs.push(r1[i].replayCode);
                        }
                        war_record_db.recordCode.destroy({where:{replayCode:{$notIn:cs}, gameType:gameType}}).then(function(count) {
                            res[gameType].c2 = count;
                            cb();
                        })
                    });
                });
        }
    };

    var funcs = [];
    for (var game in war_record_db) {
        if (game != "Sequelize" && game != "sequelize" && game != "recordCode") {
            funcs.push(delFunc(game));
        }
    }
    async.waterfall(funcs,
        function (err, r) {
            callback(false, res);
        });
};

remote.deleteDailyScore = function (args, callback) {
    var res = {};
    var dayIndex = utils.getCurPassDay();
    var dayCount = (dayIndex+4)%7 + 15*7;

    var delFunc = function(gameType) {
        return function(cb) {
            daily_score_db[gameType].destroy({where:{dayIndex:{$lt:dayIndex-dayCount}}})
                .then(function (count) {
                    res[gameType] = count;
                    cb();
                });
        }
    };

    var funcs = [];
    for (var game in daily_score_db) {
        if (game != "Sequelize" && game != "sequelize") {
            funcs.push(delFunc(game));
        }
    }
    async.waterfall(funcs,
        function (err, r) {
            callback(false, res);
        });
};

remote.deleteGameHistory = function (args, callback) {
    var res = {};
    var now = Math.round(new Date().getTime()/1000) - 8*24*60*60;

    var tableName = ["NiuNiu", "TexasPoker"];

    var models = this.app.get('models');

    var delFunc = function(gameType) {
        return function(cb) {
            models[gameType+"GroupInfo"].destroy({where:{createTime:{$lt:now}}})
                .then(function (count) {
                    res[gameType] = {c1:count, c2:0};
                    models[gameType+"GroupHistory"].destroy({where:{endTime:{$lt:now}}})
                        .then(function (count) {
                            res[gameType].c2 = count;
                            cb();
                        });
                });
        }
    };

    var funcs = [];
    for (var i = 0; i < tableName.length; i++) {
        funcs.push(delFunc(tableName[i]));
    }

    var replaceTable = ["gameNiuNiu", "gameTexasPoker", "gameDDZ", "gameSSS", "gameDDZ", "gameMaJiang_nd", "gameMaJiang_gtz"];
    var delFunc1 = function(gameType) {
        return function(cb) {
            models[gameType+"ReplaceHistory"].destroy({where:{endTime:{$lt:now}}})
                .then(function (count) {
                    cb();
                });
        }
    };
    for (var i = 0; i < replaceTable.length; i++) {
        funcs.push(delFunc1(replaceTable[i]));
    }

    var d = new Date();
    d.setTime(d.getTime()-8*24*60*60*1000);

    var dbs = [
        {gameType:"gameSSS", db:sss_db, record:"GameSSSRecord"},
        {gameType:"gameDDZ", db:ddz_db, record:"GameDDZRecord"},
    ];

    var delFunc2 = function(gameType, db, record) {
        return function(cb) {
            db.TableMember.destroy({where:{tm_created_date:{$lt:d}}})
                .then(function (count) {
                    res[gameType] = {c1:count, c2:0, c3:0};
                    db.Table.destroy({where:{table_created_date:{$lt:d}}})
                        .then(function (count) {
                            res[gameType].c2 = count;
                            db[record].destroy({where:{createDate:{$lt:d}}})
                                .then(function(count) {
                                    res[gameType].c3 = count;
                                    cb();
                            });
                        });
                });
        }
    };

    for (var i = 0; i < dbs.length; i++) {
        funcs.push(delFunc2(dbs[i].gameType, dbs[i].db, dbs[i].record));
    }

    async.waterfall(funcs,
        function (err, r) {
            callback(false, res);
        });
};

remote.deleteCompetitionData = function (args, callback) {
    this.app.get('models')["MaJiangNDCompetition"].destroy({ truncate: true })
        .then(function (count) {
            callback(false, 'ok');
        });
}