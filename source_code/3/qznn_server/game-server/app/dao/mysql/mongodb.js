// mysql CRUD
var mongoclient = module.exports;

var _pool;

var NND = {};

Date.prototype.Format = function (fmt) {
	var o = {
		"M+": this.getMonth() + 1, //月份
		"d+": this.getDate(), //日
		"h+": this.getHours(), //小时
		"m+": this.getMinutes(), //分
		"s+": this.getSeconds(), //秒
		"q+": Math.floor((this.getMonth() + 3) / 3), //季度
		"S": this.getMilliseconds() //毫秒
	};
	if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	for (var k in o)
		if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
	return fmt;
};

/*
 * Init sql connection pool
 * @param {Object} app The app for the server.
 */
NND.init = function(app){
	_pool = require('./dao-pool').createMongdbPool(app);
};

/**
 * Excute sql statement
 * @param {String} tname Statement The mongodb table name.
 * @param {Object} args The data need to be save.
 * @param {fuction} cb Callback function.
 * 
 */
NND.insert = function(args){
	_pool.acquire(function(err, client) {
		if (!!err) {
			console.error('[mongoqueryErr] '+err.stack);
			return;
		}
		var date = new Date();
		var time = Date.parse(date)/1000;
		args.timestamp = time;
		var tname = "log-" + date.Format("yyyy-MM-dd");
		var collection = client.collection(tname);
		collection.insert(args);
		_pool.release(client);
	});
};

/**
 * Close connection pool.
 */
NND.shutdown = function(){
	_pool.destroyAllNow();
};

/**
 * init database
 */
mongoclient.init = function(app) {
	if (!!_pool){
		return mongoclient;
	} else {
		NND.init(app);
		mongoclient.insert = NND.insert;
		// mongoclient.update = NND.query;
		// mongoclient.delete = NND.query;
		// mongoclient.query = NND.query;
		return mongoclient;
	}
};

/**
 * shutdown database
 */
mongoclient.shutdown = function(app) {
	NND.shutdown(app);
};






