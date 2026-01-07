package modelComm

import (
	"beego/v2/client/orm"
	"compoment/ormutil"
	"compoment/util"
	"encoding/json"
	"errors"
	"reflect"
	"runtime"
	"time"

	"github.com/sirupsen/logrus"
)

func GetModelById[T any](o orm.Ormer, id uint64) (*T, error) {
	ormRet, errOrm := ormutil.QueryOneNoDiff[T](o,
		ormutil.WithId(id))
	if errOrm != nil {
		return nil, errOrm
	}
	return ormRet, nil
}

func GetModelByIds[T any](o orm.Ormer, ids []uint64) ([]*T, error) {
	if len(ids) <= 0 {
		return nil, nil
	}
	ormRet, errOrm := ormutil.QueryManyNoDiff[T](o,
		ormutil.WithIds(ids))
	if errOrm != nil {
		return nil, errOrm
	}
	return ormRet, nil
}

func GetModelBySelectOption[T any](o orm.Ormer, option ...ormutil.SelectOption) (*T, error) {
	ormRet, errOrm := ormutil.QueryOneNoDiff[T](o,
		option...)
	if errOrm != nil {
		return nil, errOrm
	}
	return ormRet, nil
}

func GetModelManyBySelectOption[T any](o orm.Ormer, option ...ormutil.SelectOption) ([]*T, error) {
	ormRet, errOrm := ormutil.QueryManyNoDiff[T](o,
		option...)
	if errOrm != nil {
		return nil, errOrm
	}
	return ormRet, nil
}

func UpdateModelByChanger[T any](o orm.Ormer, changer *ormutil.ModelChanger, option ...ormutil.SelectOption) (int64, error) {
	return ormutil.UpdateParam[T](o, changer, option...)
}

func unpackResult(ft reflect.Type, cached any, err error) []reflect.Value {
	if err != nil {
		return []reflect.Value{
			reflect.Zero(ft.Out(0)),
			reflect.ValueOf(err),
		}
	}
	// Redis 命中，返回真实值
	return []reflect.Value{
		reflect.ValueOf(cached), // T
		reflect.Zero(ft.Out(1)), // error 为 nil
	}
}

func makeCacheKey(fn reflect.Value, args []reflect.Value) string {
	arr := make([]any, len(args)+1)
	arr[0] = runtime.FuncForPC(fn.Pointer()).Name()
	for i, v := range args {
		arr[i+1] = v.Interface()
	}
	b, _ := json.Marshal(arr)
	return util.Md5(b)
}

func WrapCache[T any](fn any, ttl time.Duration) any {
	fv := reflect.ValueOf(fn)
	ft := fv.Type()

	if ft.Kind() != reflect.Func {
		panic("Wrap requires a function")
	}

	// 创建包装函数
	wrapper := reflect.MakeFunc(ft, func(args []reflect.Value) []reflect.Value {
		// 生成 key：函数名 + 参数哈希
		key := makeCacheKey(fv, args)
		// 尝试从缓存读取
		//if e, ok := c.store[key]; ok && time.Now().Before(e.expiredAt) {
		//	return unpackResult(ft, e.value, nil)
		//}
		redisRsp, err := RedisGetCacheT[T](key)
		if err != nil {
			if errors.As(err, &RedisCacheNotFind) {
				//redis not cache
			} else if ormutil.IsNoRow(err) {
				return unpackResult(ft, redisRsp, err)
			} else {
				return unpackResult(ft, redisRsp, err)
			}
		} else {
			// 判断原函数返回值是否是指针
			retType := ft.Out(0)
			if retType.Kind() == reflect.Ptr {
				// 原函数要求返回的是指针类型
				// T 是非指针类型 → 我们需要返回 &rsp
				v := reflect.ValueOf(redisRsp)
				if v.Kind() != reflect.Ptr {
					// cached 是值 → 变成指针
					ptr := reflect.New(v.Type())
					ptr.Elem().Set(v)
					return unpackResult(ft, ptr.Interface(), nil)
				}
				// cached 本身就是指针
				return unpackResult(ft, redisRsp, nil)
			}
			// 原函数返回的是值类型
			// 如果 T 是指针类型，这种情况应该视为错误，不建议支持
			return unpackResult(ft, redisRsp, nil)
		}
		// 调用原函数
		results := fv.Call(args)

		// 保存缓存（只缓存 (value, error) 这种结构）
		// var ret any
		if len(results) == 2 {
			//ret = []reflect.Value{results[0], results[1]}
			if results[1].IsNil() {
				_ = RedisSet(key, ttl, results[0].Interface())
			}
		} else {
			//ret = results
			logrus.WithField("key", key).WithField("!", nil).Error("reflectInvalid")
		}

		return results
	})

	return wrapper.Interface()
}
