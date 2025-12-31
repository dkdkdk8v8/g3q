var Sequelize = require('sequelize');

function Model(sequelize) {
    var CoinMaJiangNDUserInfo = sequelize.define('coinmajiangnduserinfo', {
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true
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
        huCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        liuCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        totalScore: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        playCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        ziMoCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        daHuCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        qiDuiCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        daDiaoCheCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        haiDiLaoCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        genZhuangCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        maxLoseScore: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        maxWinScore: {
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

    CoinMaJiangNDUserInfo.sync();

    return CoinMaJiangNDUserInfo;
}

module.exports = Model;