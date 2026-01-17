package modelClient

import (
	"beego/v2/client/orm"
	"compoment/ormutil"
	"context"
	"math/rand"
	"service/comm"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
)

const (
	ConstAvator              = 49
	ConstAvatorUrlPathPrefix = "gwd3czq"
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
		Talk:      true,
		Effect:    true,
		Music:     true,
		Avatar: ConstAvatorUrlPathPrefix + "/" +
			strconv.Itoa(rand.Intn(ConstAvator)) + ".jpg",
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
	_, err := GetDb().Raw("SELECT * FROM g3q_user WHERE is_robot = 1 AND enable = 1").QueryRows(&robots)
	return robots, err
}

// GetRobots 获取最近没玩游戏的指定数量的机器人
func GetRobots(limit, offset int) ([]*ModelUser, error) {
	var robots []*ModelUser
	_, err := GetDb().Raw("SELECT * FROM g3q_user WHERE is_robot = 1 AND enable = 1 ORDER BY last_played ASC LIMIT ? OFFSET ?", limit, offset).QueryRows(&robots)
	return robots, err
}

// GetStressUsers 获取压测用户
func GetStressUsers() ([]*ModelUser, error) {
	var users []*ModelUser
	_, err := GetDb().Raw("SELECT * FROM g3q_user WHERE app_id=?", "STRS").QueryRows(&users)
	return users, err
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

// ResetBalanceLock
func ResetBalanceLock(userId string) (*ModelUser, error) {
	ormDb := GetDb()
	var user ModelUser
	err := ormDb.DoTx(func(ctx context.Context, txOrm orm.TxOrmer) error {
		var err error
		// 使用 ForUpdate 锁行，防止并发问题
		err = txOrm.QueryTable(new(ModelUser)).Filter("user_id", userId).ForUpdate().One(&user)
		if err != nil {
			return err
		}
		user.Balance += user.BalanceLock
		user.BalanceLock = 0
		//这个orm的update的列名字，是struct的内变量名
		//如果不指定明确字段名，会有0值判断的问题，orm自动过滤0值，“”空字符串
		_, err = txOrm.Update(&user, "Balance", "BalanceLock", "GameId")
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

// 用户离开游戏，释放锁定金额
func GameResetUserBalance(userId string) (*ModelUser, error) {
	ormDb := GetDb()
	var user ModelUser
	err := ormDb.DoTx(func(ctx context.Context, txOrm orm.TxOrmer) error {
		var err error
		// 使用 ForUpdate 锁行，防止并发问题
		err = txOrm.QueryTable(new(ModelUser)).Filter("user_id", userId).ForUpdate().One(&user)
		if err != nil {
			return err
		}

		user.Balance += user.BalanceLock
		user.BalanceLock = 0
		_, err = txOrm.Update(&user, "Balance", "BalanceLock")
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
func GameLockUserBalance(userId string, minBalance int64) (*ModelUser, error) {
	ormDb := GetDb()
	var user ModelUser
	err := ormDb.DoTx(func(ctx context.Context, txOrm orm.TxOrmer) error {
		var err error
		// 使用 ForUpdate 锁行，防止并发问题
		err = txOrm.QueryTable(new(ModelUser)).Filter("user_id", userId).ForUpdate().One(&user)
		if err != nil {
			return err
		}
		if user.Balance+user.BalanceLock < minBalance {
			logrus.WithField("userId", userId).WithField(
				"balance", user.Balance).WithField("balanceLock", user.BalanceLock).Error("LockUserBal-NotEnough")
			return ErrorBalanceNotEnough
		}
		user.BalanceLock += user.Balance
		user.Balance = 0
		_, err = txOrm.Update(&user, "Balance", "BalanceLock")
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

type GameSettletruct struct {
	RoomId       string
	GameId       string
	GameRecordId uint64
	GameName     string
	Players      []UserSettingStruct
}
type UserSettingStruct struct {
	UserId                  string
	PlayerBalance           int64
	ChangeBalance           int64
	ValidBet                int64
	PendingCompensateChange int64 // 新增：待补偿金额变化量
	UserGameRecordInsert    bool
	LosingStreak            int
	WinningStreak           int
}

func UpdateUserSetting(setting *GameSettletruct) ([]*ModelUser, error) {
	ormDb := GetDb()
	//用事物保持多个player的金额,在一个事务内修改
	var ret []*ModelUser
	type logInfo struct {
		UserId        string
		OldBalance    int64
		LockBalance   int64
		NewBalance    int64
		ChangeBalance int64
		ValidBet      int64
	}
	var logs []logInfo
	err := ormDb.DoTx(func(ctx context.Context, txOrm orm.TxOrmer) error {
		for _, player := range setting.Players {
			var user ModelUser
			err := txOrm.QueryTable(new(ModelUser)).Filter("user_id", player.UserId).ForUpdate().One(&user)
			if err != nil {
				return err
			}
			oldBalanceLock := user.BalanceLock
			user.BalanceLock += player.ChangeBalance
			if player.ChangeBalance < 0 {
				user.LosingStreak++
				user.WinningStreak = 0
			} else {
				user.WinningStreak++
				user.LosingStreak = 0
			}
			user.LastPlayed = time.Now()
			user.TotalGameCount++
			user.TotalBet += uint64(player.ValidBet)
			user.TotalNetBalance += player.ChangeBalance
			user.PendingCompensate += player.PendingCompensateChange
			if user.PendingCompensate < 0 {
				//最小只能是0
				user.PendingCompensate = 0
			}
			res, err := txOrm.Raw("UPDATE g3q_user SET balance_lock=?, last_played=?, total_game_count=?, total_bet=?, total_net_balance=?, pending_compensate=?, losing_streak=?, winning_streak=?, update_at=? WHERE user_id=?",
				user.BalanceLock, user.LastPlayed, user.TotalGameCount, user.TotalBet, user.TotalNetBalance, user.PendingCompensate, user.LosingStreak, user.WinningStreak, time.Now(), user.UserId).Exec()
			if err != nil {
				return err
			}
			effectRow, err := res.RowsAffected()
			if err != nil {
				return err
			}
			if effectRow <= 0 {
				logrus.WithField("userId", player.UserId).Error("SettingEffectZero")
			}
			ret = append(ret, &user)
			if player.UserGameRecordInsert {
				//插入用户的userRecord
				userRecord := ModelUserRecord{
					UserId:        user.UserId,
					BalanceBefore: oldBalanceLock,
					BalanceAfter:  user.BalanceLock,
					GameRecordId:  setting.GameRecordId,
					RecordType:    RecordTypeGame,
				}
				_, err = txOrm.Insert(&userRecord)
				if err != nil {
					return err
				}
			}
			logs = append(logs, logInfo{
				UserId:        player.UserId,
				OldBalance:    oldBalanceLock,
				LockBalance:   user.BalanceLock,
				NewBalance:    user.Balance,
				ChangeBalance: player.ChangeBalance,
				ValidBet:      player.ValidBet,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	for _, l := range logs {
		logrus.WithField("userId", l.UserId).WithField("oldBalance", l.OldBalance).WithField(
			"lockBalance", l.LockBalance).WithField("newBalance", l.NewBalance).WithField("changeBalance", l.ChangeBalance).WithField(
			"validBet", l.ValidBet).WithField("gameId", setting.GameId).Info("settringDoTx")
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

type ModelUserRecordOnlyBanalce struct {
	UserId        string     `orm:"column(user_id);size(64)"` // 用户标识(带APPID前缀)
	RecordType    RecordType `orm:"column(record_type);default(0)"`
	BalanceBefore int64      `orm:"column(balance_before);default(0)"` // 余额（分）
	BalanceAfter  int64      `orm:"column(balance_after);default(0)"`  // 余额（分）
}

func GetUserGameRecords(userId string, limit int) ([]*ModelUserRecordOnlyBanalce, error) {
	var records []*ModelUserRecordOnlyBanalce
	ormDb := GetReadOrm()
	sql := `SELECT g3q_user_record.user_id,g3q_user_record.balance_before,g3q_user_record.balance_after FROM g3q_user_record
	WHERE user_id = ? AND record_type = ? ORDER BY g3q_user_record.id DESC LIMIT ?`

	_, err := ormDb.Raw(sql, userId, RecordTypeGame, limit).QueryRows(&records)
	if err != nil {
		return nil, err
	}
	return records, nil
}
