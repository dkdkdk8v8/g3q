/**
 * Created by mofanjun on 2017/11/6.
 */
var Pool = require('generic-pool').Pool;
var mongoClient = require('mongodb').MongoClient;
var config = require('../../../config/mongo4robot.json')[process.env.NODE_ENV || 'development'];


var createMongoPool = function(){
    return new Pool({
                name:'mongo4robot',
                create:function (callback) {
                    var dbURL = "mongodb://" + config.user + ":" + config.password + "@" + config.host + ":" + config.port + "/" + config.database;
                    mongoClient.connect(dbURL,function (err,db) {
                        if(err){
                            console.log('createMongoPool.connect.err----->',err.message);
                            callback(err,null);
                            return;
                        }
                        callback(null,db);
                    })
                },
                destroy:function (client) {
                    client.close();
                },
                max:10,
                idleTimeoutMillis:30*1000,
                log:false
            })
};

module.exports = createMongoPool;
