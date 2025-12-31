package modelClient

import (
	"service/modelComm"
	"time"
)

type ModelResourceCustomTagGroup struct {
	Id      uint64    `orm:"column(id);auto"`                                // 标识
	Name    string    `orm:"column(name);size(32)"`                          // 分类名称
	Seq     int32     `orm:"column(seq);size(16)"`                           // 排序
	Created time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelResourceCustomTagGroup) TableName() string {
	return "resource_custom_tag_group"
}

func (a *ModelResourceCustomTagGroup) TableIndex() [][]string {
	return [][]string{
		{"seq"},
	}
}

func GetAllCustomTagGroup() ([]*ModelResourceCustomTagGroup, error) {
	customTagGroupModels, err := modelComm.GetModelManyBySelectOption[ModelResourceCustomTagGroup](GetDb(), nil)
	if err != nil {
		return nil, err
	}
	return customTagGroupModels, nil
}
