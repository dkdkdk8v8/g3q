
var createNonceStr = function () {
    return Math.random().toString(36).substr(2, 15);
};

var createTimestamp = function () {
    return parseInt(new Date().getTime() / 1000) + '';
};

var raw = function (args) {
    var keys = Object.keys(args);
    keys = keys.sort()
    var newArgs = {};
    keys.forEach(function (key) {
        newArgs[key] = args[key];
    });

    var string = '';
    for (var k in newArgs) {
        string += '&' + k + '=' + newArgs[k];
    }
    string = string.substr(1);
    return string;
};

var sign = function (params, key) {
    var string = raw(params);
    string += '&key=' + key;
    var md5 = require('md5');

    return md5(string).toUpperCase();
};

module.exports.sign = sign;

module.exports.createNonceStr = createNonceStr;

module.exports.createTimestamp = createTimestamp;
