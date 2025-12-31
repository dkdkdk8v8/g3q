var timeFormat= function(date) {
    var n = date.getFullYear();
    var y = date.getMonth() + 1;
    var r = date.getDate();
    var mytime = date.toLocaleTimeString();
    var mytimes = n+ "-" + y + "-" + r + " " + mytime;
    return mytimes;
};
 module.exports.timeFormat = timeFormat;