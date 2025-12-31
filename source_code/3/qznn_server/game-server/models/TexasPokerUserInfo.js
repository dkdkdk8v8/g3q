/**
 * Created by Administrator on 2016/10/20.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var TexasPokerUserInfo = sequelize.define('texaspokeruserinfo', {
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        maxCards: {
            type: Sequelize.STRING(40),
            allowNull: false,
            defaultValue: "[]"
        },
        maxCardType: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        totalCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        winCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        betCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        perflopBetCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        playCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        tongHuaCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        huLuCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        siTiaoCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        tongHuaSunCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        huangJiaTongHuaCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
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
        },
        totalScore: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        }
    });

    TexasPokerUserInfo.sync();

    return TexasPokerUserInfo;
}

module.exports = Model;