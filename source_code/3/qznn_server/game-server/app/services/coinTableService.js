var utils = require("../util/utils");

var TableService = function(app) {
    this.app = app;
    this.tables = {};
    this.types = {};
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
};

TableService.prototype.add = function(tableNo, deskType, coinType, table) {
    if(!this.exists(tableNo)){
        this.tables[tableNo] = table;
        if (!this.types[deskType]) {
            this.types[deskType] = {};
        }
        if (!this.types[deskType][coinType]) {
            this.types[deskType][coinType] = [];
        }
        this.types[deskType][coinType].push(tableNo);
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

TableService.prototype.getDeskNames = function(deskType, coinType) {
    if (this.types[deskType] && this.types[deskType][coinType]) {
        var arr = utils.clone(this.types[deskType][coinType]);
        arr.sort(function(a, b) {
            return b.playerNum - a.playerNum;
        });
        //utils.shuffle(arr);
        return arr;
    }
    return [];
};