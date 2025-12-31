var Sequelize = require('sequelize');

function Model(sequelize) {
    var Club = sequelize.define('club', {
        clubId: {
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        clubName: {
            type: Sequelize.STRING(64),
            allowNull:false
        },
        tel: {
            type: Sequelize.STRING(40),
            defaultValue: '',
            comment:'手机号'
        },
        clubIcon: {
            type: Sequelize.STRING(128),
            allowNull:false,
            defaultValue:"0",
            comment:"俱乐部图标"
        },
        roomCard: {
            type: Sequelize.INTEGER,
            defaultValue:0,
            comment:"俱乐部房卡数"
        },
        managerId: {
            type: Sequelize.INTEGER,
            allowNull:false,
            comment:"管理员Id"
        },
        createTime: {
            type: Sequelize.INTEGER,
            allowNull:false
        },
        costRoomCard:{
            type: Sequelize.INTEGER,
            allowNull:false,
            defaultValue:1,
            comment:"俱乐部累积消耗房卡数"
        },
        isOpen:{
            type: Sequelize.INTEGER,
            allowNull:false,
            defaultValue:1,
            comment:'茶楼打样[0]打样[1]开放'
        }
    });

    Club.sync()

    return Club;
}

module.exports = Model;