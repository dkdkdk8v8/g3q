package modelClient

import (
	"compoment/uid"
	"compoment/util"
	"fmt"
	"math/rand"
	"time"

	"github.com/sirupsen/logrus"
)

const AppIdMain = "main"
const AppIdRobot = "rbot"

type ModelUser struct {
	Id        uint64 `orm:"column(id);auto"`              // 标识
	UserId    string `orm:"column(user_id);size(64)"`     // 用户标识(带APPID前缀)
	AppId     string `orm:"column(app_id);size(32)"`      // 接入应用标识
	AppUserId string `orm:"column(app_user_id);size(64)"` // 应用用户标识(不带APPID前缀)
	NickName  string `orm:"column(nick_name);size(64)"`   // 昵称
	Avatar    string `orm:"column(avatar);size(256)"`     // 头像URL
	Balance   int64  `orm:"column(balance);default(0)"`   // 余额（分）
	Remark    string `orm:"column(remark);size(256)"`     // 备注
	IsRobot   bool   `orm:"column(is_robot);default(0)"`  // 是否机器人
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
		{"user_id"}, {"enable"}, {"app_id"}, {"app_user_id"}, {"is_robot"},
	}
}

func GetOrCreateUser(userId string) (*ModelUser, error) {
	var user ModelUser
	err := GetDb().QueryTable(new(ModelUser)).Filter("user_id", userId, "is_robot", false).One(&user)
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

// InitRobots 检查并初始化机器人
func InitRobots() {
	var robots []*ModelUser
	_, err := GetDb().QueryTable(new(ModelUser)).Filter("is_robot", true).All(&robots)
	if err != nil {
		logrus.WithError(err).Error("ModelUser-InitRobots-Query-Fail")
		return
	}

	count := len(robots)
	if count < 100 {
		need := 100 - count
		for i := 0; i < need; i++ {
			appUserId := util.EncodeToBase36(uid.Generate())
			userId := AppIdRobot + "_" + appUserId
			newRobot := &ModelUser{
				UserId:    userId,
				AppId:     AppIdRobot,
				AppUserId: appUserId,
				NickName:  fmt.Sprintf("Robot_%d", i+count),
				Balance:   int64(rand.Intn(190001) + 10000), // 随机 100.00 - 2000.00 元
				IsRobot:   true,
				Enable:    true,
			}
			_, err := WrapInsert(newRobot)
			if err != nil {
				logrus.WithError(err).Error("ModelUser-InitRobots-Insert-Fail")
			}
		}
		logrus.Infof("ModelUser-InitRobots-Created-%d-Robots", need)
	}
}

// StartRechargeMonitor 持续监控机器人余额并自动充值
// isInGame 用于检查机器人是否正在游戏中，避免在结算时充值
func StartRechargeMonitor(isInGame func(string) bool) {
	ticker := time.NewTicker(10 * time.Second)
	for range ticker.C {
		var robots []*ModelUser
		// 查询余额低于 10 元（1000分）的机器人
		_, err := GetDb().QueryTable(new(ModelUser)).
			Filter("is_robot", true).
			Filter("balance__lt", 1000).
			All(&robots)

		if err != nil {
			continue
		}

		for _, bot := range robots {
			if isInGame != nil && isInGame(bot.UserId) {
				continue
			}

			rechargeAmount := int64(rand.Intn(190001) + 10000)
			bot.Balance = rechargeAmount
			if _, err := WrapUpdate(bot); err != nil {
				logrus.WithError(err).WithField("uid", bot.UserId).Error("ModelUser-Monitor-Recharge-Fail")
			}
		}
	}
}
