/**
 * Created by Administrator on 2016/10/20.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var UserAddInfo = sequelize.define('useraddinfo', {
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        codeInfoJson: {
            type: Sequelize.STRING(1024),
            allowNull: false,
            defaultValue: "{}"
        },
        guanZhuAward: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        activeDay: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        gameCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        costRoomCard: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        lastLoginTime: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        totalCount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        }
    });

    UserAddInfo.sync();

    return UserAddInfo;
}

module.exports = Model;