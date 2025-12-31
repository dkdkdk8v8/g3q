/**
 * Created by Administrator on 2016/10/20.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var MaJiangNDGroupInfo = sequelize.define('majiangndgroupinfo', {
        deskId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        deskName: {
            type: Sequelize.STRING(16),
            allowNull: false,
            defaultValue: ""
        },
        deskType: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        createTime: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        startTime: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        endTime: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        createId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        flag: {
            type: Sequelize.STRING(512),
            allowNull: false,
            defaultValue: 0
        },
        res: {
            type: Sequelize.STRING(2000),
            allowNull: false,
            defaultValue: ""
        },
        uids: {
            type: Sequelize.STRING(128),
            allowNull: false,
            defaultValue: ""
        }
    });

    MaJiangNDGroupInfo.sync();

    return MaJiangNDGroupInfo;
}

module.exports = Model;