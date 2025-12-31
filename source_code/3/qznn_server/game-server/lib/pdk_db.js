var mysql = require('../../shared/config/mysql_pdk.json');
var config = null;
if(global.g_env == 'production'){
    config = mysql.production;
} else {
    config = mysql.development;
}

if (!global.hasOwnProperty('pdk_db')) {
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

    global.pdk_db = {
        Sequelize: Sequelize,
        sequelize: sequelize,
        Table: sequelize.import('../../shared/models/gamePDK/table'),
        TableMember: sequelize.import('../../shared/models/gamePDK/tableMember'),
        TableLoginLog: sequelize.import('../../shared/models/gamePDK/tableLoginLog'),
        GamePDKRecord: sequelize.import('../../shared/models/gamePDK/gamePDKRecord'),
    }
}

module.exports = global.pdk_db;



