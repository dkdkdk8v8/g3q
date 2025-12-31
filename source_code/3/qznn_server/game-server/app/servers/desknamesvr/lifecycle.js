module.exports.afterStartAll = function(app) {
    app.rpc.desknamesvr.deskNameRemote.initCoinRoom(null, {}, function () {});
};