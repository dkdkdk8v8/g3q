package modelClient

import (
	"beego/v2/client/orm"
)

func GetAllSettingConfig() ([]*ModelSettingConfig, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelSettingConfig{})
	var ret []*ModelSettingConfig
	_, err := q.All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}
