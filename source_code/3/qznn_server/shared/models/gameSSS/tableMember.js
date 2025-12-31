/**
 * 牌局成员信息：成员ID,牌局ID，加入时间,类型(1.创建者,2.普通成员)，买入的筹码，拥有的筹码，总手数
 * @param sequelize sequelize
 * @param DataTypes 数据类型
 * @returns {*|Model}
 */
module.exports = function(sequelize, DataTypes) {
    return sequelize.define('tableMember', {
        tbID: {
            type: DataTypes.INTEGER,
            field: 'tm_id',
            primaryKey: true,
            autoIncrement: true,
            comment:'系统ID'
        },
        tableID: {//牌局ID
            type: DataTypes.INTEGER,
            field: 'tm_table_id',
            allowNull: false
        },
        uid: {//牌局成员ID
            type: DataTypes.INTEGER,
            field: 'tm_user_id',
            allowNull: false
        },
        nickName: {
            type: DataTypes.STRING(128),
            field: 'nickName',
            allowNull: true,
            comment:'用户昵称'
        },
        createdDate: {
            type: DataTypes.DATE,
            field: 'tm_created_date',
            defaultValue: DataTypes.NOW,
            comment:'创建时间'
        },
        memberType: {
            type: DataTypes.INTEGER,
            field: 'tm_member_type',
            allowNull: false,
            comment:'类型,1,房主,2普通成员'
        },
        winNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_win_number',
            defaultValue: 0,
            comment:'胜利数'
        },
        totalGunNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_total_gun_number',
            defaultValue: 0,
            comment:'打枪数'
        },
        totalBGunNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_total_b_gun_number',
            defaultValue: 0,
            comment:'被打枪数'
        },
        totalGunAllNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_total_gun_all_number',
            defaultValue: 0,
            comment:'全垒打'
        },
        totalSpecialNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_total_special_number',
            defaultValue: 0,
            comment:'特殊牌型数'
        },
        totalSfNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_total_sf_number',
            defaultValue: 0,
            comment:'同花顺数'
        },
        totalBombNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_total_bomb_number',
            defaultValue: 0,
            comment:'铁支数'
        },
        score:{
            type: DataTypes.INTEGER,
            field: 'tm_score',
            defaultValue: 0,
            comment:'总分'
        },

    }, {
        tableName: 'sss_t_table_member',
        timestamps: false,
        comment: "牌局成员信息"
    });
}
