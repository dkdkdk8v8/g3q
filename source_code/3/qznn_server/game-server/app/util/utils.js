var utils = module.exports;
var crypto = require('crypto');

// control variable of func "myPrint"
var isPrintFlag = false;
// var isPrintFlag = true;

/**
 * Check and invoke callback function
 */
utils.invokeCallback = function(cb) {
  if(!!cb && typeof cb === 'function') {
    cb.apply(null, Array.prototype.slice.call(arguments, 1));
  }
};

/**
 * clone an object
 */
utils.clone = function(obj) {
    var o;
    if (typeof obj == "object") {
        if (obj === null) {
            o = null;
        } else {
            if (obj instanceof Array) {
                o = [];
                for (var i = 0, len = obj.length; i < len; i++) {
                    o.push(utils.clone(obj[i]));
                }
            } else {
                o = {};
                for (var j in obj) {
                    if(obj.hasOwnProperty(j)) {
                        o[j] = utils.clone(obj[j]);
                    }
                }
            }
        }
    } else {
        o = obj;
    }
    return o;
};

utils.size = function(obj) {
  if(!obj) {
    return 0;
  }

  var size = 0;
  for(var f in obj) {
    if(obj.hasOwnProperty(f)) {
      size++;
    }
  }
  return size;
};

// print the file name and the line number ~ begin
function getStack(){
  var orig = Error.prepareStackTrace;
  Error.prepareStackTrace = function(_, stack) {
    return stack;
  };
  var err = new Error();
  Error.captureStackTrace(err, arguments.callee);
  var stack = err.stack;
  Error.prepareStackTrace = orig;
  return stack;
}

function getFileName(stack) {
  return stack[1].getFileName();
}

function getLineNumber(stack){
  return stack[1].getLineNumber();
}

utils.myPrint = function() {
  if (isPrintFlag) {
    var len = arguments.length;
    if(len <= 0) {
      return;
    }
    var stack = getStack();
    var aimStr = '\'' + getFileName(stack) + '\' @' + getLineNumber(stack) + ' :\n';
    for(var i = 0; i < len; ++i) {
      aimStr += arguments[i] + ' ';
    }
    console.log('\n' + aimStr);
  }
};
// print the file name and the line number ~ end

utils.encodeNickName = function (nickName) {
  nickName = utils.formatUTF8Str(nickName);
  var buff = new Buffer(nickName);
  return buff.toString('base64');
};

utils.formatUTF8Str = function (inStr) {
  var buff = new Buffer(inStr);
  var str = buff.toString('hex');
  var buffArr = [];
  for (var i = 0; i < str.length; i+=2) {
    buffArr.push(str.substr(i, 2));
  }
  var res = '';

  var mo =  1<<7;
  var mo2 = mo | (1 << 6);
  var mo3 = mo2 | (1 << 5);         //三个字节
  var mo4 = mo3 | (1 << 4);          //四个字节
  var mo5 = mo4 | (1 << 3);          //五个字节
  var mo6 = mo5 | (1 << 2);          //六个字节

  for (var i = 0; i < buffArr.length; i++)
  {
    if ((parseInt(buffArr[i], 16) & mo) == 0) {
      res += buffArr[i];
      continue;
    }

    //4字节 及其以上舍去
    if ((parseInt(buffArr[i], 16) & mo6 )  == mo6)
    {
      i = i + 5;
      continue;
    }

    if ((parseInt(buffArr[i], 16) & mo5 )  == mo5)
    {
      i = i + 4;
      continue;
    }

    if ((parseInt(buffArr[i], 16) & mo4 )  == mo4)
    {
      i = i + 3;
      continue;
    }

    if ((parseInt(buffArr[i], 16) & mo3 )  == mo3 )
    {
      i = i + 2;
      if (((parseInt(buffArr[i], 16) & mo)  == mo)&&  ((parseInt(buffArr[i-1], 16) & mo)  == mo)  )
      {
        res += buffArr[i-2] + buffArr[i-1] + buffArr[i];;
      }
      continue;
    }

    if ((parseInt(buffArr[i], 16) & mo2 )  == mo2 )
    {
      i = i + 1;
      if ((parseInt(buffArr[i], 16) & mo)  == mo)
      {
        res += buffArr[i-1] + buffArr[i];
      }
      continue;
    }
  }
  return new Buffer(res, 'hex').toString();
};

utils.decodeNickName = function (codeStr) {
  var buff = new Buffer(codeStr, 'base64');
  return buff.toString();
};

utils.gameInfoData = function (gameType) {
  switch(gameType) {
    case 1:
      return require('../domain/TexasPokerUserInfo');
  }
};


utils.md5 = function(str, encoding){
  return crypto
      .createHash('md5')
      .update(str)
      .digest(encoding || 'hex');
};

utils.getFreeTime = function(gameType) {
  return require("../game/freeTime");
};

utils.isInFreeTime = function(gameType) {
  return false;//暂时去掉免费活动
  var actTime = utils.getFreeTime(gameType);
  if (!actTime) {
    return false;
  }
  var myDate = new Date();
  for (var i = 0; i < actTime.length; i++) {
    var t = actTime[i];
    var month = myDate.getMonth();
    if (month >= t.month.from && month <= t.month.to) {
      var day = myDate.getDate();
      if (day >= t.day.from && day <= t.day.to) {
        var week = myDate.getDay();
        if (week >= t.week.from && week <= t.week.to) {
          var hour = myDate.getHours();
          if (hour >= t.hour.from && hour <= t.hour.to) {
            var minute = myDate.getMinutes();
            if (minute >= t.minute.from && minute <= t.minute.to) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
};

utils.isSameDay = function(timestamps1, timestamps2) {
  return Math.floor((timestamps1 + 8*60*60)/(24*60*60)) - Math.floor((timestamps2 + 8*60*60)/(24*60*60));
};

utils.checkVersion = function (sVersion, cVersion) {
  cVersion = cVersion || "0.0.0";
  var sV = sVersion.split(".");
  var cV = cVersion.split(".");
  for (var i = 0 ; i < sV.length; i++) {
    if (Number(sV[i]) > Number(cV[i])) {
      return i+1;
    }
  }
  return 0;
};

utils.getCurPassDay = function () {
  var passData = Math.floor((new Date().getTime()/1000+8*60*60)/(24*60*60));
  return passData;
};

utils.shuffle = function(arr) {
    for(var j, x, i = arr.length; i; j = parseInt(Math.random() * i), x = arr[--i], arr[i] = arr[j], arr[j] = x);
};