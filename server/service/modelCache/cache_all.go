package modelCache

import (
	"github.com/sirupsen/logrus"
	"service/modelClient"
	"sync"
	"time"
)

var AllCache struct {
	TagCfg      []*modelClient.ModelResourceCustomTag
	TagGroupCfg []*modelClient.ModelResourceCustomTagGroup
	TagIndex    map[uint64]*modelClient.ModelResourceCustomTag
	CfgApiGw    []*modelClient.ModelSettingLine
	CfgLine     []*modelClient.ModelSettingLine
	CfgCdn      []*modelClient.ModelSettingLine
	Mutex       sync.RWMutex
}

func GetTagIndex() map[uint64]*modelClient.ModelResourceCustomTag {
	AllCache.Mutex.RLock()
	defer AllCache.Mutex.RUnlock()
	return AllCache.TagIndex
}
func GetApiGw() []*modelClient.ModelSettingLine {
	AllCache.Mutex.RLock()
	defer AllCache.Mutex.RUnlock()
	return AllCache.CfgApiGw
}
func GetLine() []*modelClient.ModelSettingLine {
	AllCache.Mutex.RLock()
	defer AllCache.Mutex.RUnlock()
	return AllCache.CfgLine
}
func GetCdn() []*modelClient.ModelSettingLine {
	AllCache.Mutex.RLock()
	defer AllCache.Mutex.RUnlock()
	return AllCache.CfgCdn
}

func CacheAllInit() error {
	tempTagMap := make(map[uint64]*modelClient.ModelResourceCustomTag, 0)
	allTags, err := modelClient.GetAllCustomTag()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllCustomTag-Failed!")
		return err
	}
	allTagGroups, err := modelClient.GetAllCustomTagGroup()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllCustomTagGroup-Failed!")
		return err
	}

	for _, tag := range allTags {
		tempTagMap[tag.Id] = tag
	}
	allLines, err := modelClient.GetAllSettingLine()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllSettingLine-Failed!")
		return err
	}
	var apiLine []*modelClient.ModelSettingLine
	var lineLine []*modelClient.ModelSettingLine
	var cdnLine []*modelClient.ModelSettingLine
	for _, line := range allLines {
		switch line.Category {
		case modelClient.CategoryLine:
			lineLine = append(lineLine, line)
		case modelClient.CategoryApi:
			apiLine = append(apiLine, line)
		case modelClient.CategoryCdn:
			cdnLine = append(cdnLine, line)
		}
	}

	AllCache.Mutex.Lock()
	defer AllCache.Mutex.Unlock()
	AllCache.TagCfg = allTags
	AllCache.TagGroupCfg = allTagGroups
	AllCache.TagIndex = tempTagMap
	AllCache.CfgApiGw = apiLine
	AllCache.CfgLine = lineLine
	AllCache.CfgCdn = cdnLine
	return nil
}

func StartAllCacheUpdate(interval time.Duration) error {
	if err := CacheAllInit(); err != nil {
		return err
	}
	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ticker.C:
				err1 := CacheAllInit()
				if err1 != nil {
					logrus.WithField("!", nil).
						WithError(err1).
						Error("Timer-GetAllConfig-Failed!")
				}
			}
		}
	}()
	return nil
}
