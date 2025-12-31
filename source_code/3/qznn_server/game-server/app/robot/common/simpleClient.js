/**
 * Created by mofanjun on 2017/10/25.
 */
var cwd = process.cwd();

var Pomelo = require(cwd + '/app/robot/lib/pomelo-jsclient-robot');
var Token = require(cwd + '/app/shared/token');

var pomelo = new Pomelo();
pomelo.uid = null;

var intervalRandom = function (min,max) {
    var v = min * 1000 + Math.floor(Math.random() * (max - min + 1) * 1000);
    return v;
}

var monitor = function (type,name,reqId) {
    if(typeof watcher !== 'undefined'){
        watcher.emit(type,name,reqId);
    }else{
        console.error(Array.prototype.slice.call(arguments, 0));
    }
}

var connected = false;

var DEFAULT_SECRET = 'pomelo_session_secret';

function queryEntry(){
    var token = Token.create(uid,Date.now(),DEFAULT_SECRET);
    var svr = servers[Math.floor(Math.random() * servers.length)];
    entry(svr.cHost,svr.cPort,token);
}

function entry(host,port,token,callback) {
    if(pomelo.isACK()) {
        console.log('isACK .....')
        return;
    }
    pomelo.init({host:host,port:port,log:true},function () {
        pomelo.request('connector.entryHandler.enter',{token:token},function (data) {
            if(callback){
                callback(data.code);
            }

            if(data.code == 500 || data.err){
                return console.log('Login fail',data.err);
            }

            afterLogin(pomelo,data);
        })
    })
}

function afterLogin(pomelo,data) {
    pomelo.uid = data.user.uid;
    console.log('robot uid is',pomelo.uid);
    (function enterGame() {
        pomelo.request(gameType + ".gameHandler.enterDeskWithoutPos",{gameType:gameType,deskName:deskName},function (data) {
            if(data.code == 500 || data.err){
                watcher.emit("recycle_" + gameType + "_" + deskName + "_" + pomelo.uid,false);
                pomelo.disconnect();
                console.log(gameType + ".gameHandler.enterDeskWithoutPos " + (data.msg || "err!"));
                return;
            }
            setTimeout(function () {
                if(gameType == "coinDDZ" || gameType == "coinMaJiang_nd"){
                    //不用自动准备的游戏
                }else{
                    pomelo.request(gameType + ".gameHandler.ready",{uid:uid,deskName:deskName},function () {})
                }
            },intervalRandom(3,5));
            watcher.emit("recycle_"+gameType+"_"+deskName+"_"+pomelo.uid, true);

            var g = generatePlayRobot(gameType);
            g.init(pomelo,gameType,deskName,pomelo.uid,watcher);

            watcher.once("exitGame_"+gameType+"_"+deskName+"_"+pomelo.uid, function() {
                g.exitGame();
            });

        })
    })();
}

function generatePlayRobot(gameType) {
    var gameScript = require(cwd + '/app/robot/' + gameType + '/' + "gameScript");
    return new gameScript();
}

queryEntry();

