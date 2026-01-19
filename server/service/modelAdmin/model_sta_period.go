package modelAdmin

import (
	"compoment/ormutil"
	"compoment/util"
	"time"
)

type ModelStaPeriod struct {
	Id                 int       `orm:"column(id);auto"`
	CreateTime         time.Time `orm:"column(createTime);type(datetime);auto_now_add"`
	UpdateTime         time.Time `orm:"column(updateTime);type(datetime);auto_now"`
	TimeKey            time.Time `orm:"column(timeKey);type(datetime)"`
	AppId              string    `orm:"column(appId);size(255);default()"`
	GameName           string    `orm:"column(gameName);size(255);default()"`
	IsRobot            bool      `orm:"column(isRobot);default(0)"`
	GameUserCount      int       `orm:"column(gameUserCount);default(0)"`
	GameCount          int       `orm:"column(gameCount);default(0)"`
	BetCount           int       `orm:"column(betCount);default(0)"`
	BetAmount          int       `orm:"column(betAmount);default(0)"`
	GameWin            int       `orm:"column(gameWin);default(0)"`
	FirstGameUserCount int       `orm:"column(firstGameUserCount);default(0)"`
	FirstGameUserIds   string    `orm:"column(firstGameUserIds);type(json)"` // Stored as JSON string
	CardResult         string    `orm:"column(cardResult);type(json)"`       // Stored as JSON string
}

func (u *ModelStaPeriod) TableName() string {
	return "sta_period"
}

func GetStaPeriod(userId string, date time.Time) (*ModelStaPeriod, error) {
	ormDb := GetReadDb()
	return ormutil.QueryOneNoDiff[ModelStaPeriod](ormDb, ormutil.WithKV("userId", userId),
		ormutil.WithKV("date", date))
}

// 获取昨日所有period的数据，并统计 gameWin 的累加，BetAmount的累加
// byday 0：今日 -1:昨日 -2:2天前  -3:3天前
func GetStaPeriodByDay(byday int) (int, int) {
	var totalGameWin int
	var totalBetAmount int
	bydayTime := util.AddDateWithoutLock(time.Now(), 0, 0, -byday)

	ormDb := GetReadDb()
	var periods []*ModelStaPeriod
	_, err := ormDb.QueryTable(new(ModelStaPeriod)).Filter("timeKey__gte", bydayTime).
		Filter("timeKey__lt", bydayTime.AddDate(0, 0, 1)).All(&periods)
	if err != nil {
		return 0, 0
	}
	for _, period := range periods {
		totalGameWin += period.GameWin
		totalBetAmount += period.BetAmount
	}
	return totalGameWin, totalBetAmount
}
