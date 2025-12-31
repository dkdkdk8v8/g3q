var mysql = require('../../shared/config/mysql_ddz.json');
var config = null;
if(global.g_env == 'production'){
    config = mysql.production;
} else {
    config = mysql.development;
}

if (!global.hasOwnProperty('ddz_db')) {
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

    global.ddz_db = {
        Sequelize: Sequelize,
        sequelize: sequelize,
        Table: sequelize.import('../../shared/models/gameDDZ/table'),
        TableMember: sequelize.import('../../shared/models/gameDDZ/tableMember'),
        TableLoginLog: sequelize.import('../../shared/models/gameDDZ/tableLoginLog'),
        GameDDZRecord: sequelize.import('../../shared/models/gameDDZ/gameDDZRecord'),
    }
}

module.exports = global.ddz_db;



