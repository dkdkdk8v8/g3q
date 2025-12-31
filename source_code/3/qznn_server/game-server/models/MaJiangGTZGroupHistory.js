/**
 * Created by mofanjun on 2017/11/13.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var MaJiangGTZGroupHistory = sequelize.define('majianggtzgrouphistory', {
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
        clubId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue:0
        },
        endTime: {
            type: Sequelize.INTEGER,
            allowNull: false
        }
    });

    MaJiangGTZGroupHistory.sync();

    return MaJiangGTZGroupHistory;
}

module.exports = Model;