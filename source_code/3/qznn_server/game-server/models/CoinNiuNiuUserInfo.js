var Sequelize = require('sequelize');

function Model(sequelize) {
    var CoinNiuNiuUserInfo = sequelize.define('coinniuniuuserinfo', {
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
        niuNiuCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        wuHuaNiuCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        wuXiaoNiuCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        zhaDanCount: {
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
        },
        playCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    });

    CoinNiuNiuUserInfo.sync();

    return CoinNiuNiuUserInfo;
}

module.exports = Model;