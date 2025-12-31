package modelClient

import (
	"time"
)

type ModelResourcePublisher struct {
	Id       uint64    `orm:"column(id);auto"`                                // 标识
	Name     string    `orm:"column(name)"`                                   // 名称
	NameSrc  string    `orm:"column(nameSrc)"`                                // 名称src
	Icon     string    `orm:"column(icon);size(512);default()"`               // 图标
	Profile  string    `orm:"column(profile);type(text);null"`                // 简介
	Country  string    `orm:"column(country);size(32);default()"`             // 国家
	Enable   bool      `orm:"column(enable);default(0)"`                      // 是否上架
	VideoNum int       `orm:"column(videoNum);default(0)"`                    // 视频数量
	HotBase  int       `orm:"column(hotBase);default(0)"`                     // 热度基础
	HotReal  int       `orm:"column(hotReal);default(0)"`                     // 热度真实统计
	Created  time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated  time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelResourcePublisher) TableName() string {
	return "resource_publisher_info"
}

func (a *ModelResourcePublisher) TableIndex() [][]string {
	return [][]string{
		{"name"}, {"nameSrc"},
	}
}

func (a *ModelResourcePublisher) TableUnique() [][]string {
	return [][]string{
		{"nameSrc"},
	}
}
