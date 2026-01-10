package modelAdmin

import (
	"beego/v2/client/orm"
	"compoment/ormutil"

	_ "github.com/go-sql-driver/mysql"
)

const ServerDB = "g3q_admin"

func RegModels() {
	orm.RegisterModel(
		&ModelStaUser{},
	)
}

func WrapInsert(model interface{}) (int64, error) {
	o := GetDb()
	return ormutil.InsertOne(o, model)
}

func WrapUpdate(model interface{}) (int64, error) {
	o := GetDb()
	return o.Update(model)
}

func GetDb() orm.Ormer {
	return ormutil.NewOrm(ServerDB)
}

func GetReadDb() orm.Ormer {
	return ormutil.NewReadOrm(ServerDB)
}
