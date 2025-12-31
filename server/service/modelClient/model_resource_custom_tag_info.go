package modelClient

import (
	"service/modelComm"
	"time"
)

type ModelResourceCustomTag struct {
	Id         uint64    `orm:"column(id);auto"`                                // 标识
	Name       string    `orm:"column(name);size(32)"`                          // 标签名称
	PlaylistId uint64    `orm:"column(playlistId)"`                             // 播单id
	GroupId    uint64    `orm:"column(groupId)"`                                // 标签分组id
	Seq        int32     `orm:"column(seq);size(16)"`                           // 排序
	Created    time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated    time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelResourceCustomTag) TableName() string {
	return "resource_custom_tag_info"
}

func (a *ModelResourceCustomTag) TableIndex() [][]string {
	return [][]string{
		{"seq"}, {"name"}, {"groupId"},
	}
}

var GetCustomTagByIdCache = modelComm.WrapCache[ModelResourceCustomTag](GetCustomTagById,
	300*time.Second).(func(id uint64) (*ModelResourceCustomTag, error))

func GetCustomTagById(id uint64) (*ModelResourceCustomTag, error) {
	customTagModel, err := modelComm.GetModelById[ModelResourceCustomTag](GetDb(), id)
	if err != nil {
		return nil, err
	}
	return customTagModel, nil
}

func GetAllCustomTag() ([]*ModelResourceCustomTag, error) {
	customTagModels, err := modelComm.GetModelManyBySelectOption[ModelResourceCustomTag](GetDb(), nil)
	if err != nil {
		return nil, err
	}
	return customTagModels, nil
}
