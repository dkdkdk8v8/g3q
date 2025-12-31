/**
 * Created by Administrator on 2016/10/20.
 */

var Sequelize = require('sequelize');

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

function Model(sequelize) {
    var GameIdSet = sequelize.define('gameidset', {
        aid: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id: {
            type: Sequelize.INTEGER
        }
    }, {
        initialAutoIncrement:"100000"
    });

    GameIdSet.sync().then(function(){
        sequelize.query("select table_name, AUTO_INCREMENT, TABLE_SCHEMA from information_schema.tables where table_name='gameidset'", { type: sequelize.QueryTypes.SELECT})
            .then(function(inc) {
                for (var ii = 0; ii < inc.length; ii++) {
                    if (inc[ii].TABLE_SCHEMA == 'game_xq') {
                        var auto = parseInt(inc[ii].AUTO_INCREMENT);
                        if (auto == 100000) {
                            var length = auto + 9 * 10000;
                            var arr = [];
                            for (var i = auto; i < length; i++) {
                                arr.push({id: i});
                            }
                            arr = swap(arr, 10 * 10000);
                            for (var j = 0; j < 100; j++) {
                                var tempArr = arr.filter(function (item, index) {
                                    return index % 100 == j;
                                });
                                GameIdSet.bulkCreate(tempArr);
                            }
                        }
                    }
                }
            }).catch(function(err){
            console.log("user_db:"+err);
        });
    });

    return GameIdSet;
}

module.exports = Model;
