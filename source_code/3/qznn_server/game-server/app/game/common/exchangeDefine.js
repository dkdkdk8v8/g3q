/**
 * Created by kudoo on 2018/4/19.
 */
var utils = require('../../util/utils');
var gDefine = module.exports;

gDefine.ExchangeData = [
    {id:1, coin:10000, roomCard:3, coupon:0},
    {id:2, coin:60000, roomCard:15, coupon:0},
    {id:3, coin:400000, roomCard:90, coupon:0}
];

//上线后，只能添加值，不能修改或删除,id可以不按顺序
gDefine.goodsData = [
    {id:1, valid:true, roomCard:12, price:12, coupon:10000, product:"12颗钻石"},
    {id:2, valid:true, roomCard:0, price:30, coupon:25000, product:"1斤装宁都肉丸"},
    {id:3, valid:true, roomCard:0, price:50, coupon:41888, product:"5斤甲酒"},
    {id:4, valid:true, roomCard:0, price:68, coupon:56888, product:"黄妈枇杷膏"},
    {id:5, valid:true, roomCard:0, price:80, coupon:66888, product:"20斤农家米"},
    {id:6, valid:true, roomCard:0, price:80, coupon:66888, product:"1斤装蜂蜜"},
    {id:7, valid:true, roomCard:0, price:80, coupon:66888, product:"赣南脐橙5斤装"},
    {id:8, valid:true, roomCard:100, price:100, coupon:83300, product:"100颗钻石"},
    {id:9, valid:true, roomCard:0, price:148, coupon:123444, product:"黄妈枇杷膏礼盒装"},
    {id:10, valid:true, roomCard:0, price:329, coupon:274266, product:"美的电饭煲"},
    {id:11, valid:true, roomCard:0, price:499, coupon:415888, product:"九阳豆浆机"},
    {id:12, valid:true, roomCard:0, price:9688, coupon:8073666, product:"苹果X"}
];

gDefine.getGoodsInfo = function(){
    var tt = utils.clone(this.goodsData);
    for(var i in tt){
        if(!tt[i].valid){
            delete tt[i];
        } else {
            delete tt[i].valid;
            delete tt[i].roomCard;
        }
    }
    return tt;
}

gDefine.getGoodsById = function(id){
    for(var i in this.goodsData){
        var prod = this.goodsData[i];
        if(prod.id == id){
            return prod;
        }
    }
    return null;
}