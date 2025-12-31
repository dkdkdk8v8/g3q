var mysql = require('../../shared/config/mysql_daily_score.json');
var fs = require('fs');
var path = require('path');
var config = null;
if(global.g_env == 'production'){
    config = mysql.production;
} else {
    config = mysql.development;
}

if (!global.hasOwnProperty('daily_score_db')) {
    var Sequelize = require('sequelize');
    var sequelize = new Sequelize(config.database, config.user, config.password, {
        host: config.host,
        port:config.port,
        dialect: 'mysql',
        timezone:'+08:00',
        logging: false,

        pool: {
            max: 5,
            min: 0,
            idle: 10000
        }
    });

    global.daily_score_db = {
        Sequelize: Sequelize,
        sequelize: sequelize
    };

    var moduleDir = path.dirname(__filename) + '/../../shared/models/dailyScore/';
    fs.readdir(moduleDir, function (err, fileNames) {
        for (var i = 0; i < fileNames.length; i++) {
            var fileName = fileNames[i];
            var module = path.basename(moduleDir + fileName, '.js');

            global.daily_score_db[module] = sequelize.import(moduleDir + fileName);
        }
    });
}

module.exports = global.daily_score_db;