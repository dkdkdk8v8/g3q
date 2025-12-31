package modelClient

import "time"

type ModelSettingDiscountSystem struct {
	Id      uint64    `orm:"column(id);auto"`                                // 标识
	RuleId  uint64    `orm:"column(ruleId)"`                                 // 规则id
	Percent uint8     `orm:"column(percent)"`                                // 扣量百分比0-100
	Weight  uint32    `orm:"column(weight)"`                                 // 权重 多条生效时取权重更高的一条
	Enable  bool      `orm:"column(enable);default(0)"`                      // 是否启用
	Valid   bool      `orm:"column(valid);default(0)"`                       // 是否生效
	Remark  string    `orm:"column(remark);size(256)"`                       // 备注
	Created time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelSettingDiscountSystem) TableName() string {
	return "setting_discount_system"
}

func (a *ModelSettingDiscountSystem) TableIndex() [][]string {
	return [][]string{
		{"valid"},
	}
}
