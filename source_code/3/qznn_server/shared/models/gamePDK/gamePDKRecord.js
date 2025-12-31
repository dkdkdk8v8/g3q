/**
 * 跑得快游戏记录：系统ID,用户ID,桌子ID,桌号,局数,总得分
 * @param sequelize sequelize
 * @param DataTypes 数据类型
 * @returns {*|Model}
 */
module.exports = function(sequelize, DataTypes) {
    return sequelize.define('gamePDKRecord', {
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
    }, {
        tableName: 'pdk_t_game_pdk_record',
        timestamps: false,
        comment: "跑得快游戏记录"
    });
}
