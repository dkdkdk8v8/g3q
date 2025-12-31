/**
 * 牌局表/桌子表:牌局ID,牌局名称，模式，玩法，局数，消耗的钻石，是否记牌，创建者,创建时间，牌局是否结束，牌局是否开始,牌局开始时间,牌局结束时间
 * @param sequelize sequelize
 * @param DataTypes 数据类型
 * @returns {*|Model}
 */
module.exports = function(sequelize, DataTypes) {
    return sequelize.define('table', {
        tableID: {
            type: DataTypes.INTEGER,
            field: 'table_id',
            primaryKey: true,
            autoIncrement: true,
            comment:'桌子ID'
        },
        tableNo:{
            type: DataTypes.INTEGER,
            field: 'table_no',
            allowNull: false,
            comment:'桌子号或验证码'
        },
        tableName: {
            type: DataTypes.STRING(40),
            field: 'table_name',
            allowNull: true,
            comment:'桌子名称'
        },
        tableMode: {
            type:DataTypes.INTEGER,
            field: 'table_mode',
            defaultValue: 0,
            comment:'模式,1,经典斗地主'
        },
        playMethod: {
            type:DataTypes.INTEGER,
            field: 'table_play_method',
            defaultValue: 0,
            comment:'玩法'
        },
        allowGameTimes: {
            type: DataTypes.INTEGER,
            field: 'table_allow_game_times',
            defaultValue: 0,
            comment:'局数'
        },
        consumeDiamond: {
            type: DataTypes.INTEGER,
            field: 'table_consume_diamond',
            defaultValue: 0,
            comment:'消耗的钻石'
        },
        isCardCounting: {
            type: DataTypes.BOOLEAN,
            field: 'table_is_card_counting',
            defaultValue: false,
            comment:'是否记牌'
        },
        member: {
            type: DataTypes.INTEGER,
            field: 'table_member',
            defaultValue: 0,
            comment:'成员数'
        },
        creatorID: {
            type: DataTypes.INTEGER,
            field: 'table_creator_id',
            comment:'创建者'
        },
        createdDate: {
            type: DataTypes.DATE,
            field: 'table_created_date',
            defaultValue: DataTypes.NOW,
            comment:'创建时间'
        },
        isStop:{
            type: DataTypes.BOOLEAN,
            field: 'table_is_stop',
            defaultValue: false,
            comment:'牌局是否结束'
        },
        isStart:{
            type: DataTypes.BOOLEAN,
            field: 'table_is_start',
            defaultValue: false,
            comment:'牌局是否开始'
        },
        isDrop:{
            type: DataTypes.BOOLEAN,
            field: 'table_is_drop',
            defaultValue: false,
            comment:'牌局是否解散'
        },
        startDate: {
            type: DataTypes.DATE,
            field: 'table_start_date',
            comment:'牌局开始时间'
        },
        stopDate: {
            type: DataTypes.DATE,
            field: 'table_stop_date',
            comment:'牌局结束时间'
        },
        dropDate: {
            type: DataTypes.DATE,
            field: 'table_drop_date',
            comment:'牌局解散时间'
        },
        res: {
            type: DataTypes.STRING(500),
            field: 'table_res',
            allowNull: true,
            comment:'战绩描述'
        },
        bombLimitType: {
            type:DataTypes.INTEGER,
            field: 'table_bomb_limit_type',
            defaultValue: 1,
            comment:'炸弹上限类型,1:不限,2:3炸、3:4炸、4:5炸'
        },
        clubId:{
            type:DataTypes.INTEGER,
            allowNull:false,
            defaultValue:0,
            comment:'圈子Id'
        }
    }, {
        tableName: 'ddz_t_table',
        timestamps: false,
        comment: "牌局表或桌子表",
        initialAutoIncrement:1
    });
}
