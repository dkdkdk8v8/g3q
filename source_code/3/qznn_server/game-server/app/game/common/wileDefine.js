/**
 * Created by kudoo on 2017/10/27.
 */

var gDefine = module.exports;

gDefine.gWiles = [
    {id:1,name:"dianzhan",type:1,action1:"dianzhan1",action2:"dianzhan",price:0},
    {id:2,name:"diancai",type:1,action1:"diancai1",action2:"diancai",price:10},
    {id:3,name:"tuoxie",type:1,action1:"tuoxie1",action2:"tuoxie",price:1000},
    {id:4,name:"ji",type:1,action1:"ji1",action2:"ji",price:1000},
    {id:5,name:"jiqiang",type:2,action1:"",action2:"jiqiang",action3:"jiqiang2",price:1000},
    {id:6,name:"poshui",type:3,action1:"",action2:"poshui",price:2000},
    {id:7,name:"zhuantou",type:1,action1:"zhuantou1",action2:"zhuantou",price:2000},
    {id:8,name:"dian",type:2,action1:"dian1",action2:"dian",action3:"dian2",price:2000},
    {id:9,name:"futou",type:1,action1:"futou1",action2:"futou",price:2000},
    {id:10,name:"egg",type:1,action1:"egg1",action2:"egg",price:2000},
    {id:11,name:"qian",type:1,action1:"qian1",action2:"qian",price:5000},
    {id:12,name:"jiubei",type:1,action1:"jiubei1",action2:"jiubei",price:5000},
    {id:13,name:"hua",type:1,action1:"hua1",action2:"hua",price:5000},
    {id:14,name:"qiubite",type:2,action1:"qiubite1",action2:"qiubite",action3:"qiubite2",price:10000},
    {id:15,name:"kiss",type:1,action1:"kiss1",action2:"kiss",price:10000},
    {id:16,name:"jiezhi",type:1,action1:"jiezhi1",action2:"jiezhi",price:10000}
];

gDefine.checkWid = function (wid){
    if(wid<1 || wid>this.gWiles.length) {
        return false;
    }

    return true;
}