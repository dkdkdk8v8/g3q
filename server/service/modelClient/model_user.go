package modelClient

import (
	"time"
)

type RecordType int

const (
	RecordTypeDeposit  RecordType = 0
	RecordTypeWithDraw RecordType = 1
	RecordTypeGame     RecordType = 2
	RecordTypeAdmin    RecordType = 3
)

type ModelUser struct {
	Id              uint64    `orm:"column(id);auto" json:"-"`                           // 标识
	UserId          string    `orm:"column(user_id);size(64)"`                           // 用户标识(带APPID前缀)
	AppId           string    `orm:"column(app_id);size(32)" json:"-"`                   // 接入应用标识
	AppUserId       string    `orm:"column(app_user_id);size(64)" json:"-"`              // 应用用户标识(不带APPID前缀)
	NickName        string    `orm:"column(nick_name);size(64)"`                         // 昵称
	Avatar          string    `orm:"column(avatar);size(256)"`                           // 头像URL
	Balance         int64     `orm:"column(balance);default(0)"`                         // 余额（分）
	BalanceLock     int64     `orm:"column(balance_lock);default(0)" json:"balanceLock"` // 锁定余额（分）
	GameCount       int       `orm:"column(game_count);default(0)" json:"gameCount"`     // 游戏次数
	GameId          string    `orm:"column(game_id);size(64)" json:"gameId"`             // 游戏ID
	Remark          string    `orm:"column(remark);size(256)" json:"-"`                  // 备注
	LastPlayed      time.Time `orm:"column(last_played);type(datetime);null" json:"-"`   // 最后游戏时间
	IsRobot         bool      `orm:"column(is_robot);default(0)" json:"-"`               // 是否机器人
	Enable          bool      `orm:"column(enable);default(0)" json:"-"`                 // 是否启用
	Effect          bool      `orm:"column(effect);default(true)"`                       // 是否开启音效
	Music           bool      `orm:"column(music);default(true)"`                        // 是否开启音乐
	Talk            bool      `orm:"column(talk);default(0)"`                            // 是否开启聊天
	TotalDeposit    uint64    `orm:"column(total_deposit);default(0)"`                   // 总充值金额
	TotalWithDraw   uint64    `orm:"column(total_with_draw);default(0)"`                 // 总提现金额
	TotalGameCount  uint64    `orm:"column(total_game_count);default(0)"`                // 总游戏次数
	TotalBet        uint64    `orm:"column(total_bet);default(0)"`                       // 总投注金额
	TotalNetBalance int64     `orm:"column(total_net_balance);default(0)"`               // 总输赢金额
	CreateAt        time.Time `orm:"column(create_at);type(datetime);auto_now_add"`      // 创建时间
	UpdateAt        time.Time `orm:"column(update_at);type(datetime);auto_now" json:"-"` // 更新时间
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

type ModelUserRecord struct {
	Id            uint64     `orm:"column(id);auto" json:"-"` // 标识
	UserId        string     `orm:"column(user_id);size(64)"` // 用户标识(带APPID前缀)
	RecordType    RecordType `orm:"column(record_type);default(0)"`
	BalanceBefore int64      `orm:"column(balance_before);default(0)"`             // 余额（分）
	BalanceAfter  int64      `orm:"column(balance_after);default(0)"`              // 余额（分）
	GameRecordId  uint64     `orm:"column(game_record_id);size(64)"`               // 游戏RecordID // join ModelGame的Id 主键
	OrderId       string     `orm:"column(order_id);size(128);null" json:"-"`      // 订单ID
	OrderState    int        `orm:"column(order_state);default(0)" json:"-"`       // 订单状态
	CreateAt      time.Time  `orm:"column(create_at);type(datetime);auto_now_add"` // 创建时间
}

func (a *ModelUserRecord) TableName() string {
	return "g3q_user_record"
}

func (a *ModelUserRecord) TableUnique() [][]string {
	return [][]string{
		{"user_id", "game_record_id"}, {"order_id"},
	}
}

func (a *ModelUserRecord) TableIndex() [][]string {
	return [][]string{
		{"user_id"}, {"game_record_id"}, {"create_at"},
	}
}
