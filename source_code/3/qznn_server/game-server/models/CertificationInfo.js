/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

function Model(sequelize) {
    var CertificationInfo = sequelize.define('certificationinfo', {
        uid: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        name: {
            type: Sequelize.STRING(32),
            allowNull: false
        },
        IDNumber: {
            type: Sequelize.STRING(32),
            allowNull: false
        },
        status: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    });

    CertificationInfo.sync();

    return CertificationInfo;
}

module.exports = Model;