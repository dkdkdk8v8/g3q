package modelClient

import (
	"compoment/rds"
	"service/modelComm"

	"github.com/sirupsen/logrus"
)

func StatisticHKeyInc(key string, hKey string) error {
	_, err := rds.DefConnPool.HIncrease(modelComm.StatisticRedisDb, key, hKey, 1)
	if err != nil {
		logrus.WithField("!", nil).WithField("key", key).WithField("hkey", hKey).WithError(err).Error("StatisticHKeyInc-Increase-Fail")
		return nil
	}
	return nil
}

// scan 所有的 modelComm.StatisticRedisDb 的keys ， 对每个key执行 fn 函数，func 参数传入 key 和 该key对应的所有hash字段，先完成search hot的统计
func ScanStatisticKeys(fn func(key string, hashFields map[string]string) error) error {
	var cursor uint64
	for {
		nextCursor, keys, err := rds.DefConnPool.Scan(modelComm.StatisticRedisDb, cursor, modelComm.SearchHot+"*", 100)
		if err != nil {
			return err
		}

		for _, key := range keys {
			hashFields := make(map[string]string)
			var hCursor uint64
			var scanErr error
			for {
				var kvs []string
				hCursor, kvs, scanErr = rds.DefConnPool.HScan(modelComm.StatisticRedisDb, key, hCursor, "", 100)
				if scanErr != nil {
					logrus.WithField("!", nil).WithField("key", key).WithError(scanErr).Error("ScanStatisticKeys-HScan-Fail")
					break
				}
				for i := 0; i < len(kvs); i += 2 {
					if i+1 < len(kvs) {
						hashFields[kvs[i]] = kvs[i+1]
					}
				}
				if hCursor == 0 {
					break
				}
			}
			if scanErr != nil {
				continue
			}
			if err := fn(key, hashFields); err != nil {
				logrus.WithField("!", nil).WithField("key", key).WithError(err).Error("ScanStatisticKeys-Fn-Fail")
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return nil
}
