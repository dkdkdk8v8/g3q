/**
 * @profile
 * @title:棋牌游戏比赛模式设计中的核心匹配规则
 * @refer:http://www.gamelook.com.cn/2017/10/307361
*/
var TMQ_MAX_COUNT = 3;//table match queue 等待队列长度

var TableService = function(app) {
    this.app = app;
    this.tables = {};//tableNo,table
    this.GameTMQ = [];
};

module.exports = TableService;

//TableService.prototype.getTableByNo = function(tableNo) {
//    for(var key in this.tables){
//        var table = this.tables[key];
//        if(table.tableNo == tableNo){
//            return table;
//        }
//    }
//    return null;
//}
TableService.prototype.get = function(tableNo) {
    return this.tables[tableNo];
}

TableService.prototype.add = function(tableNo, table) {
    if(!this.exists(tableNo)){
        this.tables[tableNo] = table;
    }
};
TableService.prototype.exists = function(tableNo) {
    if(!!this.tables[tableNo]){
        return true;
    }
    return false;
};
TableService.prototype.remove = function(tableNo) {
    if(this.exists(tableNo)){
        delete this.tables[tableNo];
    }
};

/**
 * @profile:顺序 获取桌号
*/
TableService.prototype.getQuickEnterTableNo = function (roomIndex) {
    var tables = this.tables;
    var emptySeatTables = [];
    var bestTable = null;

    for(var tableNo in tables){
        var table = tables[tableNo];

        if(table.roomIndex != roomIndex){
            continue;
        }

        var emptyCnt = table.getEmptySeatCount();
        if(! emptySeatTables[emptyCnt]){
            emptySeatTables[emptyCnt] = [];
        }
        emptySeatTables[emptyCnt].push(table);
    }

    //排序
    for(var i = 1; i < emptySeatTables.length; i++){
        if(!! emptySeatTables[i]){
            emptySeatTables[i].sort(function(table1,table2){
                var no1 = table1.tableNo || table1.deskName;
                var no2 = table2.tableNo || table2.deskName;
                return no1 - no2;
            });
        }
    }

    for(var i = 1; i < emptySeatTables.length; i++){
        if(!! emptySeatTables[i]){
            bestTable = emptySeatTables[i][0];
            break;
        }
    }

    if(! bestTable) return null;//没有空闲桌子的时候

    return bestTable.tableNo || bestTable.deskName;
}
/**
 * @profile:顺序 获取房卡的桌号
*/
TableService.prototype.getBoxTableNo = function (boxId) {
    var tables = this.tables;
    var emptySeatTables = [];
    var bestTable = null;

    for(var tableNo in tables){
        var table = tables[tableNo];
        //非圈子的桌子 或者 不是同一个房间
        if(! table.boxId || table.boxId != boxId){
            continue;
        }

        var emptyCnt = table.getEmptySeatCount();
        if(! emptySeatTables[emptyCnt]){
            emptySeatTables[emptyCnt] = [];
        }
        emptySeatTables[emptyCnt].push(table);
    }

    //排序
    for(var i = 1; i < emptySeatTables.length; i++){
        if(!! emptySeatTables[i]){
            emptySeatTables[i].sort(function(table1,table2){
                var no1 = table1.tableNo || table1.deskName;
                var no2 = table2.tableNo || table2.deskName;
                return no1 - no2;
            });
        }
    }

    for(var i = 1; i < emptySeatTables.length; i++){
        if(!! emptySeatTables[i]){
            bestTable = emptySeatTables[i][0];
            break;
        }
    }

    if(! bestTable) return null;//没有空闲桌子的时候

    return bestTable.tableNo || bestTable.deskName;
}
/**
 * @profile:错序 获取桌号
*/
//重新获取TMQ
TableService.prototype.getTMQ = function(roomIndex){
    var tables = this.tables;
    if(! this.GameTMQ[roomIndex]){
        this.GameTMQ[roomIndex] = [];
    }
    var TMQ = this.GameTMQ[roomIndex];
    var emptySeatTables = [];
    var needCount = 0;
    var tmpTMQ = [];
    //1. 将坐满的TMQ踢出队列
    for(var i in TMQ){
        var table = this.tables[TMQ[i]];
        if(table.getEmptySeatCount() != 0){
            tmpTMQ.push(TMQ[i]);
        }
    }
    needCount = TMQ_MAX_COUNT - tmpTMQ.length;//队列中的位置全部由空位
    if(needCount == 0){
        return TMQ;//tmpTMQ is a new Array
    }
    //2. 从房间中将空闲的桌子加入
    //2.1 找到房间中所有的桌子
    for(var tableNo in tables){
        var table = tables[tableNo];

        if(table.roomIndex != roomIndex){
            continue;
        }

        var emptyCnt = table.getEmptySeatCount();
        if(! emptySeatTables[emptyCnt]){
            emptySeatTables[emptyCnt] = [];
        }
        emptySeatTables[emptyCnt].push(table);
    }
    //2.2 按桌子号排序
    for(var i = 1; i < emptySeatTables.length; i++){
        if(!! emptySeatTables[i]){
            emptySeatTables[i].sort(function(table1,table2){
                var no1 = table1.tableNo || table1.deskName;
                var no2 = table2.tableNo || table2.deskName;
                return no1 - no2;
            });
        }
    }
    //2.3 符合条件的入队
    for(var i = 1; i < emptySeatTables.length; i++){
        var legalTables = emptySeatTables[i];
        if(! legalTables) continue;
        for(var j = 0; j < legalTables.length && needCount > 0; j++){
            var table = legalTables[j];
            needCount --;
            tmpTMQ.push(table.tableNo || table.deskName);
        }
        
        if (needCount == 0) break;
    }

    this.GameTMQ[roomIndex] = tmpTMQ;
    return tmpTMQ;
}

TableService.prototype.getTMQTableNo = function(roomIndex){
    //重新获取队列
    var TMQ = this.getTMQ(roomIndex);
    //房间无空闲桌子
    if(TMQ.length == 0) return null;
    //重新排队
    var bestTableNo = TMQ.shift();
    TMQ.push(bestTableNo);
    return bestTableNo;
}

/**
 * @profile:人数统计接口
 * @return {roomIndex:playerCount}
 */
TableService.prototype.countPlayersByRoom = function(){
    var roomInfos = {}
    var tables = this.tables;

    for(var tableNo in tables){
        var table = tables[tableNo];
        var roomIndex = table.roomIndex;
        
        if(!roomInfos[roomIndex]){
            roomInfos[roomIndex] = 0;
        }

        var playersCnt = 0;
        table.players.forEach(function(p){
            if(!! p){
                playersCnt++;
            }
        });

        roomInfos[roomIndex] += playersCnt;
    }

    return roomInfos;
}