package modelClient

import "time"

type ModelSettingDiscountRule struct {
	Id           uint64    `orm:"column(id);auto"`                                // 标识
	Title        string    `orm:"column(title)"`                                  // 规则标题
	StartTime    time.Time `orm:"column(startTime);type(start_time)"`             // 生效时间
	EndTime      time.Time `orm:"column(endTime);type(end_time)"`                 // 失效时间
	WeekList     string    `orm:"column(weekList)"`                               // 每周日期集合
	DiscountType string    `orm:"column(discountType)"`                           // 类型
	Created      time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated      time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelSettingDiscountRule) TableName() string {
	return "setting_discount_rule"
}

func (a *ModelSettingDiscountRule) TableIndex() [][]string {
	return [][]string{
		{"discountType"},
	}
}
