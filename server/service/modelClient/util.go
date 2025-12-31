package modelClient

import (
	"beego/v2/client/orm"
	"compoment/ormutil"
)

func WrapInsert(model interface{}) (int64, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	return ormutil.InsertOne(o, model)
}

func WrapUpdate(model interface{}) (int64, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	return o.Update(model)
}

func GetDb() orm.Ormer {
	return orm.NewOrmUsingDB(ServerDB)
}
