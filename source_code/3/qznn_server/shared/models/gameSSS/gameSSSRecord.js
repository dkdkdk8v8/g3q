/**
 * 十三水游戏记录：系统ID,用户ID,桌子ID,桌号,局数,总得分
 * @param sequelize sequelize
 * @param DataTypes 数据类型
 * @returns {*|Model}
 */
module.exports = function(sequelize, DataTypes) {
    return sequelize.define('gameSSSRecord', {
        recordID: {
            type: DataTypes.INTEGER,
            field: 'recordID',
            primaryKey: true,
            autoIncrement: true,
            comment:'系统ID'
        },
        uid: {
            type: DataTypes.INTEGER,
            field: 'uid',
            allowNull: false,
            comment:'用户ID'
        },
        tableID: {
            type: DataTypes.INTEGER,
            field: 'tableID',
            allowNull: false,
            comment:'桌子ID'
        },
        tableNo: {
            type: DataTypes.INTEGER,
            field: 'tableNo',
            allowNull: false,
            comment:'桌号'
        },
        number: {
            type: DataTypes.INTEGER,
            field: 'number',
            defaultValue: 0,
            comment:'局数'
        },
        score: {
            type: DataTypes.INTEGER,
            field: 'score',
            defaultValue: 0,
            comment:'总得分'
        },
        playMethod: {
            type:DataTypes.INTEGER,
            field: 'playMethod',
            defaultValue: 0,
            comment:'玩法'
        },
        createDate: {
            type: DataTypes.DATE,
            field: 'createDate',
            defaultValue: DataTypes.NOW,
            comment:'创建时间'
        }, 
        gunNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_gun_number',
            defaultValue: 0,
            comment:'打枪数'
        },
        bGunNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_b_gun_number',
            defaultValue: 0,
            comment:'被打枪数'
        },
        gunAllNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_gun_all_number',
            defaultValue: 0,
            comment:'全垒打'
        },
        specialNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_special_number',
            defaultValue: 0,
            comment:'特殊牌型数'
        },
        sfNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_sf_number',
            defaultValue: 0,
            comment:'同花顺数'
        },
        bombNumber:{
            type: DataTypes.INTEGER,
            field: 'tm_bomb_number',
            defaultValue: 0,
            comment:'铁支数'
        }
    }, {
        tableName: 'sss_t_game_sss_record',
        timestamps: false,
        comment: "十三水游戏记录"
    });
}
