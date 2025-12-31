/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

function Model(sequelize) {
    var MaJiangNDGroupHistory = sequelize.define('majiangndgrouphistory', {
        id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        deskId: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        clubId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue:0
        },
        endTime: {
            type: Sequelize.INTEGER,
            allowNull: false
        }
    });

    MaJiangNDGroupHistory.sync();

    return MaJiangNDGroupHistory;
}

module.exports = Model;