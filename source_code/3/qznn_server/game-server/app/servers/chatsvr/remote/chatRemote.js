/**
 * Created by Administrator on 2016/11/17.
 */
var channelUtil = require('../../../util/channelUtil');
var pomelo = require('pomelo');
var utils = require("../../../util/utils");

module.exports = function(app) {
    return new remote(app);
};

var remote = function(app) {
    this.app = app;
    pomelo.app.get('channelService').createChannel(channelUtil.getGlobalChannelName());
    this.userChannel = {};
};

remote.prototype.addToWorldChannel = function(uid, sid, callback) {
    var worldchannel = pomelo.app.get('channelService').getChannel(channelUtil.getGlobalChannelName(), false);
    worldchannel.add(uid, sid);
    utils.invokeCallback(callback);
};

remote.prototype.leaveWorldChannel = function(uid, sid, callback) {
    var worldchannel = pomelo.app.get('channelService').getChannel(channelUtil.getGlobalChannelName(), false);
    worldchannel.leave(uid, sid);
    utils.invokeCallback(callback);
};

remote.prototype.addToGameChannel = function(uid, sid, gameType, callback) {
    utils.invokeCallback(callback);
};

remote.prototype.leaveGameChannel = function(uid, sid, gameType, callback) {
    utils.invokeCallback(callback);
};

remote.prototype.pushMessageToWorld = function(route, msg, callback) {
    var worldchannel = pomelo.app.get('channelService').getChannel(channelUtil.getGlobalChannelName(), false);
    worldchannel.pushMessage(route, msg);
    utils.invokeCallback(callback);
};

remote.prototype.pushMessageToGame = function (route, msg, gameType, callback) {
    utils.invokeCallback(callback);
};

//
remote.prototype.addToRoomChannel = function(uid, sid, gameType, roomIndex, callback) {

    this.leaveRoomChannel(uid);
    var channel = pomelo.app.get('channelService').getChannel(channelUtil.getDeskChannelName(gameType, roomIndex), true);;
    if (channel) {
        channel.add(uid, sid);
        this.userChannel[uid] = {gameType:gameType, roomIndex:roomIndex};
    }
    utils.invokeCallback(callback);
};

remote.prototype.leaveRoomChannel = function(uid, callback) {
    if (this.userChannel[uid]) {
        var info = this.userChannel[uid];
        var tmpChannel = pomelo.app.get('channelService').getChannel(channelUtil.getDeskChannelName(info.gameType, info.roomIndex), false);
        var member =  tmpChannel.getMember(uid);
        tmpChannel.leave(uid, member.sid);
        utils.invokeCallback(callback, false, this.userChannel[uid]);
        delete this.userChannel[uid];
    }
    else {
        utils.invokeCallback(callback, {err:true, msg:"房间错误!"});
    }
};

remote.prototype.pushMessageToRoom = function (route, msg, gameType, roomIndex, callback) {

    var channel = pomelo.app.get('channelService').getChannel(channelUtil.getDeskChannelName(gameType, roomIndex), false);
    if (channel) {
        channel.pushMessage(route, msg);
    }
    utils.invokeCallback(callback);
};

//
remote.prototype.pushMessageToUsers = function(route,uids,msg,callback){
    var worldchannel = pomelo.app.get('channelService').getChannel(channelUtil.getGlobalChannelName(), false);
    var members = [];
    for(var i = 0; i < uids.length; i++){
        var uid = uids[i];
        var member = worldchannel.getMember(uid);
        if(! member){
            continue;
        }
        members.push(member);
    }

    if(members.length != 0){
        pomelo.app.get('channelService').pushMessageByUids(route,msg,members,callback);
    }else{
        utils.invokeCallback(callback);
    }  
}

remote.prototype.getSidInfo = function(uids,callback){
    var worldchannel = pomelo.app.get('channelService').getChannel(channelUtil.getGlobalChannelName(), false);
    var uidMap = {};
    for(var i = 0; i < uids.length; i++){
        var member = worldchannel.getMember(uids[i]);
        if(member){
            uidMap[uids[i]] = member.sid;
        }else{
            uidMap[uids[i]] = null;
        }
    }
    callback(null,uidMap);
}