package modelClient

import (
	"beego/v2/client/orm"
	"compoment/ormutil"
	"service/modelComm"
	"time"
)

type ModelResourceVideoTag struct {
	Id         uint64    `orm:"column(id);auto"`                                // 标识
	NameSrc    string    `orm:"column(nameSrc);size(32)"`                       // 原标签
	SimilarIds string    `orm:"column(similarIds);size(512)"`                   // 近义词ID集合
	Seq        int32     `orm:"column(seq);size(16)"`                           // 排序
	Created    time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated    time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelResourceVideoTag) TableName() string {
	return "resource_video_tag_info"
}

func (a *ModelResourceVideoTag) TableIndex() [][]string {
	return [][]string{
		{"seq"}, {"nameSrc"},
	}
}

func (a *ModelResourceVideoTag) TableUnique() [][]string {
	return [][]string{
		{"nameSrc"},
	}
}

func InsertResourceTag(model *ModelResourceVideoTag) error {
	o := orm.NewOrmUsingDB(ServerDB)
	_, err := o.Insert(model)
	if err != nil {
		return err
	}
	return nil
}

var GetSrcTagCache = modelComm.WrapCache[ModelResourceVideoTag](GetSrcTag,
	10*time.Second).(func(src string) (*ModelResourceVideoTag, error))

func GetSrcTag(src string) (*ModelResourceVideoTag, error) {
	ormRet, errOrm := ormutil.QueryOneNoDiff[ModelResourceVideoTag](GetDb(),
		ormutil.WithKV("nameSrc", src))
	if errOrm != nil {
		return nil, errOrm
	}
	return ormRet, nil
}

var GetSrcTagsCache = modelComm.WrapCache[[]*ModelResourceVideoTag](GetSrcTags,
	10*time.Second).(func(ids []uint64) ([]*ModelResourceVideoTag, error))

func GetSrcTags(ids []uint64) ([]*ModelResourceVideoTag, error) {
	if len(ids) <= 0 {
		return nil, nil
	}
	ormRet, errOrm := ormutil.QueryManyNoDiff[ModelResourceVideoTag](GetDb(),
		ormutil.WithIds(ids))
	if errOrm != nil {
		return nil, errOrm
	}
	return ormRet, nil
}

func GetResourceTags(nameSrc ...string) ([]*ModelResourceVideoTag, error) {
	if len(nameSrc) <= 0 {
		return nil, nil
	}
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelResourceVideoTag{})
	var ret []*ModelResourceVideoTag
	_, err := q.Filter("nameSrc__in", nameSrc).All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func GetResourceTagsByIds(ids ...string) ([]*ModelResourceVideoTag, error) {
	if len(ids) <= 0 {
		return nil, nil
	}
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelResourceVideoTag{})
	var ret []*ModelResourceVideoTag
	_, err := q.Filter("id__in", ids).All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}
