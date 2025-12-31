/**
 * Created by kudoo on 2018/5/21.
 */
//兑换记录
var Sequelize = require('sequelize');

function Model(sequelize) {
    var userExchangeRecord = sequelize.define('userExchangeRecord', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        productID: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        productName: {
            type: Sequelize.STRING,
            defaultValue: ""
        },
        code: {
            type: Sequelize.STRING,
            allowNull: false,
            comment:"兑换码"
        },
        status: {
            type: Sequelize.INTEGER,
            defaultValue: 0             //0未兑换，1已兑换
        },
        createDate: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW()
        },
        checkDate: {
            type: Sequelize.DATE,
            comment:"处理时间"
        }
    });

    userExchangeRecord.sync();

    return userExchangeRecord;
}

module.exports = Model;