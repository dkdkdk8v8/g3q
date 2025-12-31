/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

function Model(sequelize) {
    var GiftCode = sequelize.define('giftcode', {
        code: {
            type: Sequelize.STRING(32),
            allowNull: false,
            primaryKey: true
        },
        cardNum: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        endTime: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        codeType: {
            type: Sequelize.INTEGER,
            defaultValue: 1
        },
        leftCount: {
            type: Sequelize.INTEGER,
            defaultValue: 1
        }
    });

    GiftCode.sync();

    return GiftCode;
}

module.exports = Model;