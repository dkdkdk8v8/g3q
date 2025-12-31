var _poolModule = require('generic-pool');

var createMongdbPool = function(app) {
	var mongodbConfig = app.get('mongodb');
	var dbURL = "mongodb://" + mongodbConfig.user + ":" + mongodbConfig.password + "@" + mongodbConfig.host + ":" + mongodbConfig.port + "/" + mongodbConfig.database;
	return _poolModule.Pool({
		name: 'mongodb',
		create: function(callback) {
			var mongodb = require('mongodb').MongoClient;
			mongodb.connect(dbURL, callback);
		},
		destroy: function(client) {
			client.close();
		},
		max: 10,
		idleTimeoutMillis : 30000,
		log : false
	});
};

exports.createMongdbPool = createMongdbPool;
