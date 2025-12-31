/**
 * Created by Administrator on 2016/10/20.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var DDZUserInfo = sequelize.define('ddzuserinfo', {
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        totalCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        winCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        totalScore: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        playCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        dzWinCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        nmWinCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        chunTianCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        rocketCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        bombCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        maxWinScore: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        maxWinTime: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        maxLoseScore: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        }
    });

    DDZUserInfo.sync();

    return DDZUserInfo;
}

module.exports = Model;