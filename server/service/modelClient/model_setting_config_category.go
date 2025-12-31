package modelClient

import "time"

type ModelSettingConfigCategory struct {
	Id       uint64    `orm:"column(id);auto"`                                // 标识
	Name     string    `orm:"column(name);size(32)"`                          // 分类名称
	Category string    `orm:"column(category)"`                               // 分类值
	Seq      int32     `orm:"column(seq);size(16)"`                           // 排序
	Created  time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated  time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelSettingConfigCategory) TableName() string {
	return "setting_config_category"
}

func (a *ModelSettingConfigCategory) TableUnique() [][]string {
	return [][]string{
		{"category"},
	}
}

func (a *ModelSettingConfigCategory) TableIndex() [][]string {
	return [][]string{
		{"seq"},
	}
}
