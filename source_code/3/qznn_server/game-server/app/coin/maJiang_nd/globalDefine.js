/**
 * Created by Administrator on 2016/8/8.
 */
var gDefine = module.exports;

// 玩家状态
gDefine.PlayStatus = {
    null:0,      // 没有准备
    ready:1,    // 准备
    play:2,     // 正常游戏
    bai:3,      // 摆
    bao:4       // 报定
};

// 游戏状态
gDefine.GameStatus = {
    null:0,
    Craps1:1,        // 摇骰子1
    Craps2:2,        // 摇骰子2
    InitCard:3,     // 刚开始发牌
    BaoCard:4,     // 决定宝牌
    PushCard:5,     // 发牌
    WaitOpt:6,       // 等待吃碰杠操作
    Think:7,         // 吃碰等待操作
    End:8,           // 结束
    WaitCard:9,       // 出牌
    Ready:10,           // 准备阶段
    Dissolution:11,      // 解散房间
    Huan:12             //换牌阶段
};

gDefine.OptCardCode = {
    Null: 0,        // 取消
    Chi: 0x0001,         // 吃
    Peng: 0x0002,        // 碰
    AnGang: 0x0004,     // 暗杠
    MingGang: 0x0008,    // 明杠
    Hu:0x0010,            // 胡牌
    MingBai:0x0020,        // 明摆
    BaoDing:0x0040,        // 报定
    Huan:0x0200             //换牌
};

gDefine.GroupDeskType = {
    SiBaBao: 1,   // 48宝
    LiuBaBao: 2    // 68宝
};

// 牌
gDefine.CardType = {
    Wan: 0,//万
    Tiao: 1,//条
    Tong: 2,//筒
    Feng: 3,//风
    Zhi: 4//字
};

gDefine.HuType = {
    Null: 0,
    PingHu: 1,
    YaoRen: 2,
    QiDui: 3,
    HaoHuaQidui: 4,
    ShuangHaoHuaQidui: 5,
    SanHaoHuaQiDui: 6,
    PengPenghu: 7,
    LiangDuiHu: 8,
    GangShangKaiHua: 9,
    SiQia: 10,
    HuoKa: 11,
    QuanQiuRen: 12,
    BuQiuRen: 13,
    ShiSanLan: 14,
    QiZiQuan: 15,
    ShiSiYao: 16,
    QingYiSe: 17,
    ZiYiSe: 18,
    QiangGang: 19,
    HaiDiLaoYue: 20,
    TianHu: 21,
    DiHu: 22,
    RenHu: 23,
    YiTiaoLong: 24,
    FeiBao: 25,
    MingGang: 28,
    AnGang: 29,
    ZhuangFen: 30,
    BuGang: 31,
    HuoDiao: 32,
    SiDiao: 33,
    XiaoSaZiMo: 34,
    HuBao: 35,
    ZhangMao: 36,

    Gang: 37,
    GenZhuang:38,

    GangShangKaiHuaHaiDiLao: 39,
    GangShangKaiHuaHaiDiLaoDaHu: 40,
    GangShangKaiHuaHaiDiLaoDaDiaoChe: 41,



    SanBao: 2026,
    SiBao: 2027,
    BaoDing: 2028,
    LiangZhuangFen: 2029,
    BaoDingHuPai: 2030


};

gDefine.HuTypeInfo = {
    0 : {name:"没胡"},
    1 : {name:"", score: 2,bigscore:2},
    2 : {name:"幺仁", score: 8},
    3 : {name:"七对", score: 10,bigscore:12},
    4 : {name:"豪华七对", score: 12 ,bigscore:16},
    5 : {name:"双豪华七对", score: 20,bigscore:24},
    6 : {name:"三豪华七对", score: 26},
    7 : {name:"大胡", score: 4,bigscore: 6},
    8 : {name:"两对胡", score: 2},
    9 : {name:"杠上开花", score: 6,bigscore:8},
    10 : {name:"死掐", score: 2},
    11 : {name:"活卡", score: 1},
    12 : {name:"大吊车", score: 10,bigscore:12},
    13 : {name:"不求人", score: 1},
    14 : {name:"十三烂", score: 1},
    15 : {name:"七字全", score: 6},
    16 : {name:"十四幺", score: 1},
    17 : {name:"清一色", score: 8},
    18 : {name:"字一色", score: 8},
    19 : {name:"", score: 12,bigscore:16},
    20 : {name:"海底捞", score: 6 ,bigscore:8},
    21 : {name:"天胡", score: 8 ,bigscore:10},
    22 : {name:"地胡", score: 6 ,bigscore:8},
    23 : {name:"人胡", score: 6},
    24 : {name:"一条龙", score: 6},
    25 : {name:"飞宝", score: 1},
    28 : {name:"杠(明)", score: 6},

    29 : {name:"杠(暗)", score: 4},
    30 : {name:"庄分", score: 1},
    31 : {name:"补杠", score: 1},
    32 : {name:"活吊", score: 1},
    33 : {name:"死吊", score: 2},
    34 : {name:"潇洒自摸", score: 6},
    35 : {name:"胡宝", score: 1},
    36 : {name:"长毛", score: 1},
    37 : {name:"杠分", score: 1},
    38 : {name:"跟庄", score: 1},
    39 : {name:"杠上开花 海底捞", score: 8 ,bigscore:10},
    40 : {name:"大胡 杠上开花 海底捞", score: 16 ,bigscore:26},
    41 : {name:"大吊车 杠上开花 海底捞", score: 40 ,bigscore:50}

};

gDefine.AppendScoreInfo = {
    1007 : {name:"碰碰胡明摆", score: 6},
    1002 : {name:"幺仁明摆", score: 8},
    1003 : {name:"七对明摆", score: 8},
    1004 : {name:"豪华七对明摆", score: 12},
    1005 : {name:"双豪华七对明摆", score: 18},
    1006 : {name:"三豪华七对明摆", score: 26},
    1017 : {name:"清一色明摆", score: 8},
    1018 : {name:"字一色明摆", score: 8},
    2026 : {name:"三宝齐", score: 6},
    2027 : {name:"四宝齐", score: 12},
    2028 : {name:"报定", score: 6},
    2029 : {name:"赏分", score: 10},
    2030 : {name:"报定胡牌", score: 6}
};


gDefine.PaiName = {
    0x0001: "一万",
    0x0002: "二万",
    0x0003: "三万",
    0x0004: "四万",
    0x0005: "五万",
    0x0006: "六万",
    0x0007: "七万",
    0x0008: "八万",
    0x0009: "九万",

    0x0101: "一条",
    0x0102: "二条",
    0x0103: "三条",
    0x0104: "四条",
    0x0105: "五条",
    0x0106: "六条",
    0x0107: "七条",
    0x0108: "八条",
    0x0109: "九条",

    0x0201: "一筒",
    0x0202: "二筒",
    0x0203: "三筒",
    0x0204: "四筒",
    0x0205: "五筒",
    0x0206: "六筒",
    0x0207: "七筒",
    0x0208: "八筒",
    0x0209: "九筒",

    // 东南西北
    0x0301: "东风",
    0x0302: "西风",
    0x0303: "南风",
    0x0304: "北风",

    // 中发白
    0x0401: "红中",
    0x0402: "发财",
    0x0403: "白板"
};

// 解散标志
gDefine.DisFlag = {
    WaitOpt: 0,     // 等待操作
    Agree: 1,       // 同意
    DisAgree: 2,    // 拒绝
    Apply: 3        // 申请人
};
