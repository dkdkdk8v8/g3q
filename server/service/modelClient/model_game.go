package modelClient

import (
	"compoment/ormutil"
	"service/modelComm"
	"time"
)

type ModelGameRecord struct {
	Id       uint64    `orm:"column(id);auto" json:"-"`                      // 标识
	GameId   string    `orm:"column(game_id);size(64)"`                      // 游戏ID
	GameName string    `orm:"column(game_name);size(16)"`                    // 游戏Name
	GameData string    `orm:"column(game_data);type(text);null"`             // 游戏json
	CreateAt time.Time `orm:"column(create_at);type(datetime);auto_now_add"` // 创建时间
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
		{"game_id"}, {"create_at"},
	}
}

func InsertGameRecord(game *ModelGameRecord) (int64, error) {
	return WrapInsert(game)
}

type ModelUserRecordWithGameRecord struct {
	UserId        string `orm:"user_id"`
	BalanceBefore int64  `orm:"column(balance_before);default(0)"` // 余额（分）
	BalanceAfter  int64  `orm:"column(balance_after);default(0)"`  // 余额（分）
	ModelGameRecord
}

var GetGameRecordByIdCache = modelComm.WrapCache[*ModelUserRecordWithGameRecord](GetGameRecordById,
	300*time.Second).(func(id uint64) (*ModelUserRecordWithGameRecord, error))

func GetGameRecordById(id uint64) ([]*ModelGameRecord, error) {
	return ormutil.QueryMany[ModelGameRecord](GetDb(), ormutil.WithId(id))
}

func GetGameRecordByGameId(gameId string) ([]*ModelGameRecord, error) {
	return ormutil.QueryMany[ModelGameRecord](GetDb(), ormutil.WithKV("game_id", gameId))
}

