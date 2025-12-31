/**
 * Created by Administrator on 2016/11/11.
 */
/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

function Model(sequelize) {
    var MessageBoard = sequelize.define('messageboard', {
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
        message: {
            type: Sequelize.STRING(512),
            allowNull: false,
            defaultValue: ""
        },
        nickName: {
            type: Sequelize.STRING(128),
            allowNull: false
        },
        faceId: {
            type: Sequelize.STRING(256),
            allowNull: false
        }
    });

    MessageBoard.sync();

    return MessageBoard;
}

module.exports = Model;