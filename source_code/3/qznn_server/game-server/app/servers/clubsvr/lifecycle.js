var redis = require("redis");

var swap = function (arr,number) {
    var random = function(min,max){
        return Math.floor(min+Math.random()*(max-min));
    };
    for(var i=0;i<number;i++){
        var index1 = random(0,arr.length);
        var index2 = random(0,arr.length);
        arr[index1] = arr.splice(index2, 1, arr[index1])[0];
    }
    return arr;
};

module.exports.afterStartAll = function(app) {
    //创建redis连接
    var redisConfig = app.get('redis');
    var client = redis.createClient({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db
    });
    app.set("redisClient",client);
    //初始化club id号
    var clubModel = pomelo.app.get('models').ClubIdSet;
    clubModel.count().then(function(c){
        if(c != 0){
            return;
        }
        var clubIds = [];
        for(var i = 100000; i <= 999999; i++){
            clubIds.push({clubId:i});
        }
        //交换20万次
        swap(clubIds,200000);
        
        var spliceArray = [];
        while(clubIds.length){
            var spliceLength = Math.min(clubIds.length,50000);
            spliceArray.push(clubIds.splice(0,spliceLength));
        }

        for(var i = 0; i < spliceArray.length; i++){
            clubModel.bulkCreate(spliceArray[i]);
        }
    })
};
