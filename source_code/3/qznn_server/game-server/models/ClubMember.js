var Sequelize = require('sequelize');

function Model(sequelize) {
    var ClubMember = sequelize.define('clubmember', {
        clubId: {
            type: Sequelize.INTEGER,
            allowNull:false,
            comment:"俱乐部Id"
        },
        userId: {
            type: Sequelize.INTEGER,
            allowNull:false,
            comment:"玩家Id"
        },
        createAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW()
        }
    });

    ClubMember.sync()

    return ClubMember;
}

module.exports = Model;