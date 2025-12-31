package modelClient

import (
	"compoment/ormutil"
	"service/modelComm"
	"time"
)

const (
	CategoryApi  = "api"
	CategoryLine = "line"
	CategoryCdn  = "resource"
)

type ModelSettingLine struct {
	Id       uint64    `orm:"column(id);auto"`                                // 标识
	Category string    `orm:"column(category)"`                               // 线路分类
	Name     string    `orm:"column(name)"`                                   // 线路名称
	Url      string    `orm:"column(url);size(1024)"`                         // 线路URL
	SpeedUrl string    `orm:"column(speedUrl);size(1024)"`                    // 测速URL
	Seq      int32     `orm:"column(seq);size(16)"`                           // 排序
	Enable   bool      `orm:"column(enable);default(0)"`                      // 是否启用
	Created  time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated  time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelSettingLine) TableName() string {
	return "setting_line"
}

func (a *ModelSettingLine) TableIndex() [][]string {
	return [][]string{
		{"category"}, {"seq"}, {"enable"},
	}
}

func GetAllSettingLine() ([]*ModelSettingLine, error) {
	settingLines, err := modelComm.GetModelManyBySelectOption[ModelSettingLine](GetDb(), ormutil.WithKV("enable", 1))
	if err != nil {
		return nil, err
	}
	return settingLines, nil
}
