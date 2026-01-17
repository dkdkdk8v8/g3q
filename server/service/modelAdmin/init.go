package modelAdmin

import (
	"beego/v2/client/orm"
	"compoment/ormutil"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/sirupsen/logrus"
)

const ServerDB = "g3q_admin"

func RegModels() {
	orm.RegisterModel(
		&ModelStaUser{},
	)
}

func Init() {
	ticker := time.NewTicker(time.Second * 10)
	go func() {
		for range ticker.C {
			err := SysParamCache.Reload()
			if err != nil {
				logrus.WithField("!", nil).WithError(err).Error("adminSysParam-Fail")
			}
		}
	}()
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
