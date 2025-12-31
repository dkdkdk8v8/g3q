package modelClient

import (
	"compoment/uid"
	"compoment/util"
)

const AppIdMain = "main"

type ModelUser struct {
	Id        uint64 `orm:"column(id);auto"`              // 标识
	UserId    string `orm:"column(user_id);size(64)"`     // 用户标识(带APPID前缀)
	AppId     string `orm:"column(app_id);size(32)"`      // 接入应用标识
	AppUserId string `orm:"column(app_user_id);size(64)"` // 应用用户标识(不带APPID前缀)
	Balance   int64  `orm:"column(balance);default(0)"`   // 余额（分）
	Remark    string `orm:"column(remark);size(256)"`     // 备注
	Enable    bool   `orm:"column(enable);default(0)"`    // 是否启用
}

func (a *ModelUser) TableName() string {
	return "g3q_user"
}

func (a *ModelUser) TableUnique() [][]string {
	return [][]string{
		{"user_id"},
	}
}

func (a *ModelUser) TableIndex() [][]string {
	return [][]string{
		{"user_id"}, {"enable"}, {"app_id"}, {"app_user_id"},
	}
}

func GetOrCreateUser(userId string) (*ModelUser, error) {
	var user ModelUser
	err := GetDb().QueryTable(new(ModelUser)).Filter("user_id", userId).One(&user)
	if err == nil {
		return &user, nil
	}

	// 用户不存在，执行自动注册逻辑
	appUserId := util.EncodeToBase36(uid.Generate())
	newUserId := AppIdMain + "_" + appUserId

	user = ModelUser{
		UserId:    newUserId,
		AppId:     AppIdMain,
		AppUserId: appUserId,
		Enable:    true,
	}

	_, err = WrapInsert(&user)
	return &user, err
}
