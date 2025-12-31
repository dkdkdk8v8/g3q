/**
 * Created by Administrator on 2016/10/21.
 */

var MaJiangNDUserInfo = function (opts) {
    opts = opts || {};
    this.totalCount = opts.totalCount || 0;
    this.huCount = opts.huCount || 0;
    this.liuCount = opts.liuCount || 0;
    this.totalScore = opts.totalScore || 0;
    this.playCount = opts.playCount || 0;

    this.winCount = opts.winCount || 0;
    this.ziMoCount = opts.ziMoCount || 0;
    this.daHuCount = opts.daHuCount || 0;
    this.qiDuiCount = opts.qiDuiCount || 0;
    this.daDiaoCheCount = opts.daDiaoCheCount || 0;
    this.haiDiLaoCount = opts.haiDiLaoCount || 0;
    this.genZhuangCount = opts.genZhuangCount || 0;
    this.daHuCount = opts.daHuCount || 0;
    this.maxWinScore = opts.maxWinScore || 0;
    this.maxWinTime = opts.maxWinTime || 0;
    this.maxLoseScore = opts.maxLoseScore || 0;
};

module.exports = MaJiangNDUserInfo;
