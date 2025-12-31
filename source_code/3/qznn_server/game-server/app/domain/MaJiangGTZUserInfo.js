/**
 * Created by mofanjun on 2017/11/13.
 */

var MaJiangGTZUserInfo = function (opts) {
    opts = opts || {};
    this.maxCards = opts.maxCards || "[]";
    this.totalCount = opts.totalCount || 0;
    this.winCount = opts.winCount || 0;
    this.loseCount = opts.loseCount || 0;
    this.drawCount = opts.drawCount || 0;
    this.playCount = opts.playCount || 0;

    this.tongShaCount = opts.tongShaCount || 0;
    this.tongPeiCount = opts.tongPeiCount || 0;
    this.baoZiCount = opts.baoZiCount|| 0;
    this.specialCardCount = opts.specialCardCount || 0;

    this.totalScore = opts.totalScore || 0;
    this.maxWinScore = opts.maxWinScore || 0;
    this.maxLoseScore = opts.maxLoseScore || 0;
    this.maxWinTime = opts.maxWinTime || 0;
};

module.exports = MaJiangGTZUserInfo;
