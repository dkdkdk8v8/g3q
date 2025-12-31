package modelClient

import (
	"beego/v2/client/orm"
	"encoding/json"
	"time"
)

type LayoutType int

const (
	LayoutTypeNone          LayoutType = 0
	LayoutTypeAdBanner      LayoutType = 1
	LayoutTypeAdBlock       LayoutType = 2
	LayoutTypeAdQuick       LayoutType = 3
	LayoutTypeRecentHistory LayoutType = 4
	LayoutTypeRecentUpdate  LayoutType = 5
	LayoutTypePlayList      LayoutType = 6 //通用视频Block
	LayoutTypeAdOpenApp     LayoutType = 7
	LayoutTYpeAdLobbyPop    LayoutType = 8
	LayoutTypePlayListList  LayoutType = 9
)

type ArgType int

const (
	ArgTypeNone        ArgType = 0
	ArgTypeAdOpenApp   ArgType = 1
	ArgTypeAdLobbyPop  ArgType = 2
	ArgTypeAdQuick     ArgType = 3
	ArgTypeAdBanner    ArgType = 4
	ArgTypeAdLobbySide ArgType = 5
	ArgTypeAdComm      ArgType = 6
	ArgTypePlaylist    ArgType = 100
)

type StyleType int

const (
	StyleSmall           StyleType = 0 //每行2列
	Style1BigSmall       StyleType = 1 //首行大，剩余一列2个
	StyleBig             StyleType = 2 //每行1列
	Style2HalfColumn1Row StyleType = 3 //1行2.5列,可滑动
	Style3HalfColumn1Row StyleType = 4 //1行3.5列,可滑动
	Style1HalfColumn1Row StyleType = 5 //1行1.5列,可滑动
)

type AdCommItemStruct struct {
	ResId        uint64 //素材id
	ClickEventId uint64 //点击事件id
	Weight       int
}

type ArgTypeAdCommStruct struct {
	Width  int
	Height int
}

type ArgTypeAdOpenStruct struct {
	ArgTypeAdCommStruct
	Duration  int //second
	AutoClose int //second
}

type ArgTypeAdPopStruct struct {
	ArgTypeAdCommStruct
	Duration int //second
}

type ArgTypeAdQuickStruct struct {
	AdGroupName string //金刚区GroupName
	Column      int
}

type ArgTypeBlockAdStruct struct {
	AdGroupName string //BlockGroupName
}

type ArgTypeAdBannerStruct struct {
	AdGroupName string
	Duration    int
	ArgTypeAdCommStruct
}

type ArgTypeLobbySideStruct struct {
	Duration int //second  0 不可关闭
	Items    []struct {
		AdCommItemStruct
		Title string //底部描述文字
	}
}

type ArgTypePlaylistStruct struct {
	Title        string
	SubTitle     string
	PlaylistId   uint64
	RowCount     int
	Total        int
	StyleType    StyleType
	ClickEventId uint64 //点击事件id
}

type ArgTypePlaylistListStruct struct {
	PlayList []struct {
		PlayListId   uint64
		ClickEventId uint64 //点击事件id
		Desc         string
	}
}

type ModelLayoutBlock struct {
	Id         uint64     `orm:"column(id);auto"`                   // 标识
	AppId      string     `orm:"column(appId);size(32)"`            // App ID
	TabId      uint64     `orm:"column(tabId)"`                     // 标签页ID
	LayoutType LayoutType `orm:"column(layoutType)"`                // 布局类型
	ArgType    ArgType    `orm:"column(argType)"`                   // 参数类型
	ArgJson    string     `orm:"column(argJson);size(2048)"`        // 参数JSON
	Enable     bool       `orm:"column(enable);default(0)"`         // 是否启用
	Seq        int32      `orm:"column(seq);size(16)"`              // 排序
	Remark     string     `orm:"column(remark);size(1024)"`         // 备注
	LastUpdate time.Time  `orm:"column(lastUpdate);type(datetime)"` // 上次更新block的时间
	VIds       string     `orm:"column(vIds);type(text);null"`      // block内的视频ids 数组json
	VIdsInt    []uint64   `orm:"-"`
	Created    time.Time  `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated    time.Time  `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelLayoutBlock) TableName() string {
	return "layout_block"
}

func (a *ModelLayoutBlock) MarshalJSON() ([]byte, error) {
	//为了redis 缓存json的时候，已经把Ids内存
	a.GetVIdsInt()
	return json.Marshal(a)
}

func (a *ModelLayoutBlock) GetVIdsInt() []uint64 {
	if len(a.VIds) <= 0 && len(a.VIds) > 0 {
		json.Unmarshal([]byte(a.VIds), &a.VIdsInt)
	}
	return a.VIdsInt
}

func GetAllLayoutBlock() ([]*ModelLayoutBlock, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelLayoutBlock{})
	var ret []*ModelLayoutBlock
	_, err := q.OrderBy("-seq").All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func GetAllLayoutTab() ([]*ModelLayoutTab, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelLayoutTab{})
	var ret []*ModelLayoutTab
	_, err := q.Filter("enable", 1).OrderBy("-seq").All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}
