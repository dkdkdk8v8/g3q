/**
 * Created by Administrator on 2016/8/8.
 */
var gDefine = module.exports;

gDefine.PAI_XING = {
    NoCow:     {weight:0x0000, times:1, name:"没牛"},
    CowOne:    {weight:0x0001, times:1, name:"牛一"},
    CowTwo: 	{weight:0x0002, times:1, name:"牛二"},
    CowThree:  {weight:0x0003, times:1, name:"牛三"},
    CowFour:   {weight:0x0004, times:1, name:"牛四"},
    CowFive:   {weight:0x0005, times:1, name:"牛五"},
    CowSix: 	{weight:0x0006, times:1, name:"牛六"},
    CowSeven: 	{weight:0x0007, times:2, name:"牛七"},
    CowEight:  {weight:0x0008, times:2, name:"牛八"},
    CowNine: 	{weight:0x0009, times:3, name:"牛九"},
    CowNiu: 	{weight:0x000A, times:4, name:"牛牛"},
    CowFace: 	{weight:0x000B, times:6, name:"五花牛"},
    CowBoom:   {weight:0x000C, times:8, name:"炸弹"},
    CowLittle: {weight:0x000D, times:10, name:"五小牛"}
};

gDefine.COW_RES = [
    gDefine.PAI_XING.CowNiu,
    gDefine.PAI_XING.CowOne,
    gDefine.PAI_XING.CowTwo,
    gDefine.PAI_XING.CowThree,
    gDefine.PAI_XING.CowFour,
    gDefine.PAI_XING.CowFive,
    gDefine.PAI_XING.CowSix,
    gDefine.PAI_XING.CowSeven,
    gDefine.PAI_XING.CowEight,
    gDefine.PAI_XING.CowNine
];

// 玩家状态
gDefine.PlayStatus = {
    watch:0,    // 观看
    play:1,    // 游戏中
    out:2,       // 淘汰
    ready:3
};

// 游戏状态
gDefine.GameStatus = {
    null: 0,

    Start: 1,      // 开始
    Bank: 2,      // 抢庄
    CalCard: 3,  // 组合
    Card: 4,     // 发牌
    Point: 5,    // 叫分
    LeftCard: 6, // 发最后一张牌
    ShowBank: 7,  // 显示庄家
    End: 8,         // 结束
    Wait: 9         // 等待玩家加入
};

gDefine.GroupDeskType = {
    TongBi: 1,      // 通比牛牛
    Random: 2,      // 随机抢庄
    Card: 3,        // 看牌抢庄
    SequenceBank: 4       // 轮庄
};

// 解散标志
gDefine.DisFlag = {
    WaitOpt: 0,     // 等待操作
    Agree: 1,       // 同意
    DisAgree: 2,    // 拒绝
    Apply: 3        // 申请人
};

gDefine.ZhuangType = {
    NoCow: 1,       // 无牛下庄
    Lose: 2,        // 负分下庄
    Sequence:3,		// 轮流当庄
    Force:4,		// 霸王庄
    Cow: 5         // 牛牛下庄
};


