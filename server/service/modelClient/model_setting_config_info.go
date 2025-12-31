package modelClient

import "time"

type ModelSettingConfig struct {
	Id        uint64    `orm:"column(id);auto" `                               // 标识
	Name      string    `orm:"column(name)"`                                   // 配置名称
	Category  string    `orm:"column(category)"`                               // 配置分类
	DataKey   string    `orm:"column(dataKey)"`                                // 键
	DataValue string    `orm:"column(dataValue)"`                              // 值
	DataType  string    `orm:"column(dataType)"`                               // 类型
	Unit      string    `orm:"column(unit)"`                                   // 单位
	Rows      int32     `orm:"column(rows);size(16)"`                          // 编辑行数
	Seq       int32     `orm:"column(seq);size(16)"`                           // 排序
	ExtraJson string    `orm:"column(extraJson);size(10240)"`                  // 辅助数据JSON
	Remark    string    `orm:"column(remark);size(1024)"`                      // 备注
	Created   time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated   time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelSettingConfig) TableName() string {
	return "setting_config_info"
}

func (a *ModelSettingConfig) TableUnique() [][]string {
	return [][]string{
		{"dataKey"},
	}
}

func (a *ModelSettingConfig) TableIndex() [][]string {
	return [][]string{
		{"seq"}, {"dataKey"}, {"category"},
	}
}
