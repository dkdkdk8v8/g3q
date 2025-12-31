var Sequelize = require('sequelize');

function Model(sequelize) {
    var Robot = sequelize.define('robotinfo', {
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        loginPwd: {
            type: Sequelize.STRING(40),
            allowNull: false,
            defaultValue: ""
        },
        account: {
            type: Sequelize.STRING(40),
            allowNull: false,
            defaultValue: ""
        },
        nickName: {
            type: Sequelize.STRING(128),
            allowNull: false,
            defaultValue: ""
        },
        sex: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        faceId: {
            type: Sequelize.STRING(256),
            allowNull: false,
            defaultValue: ""
        },
        city: {
            type: Sequelize.STRING(45),
            allowNull: false,
            defaultValue: ""
        },
        province: {
            type: Sequelize.STRING(45),
            allowNull: false,
            defaultValue: ""
        },
        country: {
            type: Sequelize.STRING(45),
            allowNull: false,
            defaultValue: ""
        },
        platformId: {
            type: Sequelize.STRING(45),
            allowNull: false,
            defaultValue: ""
        },
        sign: {
            type: Sequelize.STRING(512),
            allowNull: false,
            defaultValue: ""
        },
        roomCard: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        freeRoomInfo: {
            type: Sequelize.STRING(1024),
            allowNull: false,
            defaultValue: "{}"
        },
        gameId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        isCheck: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        createTime: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        lastLoginTime: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        isNewUser: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        costRoomCard: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        lastLoginPlatform: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        lastLoginIP: {
            type: Sequelize.STRING(32),
            allowNull: false,
            defaultValue: ""
        },
        guideStep: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        coin: {
            type: Sequelize.BIGINT,
            defaultValue: 10000
        },
        coupon: {
            type: Sequelize.BIGINT,
            defaultValue: 0
        },
        phoneNum: {
            type: Sequelize.STRING(20),
            defaultValue: ""
        },
        isLoyal: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        isFrozen: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        registerChannelID: {
            type: Sequelize.STRING(20),
            defaultValue: ""
        },
        lastLoginChannelID: {
            type: Sequelize.STRING(20),
            defaultValue: ""
        },
        recharge: {
            type: Sequelize.INTEGER,
            comment:"机器人充值"
        }
    },{
        initialAutoIncrement:'10000000'
    });

    Robot.sync();

    return Robot;
}

module.exports = Model;