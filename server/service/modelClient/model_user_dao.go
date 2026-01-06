package modelClient

import (
	"compoment/ormutil"

	"github.com/sirupsen/logrus"
)

func GetOrCreateUser(appId string, appUserId string) (*ModelUser, error) {
	//todo redis locking，防止并发创建同一用户
	var user ModelUser
	err := GetDb().QueryTable(new(ModelUser)).Filter(
		"user_id", appId+appUserId).One(&user)
	if err == nil {
		return &user, nil
	}

	// 用户不存在，执行自动注册逻辑
	newUserId := appId + appUserId

	user = ModelUser{
		UserId:    newUserId,
		AppId:     appId,
		AppUserId: appUserId,
		Enable:    true,
		Balance:   200000, // 默认2000元 用于测试
	}

	_, err = WrapInsert(&user)
	if err != nil {
		if ormutil.IsDuplicate(err) {
			logrus.WithField("userId", newUserId).Error("invalidUser")
			return nil, err
		}
		return nil, err
	}
	return &user, err
}

// GetUserByUserId 根据UserId获取用户信息
func GetUserByUserId(userId string) (*ModelUser, error) {
	var user ModelUser
	err := GetDb().QueryTable(new(ModelUser)).Filter("user_id", userId).One(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetAllRobots 获取所有机器人
func GetAllRobots() ([]*ModelUser, error) {
	var robots []*ModelUser
	_, err := GetDb().QueryTable(new(ModelUser)).Filter("is_robot", true).Filter("enable", true).All(&robots)
	return robots, err
}

// UpdateUser 更新用户信息
func UpdateUser(user *ModelUser) (int64, error) {
	return WrapUpdate(user)
}

// UpdateUser 更新用户信息
func UpdateUserParam(userId string, param *ormutil.ModelChanger) (int64, error) {
	return ormutil.UpdateParam[ModelUser](GetDb(), param, ormutil.WithKV("user_id", userId))
}

// func UpdateUserFields(model *ModelUser, fields ...string) (int64, error) {
// 	if model.UserId == "" {
// 		return 0, ormutil.ErrInvalidModelKeyIndex
// 	}
// 	 ormutil.UpdateFields[ModelUser](GetDb(), model, fields)
// }

func GetRandomRobots(limit int) ([]*ModelUser, error) {
	var robots []*ModelUser
	// OrderBy("?") 是 MySQL 的随机排序
	_, err := GetDb().Raw("SELECT * FROM g3q_user WHERE is_robot = 1 AND enable = 1 ORDER BY RAND() LIMIT ?", limit).QueryRows(&robots)
	return robots, err
}
