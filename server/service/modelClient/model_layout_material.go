package modelClient

import (
	"beego/v2/client/orm"
	"time"
)

type ModelLayoutMaterial struct {
	Id        uint64    `orm:"column(id);auto"`                                // 标识
	Name      string    `orm:"column(name);size(256)"`                         // 素材名称
	GroupName string    `orm:"column(groupName);size(512)"`                    // 素材分组名
	Icon      string    `orm:"column(icon);size(512)"`                         // 素材图片
	Seq       int32     `orm:"column(seq);size(16)"`                           // 排序
	Remark    string    `orm:"column(remark);size(1024)"`                      // 备注
	Desc      string    `orm:"column(desc);size(1024)"`                        // 描述
	Created   time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated   time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelLayoutMaterial) TableName() string {
	return "layout_material"
}

func (a *ModelLayoutMaterial) TableIndex() [][]string {
	return [][]string{
		{"seq"},
	}
}

func GetAllLayoutMaterial() ([]*ModelLayoutMaterial, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelLayoutMaterial{})
	var ret []*ModelLayoutMaterial
	_, err := q.All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}
