module.exports = function(sequelize, DataTypes) {
    return sequelize.define('record_code', {
        index: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        replayCode: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        gameType: {
            type: DataTypes.STRING(20),
            allowNull: false
        }
    }, {
        freezeTableName: true,
        timestamps: false
    });
};
