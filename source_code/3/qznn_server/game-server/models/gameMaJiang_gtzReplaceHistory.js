/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

function Model(sequelize) {
    var GTZGroupHistory = sequelize.define('gameMaJiang_gtzReplaceHistory', {
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
        endTime: {
            type: Sequelize.INTEGER,
            allowNull: false
        }
    });

    GTZGroupHistory.sync();

    return GTZGroupHistory;
}

module.exports = Model;