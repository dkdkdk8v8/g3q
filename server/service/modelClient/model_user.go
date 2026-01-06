package modelClient

import (
	"time"
)

type ModelUser struct {
	Id          uint64    `orm:"column(id);auto" json:"-"`                           // 标识
	UserId      string    `orm:"column(user_id);size(64)"`                           // 用户标识(带APPID前缀)
	AppId       string    `orm:"column(app_id);size(32)" json:"-"`                   // 接入应用标识
	AppUserId   string    `orm:"column(app_user_id);size(64)" json:"-"`              // 应用用户标识(不带APPID前缀)
	NickName    string    `orm:"column(nick_name);size(64)"`                         // 昵称
	Avatar      string    `orm:"column(avatar);size(256)"`                           // 头像URL
	Balance     int64     `orm:"column(balance);default(0)"`                         // 余额（分）
	BalanceLock int64     `orm:"column(balance_lock);default(0)"`                    // 锁定余额（分）
	Remark      string    `orm:"column(remark);size(256)" json:"-"`                  // 备注
	LastPlayed  time.Time `orm:"column(last_played);type(datetime);null" json:"-"`   // 最后游戏时间
	IsRobot     bool      `orm:"column(is_robot);default(0)" json:"-"`               // 是否机器人
	Enable      bool      `orm:"column(enable);default(0)" json:"-"`                 // 是否启用
	Effect      bool      `orm:"column(effect);default(true)"`                       // 是否开启音效
	Music       bool      `orm:"column(music);default(true)"`                        // 是否开启音乐
	Talk        bool      `orm:"column(talk);default(true)"`                         // 是否开启聊天
	CreateAt    time.Time `orm:"column(create_at);type(datetime);auto_now_add"`      // 创建时间
	UpdateAt    time.Time `orm:"column(update_at);type(datetime);auto_now" json:"-"` // 更新时间
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
