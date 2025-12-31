/**
 * Created by Administrator on 2016/10/20.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var SSSUserInfo = sequelize.define('sssuserinfo', {
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
        perflopBetCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        playCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        daQiangCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        beiDaQiangCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        quanLeiDaCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        specialCardCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        tongHuaCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        tieZhiCount: {
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

    SSSUserInfo.sync();

    return SSSUserInfo;
}

module.exports = Model;