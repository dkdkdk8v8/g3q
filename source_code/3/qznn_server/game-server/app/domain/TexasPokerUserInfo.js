/**
 * Created by Administrator on 2016/10/21.
 */

var TexasPokerUserInfo = function (opts) {
    opts = opts || {};
    this.maxCards = opts.maxCards || "[]";
    this.totalCount = opts.totalCount || 0;
    this.totalScore = opts.totalScore || 0;
    this.winCount = opts.winCount || 0;
    this.betCount = opts.betCount || 0;
    this.perflopBetCount = opts.perflopBetCount || 0;
    this.playCount = opts.playCount || 0;
    this.tongHuaCount = opts.tongHuaCount || 0;
    this.huLuCount = opts.huLuCount || 0;
    this.siTiaoCount = opts.siTiaoCount || 0;
    this.tongHuaSunCount = opts.tongHuaSunCount || 0;
    this.huangJiaTongHuaCount = opts.huangJiaTongHuaCount || 0;
    this.maxWinScore = opts.maxWinScore || 0;
    this.maxLoseScore = opts.maxLoseScore || 0;
    this.maxWinTime = opts.maxWinTime || 0;

};

module.exports = TexasPokerUserInfo;
