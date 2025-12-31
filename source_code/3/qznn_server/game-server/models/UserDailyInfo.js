/**
 * Created by Administrator on 2016/12/22.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var UserDailyInfo = sequelize.define('userdailyinfo', {
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        giftCodeCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        shareGroupCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        shareFriendCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        lastOptTime: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        freeCoinCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        appleRecharge1Count: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        appleRecharge2Count: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        appleRecharge3Count: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        }
    });

    UserDailyInfo.sync();
    
    return UserDailyInfo;
}

module.exports = Model;