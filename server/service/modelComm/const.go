package modelComm

const (
	HistoryReportRedisHoldSec = 86400
)

const (
	MysqlCacheRedisDb = 1

	ReadReportRedisDb        = 2
	ReadReportPrefix         = "r_"
	ReadReportUpdateTimeHKey = "ut"

	StatisticRedisDb = 3
	SearchHot        = "s_h_"

	RedisDbData       = 4
	UserIncreaseIdKey = "user_inc"

	RedisUserBriefDb = 5

	RedisInstallDb    = 6
	InstallIpForShare = "ip_s_"
	InstallIpForCode  = "ip_c_"

	RedisDbToken = 7 //已经预先定义在了Comm Token 模块内
	RedisDbSms   = 8 //已经预先定义在了sms 模块内
)
