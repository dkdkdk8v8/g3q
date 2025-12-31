/**
 * Created by mofanjun on 2017/11/13.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var MaJiangGTZUserInfo = sequelize.define('majianggtzuserinfo', {
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
        loseCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        drawCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        playCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        tongShaCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        tongPeiCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        baoZiCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        specialCardCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        totalScore: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        maxWinScore: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        maxLoseScore: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        maxWinTime: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    });

    MaJiangGTZUserInfo.sync();

    return MaJiangGTZUserInfo;
}

module.exports = Model;
