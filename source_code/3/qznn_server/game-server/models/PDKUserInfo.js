/**
 * Created by Administrator on 2016/10/20.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var PDKUserInfo = sequelize.define('pdkuserinfo', {
        uid: {
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        totalCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        winCount: {
            type: Sequelize.INTEGER,
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
        bombCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        guanMenCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        quanGuanCount: {
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

    PDKUserInfo.sync();

    return PDKUserInfo;
}

module.exports = Model;