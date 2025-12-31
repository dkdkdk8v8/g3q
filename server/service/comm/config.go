package comm

import "compoment/conf"

var CfgLogSysHttpIn = conf.NewBoolLoader("config.sys.http.in", true)
var CfgLogSysHttpOut = conf.NewBoolLoader("config.sys.http.out", true)
var CfgLogContentLength = conf.NewIntLoader("config.sys.http.content.len", 128)
