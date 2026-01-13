package modelAdmin

import (
	"compoment/ormutil"
	"time"
)

type ModelStaUser struct {
	Id             int       `orm:"column(id);auto"`
	Date           time.Time `orm:"column(date);type(datetime)"`
	UserId         string    `orm:"column(userId);size(255)"`
	AppId          string    `orm:"column(appId);size(255)"`
	DepositCount   int       `orm:"column(depositCount);default(0)"`
	DepositAmount  int64     `orm:"column(depositAmount);default(0)"`
	WithdrawCount  int       `orm:"column(withdrawCount);default(0)"`
	WithdrawAmount int64     `orm:"column(withdrawAmount);default(0)"`
	BetCount       int       `orm:"column(betCount);default(0)"`
	BetAmount      int64     `orm:"column(betAmount);default(0)"`
	WinCount       int       `orm:"column(winCount);default(0)"`
	BankerCount    int       `orm:"column(bankerCount);default(0)"`
	BetWin         int64     `orm:"column(betWin);default(0)"`
	CreateTime     time.Time `orm:"column(createTime);type(datetime);auto_now_add"`
	UpdateTime     time.Time `orm:"column(updateTime);type(datetime);auto_now"`
}

func (u *ModelStaUser) TableName() string {
	return "sta_user"
}

func (u *ModelStaUser) TableIndex() [][]string {
	return [][]string{
		{"appId"},
		{"date"},
		{"updateTime"},
		{"userId"},
		{"createTime"},
	}
}

func GetStaUser(userId string, date time.Time) (*ModelStaUser, error) {
	ormDb := GetReadDb()
	return ormutil.QueryOneNoDiff[ModelStaUser](ormDb, ormutil.WithKV("userId", userId), ormutil.WithKV("date", date))
}
