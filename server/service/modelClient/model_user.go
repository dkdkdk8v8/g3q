package modelClient

import (
	"time"
)

const AppIdMain = "main"
const AppIdRobot = "rbot"

type ModelUser struct {
	Id         uint64    `orm:"column(id);auto"`                               // 标识
	UserId     string    `orm:"column(user_id);size(64)"`                      // 用户标识(带APPID前缀)
	AppId      string    `orm:"column(app_id);size(32)"`                       // 接入应用标识
	AppUserId  string    `orm:"column(app_user_id);size(64)"`                  // 应用用户标识(不带APPID前缀)
	NickName   string    `orm:"column(nick_name);size(64)"`                    // 昵称
	Avatar     string    `orm:"column(avatar);size(256)"`                      // 头像URL
	Balance    int64     `orm:"column(balance);default(0)"`                    // 余额（分）
	Remark     string    `orm:"column(remark);size(256)"`                      // 备注
	LastPlayed time.Time `orm:"column(last_played);type(datetime);null"`       // 最后游戏时间
	IsRobot    bool      `orm:"column(is_robot);default(0)"`                   // 是否机器人
	Enable     bool      `orm:"column(enable);default(0)"`                     // 是否启用
	CreateAt   time.Time `orm:"column(create_at);type(datetime);auto_now_add"` // 创建时间
	UpdateAt   time.Time `orm:"column(update_at);type(datetime);auto_now"`     // 更新时间
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
		{"user_id"}, {"enable"}, {"app_id"}, {"app_user_id"}, {"is_robot"},
	}
}

func GetOrCreateUser(appId string, appUserId string) (*ModelUser, error) {
	//todo redis locking，防止并发创建同一用户
	var user ModelUser
	if appId == "" {
		appId = AppIdMain
	}
	err := GetDb().QueryTable(new(ModelUser)).Filter(
		"app_id", appId).Filter(
		"app_user_id", appUserId).Filter(
		"is_robot", false).One(&user)
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
	_, err := GetDb().QueryTable(new(ModelUser)).Filter("is_robot", true).All(&robots)
	return robots, err
}

// CreateRobot 创建机器人
func CreateRobot(user *ModelUser) (int64, error) {
	return WrapInsert(user)
}

// GetRandomRobots 随机获取指定数量的机器人
func GetRandomRobots(limit int) ([]*ModelUser, error) {
	var robots []*ModelUser
	// OrderBy("?") 是 MySQL 的随机排序
	_, err := GetDb().QueryTable(new(ModelUser)).
		Filter("is_robot", true).OrderBy("?").
		Limit(limit).
		All(&robots)
	return robots, err
}

// UpdateUser 更新用户信息
func UpdateUser(user *ModelUser) (int64, error) {
	return WrapUpdate(user)
}
