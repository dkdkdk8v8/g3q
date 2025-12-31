/**
 * Created by Administrator on 2016/10/20.
 */

var UserDailyInfo = function (opts) {
    this.uid = opts.uid;
    this.giftCodeCount = opts.giftCodeCount;
    this.shareGroupCount = opts.shareGroupCount;
    this.shareFriendCount = opts.shareFriendCount;
    this.lastOptTime = opts.lastOptTime;
    this.freeCoinCount = opts.freeCoinCount;
    this.appleRecharge1Count = opts.appleRecharge1Count;
    this.appleRecharge2Count = opts.appleRecharge2Count;
    this.appleRecharge3Count = opts.appleRecharge3Count;
};


UserDailyInfo.reset = function(obj, now) {
    obj.giftCodeCount = 0;
    obj.shareGroupCount = 0;
    obj.shareFriendCount = 0;
    obj.freeCoinCount = 0;
    obj.appleRecharge1Count = 0;
    obj.appleRecharge2Count = 0;
    obj.appleRecharge3Count = 0;
    obj.lastOptTime = now;
};


module.exports = UserDailyInfo;