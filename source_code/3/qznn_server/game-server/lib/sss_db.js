var mysql = require('../../shared/config/mysql_sss.json');
var config = null;
if(global.g_env == 'production'){
    config = mysql.production;
} else {
    config = mysql.development;
}

if (!global.hasOwnProperty('sss_db')) {
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

    global.sss_db = {
        Sequelize: Sequelize,
        sequelize: sequelize,
        Table: sequelize.import('../../shared/models/gameSSS/table'),
        TableMember: sequelize.import('../../shared/models/gameSSS/tableMember'),
        TableLoginLog: sequelize.import('../../shared/models/gameSSS/tableLoginLog'),
        GameSSSRecord: sequelize.import('../../shared/models/gameSSS/gameSSSRecord'),
    }
}

module.exports = global.sss_db;



