/**
 * Created by kudoo on 2018/4/18.
 */
var utils = require('../../util/utils');
var gDefine = module.exports;

gDefine.LotteryData = [
    {id:1, name:"8000金币", coin:8000, roomCard:0, coupon:0, weight:400},
    {id:2, name:"1颗钻石", coin:0, roomCard:1, coupon:0, weight:60},
    {id:3, name:"10万金币", coin:100000, roomCard:0, coupon:0, weight:8},
    {id:4, name:"100颗钻石", coin:0, roomCard:100, coupon:0, weight:1},
    {id:5, name:"88张礼券", coin:0, roomCard:0, coupon:88, weight:20},
    {id:6, name:"5万金币", coin:50000, roomCard:0, coupon:0, weight:40},
    {id:7, name:"20颗钻石", coin:0, roomCard:20, coupon:0, weight:10},
    {id:8, name:"888张礼券", coin:0, roomCard:0, coupon:888, weight:1},
    {id:9, name:"谢谢参与", coin:0, roomCard:0, coupon:0, weight:200},
    {id:10, name:"1.5万金币", coin:15000, roomCard:0, coupon:0, weight:300},
    {id:11, name:"3颗钻石", coin:0, roomCard:3, coupon:0, weight:30},
    {id:12, name:"100万金币", coin:1000000, roomCard:0, coupon:0, weight:1}
];

gDefine.getLotteryRewards = function(){
    var tt = utils.clone(this.LotteryData);
    for(var i in tt){
        delete tt[i].weight;
    }
    return tt;
}

gDefine.LotteryRewards = gDefine.getLotteryRewards();

var random = function(min,max){
    return Math.floor(min+Math.random()*(max-min));
}

gDefine.luckyDraw = function(){
    var sum = 0;
    this.LotteryData.forEach(function(p){
       sum += p.weight;
    });
    var r = random(0,sum);
    var i=0;
    for(;i<this.LotteryData.length;i++){
        r -= this.LotteryData[i].weight;
        if(r<0){
            break;
        }
    }
    if(i === this.LotteryData.length){
        i--;
    }
    return this.LotteryRewards[i];
}