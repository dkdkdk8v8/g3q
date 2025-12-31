package modelClient

import (
	"beego/v2/client/orm"
	"time"
)

type AdType int

const (
	AdTypeOpenApp     AdType = 1
	AdTypeLobbyPop    AdType = 2
	AdTypeBanner      AdType = 3
	AdTypeQuick       AdType = 4
	AdTypeAdLobbySide AdType = 5
	AdTypeAdBlock     AdType = 6
)

type ModelAdCommon struct {
	Id           uint64    `orm:"column(id);auto"`                                // 标识
	ClickEventId uint64    `orm:"column(clickEventId)"`                           // 点击事件
	Name         string    `orm:"column(name);size(256)"`                         // 名称
	AdGroup      string    `orm:"column(adGroup)"`                                // 广告组
	AdType       AdType    `orm:"column(adType)"`                                 // 广告类型
	Icon         string    `orm:"column(icon);size(512)"`                         // 图片
	Enable       bool      `orm:"column(enable);default(0)"`                      // 是否启用
	Position     int32     `orm:"column(position);size(16)"`                      // 位置
	Weight       uint32    `orm:"column(weight)"`                                 // 同一个位置的广告按权重展示，为0时不展示
	Remark       string    `orm:"column(remark);size(1024)"`                      // 备注
	Created      time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated      time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelAdCommon) TableName() string {
	return "ad_common"
}

func (a *ModelAdCommon) TableIndex() [][]string {
	return [][]string{
		{"adGroup", "adType"},
	}
}

func GetAllAdCommon() ([]*ModelAdCommon, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelAdCommon{})
	var ret []*ModelAdCommon
	_, err := q.Filter("enable", 1).OrderBy("position").All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}
