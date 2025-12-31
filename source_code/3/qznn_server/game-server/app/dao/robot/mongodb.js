/**
 * Created by mofanjun on 2017/11/6.
 */
var createMongoPool = require('./pool');

var mongoClient = module.exports;

//from lordofpomelo
var _pool = null;
var NND = {};

NND.init = function () {
    if(!_pool){
        _pool = createMongoPool();
    }
}

NND.shutdown = function () {
    _pool.destroyAllNow()
}

NND.insert = function (iDoc) {
    _pool.acquire(function (err,client) {
        try{
            if(err){
                throw err;
            }else {
                _pool.release(client);
                var tname = iDoc.name + "Cards";
                delete iDoc.name;

                var collection = client.collection(tname);
                collection.findOne({deckMD5:iDoc.deckMD5},function(err,doc){//不重复的牌堆入库
                    if(!! err ){
                        throw err
                    }

                    if(!! doc){
                        return;
                    }

                    collection.insertOne(iDoc,function (err,res) {
                        if(!! err){
                            throw err;
                            return;
                        }
                    })
                })
            }
        }catch (err){
            console.log('NND.insert--->err',err.message);
        }
    })
}

NND.findRandomOne = function (args,callback) {
    _pool.acquire(function (err,client) {
        try{
            if(err){
                throw err;
            }else {
                _pool.release(client);
                var tname = args.name + "Cards";
                delete args.name;

                var collection = client.collection(tname);
                collection.count(function(err,count){
                    if(!!err) throw err;
                    
                    var skip = Math.floor(Math.random() * count)
                    collection.find({}).skip(skip).limit(1).toArray(function(err,docs){
                        if(!! err) throw err;
                        callback(null,docs[0]);
                    })
                })
            }
        }catch (err){
            console.log('NND.insert--->err',err.message);
            callback(err);
        }
    })
}



mongoClient.init = function () {
    if(!! _pool){
        return mongoClient;
    }else {
        NND.init();
        mongoClient.insert = NND.insert;
        mongoClient.findRandomOne = NND.findRandomOne;
        return mongoClient;
    }
}

mongoClient.shutdown = function () {
    NND.shutdown();
}