/**
 * Created by mofanjun on 2017/10/26.
 */

var define = module.exports = exports;

define.PAI_XING = {
    NoCow:     {weight:0x0000, times:1, name:"没牛"},
    CowOne:    {weight:0x0001, times:1, name:"牛一"},
    CowTwo: 	{weight:0x0002, times:1, name:"牛二"},
    CowThree:  {weight:0x0003, times:1, name:"牛三"},
    CowFour:   {weight:0x0004, times:1, name:"牛四"},
    CowFive:   {weight:0x0005, times:1, name:"牛五"},
    CowSix: 	{weight:0x0006, times:1, name:"牛六"},
    CowSeven: 	{weight:0x0007, times:2, name:"牛七"},
    CowEight:  {weight:0x0008, times:2, name:"牛八"},
    CowNine: 	{weight:0x0009, times:2, name:"牛九"},
    CowNiu: 	{weight:0x000A, times:3, name:"牛牛"},
    CowFace: 	{weight:0x000B, times:5, name:"五花牛"},
    CowBoom:   {weight:0x000C, times:8, name:"炸弹"},
    CowLittle: {weight:0x000D, times:10, name:"五小牛"}
};

define.COW_RES = [
    define.PAI_XING.CowNiu,
    define.PAI_XING.CowOne,
    define.PAI_XING.CowTwo,
    define.PAI_XING.CowThree,
    define.PAI_XING.CowFour,
    define.PAI_XING.CowFive,
    define.PAI_XING.CowSix,
    define.PAI_XING.CowSeven,
    define.PAI_XING.CowEight,
    define.PAI_XING.CowNine
];

// 玩家状态
define.PlayStatus = {
    watch:0,    // 观看
    play:1,    // 游戏中
    out:2,       // 淘汰
    ready:3,
    null:4, //初始化状态
};

// 游戏状态
define.GameStatus = {
    null: 0,

    Start: 1,      // 开始
    Bank: 2,      // 抢庄
    CalCard: 3,  // 组合
    Card: 4,     // 发牌
    Point: 5,    // 叫分
    LeftCard: 6, // 发最后一张牌
    ShowBank: 7,  // 显示庄家
    End: 8,         // 结束
    Wait: 9,         // 等待玩家加入
    QiePai: 10,      // 切牌阶段
    Ready:11        //准备阶段
};