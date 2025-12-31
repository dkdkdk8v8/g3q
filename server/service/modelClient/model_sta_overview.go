package modelClient

import "time"

type ModelStaOverview struct {
	Id       uint64    `orm:"column(id);auto"`                                // 标识
	KeyTime  time.Time `orm:"column(keyTime);type(datetime)" `                // 分片时间
	AppId    string    `orm:"column(appId);size(8)"`                          // APP ID
	Code     string    `orm:"column(code);size(8)"`                           // 渠道码
	Platform string    `orm:"column(platform);size(16)"`                      // 平台
	Click    int       `orm:"column(click);default(0)"`                       // 点击量
	Register int       `orm:"column(register);default(0)"`                    // 注册量
	Active   int       `orm:"column(active);default(0)"`                      // 活跃数
	Pay      int       `orm:"column(pay);default(0)"`                         // 用户支付金额(元)
	Created  time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated  time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelStaOverview) TableName() string {
	return "sta_overview"
}

func (a *ModelStaOverview) TableIndex() [][]string {
	return [][]string{
		{"keyTime"}, {"appId"}, {"code"}, {"platform"},
	}
}
