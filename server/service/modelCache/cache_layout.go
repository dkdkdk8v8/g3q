package modelCache

import (
	"github.com/sirupsen/logrus"
	"service/modelClient"
	"sync"
	"time"
)

var LayoutCache struct {
	BlockIndex      map[uint64]*modelClient.ModelLayoutBlock
	TableIndex      map[uint64]*modelClient.ModelLayoutTab
	TableBlockIndex map[uint64][]*modelClient.ModelLayoutBlock
	MaterialIndex   map[uint64]*modelClient.ModelLayoutMaterial
	ClickEventIndex map[uint64]*modelClient.ModelLayoutClickEvent
	TableCfg        []*modelClient.ModelLayoutTab
	AdCommonCfg     []*modelClient.ModelAdCommon
	Mutex           sync.RWMutex
}

func GetBlockIndex() map[uint64]*modelClient.ModelLayoutBlock {
	LayoutCache.Mutex.RLock()
	defer LayoutCache.Mutex.RUnlock()
	return LayoutCache.BlockIndex
}

func GetTabIndex() map[uint64]*modelClient.ModelLayoutTab {
	LayoutCache.Mutex.RLock()
	defer LayoutCache.Mutex.RUnlock()
	return LayoutCache.TableIndex
}

func GetTabBlockIndex() map[uint64][]*modelClient.ModelLayoutBlock {
	LayoutCache.Mutex.RLock()
	defer LayoutCache.Mutex.RUnlock()
	return LayoutCache.TableBlockIndex
}

func GetMaterialIndex() map[uint64]*modelClient.ModelLayoutMaterial {
	LayoutCache.Mutex.RLock()
	defer LayoutCache.Mutex.RUnlock()
	return LayoutCache.MaterialIndex
}

func GetClickEventIndex() map[uint64]*modelClient.ModelLayoutClickEvent {
	LayoutCache.Mutex.RLock()
	defer LayoutCache.Mutex.RUnlock()
	return LayoutCache.ClickEventIndex
}

func GetTab(appId string) []*modelClient.ModelLayoutTab {
	var ret []*modelClient.ModelLayoutTab
	for _, t := range LayoutCache.TableCfg {
		if t.AppId == appId && t.Enable {
			ret = append(ret, t)
		}
	}
	return ret
}

func GetAdCommon(groupName string, adType modelClient.AdType) []*modelClient.ModelAdCommon {
	//LayoutCache.Mutex.RLock()
	//defer LayoutCache.Mutex.RUnlock()
	if groupName == "" {
		//return LayoutCache.AdCommonCfg
		logrus.WithField("!", nil).Error("EmptyAdCommGroupName")
		return nil
	}
	var ret []*modelClient.ModelAdCommon
	for _, ad := range LayoutCache.AdCommonCfg {
		if ad.AdGroup == groupName && adType == ad.AdType {
			ret = append(ret, ad)
		}
	}
	return ret
}
func CacheLayoutInit() error {
	var tempBlockIndex = make(map[uint64]*modelClient.ModelLayoutBlock)
	var tempTabIndex = make(map[uint64]*modelClient.ModelLayoutTab)
	var tempTabBlockIndex = make(map[uint64][]*modelClient.ModelLayoutBlock)
	var tempMaterialIndex = make(map[uint64]*modelClient.ModelLayoutMaterial)
	var tempClickIndex = make(map[uint64]*modelClient.ModelLayoutClickEvent)
	allBlock, err := modelClient.GetAllLayoutBlock()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllLayoutBlock-Failed!")
		return err
	}
	allTab, err := modelClient.GetAllLayoutTab()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllLayoutTab-Failed!")
		return err
	}
	allMaterial, err := modelClient.GetAllLayoutMaterial()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllLayoutMaterial-Failed!")
		return err
	}
	allClickEvent, err := modelClient.GetAllLayoutClickEvent()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllLayoutClickEvent-Failed!")
		return err
	}
	allAdCommon, err := modelClient.GetAllAdCommon()
	if err != nil {
		logrus.WithField("!", nil).WithError(err).Error("GetAllAdCommon-Failed!")
		return err
	}
	//LayoutCache.Mutex.Lock()
	//defer LayoutCache.Mutex.Unlock()
	for _, block := range allBlock {
		//todo check arg json
		tempBlockIndex[block.Id] = block
	}

	for _, tab := range allTab {
		tempTabIndex[tab.Id] = tab
	}

	for _, block := range allBlock {
		if !block.Enable {
			continue
		}

		tempBlockArr, ok := tempTabBlockIndex[block.TabId]
		if !ok {
			tempBlockArr = make([]*modelClient.ModelLayoutBlock, 0)
		}
		tempBlockArr = append(tempBlockArr, block)
		tempTabBlockIndex[block.TabId] = tempBlockArr
	}

	for _, material := range allMaterial {
		tempMaterialIndex[material.Id] = material
	}
	for _, clickEvent := range allClickEvent {
		tempClickIndex[clickEvent.Id] = clickEvent
	}

	LayoutCache.Mutex.Lock()
	defer LayoutCache.Mutex.Unlock()
	LayoutCache.BlockIndex = tempBlockIndex
	LayoutCache.TableIndex = tempTabIndex
	LayoutCache.TableBlockIndex = tempTabBlockIndex
	LayoutCache.MaterialIndex = tempMaterialIndex
	LayoutCache.ClickEventIndex = tempClickIndex
	LayoutCache.TableCfg = allTab
	LayoutCache.AdCommonCfg = allAdCommon

	return nil
}

func StartLayoutUpdate(interval time.Duration) error {
	if err := CacheLayoutInit(); err != nil {
		return err
	}
	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ticker.C:
				err1 := CacheLayoutInit()
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
