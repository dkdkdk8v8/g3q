/**
 * 游戏战绩：系统ID,桌子ID,桌号,局数,牌谱内容,创建时间
 * @param sequelize sequelize
 * @param DataTypes 数据类型
 * @returns {*|Model}
 */
 var path = require('path');
module.exports = function(sequelize, DataTypes) {
    return sequelize.define(path.basename(__filename, '.js') + '_dailyScore', {
        index: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uid: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        dayIndex: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        score: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    },{
        freezeTableName: true,
        timestamps: false,
    });
}
