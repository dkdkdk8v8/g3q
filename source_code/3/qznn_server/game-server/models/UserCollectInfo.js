/**
 * Created by Administrator on 2016/10/20.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var UserCollectInfo = sequelize.define('usercollectinfo', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uid: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        gameType: {
            type: Sequelize.STRING(20),
            defaultValue: ""
        },
        result: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        createDate: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        replayCode: {
            type: Sequelize.STRING(20),
            defaultValue: ""
        }
    });

    UserCollectInfo.sync();

    return UserCollectInfo;
}

module.exports = Model;