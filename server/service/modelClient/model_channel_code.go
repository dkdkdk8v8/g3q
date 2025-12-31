package modelClient

import "time"

type ModelChannelCode struct {
	Id             uint64    `orm:"column(id);auto"`                                // 标识
	AppId          string    `orm:"column(appId);size(32)"`                         // App ID
	Code           string    `orm:"column(code);size(32)"`                          // 渠道码
	Remark         string    `orm:"column(remark);size(256)"`                       // 备注
	ApkPath        string    `orm:"column(apkPath);size(256)"`                      // APK路径
	DiscountBegin  int8      `orm:"column(discountBegin)"`                          // 扣量-起始量
	DiscountNum    int8      `orm:"column(discountNum)"`                            // 扣量-扣除量
	DiscountEnable bool      `orm:"column(discountEnable);default(0)"`              // 扣量-是否启用
	Seq            int32     `orm:"column(seq);size(16)"`                           // 排序
	Enable         bool      `orm:"column(enable);default(0)"`                      // 是否启用
	IsDefault      bool      `orm:"column(isDefault);default(0)"`                   // 是否默认包
	ApkPackUpdated time.Time `orm:"column(apkPackUpdated);type(datetime)"`          // APK打包更新时间
	Created        time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated        time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelChannelCode) TableName() string {
	return "channel_code"
}

func (a *ModelChannelCode) TableUnique() [][]string {
	return [][]string{
		{"code"},
	}
}

func (a *ModelChannelCode) TableIndex() [][]string {
	return [][]string{
		{"seq"}, {"code"},
	}
}
