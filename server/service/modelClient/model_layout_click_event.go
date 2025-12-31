package modelClient

import (
	"beego/v2/client/orm"
	"time"
)

type ClickType int

const (
	ClickTypeNone        ClickType = 0
	ClickTypeOpenWeb     ClickType = 1
	ClickTypeInnerWeb    ClickType = 2
	ClickTypeMainMenu    ClickType = 3
	ClickTypeVideoDetail ClickType = 4
	ClickTypePlayList    ClickType = 5
	ClickTypeTab         ClickType = 6
	ClickTypeSearch      ClickType = 7
)

type ClickTypeVideoDetailStruct struct {
	VideoId    uint64
	PlayListId uint64
}

type ClickTypePlayListStruct struct {
	PlayListId uint64
	BlockId    uint64
}

type ModelLayoutClickEvent struct {
	Id         uint64    `orm:"column(id);auto"`                                // 标识
	ClickType  ClickType `orm:"column(clickType);default(0)"`                   // 点击类型
	ClickParam string    `orm:"column(clickParam);size(1024)"`                  // 点击参数
	Remark     string    `orm:"column(remark);size(1024)"`                      // 备注
	Created    time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated    time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelLayoutClickEvent) TableName() string {
	return "layout_click_event"
}

func (a *ModelLayoutClickEvent) TableIndex() [][]string {
	return [][]string{
		{"clickType"},
	}
}

func GetAllLayoutClickEvent() ([]*ModelLayoutClickEvent, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelLayoutClickEvent{})
	var ret []*ModelLayoutClickEvent
	_, err := q.All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}
