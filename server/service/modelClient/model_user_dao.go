package modelClient

import (
	"compoment/ormutil"
	"compoment/uid"
	"compoment/util"
	"math/rand"
	"time"

	"github.com/sirupsen/logrus"
)

const AppIdMain = "main"
const AppIdRobot = "rbot"

const (
	RobotMinRecharge   = 10000  // 充值最小值 (100元 = 10000分)
	RobotMaxRecharge   = 200000 // 充值最大值 (2000元 = 200000分)
	RobotRechargeLimit = 1000   // 余额低于此值时触发充值 (10元 = 1000分)
	RobotTotalCount    = 100    // 机器人总数
)

var chineseNicknames = []string{
	"绝世高手", "无敌寂寞", "影之刃", "狂奔的蜗牛", "夜空中最亮的星", "追风少年", "淡定人生", "一剑飘红", "梦回唐朝", "浮生若梦",
	"往事随风", "心如止水", "傲视群雄", "独孤求败", "笑看风云", "风继续吹", "海阔天空", "光辉岁月", "不再犹豫", "真的爱你",
	"大地", "长城", "农民", "情人", "冷雨夜", "喜欢你", "灰色轨迹", "岁月无声", "谁伴我闯荡", "无尽空虚",
	"早班火车", "我是愤怒", "和平与爱", "命运派对", "莫欺少年穷", "天若有情", "乱世巨星", "友情岁月", "战无不胜", "刀光剑影",
	"只手遮天", "以牙还牙", "成王败寇", "龙争虎斗", "胜者为王", "古惑仔", "陈浩南", "山鸡", "大飞", "太子",
	"生番", "雷耀扬", "乌鸦", "笑面虎", "金毛虎", "下山虎", "草鞋", "白纸扇", "红棍", "龙头",
	"坐馆", "话事人", "江湖告急", "英雄本色", "喋血双雄", "龙虎风云", "监狱风云", "学校风云", "圣战风云", "伴我闯天涯",
	"侠盗高飞", "真心英雄", "暗战", "枪火", "放逐", "复仇", "神探", "文雀", "铁三角", "黑社会",
	"以和为贵", "毒战", "盲探", "夺命金", "单身男女", "高海拔之恋", "龙凤斗", "瘦身男女", "钟无艳", "孤男寡女",
	"暗花", "非常突然", "真心英雄", "两个只能活一个", "一个字头的诞生", "恐怖鸡", "摄氏32度", "最后判决", "十万火急", "真心英雄",
}

func GetOrCreateUser(appId string, appUserId string) (*ModelUser, error) {
	//todo redis locking，防止并发创建同一用户
	var user ModelUser
	err := GetDb().QueryTable(new(ModelUser)).Filter(
		"user_id", appId+appUserId).Filter(
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

// GetRandomRobots 随机获取指定数量的机器人
func GetRandomRobots(limit int) ([]*ModelUser, error) {
	var robots []*ModelUser
	// OrderBy("?") 是 MySQL 的随机排序
	_, err := GetDb().Raw("SELECT * FROM g3q_user WHERE is_robot = 1 ORDER BY RAND() LIMIT ?", limit).QueryRows(&robots)
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

// 初始化机器人池
func InitRobots() {
	robots, err := GetAllRobots()
	if err != nil {
		logrus.WithError(err).Error("RobotManager-InitRobots-Query-Fail")
		return
	}

	count := len(robots)
	if count < RobotTotalCount {
		need := RobotTotalCount - count
		for i := 0; i < need; i++ {
			appId := AppIdRobot
			appUserId := util.EncodeToBase36(uid.Generate())
			userId := appId + appUserId
			nickName := ""
			if len(chineseNicknames) > 0 && rand.Intn(100) < 70 { // 70%概率使用中文昵称
				nickName = chineseNicknames[rand.Intn(len(chineseNicknames))]
			}
			newRobot := &ModelUser{
				UserId:    userId,
				AppId:     appId,
				AppUserId: appUserId,
				NickName:  nickName,
				Balance:   0,
				IsRobot:   true,
				Enable:    true,
				CreateAt:  time.Now(),
				UpdateAt:  time.Now(),
			}
			_, err := WrapInsert(newRobot)
			if err != nil {
				logrus.WithError(err).Error("RobotManager-InitRobots-Insert-Fail")
			}
		}
		logrus.Infof("RobotManager-InitRobots-Created-%d-Robots", need)
	}
}

// 派发前检查余额，不足则充值 (按需充值逻辑),充值需满足房间最低进入标准
func BotRecharge(bot *ModelUser, minBalance int64) {
	if bot.Balance < minBalance {
		minRecharge := minBalance + int64(RobotMinRecharge)
		maxRecharge := int64(RobotMaxRecharge)
		if maxRecharge < minRecharge { // 确保最大值不小于最小值
			maxRecharge = minRecharge * 10
		}
		rechargeAmount := rand.Int63n(maxRecharge-minRecharge+1) + minRecharge
		bot.Balance = rechargeAmount
		if _, err := UpdateUser(bot); err != nil {
			logrus.WithError(err).WithField("uid", bot.UserId).Error("RobotManager-Arrange-Recharge-Fail")
		}
	}
}
