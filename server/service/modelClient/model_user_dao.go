package modelClient

import (
	"beego/v2/client/orm"
	"compoment/ormutil"
	"context"
	"errors"
	"service/comm"
	"time"

	"github.com/sirupsen/logrus"
)

var ErrorBalanceNotEnough = comm.NewMyError("用户余额不足")

func GetOrCreateUser(appId string, appUserId string) (*ModelUser, error) {
	//todo redis locking，防止并发创建同一用户
	var user ModelUser
	err := GetDb().QueryTable(new(ModelUser)).Filter(
		"user_id", appId+appUserId).One(&user)
	if err == nil {
		return &user, nil
	}

	// 用户不存在，执行自动注册逻辑
	newUserId := appId + appUserId

	user = ModelUser{
		UserId:    newUserId,
		AppId:     appId,
		AppUserId: appUserId,
		Enable:    true,
		Balance:   200000, // 默认2000元 用于测试
	}

	_, err = WrapInsert(&user)
	if err != nil {
		if ormutil.IsDuplicate(err) {
			logrus.WithField("userId", newUserId).Error("invalidUser")
			return nil, err
		}
		return nil, err
	}
	return &user, err
}

// GetUserByUserId 根据UserId获取用户信息
func GetUserByUserId(userId string) (*ModelUser, error) {
	var user ModelUser
	err := GetDb().QueryTable(new(ModelUser)).Filter("user_id", userId).One(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetAllRobots 获取所有机器人
func GetAllRobots() ([]*ModelUser, error) {
	var robots []*ModelUser
	_, err := GetDb().Raw("SELECT * FROM g3q_user WHERE is_robot = 1 AND enable = 1 AND (balance + balance_lock) >= 6").QueryRows(&robots)
	return robots, err
}

// UpdateUser 更新用户信息
func UpdateUser(user *ModelUser) (int64, error) {
	return WrapUpdate(user)
}

// UpdateUser 更新用户信息
func UpdateUserParam(userId string, param *ormutil.ModelChanger) (int64, error) {
	return ormutil.UpdateParam[ModelUser](GetDb(), param, ormutil.WithKV("user_id", userId))
}

// InsertUserRecord
func InsertUserRecord(user *ModelUserRecord) (int64, error) {
	return WrapInsert(user)
}

// func UpdateUserFields(model *ModelUser, fields ...string) (int64, error) {
// 	if model.UserId == "" {
// 		return 0, ormutil.ErrInvalidModelKeyIndex
// 	}
// 	 ormutil.UpdateFields[ModelUser](GetDb(), model, fields)
// }

// RecoveryGameId
func RecoveryGameId(userId string, gameId string) (*ModelUser, error) {
	ormDb := GetDb()
	var user ModelUser
	err := ormDb.DoTx(func(ctx context.Context, txOrm orm.TxOrmer) error {
		var err error
		// 使用 ForUpdate 锁行，防止并发问题
		err = txOrm.QueryTable(new(ModelUser)).Filter("user_id", userId).ForUpdate().One(&user)
		if err != nil {
			return err
		}
		if user.GameId != gameId {
			return errors.New("gameIdNotMatch")
		}
		user.Balance += user.BalanceLock
		user.BalanceLock = 0
		user.GameId = ""
		_, err = txOrm.Update(&user, "balance", "balance_lock", "game_id")
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &user, nil
}

// 用户进入游戏，锁定余额
func GameLockUserBalance(userId string, gameId string, minBalance int64) error {
	ormDb := GetDb()
	err := ormDb.DoTx(func(ctx context.Context, txOrm orm.TxOrmer) error {
		var user ModelUser
		var err error
		// 使用 ForUpdate 锁行，防止并发问题
		err = txOrm.QueryTable(new(ModelUser)).Filter("user_id", userId).ForUpdate().One(&user)
		if err != nil {
			return err
		}
		userTotalBalance := int64(0)
		if user.GameId == gameId {
			userTotalBalance = user.Balance + user.BalanceLock
		} else {
			userTotalBalance = user.Balance
		}
		if userTotalBalance < minBalance {
			return ErrorBalanceNotEnough
		}
		user.BalanceLock += user.Balance
		user.Balance = 0
		user.GameId = gameId
		_, err = txOrm.Update(&user, "balance", "balance_lock", "game_id")
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

type GameSettletruct struct {
	RoomId       string
	GameRecordId uint64
	GameName     string
	Players      []UserSettingStruct
}
type UserSettingStruct struct {
	UserId        string
	ChangeBalance int64
	ValidBet      int64
}

func UpdateUserSetting(setting *GameSettletruct) ([]*ModelUser, error) {
	ormDb := GetDb()
	//用事物保持多个player的金额,在一个事务内修改
	var ret []*ModelUser
	err := ormDb.DoTx(func(ctx context.Context, txOrm orm.TxOrmer) error {
		for _, player := range setting.Players {
			var user ModelUser
			err := txOrm.QueryTable(new(ModelUser)).Filter("user_id", player.UserId).ForUpdate().One(&user)
			if err != nil {
				return err
			}
			oldBalance := user.Balance + user.BalanceLock
			user.Balance += user.BalanceLock + player.ChangeBalance
			user.BalanceLock = 0
			user.GameId = ""
			user.LastPlayed = time.Now()
			user.TotalGameCount++
			user.TotalBet += uint64(player.ValidBet)
			user.TotalNetBalance += player.ChangeBalance
			_, err = txOrm.Update(&user, "balance", "balance_lock", "game_id",
				"last_played", "total_game_count", "total_bet", "total_net_balance")
			if err != nil {
				return err
			}
			ret = append(ret, &user)
			//插入用户的userRecord
			userRecord := ModelUserRecord{
				UserId:        user.UserId,
				BalanceBefore: oldBalance,
				BalanceAfter:  user.Balance,
				GameRecordId:  setting.GameRecordId,
				RecordType:    RecordTypeGame,
			}
			_, err = txOrm.Insert(&userRecord)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return ret, nil
}

type ModelUserRecordJoinGameRecord struct {
	ModelUserRecord
	GameRecordId uint64
	GameName     string
	GameData     string
}

func GetUserGameRecordsJoinGameRecord(userId string, limit int, id uint64, start, end time.Time) ([]*ModelUserRecordJoinGameRecord, error) {
	ormDb := GetReadOrm()
	var records []*ModelUserRecordJoinGameRecord
	sql := `SELECT g3q_user_record.*, g3q_game_record.game_name, g3q_game_record.game_data
	FROM g3q_user_record
	LEFT JOIN g3q_game_record ON g3q_user_record.game_record_id = g3q_game_record.id
	WHERE g3q_user_record.user_id = ?`
	var args []interface{}
	args = append(args, userId)
	if id > 0 {
		sql += " AND g3q_user_record.id < ?"
		args = append(args, id)
	}
	if start.Unix() != 0 {
		sql += " AND g3q_user_record.create_at >= ?"
		args = append(args, start)
	}
	if end.Unix() != 0 {
		sql += " AND g3q_user_record.create_at < ?"
		args = append(args, end)
	}
	sql += " ORDER BY g3q_user_record.id DESC LIMIT ?"
	args = append(args, limit)
	_, err := ormDb.Raw(sql, args...).QueryRows(&records)
	if err != nil {
		return nil, err
	}
	return records, nil

}
