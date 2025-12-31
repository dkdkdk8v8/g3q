/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

function Model(sequelize) {
    var RedPackage = sequelize.define('redpackage', {
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
        timestamp: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        recivers: {
            type: Sequelize.STRING(256),
            allowNull: false,
            defaultValue: ""
        },
        totalCard: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        }
    });

    RedPackage.sync();

    return RedPackage;
}

module.exports = Model;