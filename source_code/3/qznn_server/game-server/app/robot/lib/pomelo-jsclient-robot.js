/**
 * Created by mofanjun on 2017/10/27.
 */
var WebSocket = require('ws');
var util = require('util');

var JS_WS_CLIENT_TYPE = 'js-websocket';
var JS_WS_CLIENT_VERSION = '0.0.1';

var RES_OK = 200;
var RES_FAIL = 500;
var RES_OLD_CLIENT = 501;

var DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

var Protocol = require('pomelo-protocol');
var protobuf = require('pomelo-protobuf');
var Package = Protocol.Package;
var Message = Protocol.Message;
var EventEmitter = require('events');

var Pomelo = function () {
    this.socket = null;
    this.reqId = 0;
    this.callbacks = {};
    this.handlers = {};
    //Map from request id to route
    this.routeMap = {};
    this.dict = {};
    this.abbrs = {};
    this.serverProtos = {};
    this.clientProtos = {};
    this.protoVersion = 0;

    this.heartbeatInterval = 0;
    this.heartbeatTimeout = 0;
    this.nextHeardbeatTimeout = 0;
    this.gapThreshold = 100;
    this.heartbeatId = null;
    this.heartbeatTimeoutId = null;
    this.handshakeCallback = null;

    this.decode = null;
    this.encode = null;

    this.reconnect = false;
    this.reconnectTimer = null;
    this.reconnectUrl = null;
    this.reconnectAttempts = 0;
    this.reconnectionDelay = 5000;
    
    this.useCrypto;
    //
    this.handshakeBuffer = {
        sys:{
            type:JS_WS_CLIENT_TYPE,
            version:JS_WS_CLIENT_VERSION,
            rsa:{}
        },
        user:{

        }
    }
    //
    this.initCallback = null;
    //
    this.handlers[Package.TYPE_HANDSHAKE] = handshake;
    this.handlers[Package.TYPE_HEARTBEAT] = heartbeat;
    this.handlers[Package.TYPE_DATA] = onData;
    this.handlers[Package.TYPE_KICK] = onKick;
}

util.inherits(Pomelo, EventEmitter);

module.exports = Pomelo;

Pomelo.prototype.init = function (params,cb) {
    this.initCallback = cb;

    var host = params.host;
    var port = params.port;

    this.encode = params.encode || defaultEncode;
    this.decode = params.decode || defaultDecode


    var url = "ws://" + host;
    if(port){
        url += ":" + port;
    }
    //初始化连接参数
    this.handshakeBuffer.user = params.user;
    /*
     *@TODO:google查阅 有人在使用时报错 估计是官方没有引入相关库
     * 如后期需要使用 需改进
     */
    if(params.encrypt){}
    this.handshakeCallback = params.handshakeCallback;
    this.connect(params,url,cb);
}

Pomelo.prototype.connect = function (params,url,cb) {
    var params = params || {};
    var maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.reconnectUrl = url;
    var self = this;
    var onopen = function (event) {
        if(!! self.reconnect){
            self.emit("reconnect");
        }
        self.reset();
        var obj = Package.encode(Package.TYPE_HANDSHAKE,Protocol.strencode(JSON.stringify(self.handshakeBuffer)));
        self.send(obj);
    }

    var onmessage = function (event) {
        self.processPackage(Package.decode(event.data),cb);
        // new package arrived, update the heartbeat timeout
        if(self.heartbeatTimeout){
            self.nextHeardbeatTimeout = Date.now() + self.heartbeatTimeout;
        }
    }

    var onerror = function (event) {
        self.emit("io-error",event);
        console.error('socket error:',event);
    }

    var onclose = function (event) {
        self.emit("close",event);
        self.emit("disconnect",event);
        if(event.code != 1000){
            console.error("socket close:",event);
        }
        //TODO reconnect
        if(!!params.reconnect && self.reconnectAttempts < maxReconnectAttempts){
            self.reconnect = true;
            self.reconnectAttempts++;
            self.reconnectTimer = setTimeout(function(){
                self.connect(params,self.reconnectUrl,cb);
            },self.reconnectionDelay);
            self.reconnectionDelay *= 2;
        }
    }

    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer';
    this.socket.onopen = onopen;
    this.socket.onmessage = onmessage;
    this.socket.onerror = onerror;
    this.socket.onclose = onclose;
};

Pomelo.prototype.reset = function(){
    this.reconnect = false;
    this.reconnectionDelay = 1000 * 5;
    this.reconnectAttempts = 0;
    clearTimeout(this.reconnectTimer);
}

Pomelo.prototype.send = function(package){
    if(!! this.socket){
        //socket.send(package.buffer);
        /*
         * @brief pomelo-protocol用的Buffer类浏览器环境下和Node@4.X环境下是不同的
         * 还没仔细看。
         * */
        this.socket.send(package, {binary: true, mask: true},function(err){
            if(!! err){
                console.error("[pomelo-jsclint-robot]ws send data error:",err.message);
            }
        });
    }
}

Pomelo.prototype.processPackage = function(msgs){
    if(Array.isArray(msgs)) {
        for(var i = 0; i < msgs.length; i++){
            var msg = msgs[i];
            this.handlers[msgs.type].call(this,msgs.body);
        }
    } else {
        this.handlers[msgs.type].call(this,msgs.body);
    }
}

Pomelo.prototype.initData = function(data){
    if(!data || !data.sys){
        return;
    }

    this.dict = data.sys.dict;
    var protos = data.sys.protos;
    //Init compress dict
    if(this.dict) {
        //this.dict = dict;
        this.abbrs = {};

        for(var route in this.dict){
            this.abbrs[this.dict[route]] = route;
        }
    }

    //Init protobuf protos
    if(protos){
        this.protoVersion = protos.version || 0;
        this.serverProtos = protos.server || {};
        this.clientProtos = protos.client || {};

        if(!!protobuf){
            protobuf.init({encoderProtos:protos.client,decoderProtos:protos.server});
        }
    }
}

Pomelo.prototype.handshakeInit = function(data){
    if(data.sys && data.sys.heartbeat){
        this.heartbeatInterval = data.sys.heartbeat * 1000;
        this.heartbeatTimeout = this.heartbeatInterval * 2;
    } else {
        this.heartbeatInterval = 0;
        this.heartbeatTimeout = 0;
    }

    this.initData(data);
    if(typeof this.handshakeCallback === 'function'){
        this.handshakeCallback(data.user);
    }
}

//握手
var handshake = function(data){
    data = JSON.parse(Protocol.strdecode(data));
    if(data.code == RES_OLD_CLIENT){
        return this.emit("error","client version not fullfill");
    }

    if(data.code !== RES_OK) {
        return this.emit("error","handshake fail");
    }

    this.handshakeInit(data);

    var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK);
    this.send(obj);
    if(this.initCallback) this.initCallback();
}

//心跳
Pomelo.prototype.disconnect = function(){
    if(!! this.socket){
        if(this.socket.disconnect) this.socket.disconnect();
        if(this.socket.close) this.socket.close();
        console.log("disconnect");
        this.socket = null;
    }

    if(this.heartbeatId) {
        clearTimeout(this.heartbeatId);
        this.heartbeatId = null;
    }

    if(this.heartbeatTimeoutId) {
        clearTimeout(this.heartbeatTimeoutId);
        this.heartbeatTimeoutId = null;
    }
}

Pomelo.prototype.heartbeatTimeoutCb = function(){
    var gap = this.nextHeardbeatTimeout - Date.now();
    if(gap > this.gapThreshold){
        this.heartbeatTimeoutId = setTimeout(this.heartbeatTimeoutCb,gap);
    } else {
        console.error("server heartbeat timeout");
        this.emit("heartbeat timeout");
        this.disconnect();
    }
}

var heartbeat = function(data){
    if(! this.heartbeatInterval) return;

    var obj = Package.encode(Package.TYPE_HEARTBEAT);
    if(this.heartbeatTimeoutId){
        clearTimeout(this.heartbeatTimeoutId);
        this.heartbeatTimeoutId = null;
    }

    if(this.heartbeatId) return;//already in a heartbeat interval
    var self = this;
    this.heartbeatId = setTimeout(function(){
        self.heartbeatId = null;
        self.send(obj);

        self.nextHeardbeatTimeout = Date.now() + self.heartbeatTimeout;
        self.heartbeatTimeoutId = setTimeout(self.heartbeatTimeoutCb,self.heartbeatTimeout);
    },this.heartbeatInterval);
}
//数据
var defaultEncode = Pomelo.prototype.encode = function(reqId,route,msg){
    var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;
    //compress msg by protobuf
    if(protobuf && this.clientProtos[route]){
        msg = protobuf.encode(route,msg);
    } else {
        msg = Protocol.strencode(JSON.stringify(msg));
    }

    var compressRoute = 0;
    if(this.dict && this.dict[route]){
        route = this.dict[route];
        compressRoute = 1;
    }

    return Message.encode(reqId,type,compressRoute,route,msg);
}

Pomelo.prototype.deCompose = function(msg){
    var route = msg.route;
    //Decompose route from dict
    if(msg.compressRoute){
        if(! this.abbrs[route]){
            return {};
        }

        route = msg.route = this.abbrs[route];
    }

    if(protobuf && this.serverProtos[route]){
        return protobuf.decodeStr(route,msg.body);
    }else {
        return JSON.parse(Protocol.strdecode(msg.body));
    }

    return msg;
}

var defaultDecode = Pomelo.prototype.decode = function(data){
    //probuff decode
    var msg = Message.decode(data);

    if(msg.id > 0){
        msg.route = this.routeMap[msg.id];
        delete this.routeMap[msg.id];
        if(!msg.route){
            return;
        }
    }

    msg.body = this.deCompose(msg);
    return msg;
}

Pomelo.prototype.processMessage = function(pomelo,msg){
    if(!msg.id){
        //server push message
        this.emit(msg.route,msg.body);
        return;
    }

    //if have a id then find the callback function with the request
    var cb = this.callbacks[msg.id];

    delete this.callbacks[msg.id];
    if(typeof cb !== 'function'){
        return;
    }
    cb(msg.body);
    return;
}

var onData = function(data){
    var msg = data;
    if(this.decode){
        msg = this.decode(msg);
    }
    this.processMessage(this,msg);
}
//服务端主动发起踢人
var onKick = function(data){
    data = JSON.parse(Protocol.strdecode(data));
    this.emit("onKick",data);
}
//client action
/*
 * 000 request
 * 001 notify
 * 010 response
 * 011 server push
 */
Pomelo.prototype.sendMessage = function(reqId,route,msg){
    if(this.useCrypto){
        return;
        //TODO:暂不支持自定义加密
    }

    if(this.encode){
        msg = this.encode(reqId,route,msg);
    }
    var packet = Package.encode(Package.TYPE_DATA,msg);
    this.send(packet);
}

Pomelo.prototype.request = function(route,msg,cb){
    if(arguments.length === 2 && typeof msg === "function"){
        cb = msg;
        msg = {};
    }else {
        msg = msg || {};
    }

    route = route || msg.route;
    if(!route){
        console.log('request route is null');
        return;
    }

    this.reqId++;
    this.sendMessage(this.reqId,route,msg);

    this.callbacks[this.reqId] = cb;
    this.routeMap[this.reqId] = route;
}

Pomelo.prototype.notify = function(route,msg){
    msg = msg || {};
    this.sendMessage(0,route,msg);
}

//是否建立连接
Pomelo.prototype.isACK = function () {
    return !! this.socket;
}