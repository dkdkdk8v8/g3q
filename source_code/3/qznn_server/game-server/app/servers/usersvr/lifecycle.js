var redis = require("redis");

module.exports.afterStartAll = function(app) {
    var redisConfig = app.get('redis');
    var client = redis.createClient({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db
    });
    app.set("redisClient",client);
};