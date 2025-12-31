package modelClient

import (
	"compoment/ormutil"
	"service/modelComm"
	"time"
)

type ModelResourceVideoPlaylist struct {
	Id        uint64    `orm:"column(id);auto"`                                // 标识
	Condition string    `orm:"column(condition);size(2048)"`                   // 搜索条件
	VideoIds  string    `orm:"column(videoIds);type(text);null"`               // 视频Id集合
	Icon      string    `orm:"column(icon);size(512)"`                         // 播单图片
	Seq       int32     `orm:"column(seq);size(16)"`                           // 排序
	Remark    string    `orm:"column(remark);size(1024)"`                      // 备注
	Desc      string    `orm:"column(desc);size(1024)"`                        // 描述
	VideoNum  int       `orm:"column(videoNum)"`                               // 视频数量
	PlayNum   int       `orm:"column(playNum)"`                                // 播单播放量
	GroupIds  string    `orm:"column(groupIds);size(1024)"`                    // Ids
	Created   time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated   time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelResourceVideoPlaylist) TableName() string {
	return "resource_video_playlist"
}

var GetVideoPlayListCache = modelComm.WrapCache[ModelResourceVideoPlaylist](GetVideoPlayList,
	10*time.Second).(func(uint64 uint64) (*ModelResourceVideoPlaylist, error))

func GetVideoPlayList(id uint64) (*ModelResourceVideoPlaylist, error) {
	ormRet, errOrm := ormutil.QueryOneNoDiff[ModelResourceVideoPlaylist](GetDb(),
		ormutil.WithId(id))
	if errOrm != nil {
		return nil, errOrm
	}
	return ormRet, nil
}

func (a *ModelResourceVideoPlaylist) TableIndex() [][]string {
	return [][]string{
		{"seq"},
	}
}
