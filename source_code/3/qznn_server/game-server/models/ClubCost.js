/**
 * Created by kudoo on 2018/5/25.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var ClubCost = sequelize.define('clubCost', {
        id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        clubId: {
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        roomCard: {
            type: Sequelize.INTEGER,
            defaultValue:0,
            comment:"房卡数"
        },
        logData: {
            type: Sequelize.STRING,
            defaultValue: ""
        },
        createTime: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW()
        }
    });

    ClubCost.sync()

    return ClubCost;
}

module.exports = Model;