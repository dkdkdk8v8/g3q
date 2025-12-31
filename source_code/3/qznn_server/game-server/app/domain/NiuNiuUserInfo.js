/**
 * Created by Administrator on 2016/10/21.
 */

var NiuNiuUserInfo = function (opts) {
    opts = opts || {};
    this.maxCards = opts.maxCards || "[]";
    this.totalCount = opts.totalCount || 0;
    this.winCount = opts.winCount || 0;
    this.playCount = opts.playCount || 0;

    this.tongShaCount = opts.tongShaCount || 0;
    this.tongPeiCount = opts.tongPeiCount || 0;
    this.niuNiuCount = opts.niuNiuCount || 0;
    this.wuHuaNiuCount = opts.wuHuaNiuCount || 0;
    this.wuXiaoNiuCount = opts.wuXiaoNiuCount || 0;
    this.zhaDanCount = opts.zhaDanCount || 0;
    this.totalScore = opts.totalScore || 0;
    this.maxWinScore = opts.maxWinScore || 0;
    this.maxLoseScore = opts.maxLoseScore || 0;
    this.maxWinTime = opts.maxWinTime || 0;
};

module.exports = NiuNiuUserInfo;
