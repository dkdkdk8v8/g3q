/**
 * Created by Administrator on 2016/10/21.
 */

var SSSUserInfo = function (opts) {
    opts = opts || {};
    this.totalCount = opts.totalCount || 0;
    this.winCount = opts.winCount || 0;
    this.totalScore = opts.totalScore || 0;
    this.playCount = opts.playCount || 0;
    this.daQiangCount = opts.daQiangCount || 0;
    this.beiDaQiangCount = opts.beiDaQiangCount || 0;
    this.quanLeiDaCount = opts.quanLeiDaCount || 0;
    this.specialCardCount = opts.specialCardCount || 0;
    this.tongHuaCount = opts.tongHuaCount || 0;
    this.tieZhiCount = opts.tieZhiCount || 0;
    this.maxWinScore = opts.maxWinScore || 0;
    this.maxLoseScore = opts.maxLoseScore || 0;
    this.maxWinTime = opts.maxWinTime || 0;
};

module.exports = SSSUserInfo;
