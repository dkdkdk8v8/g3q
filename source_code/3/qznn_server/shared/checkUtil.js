module.exports.checkPhone = function (phone){
    if(!(/^1[3|4|5|7|8]\d{9}$/.test(phone))){
        return false;
    }
    return true;
}

module.exports.isInteger = function (x) {
    if(x === null || x === ""){
        return false;
    }
    return x % 1 === 0;
}
module.exports.isBoolean = function (x) {
    if (x == 0 || x == '0' || x == 1 || x == '1') {
        return true;
    }
    return false;
}
module.exports.isPositiveInteger = function (x) {
    if(x === null || x === ""){
        return false;
    }
    if(x % 1 !== 0){
        return false;
    }
    return x > 0;
}
//module.exports.swap = function (arr,number) {
//    var random = function(min,max){
//        return Math.floor(min+Math.random()*(max-min));
//    }
//    var index1 = random(0,arr.length);
//    var index2 = random(0,arr.length);
//    arr[index1] = arr.splice(index2, 1, arr[index1])[0];
//    return arr;
//}
