(function(global){
    var code = {
        OK: 200,//操作成功
        FAIL: 500,//操作失败
        ERROR:100,//程序错误
        PARAM_ERROR:999,//参数错误
        LOGIN:{
            LOGIN_ERROR:502
        },
        ENTRY:{
            FA_TOKEN_ILLEGAL:1001,
            FA_TOKEN_EXPIRE:1002,
        },
        TABLE:{
            ROOM_CARD_NOT_ENOUGH:2001,
            FA_TABLE_CHANNEL_IS_NULL:2002,
            FA_TABLE_IS_NOT_IN_CHANNEL:2003,
            FA_TABLE_NOT_EXISTS:2004,
            FA_TABLE_IS_ALREADY_START:2005,
            FA_PLAYER_NOT_ENTER_TABLE:2006,
            FA_TABLE_PERSON_NUMBER_LIMIT:2007
        },
        USER:{
            FA_TABLE_SELF_IS_CREATOR:3001,
        }
    };

    if(typeof module !== 'undefined' && module.exports){
        module.exports = code;
    } else if(typeof define === 'function' && define.amd){
        define([], function () {
            return code;
        });
    } else {
        global.check_code = code;
    }
}(this));