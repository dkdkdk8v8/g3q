package modelCache

import (
	_ "github.com/go-sql-driver/mysql"
	"time"
)

func InitModelCache() error {
	if err := StartSettingUpdate(time.Second * 10); err != nil {
		return err
	}
	if err := StartLayoutUpdate(time.Second * 10); err != nil {
		return err
	}
	if err := StartAllCacheUpdate(time.Second * 60); err != nil {
		return err
	}
	return nil
}
