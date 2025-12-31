/**
 * 游戏战绩：系统ID,桌子ID,桌号,局数,牌谱内容,创建时间
 * @param sequelize sequelize
 * @param DataTypes 数据类型
 * @returns {*|Model}
 */
 var path = require('path');
module.exports = function(sequelize, DataTypes) {
    return sequelize.define(path.basename(__filename, '.js') + '_record', {
        index: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        replayCode: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        deskId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        deskName: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        roundIndex: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        result:{
            type: DataTypes.TEXT,
            allowNull: true
        },
        createDate: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        collectionCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    },{
        freezeTableName: true,
        timestamps: false
    });
};
