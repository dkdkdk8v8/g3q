/**
 * Created by kudoo on 2018/4/17.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var UserSigin = sequelize.define('usersignin', {
        id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        info: {
            type: Sequelize.STRING,
            defaultValue: "",
            comment:"签到信息"
        },
    });

    UserSigin.sync();

    return UserSigin;
}

module.exports = Model;