package modelClient

import (
	"beego/v2/client/orm"

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
