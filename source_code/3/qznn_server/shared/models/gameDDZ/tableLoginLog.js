/**
 * 房间登录日志：系统ID,用户ID，用户昵称，登录时间,
 * @param sequelize sequelize
 * @param DataTypes 数据类型
 * @returns {*|Model}
 */
module.exports = function(sequelize, DataTypes) {
    return sequelize.define('tableLoginLog', {
        logID: {
            type: DataTypes.INTEGER,
            field: 'log_id',
            primaryKey: true,
            autoIncrement: true,
            comment:'系统ID'
        },
        userAccount: {
            type: DataTypes.INTEGER,
            field: 'log_user_account',
            allowNull: false,
            comment:'用户ID'
        },
        nickName: {
            type: DataTypes.STRING(40),
            field: 'log_nick_name',
            comment:'用户昵称'
        },
        loginDate: {
            type: DataTypes.DATE,
            field: 'log_login_date',
            defaultValue: DataTypes.NOW,
            comment:'登录日期'
        },
    }, {
        tableName: 'ddz_t_table_login_log',
        timestamps: false,
        comment: "用户登录日志"
    });
}
