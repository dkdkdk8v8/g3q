package modelClient

import "time"

type ModelGame struct {
	Id       uint64    `orm:"column(id);auto" json:"-"`                           // 标识
	GameId   string    `orm:"column(game_id);size(64)"`                           // 游戏ID
	GameData string    `orm:"column(game_data);type(text);null"`                  // 游戏json
	CreateAt time.Time `orm:"column(create_at);type(datetime);auto_now_add"`      // 创建时间
	UpdateAt time.Time `orm:"column(update_at);type(datetime);auto_now" json:"-"` // 更新时间
}

func (a *ModelGame) TableName() string {
	return "g3q_game"
}

func (a *ModelGame) TableUnique() [][]string {
	return [][]string{
		{"game_id"},
	}
}

func (a *ModelGame) TableIndex() [][]string {
	return [][]string{
		{"game_id"},
	}
}

func InsertGame(game *ModelGame) (int64, error) {
	return WrapInsert(game)
}
