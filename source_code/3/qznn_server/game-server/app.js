var pomelo = require('pomelo');
var routeUtil = require('./app/util/routeUtil');
var Sequelize = require('sequelize');
var fs = require('fs');
var path = require('path');
var gameFilter = require("./app/filter/gameFilter");
var uidFilter = require("./app/filter/uidFilter");
var loginFilter = require("./app/filter/loginFilter");
var TableService = require('./app/services/tableService');
var ClubService = require('./app/services/clubServices');
var CoinTableService = require('./app/services/coinTableService');
var MatchService = require("./app/services/matchService");
/**
 * Init app for client
 */
var app = pomelo.createApp();
app.set('name', 'qp_server');

global.g_env = app.get('env');
console.log(`当前环境变量：${global.g_env}`)

process.setMaxListeners(100);

var ddz_db = require('./lib/ddz_db');
var sss_db = require('./lib/sss_db');
var pdk_db = require('./lib/pdk_db');

var war_record_db = require('./lib/war_record_db');
var daily_score_db = require('./lib/daily_score_db');

// configure for global
app.configure('production|development', function () {

    app.before(pomelo.filters.toobusy());

    var onlineUser = require('./app/modules/onlineUser');
    var roomInfo = require('./app/modules/roomInfo');
    var userInfo = require('./app/modules/userInfo');
    if (typeof app.registerAdmin === 'function') {
        //app.registerAdmin(sceneInfo, {app: app});
        app.registerAdmin(onlineUser, {app: app});
        app.registerAdmin(roomInfo, {app: app});
        app.registerAdmin(userInfo, {app: app});
    }

    app.loadConfig('redis', app.getBase() + '/config/redis.json');
    app.loadConfig('mysql', app.getBase() + '/config/mysql.json');
    var config = app.get('mysql');

    if (app.serverType != 'gate' && app.serverType != 'connector' && app.serverType != 'desknamesvr' && app.serverType != 'master'
        && app.serverType != 'gameZJH' && app.serverType != 'gameMahjongLG' && app.serverType != 'gameSK'
        && app.serverType != 'gameSG') {

        var sequelize = new Sequelize(config.database, config.user, config.password, {
            host: config.host,
            port: config.port,
            dialect: 'mysql',
            logging: false,
            define: {
                freezeTableName: true,
                timestamps: false,
                logging: false,
                charset: 'utf8',
                collate: 'utf8_general_ci'
            },
            pool: {
                max: 5,
                min: 0,
                idle: 10000
            }
        });

        var moduleDir = './models/';
        var globeDB = {};
        fs.readdir(moduleDir, function (err, fileNames) {
            for (var i = 0; i < fileNames.length; i++) {
                var fileName = fileNames[i];
                var module = path.basename(moduleDir + fileName, '.js');

                globeDB[module] = new require(moduleDir + fileName)(sequelize);
                globeDB[module].sequelize = sequelize;
            }
            app.set('models', globeDB);
        });
    }

    app.set('games', require('./config/gameList.json'));

    app.loadConfig('mongodb', app.getBase() + '/config/mongodb.json');
    app.filter(pomelo.filters.timeout());
    app.filter(pomelo.filters.time());
    app.rpcFilter(pomelo.rpcFilters.rpcLog());

    var mongodb = require('./app/dao/mysql/mongodb').init(app);
    app.set('mongodb', mongodb);

    app.route('gameNiuNiu', routeUtil.gameNiuNiu);
    // app.route('gameTexasPoker', routeUtil.gameTexasPoker);
    // app.route('gameMaJiang_nd', routeUtil.gameMaJiang_nd);
    // app.route('gameMaJiang_gtz', routeUtil.gameMaJiang_gtz);

    // app.route('gameSSS', routeUtil.gameSSS);
    // app.route('gameDDZ', routeUtil.gameDDZ);
    // app.route('gamePDK', routeUtil.gamePDK);
    //金币场
    // app.route('coinDDZ', routeUtil.coinDDZ);
    app.route('coinNiuNiu4', routeUtil.coinNiuNiu4);
    // app.route('coinMaJiang_nd', routeUtil.coinMaJiang_nd);
});

app.configure('production|development', 'desknamesvr', function () {
    app.set("proxyConfig", {
        pendingSize: 2000
    })
})

app.configure('production|development', 'connector', function () {
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            heartbeat: 10,
            useDict: true,
            useProtobuf: true,
            handshake: function (msg, cb) {
                cb(null, {});
            }
        });
});

app.configure('production|development', 'usersvr', function () {
    daily_score_db.sequelize.sync({force: false});
    app.route('usersvr', routeUtil.usersvr);
});

app.configure('production|development', 'lobbysvr', function () {
    war_record_db.sequelize.sync({force: false});
    daily_score_db.sequelize.sync({force: false});
});

app.configure('production|development', 'singlesvr', function () {
    war_record_db.sequelize.sync({force: false});
});

app.configure('production|development', 'gate', function () {
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            useDict: true,
            useProtobuf: true
        });
});


app.configure('production|development', 'loginsvr', function () {
    app.filter(loginFilter());
});

app.configure('production|development', 'gmsvr', function () {
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            heartbeat: 15
        });
});

app.configure('production|development', 'gameNiuNiu', function () {
    app.set('tableService', new TableService(app), false);
    app.filter(gameFilter());
});


app.configure('production|development', 'coinNiuNiu4', function () {
    app.set('tableService', new TableService(app), false);
    app.filter(gameFilter());
});


/***********************************************************************************/

app.configure('production|development', 'proxysvr', function () {
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            heartbeat: 15
        });
});

app.configure('production|development', 'lobbysvr|singlesvr', function () {
    app.filter(uidFilter());
});

//机器人
app.configure('production|development', 'desknamesvr|robotClient', function () {
    app.loadConfig('robotConfig', app.getBase() + '/config/robot.json');
})

app.configure('production|development', 'robotMaster', function () {
    //机器人日志库
    var connecter = require('./app/dao/robot/mongodb').init(app);
    app.set('connecter', connecter);
})

//俱乐部服务
app.configure('production|development', 'clubsvr', function () {
    app.set('clubService', new ClubService(app), false);
})

//定人赛
app.configure('production|development', 'matchsvr', function () {
    app.loadConfig('config', app.getBase() + '/config/match.json');
    app.set('matchService', new MatchService(app), false);
})


app.enable('systemMonitor');
//start
app.start();

// Uncaught exception handler
process.on('uncaughtException', function (err) {
    console.error(' Caught exception: ' + err.stack);
});
