var ChannelUtil = module.exports;

var GLOBAL_CHANNEL_NAME = 'pomelo';
var DESK_CHANNEL_PREFIX = 'desk_';
var GAME_CHANNEL_PERFIX = 'game_';

ChannelUtil.getGlobalChannelName = function() {
  return GLOBAL_CHANNEL_NAME;
};

ChannelUtil.getDeskChannelName = function(gameType, roomType, deskId) {
  return DESK_CHANNEL_PREFIX + gameType + '_' + roomType + '_' + deskId;
};

ChannelUtil.getGameChannelName = function(gameType) {
  return GAME_CHANNEL_PERFIX + gameType;
};