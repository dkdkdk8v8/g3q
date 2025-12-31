var Sequelize = require('sequelize');

function Model(sequelize) {
    var MatchAward = sequelize.define('matchaward', {
        uid:{
            type: Sequelize.INTEGER,
            allowNull: false
        },
        matchName:{
            type: Sequelize.STRING(32),
            allowNull:false
        },
        awardName:{
            type: Sequelize.STRING(16),
            allowNull: false
        },
        awardNumber:{
            type:Sequelize.INTEGER,
            allowNull:false,
            defaultValue:0
        },
        time:{
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW()
        }
    });

    MatchAward.sync();

    return MatchAward;
}

module.exports = Model;