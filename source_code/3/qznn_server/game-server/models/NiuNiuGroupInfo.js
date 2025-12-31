/**
 * Created by Administrator on 2016/10/20.
 */
var Sequelize = require('sequelize');

function Model(sequelize) {
    var NiuNiuGroupInfo = sequelize.define('niuniugroupinfo', {
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
            type: Sequelize.STRING(1000),
            allowNull: false,
            defaultValue: ""
        },
        uids: {
            type: Sequelize.STRING(128),
            allowNull: false,
            defaultValue: ""
        }
    });

    NiuNiuGroupInfo.sync();

    return NiuNiuGroupInfo;
}

module.exports = Model;