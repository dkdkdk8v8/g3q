/**
 * Created by Administrator on 2016/10/20.
 * 比赛时间段统计
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var MaJiangNDCompetition = sequelize.define('majiangndcompetition', {
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        gameId: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },
        totalCount: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment:'总局数'
        },
        winCount: {
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
            defaultValue: 0,
            comment:'大局数'
        },
        costRoomCards: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment:'消耗房卡'
        }

    });

    MaJiangNDCompetition.sync();

    return MaJiangNDCompetition;
}

module.exports = Model;