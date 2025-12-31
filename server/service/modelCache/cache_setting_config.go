package modelCache

import (
	"encoding/json"
	"github.com/sirupsen/logrus"
	"service/modelClient"
	"strconv"
	"sync"
	"time"
)

type SettingConfigItem struct {
	DataKey   string
	DataValue string
	DataType  string
}

var SettingConfigCache struct {
	ConfigList          []*SettingConfigItem
	ConfigIndex         map[string]*SettingConfigItem
	ConfigCategoryIndex map[string][]*SettingConfigItem
	Mutex               sync.RWMutex
}

func getConfigIndex() map[string]*SettingConfigItem {
	SettingConfigCache.Mutex.RLock()
	defer SettingConfigCache.Mutex.RUnlock()
	return SettingConfigCache.ConfigIndex
}

func GetStringInConfig(dataKey string) string {
	configIndex := getConfigIndex()
	configItem := configIndex[dataKey]
	return configItem.DataValue
}

func GetIntInConfig(dataKey string) int {
	str := GetStringInConfig(dataKey)
	dataValue, err := strconv.Atoi(str)
	if err != nil {
		logrus.WithField("!", nil).
			WithField("dataKey", dataKey).
			WithField("dataValue", str).
			WithError(err).
			Error("GetIntInConfig-Failed!")
	}
	return dataValue
}

func GetFloatInConfig(dataKey string) float64 {
	str := GetStringInConfig(dataKey)
	dataValue, err := strconv.ParseFloat(str, 64)
	if err != nil {
		logrus.WithField("!", nil).
			WithField("dataKey", dataKey).
			WithField("dataValue", str).
			WithError(err).
			Error("GetFloatInConfig-Failed!")
	}
	return dataValue
}

func GetJsonInConfig(dataKey string) map[string]interface{} {
	var data map[string]interface{}
	str := GetStringInConfig(dataKey)
	err := json.Unmarshal([]byte(str), &data)
	if err != nil {
		logrus.WithField("!", nil).
			WithField("dataKey", dataKey).
			WithField("dataValue", str).
			WithError(err).
			Error("GetJsonInConfig-Failed!")
	}
	return data
}

func CacheSettingInit() error {
	var tempList []*SettingConfigItem
	var tempIndex = make(map[string]*SettingConfigItem)
	var tempCategoryIndex = make(map[string][]*SettingConfigItem)

	allList, err := modelClient.GetAllSettingConfig()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllSettingConfig-Failed!")
		return err
	}
	SettingConfigCache.Mutex.Lock()
	defer SettingConfigCache.Mutex.Unlock()

	for _, item := range allList {
		tempItem := &SettingConfigItem{
			DataKey:   item.DataKey,
			DataValue: item.DataValue,
			DataType:  item.DataType,
		}
		tempIndex[item.DataKey] = tempItem
		tempList = append(tempList, tempItem)
		if tempCategoryIndex[item.Category] == nil {
			tempCategoryIndex[item.Category] = []*SettingConfigItem{}
		}
		tempCategoryIndex[item.Category] = append(tempCategoryIndex[item.Category], tempItem)
	}
	SettingConfigCache.ConfigList = tempList
	SettingConfigCache.ConfigCategoryIndex = tempCategoryIndex
	SettingConfigCache.ConfigIndex = tempIndex
	return nil
}

func StartSettingUpdate(interval time.Duration) error {
	if err := CacheSettingInit(); err != nil {
		return err
	}
	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ticker.C:
				err1 := CacheSettingInit()
				if err1 != nil {
					logrus.WithField("!", nil).
						WithError(err1).
						Error("Timer-GetAllSettingConfig-Failed!")
				}
			}
		}
	}()
	return nil
}
