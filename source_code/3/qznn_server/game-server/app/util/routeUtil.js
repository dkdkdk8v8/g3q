var exp = module.exports;
var dispatcher = require('./dispatcher');
var pomelo = require('pomelo');

exp.usersvr = function(session, msg, app, cb) {
	var uid;
	if(typeof session == 'object') {
		uid = session.uid;
	}
	else {
		uid = session;
	}

	if(!uid) {
		cb(new Error('fail to route to connector server for uid is empty'));
		return;
	}
	var svrs = app.get("servers").usersvr;
	var svr = dispatcher.dispatch(uid, svrs);

	cb(null, svr.id);
};

exp.authsvr = function(session, msg, app, cb) {

	var svrs = app.getServersByType("authsvr");
	var id = Math.floor(Math.random()*svrs.length);

	var serverId = session.get('serverId');

	var svr = dispatcher.dispatch(id, svrs);

	cb(null, svr.id);
};

exp.gameTexasPoker = function(session, msg, app, cb) {
	var deskName;
	if(typeof session == 'object') {
		deskName = session.get('deskName');
		if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
			deskName = msg.args[0].body.deskName;
		}
	}
	else {
		deskName = session;
	}

	if(!deskName) {
		cb(new Error('fail to route to connector server for deskId is empty'));
		return;
	}

	var svrs = app.getServersByType('gameTexasPoker');
	if(!svrs || svrs.length === 0) {
		return cb(new Error('can not find game servers.'));
	}
	var svr = dispatcher.dispatch(deskName, svrs);
	cb(null, svr.id);
};
exp.gameMaJiang_nd = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.boxId){
            deskName = msg.args[0].body.boxId;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('gameMaJiang_nd');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};
exp.gameMaJiang_jdz = function(session, msg, app, cb) {
	var deskName;
	if(typeof session == 'object') {
		deskName = session.get('deskName');
		if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
			deskName = msg.args[0].body.deskName;
		}
	}
	else {
		deskName = session;
	}

	if(!deskName) {
		cb(new Error('fail to route to connector server for deskId is empty'));
		return;
	}

	var svrs = app.getServersByType('gameMaJiang_jdz');
	if(!svrs || svrs.length === 0) {
		return cb(new Error('can not find game servers.'));
	}
	var svr = dispatcher.dispatch(deskName, svrs);
	cb(null, svr.id);
};

exp.gameMaJiang_lx = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('gameMaJiang_lx');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};

exp.gameMaJiang_py = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('gameMaJiang_py');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};

exp.gameMaJiang_wz = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('gameMaJiang_wz');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};

exp.gameNiuNiu = function(session, msg, app, cb) {
	var deskName;
	if(typeof session == 'object') {
		deskName = session.get('deskName');
		if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
			deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.boxId){
            deskName = msg.args[0].body.boxId;
        }
	}
	else {
		deskName = session;
	}
	if(!deskName) {
		cb(new Error('fail to route to connector server for deskId is empty'));
		return;
	}

	var svrs = app.getServersByType('gameNiuNiu');
	if(!svrs || svrs.length === 0) {
		return cb(new Error('can not find game servers.'));
	}
	var svr = dispatcher.dispatch(deskName, svrs);
	cb(null, svr.id);
};

exp.gameDDZ = function(session, msg, app, cb) {
    var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.boxId){
            deskName = msg.args[0].body.boxId;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
    var servers = app.getServersByType('gameDDZ');
    if(!servers || servers.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var res = dispatcher.dispatch(deskName, servers);
    cb(null, res.id);
};

exp.gameSK = function(session, msg, app, cb) {
	var deskName = session.get('deskName');
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
	var servers = app.getServersByType('gameSK');
	if(!servers || servers.length === 0) {
		return cb(new Error('can not find game servers.'));
	}

	var res = dispatcher.dispatch(deskName, servers);
	cb(null, res.id);
};
exp.gameSSS = function(session, msg, app, cb) {
	var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.boxId){
            deskName = msg.args[0].body.boxId;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
	var servers = app.getServersByType('gameSSS');
	if(!servers || servers.length === 0) {
		return cb(new Error('can not find game servers.'));
	}
	var res = dispatcher.dispatch(deskName, servers);
	cb(null, res.id);
};
exp.gameZJH = function(session, msg, app, cb) {
	var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
	var servers = app.getServersByType('gameZJH');
	if(!servers || servers.length === 0) {
		return cb(new Error('can not find game servers.'));
	}
	var res = dispatcher.dispatch(deskName, servers);
	cb(null, res.id);
};
exp.gamePDK = function(session, msg, app, cb) {
    var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.boxId){
            deskName = msg.args[0].body.boxId;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
    var servers = app.getServersByType('gamePDK');
    if(!servers || servers.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var res = dispatcher.dispatch(deskName, servers);
    cb(null, res.id);
};

exp.gameSG = function(session, msg, app, cb) {
    var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
    var servers = app.getServersByType('gameSG');
    if(!servers || servers.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var res = dispatcher.dispatch(deskName, servers);
    cb(null, res.id);
};

exp.gameMahjongLG = function(session, msg, app, cb) {
    var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
    var servers = app.getServersByType('gameMahjongLG');
    if(!servers || servers.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var res = dispatcher.dispatch(deskName, servers);
    cb(null, res.id);
};

exp.gameMahjongRA = function(session, msg, app, cb) {
    var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
    var servers = app.getServersByType('gameMahjongRA');
    if(!servers || servers.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var res = dispatcher.dispatch(deskName, servers);
    cb(null, res.id);
};

exp.mahjongGoldLG = function(session, msg, app, cb) {
    var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
    var servers = app.getServersByType('mahjongGoldLG');
    if(!servers || servers.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var res = dispatcher.dispatch(deskName, servers);
    cb(null, res.id);
};
exp.mahjongGoldRA = function(session, msg, app, cb) {
    var deskName = "";
    if(typeof session == 'object') {
        if (msg.namespace == 'sys' && msg.service == 'msgRemote' && msg.args[0].body && msg.args[0].body.deskName) {
            deskName = msg.args[0].body.deskName;
        }
        if (msg.args[0].deskName) {
            deskName = msg.args[0].deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }
    var servers = app.getServersByType('mahjongGoldRA');
    if(!servers || servers.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var res = dispatcher.dispatch(deskName, servers);
    cb(null, res.id);
};
exp.coinMaJiang_lx = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }
    }
    else {
        deskName = session;
    }
    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('coinMaJiang_lx');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};

exp.coinMaJiang_py = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('coinMaJiang_py');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};

exp.gameMaJiang_gtz = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.boxId){
            deskName = msg.args[0].body.boxId;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('gameMaJiang_gtz');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};

exp.coinDDZ = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.roomIndex){
            deskName = msg.args[0].body.roomIndex;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('coinDDZ');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};

exp.coinNiuNiu4 = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.roomIndex){
            deskName = msg.args[0].body.roomIndex;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('coinNiuNiu4');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};

exp.coinMaJiang_nd = function(session, msg, app, cb) {
    var deskName;
    if(typeof session == 'object') {
        deskName = session.get('deskName');
        if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.deskName){
            deskName = msg.args[0].body.deskName;
        }else if(msg.namespace == 'sys' && msg.service=='msgRemote' && msg.args[0].body && msg.args[0].body.roomIndex){
            deskName = msg.args[0].body.roomIndex;
        }
    }
    else {
        deskName = session;
    }

    if(!deskName) {
        cb(new Error('fail to route to connector server for deskId is empty'));
        return;
    }

    var svrs = app.getServersByType('coinMaJiang_nd');
    if(!svrs || svrs.length === 0) {
        return cb(new Error('can not find game servers.'));
    }
    var svr = dispatcher.dispatch(deskName, svrs);
    cb(null, svr.id);
};
