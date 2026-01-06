package modelClient

import "time"

type ModelGameRecord struct {
	Id       uint64    `orm:"column(id);auto" json:"-"`                           // 标识
	GameId   string    `orm:"column(game_id);size(64)"`                           // 游戏ID
	GameData string    `orm:"column(game_data);type(text);null"`                  // 游戏json
	CreateAt time.Time `orm:"column(create_at);type(datetime);auto_now_add"`      // 创建时间
	UpdateAt time.Time `orm:"column(update_at);type(datetime);auto_now" json:"-"` // 更新时间
}

func (a *ModelGameRecord) TableName() string {
	return "g3q_game_record"
}

func (a *ModelGameRecord) TableUnique() [][]string {
	return [][]string{
		{"game_id"},
	}
}

func (a *ModelGameRecord) TableIndex() [][]string {
	return [][]string{
		{"game_id"},
	}
}

func InsertGameRecord(game *ModelGameRecord) (int64, error) {
	return WrapInsert(game)
}
