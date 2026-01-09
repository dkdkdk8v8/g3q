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

var GetGameRecordByIdCache = modelComm.WrapCache[ModelGameRecord](GetGameRecordById,
	300*time.Second).(func(id uint64) (*ModelGameRecord, error))

func GetGameRecordById(id uint64) (*ModelGameRecord, error) {
	return ormutil.QueryOne[ModelGameRecord](GetDb(), ormutil.WithId(id))
}

func GetGameRecordByIds(ids []uint64) ([]*ModelGameRecord, error) {
	return ormutil.QueryMany[ModelGameRecord](GetDb(), ormutil.WithIds(ids))
}


func GetGameRecordByGameId(gameId string) ([]*ModelGameRecord, error) {
	return ormutil.QueryMany[ModelGameRecord](GetDb(), ormutil.WithKV("game_id", gameId))
}
