package modelClient

import "time"

type ModelLayoutTab struct {
	Id        uint64    `orm:"column(id);auto"`                                // 标识
	AppId     string    `orm:"column(appId);size(32)"`                         // App ID
	Title     string    `orm:"column(title);size(256)"`                        // 标题
	Seq       int32     `orm:"column(seq);size(16)"`                           // 排序
	Enable    bool      `orm:"column(enable);default(0)"`                      // 是否启用
	Remark    string    `orm:"column(remark);size(1024)"`                      // 备注
	IsDefault bool      `orm:"column(isDefault);default(0)"`                   // 默认
	Editable  bool      `orm:"column(editable);default(0)"`                    // 可编辑的
	Created   time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated   time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelLayoutTab) TableName() string {
	return "layout_tab"
}

func (a *ModelLayoutTab) TableIndex() [][]string {
	return [][]string{
		{"appId"},
	}
}
