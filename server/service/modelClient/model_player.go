package modelClient

type ModelPlayer struct {
	Id       uint64 `orm:"column(id);auto"`            // 标识
	PlayerId string `orm:"column(player_id);size(64)"` // 用户标识
	Code     string `orm:"column(code);size(32)"`      // 渠道码
	Remark   string `orm:"column(remark);size(256)"`   // 备注
	Balance  int64  `orm:"column(balance);default(0)"` // 余额（分）
	Enable   bool   `orm:"column(enable);default(0)"`  // 是否启用
}

func (a *ModelPlayer) TableName() string {
	return "player"
}

func (a *ModelPlayer) TableUnique() [][]string {
	return [][]string{
		{"code"},
	}
}

func (a *ModelPlayer) TableIndex() [][]string {
	return [][]string{
		{"player_id"}, {"code"},
	}
}
