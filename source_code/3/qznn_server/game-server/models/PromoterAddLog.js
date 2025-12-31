/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

function Model(sequelize) {
    var PromoterAddLog = sequelize.define('promoteraddlog', {
        id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        orderId: {
            type: Sequelize.STRING(50),
            allowNull: false,
            primaryKey: true
        },
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        gameId: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        cardNum: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        promoterId: {
            type: Sequelize.INTEGER,
            allowNull: false
        }
    });

    PromoterAddLog.sync();

    return PromoterAddLog;
}

module.exports = Model;