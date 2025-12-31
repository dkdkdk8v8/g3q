var Sequelize = require('sequelize');

function Model(sequelize) {
    var ClubIdSet = sequelize.define('clubidset', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        clubId: {
            type: Sequelize.INTEGER
        }
    });

    ClubIdSet.sync().then(function(){

    }).catch(function(err){
        console.log("ClubIdSet creat occur error:",err.message);
    });

    return ClubIdSet;
}

module.exports = Model;