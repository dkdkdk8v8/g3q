/**
 * Created by Administrator on 2016/10/20.
 */

var User = function (opts) {
    this.uid = opts.uid;
    this.nickName = opts.nickName;
    this.sex = opts.sex;
    this.faceId = opts.faceId;
    this.city = opts.city;
    this.province = opts.province;
    this.country = opts.country;
    this.platformId = opts.platformId;
    this.sign = opts.sign;
    this.roomCard = opts.roomCard;
    this.gameId = opts.gameId;
    this.freeRoomInfo = opts.freeRoomInfo;
    this.isCheck = opts.isCheck;
    this.ip = opts.ip;
    this.isNewUser = opts.isNewUser;
    this.costRoomCard = opts.costRoomCard;
    this.guideStep = opts.guideStep;
    this.coin = opts.coin;
    this.coupon = opts.coupon;
    this.account = opts.account;
    this.phoneNum = opts.phoneNum;
    this.isLoyal = opts.isLoyal;
    this.isFrozen = opts.isFrozen;
    this.frozenRoomCard = opts.frozenRoomCard || 0;
    this.freezeCoin = opts.freezeCoin || 0;
    this.isMatching = opts.isMatching;
    this.isApplyMatch = opts.isApplyMatch || false;
};

module.exports = User;