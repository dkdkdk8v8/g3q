package mainClient

import (
	"compoment/uid"
	"compoment/util"
	"math/rand"
	"service/mainClient/game"
	"service/mainClient/game/nn"
	"service/modelClient"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

const (
	RobotExitRate      = 30     // 游戏结束后退出的概率 (0-100)
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

type RobotManager struct {
	mu sync.Mutex
}

var (
	robotMgr  *RobotManager
	robotOnce sync.Once
)

func GetRobotMgr() *RobotManager {
	robotOnce.Do(func() {
		robotMgr = &RobotManager{}
		// 将配置同步到 game 层，供游戏逻辑使用
		nn.RobotExitRate = RobotExitRate
	})
	return robotMgr
}

// generateNickname 随机生成昵称
func (rm *RobotManager) generateNickname(userId string) string {
	// 50% 概率使用中文网名，50% 概率使用脱敏ID
	if len(chineseNicknames) > 0 && rand.Intn(2) == 0 {
		return chineseNicknames[rand.Intn(len(chineseNicknames))]
	}
	if len(userId) >= 8 {
		return userId[:4] + "****" + userId[len(userId)-4:]
	}
	return userId
}

// InitRobots 检查并初始化机器人池
func (rm *RobotManager) InitRobots() {
	robots, err := modelClient.GetAllRobots()
	if err != nil {
		logrus.WithError(err).Error("RobotManager-InitRobots-Query-Fail")
		return
	}

	count := len(robots)
	if count < RobotTotalCount {
		need := RobotTotalCount - count
		for i := 0; i < need; i++ {
			appId := modelClient.AppIdRobot
			appUserId := util.EncodeToBase36(uid.Generate())
			userId := appId + appUserId
			newRobot := &modelClient.ModelUser{
				UserId:    userId,
				AppId:     appId,
				AppUserId: appUserId,
				NickName:  rm.generateNickname(userId),
				Balance:   int64(rand.Intn(RobotMaxRecharge-RobotMinRecharge+1) + RobotMinRecharge),
				IsRobot:   true,
				Enable:    true,
				CreateAt:  time.Now(),
				UpdateAt:  time.Now(),
			}
			_, err := modelClient.CreateRobot(newRobot)
			if err != nil {
				logrus.WithError(err).Error("RobotManager-InitRobots-Insert-Fail")
			}
		}
		logrus.Infof("RobotManager-InitRobots-Created-%d-Robots", need)
	}
}

// ArrangeRobotsForQZNN 安排机器人进入抢庄牛牛房间伪装真实用户
func (rm *RobotManager) ArrangeRobotsForQZNN(room *nn.QZNNRoom) {
	go func() {
		for {
			// 随机等待 1-3 秒
			time.Sleep(time.Duration(rand.Intn(3)+1) * time.Second)

			// 派出一个机器人
			robots, err := modelClient.GetRandomRobots(1)
			if err != nil || len(robots) == 0 {
				break
			}
			bot := robots[0]

			// 判断是否能进入房间
			if !room.IsWaiting() || room.GetPlayerCount() >= room.GetPlayerCap() {
				break
			}

			// 检查机器人是否已经在其他房间
			if game.GetMgr().GetPlayerRoom(bot.UserId) != nil {
				continue
			}

			// 派发前检查余额，不足则充值 (按需充值逻辑)
			// 充值需满足房间最低进入标准
			minEntry := room.Config.MinBalance
			if bot.Balance < minEntry {
				minRecharge := minEntry + int64(RobotMinRecharge)
				maxRecharge := int64(RobotMaxRecharge)
				if maxRecharge < minRecharge {
					maxRecharge = minRecharge * 10
				}
				rechargeAmount := rand.Int63n(maxRecharge-minRecharge+1) + minRecharge
				bot.Balance = rechargeAmount
				if _, err := modelClient.UpdateUser(bot); err != nil {
					logrus.WithError(err).WithField("uid", bot.UserId).Error("RobotManager-Arrange-Recharge-Fail")
				}
			}

			p := &nn.Player{
				ID:      bot.UserId,
				IsRobot: true,
				Conn:    nil, // 机器人无真实连接
			}
			room.AddPlayer(p)
		}
	}()
}

// ArrangeRobotsForBRNN 安排机器人进入百人牛牛房间
func (rm *RobotManager) ArrangeRobotsForBRNN(room *nn.QZNNRoom) {
	// 百人牛牛的机器人逻辑暂未实现，后续补充
}
