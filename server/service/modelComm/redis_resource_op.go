package modelComm

import (
	"beego/v2/client/orm"
	"compoment/rds"
	"encoding/json"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

var RedisCacheNotFind = errors.New("redisKeyNotFind")

func RedisExpireCache[T any](key string) error {
	rdsResult := rds.DefConnPool.Del(MysqlCacheRedisDb, key)
	if rdsResult != nil {
		return rdsResult
	}
	return nil
}

func RedisGetCacheT[T any](key string) (any, error) {
	rdsResult := rds.DefConnPool.Get(MysqlCacheRedisDb, key)
	if !rdsResult.IsNil() {
		cacheBuf, err := rdsResult.AsBytes()
		if err != nil {
			logrus.WithField("!", nil).WithField("redisKey", key).WithError(err).Error("AsBytes-Fail")
			return nil, err
		} else {
			if string(cacheBuf) == "__empty__" {
				return nil, orm.ErrNoRows
			}
			var rsp T
			//err1 := util.UnmarshalDataFromJsonWithGzip(cacheBuf, &rsp)
			err1 := json.Unmarshal(cacheBuf, &rsp)
			if err1 != nil {
				logrus.WithField("!", nil).WithField("redisKey", key).WithError(err1).Error("Unmarshal-Fail")
				return nil, err1
			} else {
				return rsp, nil
			}
		}
	}

	cacheBuf := []byte("__empty__")

	// loader 返回 nil,缓存一会，防止一直被击穿
	err1 := rds.DefConnPool.Set(MysqlCacheRedisDb, key, cacheBuf, rds.SetOption{ExpireSec: 2})
	if err1 != nil {
		logrus.WithField("!", nil).WithField("redisKey", key).WithError(err1).Error("SetRedisModel-Fail")
	}
	//return data, nil
	return nil, RedisCacheNotFind
}

func RedisSet(key string, ttl time.Duration, data any) error {
	if data != nil {
		//cacheBuf, err := util.MarshalJsonAndGzip(data)
		cacheBuf, err := json.Marshal(data)
		if err != nil {
			return err
		}
		err1 := rds.DefConnPool.Set(MysqlCacheRedisDb, key, cacheBuf, rds.SetOption{ExpireSec: int(ttl.Seconds())})
		if err1 != nil {
			logrus.WithField("!", nil).WithField("redisKey", key).WithError(err1).Error("SetRedisModel-Fail")
			return err1
		}
	}
	return nil
}
