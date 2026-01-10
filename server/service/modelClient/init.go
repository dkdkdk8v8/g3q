package modelClient

import (
	"beego/v2/client/orm"
	"compoment/ormutil"

	_ "github.com/go-sql-driver/mysql"
)

const ServerDB = "g3q_server"

func RegModels() {
	orm.RegisterModel(
		&ModelUser{},
		&ModelUserRecord{},
		&ModelGameRecord{},
	)
}

func GetOrm() orm.Ormer {
	return ormutil.NewOrm(ServerDB)
}

func GetReadOrm() orm.Ormer {
	return ormutil.NewReadOrm(ServerDB)
}
