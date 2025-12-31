var mysql = require('../../shared/config/mysql_war_record.json');
var fs = require('fs');
var path = require('path');
var config = null;
if(global.g_env == 'production'){
    config = mysql.production;
} else {
    config = mysql.development;
}

if (!global.hasOwnProperty('war_record_db')) {
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

    global.war_record_db = {
        Sequelize: Sequelize,
        sequelize: sequelize
    };

    var moduleDir = path.dirname(__filename) + '/../../shared/models/gameRecord/';
    fs.readdir(moduleDir, function (err, fileNames) {
        for (var i = 0; i < fileNames.length; i++) {
            var fileName = fileNames[i];
            var module = path.basename(moduleDir + fileName, '.js');

            global.war_record_db[module] = sequelize.import(moduleDir + fileName);
        }
    });
}

module.exports = global.war_record_db;



