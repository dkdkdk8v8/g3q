/**
 * Created by Administrator on 2016/10/21.
 */

var PDKUserInfo = function (opts) {
    opts = opts || {};
    this.totalCount = opts.totalCount || 0;
    this.winCount = opts.winCount || 0;
    this.totalScore = opts.totalScore || 0;
    this.playCount = opts.playCount || 0;
    this.bombCount = opts.bombCount || 0;
    this.guanMenCount = opts.guanMenCount || 0;
    this.quanGuanCount = opts.quanGuanCount || 0;
    this.maxWinScore = opts.maxWinScore || 0;
    this.maxLoseScore = opts.maxLoseScore || 0;
    this.maxWinTime = opts.maxWinTime || 0;
};

module.exports = PDKUserInfo;
