/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

function Model(sequelize) {
    var MatchCode = sequelize.define('matchcode', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        code:{
            type: Sequelize.STRING(30),
            allowNull: false
        }
    });

    MatchCode.sync();

    return MatchCode;
}

module.exports = Model;