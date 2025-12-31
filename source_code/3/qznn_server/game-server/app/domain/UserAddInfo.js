/**
 * Created by Administrator on 2016/10/20.
 */

var UserAddInfo = function (opts) {
    this.uid = opts.uid;
    this.codeInfoJson = opts.codeInfoJson;
    this.guanZhuAward = opts.guanZhuAward;

    this.activeDay = opts.activeDay;
    this.gameCount = opts.gameCount;
    this.costRoomCard = opts.costRoomCard;
    this.lastLoginTime = opts.lastLoginTime;

    this.totalCount = opts.totalCount;
};

module.exports = UserAddInfo;