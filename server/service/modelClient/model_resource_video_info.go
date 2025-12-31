package modelClient

import (
	"beego/v2/client/orm"
	"compoment/ormutil"
	"fmt"
	"service/modelComm"
	"time"
)

type VideoStatus uint16

const (
	VideoStatusInit         VideoStatus = 0
	VideoStatusResourceOk   VideoStatus = 1
	VideoStatusOk           VideoStatus = 100
	VideoStatusOfflineAdmin VideoStatus = 200 //人工下架
)

type VideoResolution string

const (
	VResLLD VideoResolution = "LLD" //流畅
	VResLD  VideoResolution = "LD"  //低清
	VResSD  VideoResolution = "SD"  //标清
	VResHD  VideoResolution = "HD"  //高清
	VResFHD VideoResolution = "FHD" //超高清
)

type VideoFlag string

const (
	VideoFlagSrc VideoFlag = "src"
	VideoFlagUn  VideoFlag = "un" //uncensored
	VideoFlagCn  VideoFlag = "cn"
)

type ModelResourceVideo struct {
	Id       uint64 `orm:"column(id);auto"` // 标识
	IdStr    string `orm:"-"`
	Title    string `orm:"column(title)"`              // 标题
	TitleSrc string `orm:"column(titleSrc);default()"` // 原标题
	//TitleCN      string      `orm:"column(titleCN);default()"`              // 中文标题
	TitleEN      string      `orm:"column(titleEN);default()"`                // 英文标题
	TitleJP      string      `orm:"column(titleJP);default()"`                // 日文标题
	Duration     int32       `orm:"column(duration);default(0)"`              // 视频时长（秒）
	Profile      string      `orm:"column(profile);size(1024);default()"`     // 简介
	Directors    string      `orm:"column(directors);size(512);default()"`    // 导演集合
	Tags         string      `orm:"column(tags);size(512);default()"`         // 标签src集合
	Actors       string      `orm:"column(actors);size(512);default()"`       // 演员ID集合
	FanNumber    string      `orm:"column(fanNumber);size(32);default()"`     // 番号
	Publisher    string      `orm:"column(publisher);size(128);default()"`    // 发行商
	PublishDate  time.Time   `orm:"column(publishData);type(datetime)"`       // 发行时间
	Series       string      `orm:"column(series);size(128);default()"`       // 系列
	UploadUser   uint64      `orm:"column(uploadUser);default(0)"`            // 上传者用户
	Source       string      `orm:"column(source);size(32);default()"`        // 来源
	Status       VideoStatus `orm:"column(status);default(0)"`                // 视频状态
	CoverQuality string      `orm:"column(coverQuality);size(512);default()"` // 封面图片
	CoverLow     string      `orm:"column(coverLow);size(512);default()"`     // 封面图片
	PreVd265     string      `orm:"column(preVd265);size(256);default()"`     // 预览地址
	PreVd264     string      `orm:"column(preVd264);size(256);default()"`
	VdSrc265FHd  string      `orm:"column(vdSrc265FHd);size(256);"`
	VdSrc265Hd   string      `orm:"column(vdSrc265Hd);size(256);"`
	VdSrc265Sd   string      `orm:"column(vdSrc265Sd);size(256);"`
	VdSrc265Ld   string      `orm:"column(vdSrc265Ld);size(256);"`
	VdSrc264FHd  string      `orm:"column(vdSrc264FHd);size(256);"`
	VdSrc264Hd   string      `orm:"column(vdSrc264Hd);size(256);"`
	VdSrc264Sd   string      `orm:"column(vdSrc264Sd);size(256);"`
	VdSrc264Ld   string      `orm:"column(vdSrc264Ld);size(256);"`
	VdSrc264LLd  string      `orm:"column(vdSrc264LLd);size(256)"`
	VdUn265FHd   string      `orm:"column(vdUn265FHd);size(256);"`
	VdUn265Hd    string      `orm:"column(vdUn265Hd);size(256);"`
	VdUn265Sd    string      `orm:"column(vdUn265Sd);size(256);"`
	VdUn265Ld    string      `orm:"column(vdUn265Ld);size(256);"`
	VdUn265LLd   string      `orm:"column(vdUn265LLd);size(256);"`
	VdUn264FHd   string      `orm:"column(vdUn264FHd);size(256);"`
	VdUn264Hd    string      `orm:"column(vdUn264Hd);size(256);"`
	VdUn264Sd    string      `orm:"column(vdUn264Sd);size(256);"`
	VdUn264Ld    string      `orm:"column(vdUn264Ld);size(256);"`
	VdUn264LLd   string      `orm:"column(vdUn264LLd);size(256);"`
	VdCn265FHd   string      `orm:"column(vdCn265FHd);size(256);"`
	VdCn265Hd    string      `orm:"column(vdCn265Hd);size(256);"`
	VdCn265Sd    string      `orm:"column(vdCn265Sd);size(256);"`
	VdCn265Ld    string      `orm:"column(vdCn265Ld);size(256);"`
	VdCn265LLd   string      `orm:"column(vdCn265LLd);size(256);"`
	VdCn264FHd   string      `orm:"column(vdCn264FHd);size(256);"`
	VdCn264Hd    string      `orm:"column(vdCn264Hd);size(256);"`
	VdCn264Sd    string      `orm:"column(vdCn264Sd);size(256);"`
	VdCn264Ld    string      `orm:"column(vdCn264Ld);size(256);"`
	VdCn264LLd   string      `orm:"column(vdCn264LLd);size(256);"`
	Thumbnail    string      `orm:"column(thumbnail);size(256);default()"` // 缩略图
	ThumbnailNum int16       `orm:"column(thumbnailNum);"`                 // 缩略图
	SubTitle     string      `orm:"column(subTitle);size(256);default()"`
	Resolution   string      `orm:"column(resolution);size(128)"`
	EsUpdated    time.Time   `orm:"column(esUpdated);type(datetime)"`
	Created      time.Time   `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated      time.Time   `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelResourceVideo) GetIdStr() string {
	if a.IdStr == "" {
		a.IdStr = fmt.Sprintf("%d", a.Id)
	}
	return a.IdStr
}

func (a *ModelResourceVideo) TableName() string {
	return "resource_video_info"
}

func (a *ModelResourceVideo) TableIndex() [][]string {
	return [][]string{
		{"fanNumber"}, {"status"}, {"updateTime"}, {"createTime"},
	}
}

func (a *ModelResourceVideo) HaveVideoCn() bool {
	return a.VdCn264Sd != "" || a.VdCn264Ld != "" || a.VdCn264LLd != "" || a.VdCn264Hd != "" || a.VdCn264FHd != ""
}

func (a *ModelResourceVideo) HaveVideoUn() bool {
	return a.VdUn264Sd != "" || a.VdUn264Ld != "" || a.VdUn264LLd != "" || a.VdUn264Hd != "" || a.VdUn264FHd != ""
}

func (a *ModelResourceVideo) HaveVideoSrc() bool {
	return a.VdSrc264Sd != "" || a.VdSrc264Ld != "" || a.VdSrc264LLd != "" || a.VdSrc264Hd != "" || a.VdSrc264FHd != ""
}

func (a *ModelResourceVideo) IsStatusOffline() bool {
	return a.Status == VideoStatusOfflineAdmin
}

func (a *ModelResourceVideo) IsStatusResourceOk() bool {
	return a.Status == VideoStatusResourceOk
}

func (a *ModelResourceVideo) GetPreviewPath264() string {
	return a.PreVd264
}
func (a *ModelResourceVideo) GetPreviewPath265() string {
	return a.PreVd265
}
func (a *ModelResourceVideo) GetPreviewPathMust(b265 bool) string {
	if b265 {
		if a.PreVd265 != "" {
			return a.PreVd265
		}
	}
	return a.PreVd264
}

func (a *ModelResourceVideo) GetQualityCover() string {
	if a.CoverQuality != "" {
		return a.CoverQuality
	}
	return a.CoverLow
}

func (a *ModelResourceVideo) GetVideoPath264(vFlag VideoFlag, resolution VideoResolution) string {
	switch resolution {
	case VResLLD:
		if vFlag == VideoFlagUn {
			return a.VdUn264LLd
		} else if vFlag == VideoFlagCn {
			return a.VdCn264LLd
		} else {
			return a.VdSrc264Ld
		}
	case VResLD:
		if vFlag == VideoFlagUn {
			return a.VdUn264Ld
		} else if vFlag == VideoFlagCn {
			return a.VdCn264Ld
		} else {
			return a.VdSrc264Ld
		}
	case VResSD:
		if vFlag == VideoFlagUn {
			return a.VdUn264Sd
		} else if vFlag == VideoFlagCn {
			return a.VdCn264Sd
		} else {
			return a.VdSrc264Sd
		}
	case VResHD:
		if vFlag == VideoFlagUn {
			return a.VdUn264Hd
		} else if vFlag == VideoFlagCn {
			return a.VdCn264Hd
		} else {
			return a.VdSrc264Hd
		}
	case VResFHD:
		if vFlag == VideoFlagUn {
			return a.VdUn264FHd
		} else if vFlag == VideoFlagCn {
			return a.VdCn264FHd
		} else {
			return a.VdSrc264FHd
		}
	}
	return ""
}

func (a *ModelResourceVideo) GetVideoPath265(vFlag VideoFlag, resolution VideoResolution) string {
	switch resolution {
	case VResLLD:
		if vFlag == VideoFlagUn {
			return a.VdUn265LLd
		} else if vFlag == VideoFlagCn {
			return a.VdCn265LLd
		} else {
			//todo 没有265LLD？
			return a.VdSrc265Ld
		}
	case VResLD:
		if vFlag == VideoFlagUn {
			return a.VdUn265Ld
		} else if vFlag == VideoFlagCn {
			return a.VdCn265Ld
		} else {
			return a.VdSrc265Ld
		}
	case VResSD:
		if vFlag == VideoFlagUn {
			return a.VdUn265Sd
		} else if vFlag == VideoFlagCn {
			return a.VdCn265Sd
		} else {
			return a.VdSrc265Sd
		}
	case VResHD:
		if vFlag == VideoFlagUn {
			return a.VdUn265Hd
		} else if vFlag == VideoFlagCn {
			return a.VdCn265Hd
		} else {
			return a.VdSrc265Hd
		}
	case VResFHD:
		if vFlag == VideoFlagUn {
			return a.VdUn265FHd
		} else if vFlag == VideoFlagCn {
			return a.VdCn265FHd
		} else {
			return a.VdSrc265FHd
		}
	}
	return ""
}

func (a *ModelResourceVideo) GetVideoFlag() []VideoFlag {
	var ret []VideoFlag
	if a.HaveVideoSrc() {
		ret = append(ret, VideoFlagSrc)
	}
	if a.HaveVideoUn() {
		ret = append(ret, VideoFlagUn)
	}
	if a.HaveVideoCn() {
		ret = append(ret, VideoFlagCn)
	}
	return ret
}

func (a *ModelResourceVideo) GetAllVideoResolutions() []VideoResolution {
	var ret []VideoResolution
	if a.HaveVideoSrc() {
		if a.VdSrc264LLd != "" {
			ret = append(ret, VResLLD)
		}
		if a.VdSrc264Ld != "" {
			ret = append(ret, VResLD)
		}
		if a.VdSrc264Sd != "" {
			ret = append(ret, VResSD)
		}
		if a.VdSrc264Hd != "" {
			ret = append(ret, VResHD)
		}
		if a.VdSrc264FHd != "" {
			ret = append(ret, VResFHD)
		}
	} else if a.HaveVideoUn() {
		if a.VdUn264LLd != "" {
			ret = append(ret, VResLLD)
		}
		if a.VdUn264Ld != "" {
			ret = append(ret, VResLD)
		}
		if a.VdUn264Sd != "" {
			ret = append(ret, VResSD)
		}
		if a.VdUn264Hd != "" {
			ret = append(ret, VResHD)
		}
		if a.VdUn264FHd != "" {
			ret = append(ret, VResFHD)
		}
	} else if a.HaveVideoCn() {
		if a.VdCn264LLd != "" {
			ret = append(ret, VResLLD)
		}
		if a.VdCn264Ld != "" {
			ret = append(ret, VResLD)
		}
		if a.VdCn264Sd != "" {
			ret = append(ret, VResSD)
		}
		if a.VdCn264Hd != "" {
			ret = append(ret, VResHD)
		}
		if a.VdCn264FHd != "" {
			ret = append(ret, VResFHD)
		}
	} else {
		return nil
	}
	return ret
}

func CheckResourceVideoIsExist(fanNumber string) (bool, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	var ret ModelResourceVideo
	err := o.QueryTable(&ModelResourceVideo{}).Filter("fanNumber", fanNumber).One(&ret)
	if err != nil {
		if ormutil.IsNoRow(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func GetVideoByFanNumber(fanNumber string) (*ModelResourceVideo, error) {
	videoModel, err := modelComm.GetModelBySelectOption[ModelResourceVideo](GetDb(), ormutil.WithKV("fanNumber", fanNumber))
	if err != nil {
		return nil, err
	}
	return videoModel, nil
}

var GetVideoIdsCache = modelComm.WrapCache[[]*ModelResourceVideo](GetVideoByIds,
	300*time.Second).(func(ids []uint64) ([]*ModelResourceVideo, error))

func GetVideoByIds(ids []uint64) ([]*ModelResourceVideo, error) {
	if len(ids) <= 0 {
		return nil, nil
	}
	videoModels, err := modelComm.GetModelManyBySelectOption[ModelResourceVideo](GetDb(), ormutil.WithIds(ids))
	if err != nil {
		return nil, err
	}
	return videoModels, nil
}

var GetVideoIdCache = modelComm.WrapCache[ModelResourceVideo](GetVideoById,
	300*time.Second).(func(id uint64) (*ModelResourceVideo, error))

func GetVideoById(id uint64) (*ModelResourceVideo, error) {
	videoModel, err := modelComm.GetModelById[ModelResourceVideo](GetDb(), id)
	if err != nil {
		return nil, err
	}
	return videoModel, nil
}

func UpdateResourceVideoById(id uint64, param *ormutil.ModelChanger) error {
	if param == nil {
		return orm.ErrNoRows
	}
	if len(param.Changes) <= 0 {
		return nil
	}
	o := orm.NewOrmUsingDB(ServerDB)
	effect, err := o.QueryTable(&ModelResourceVideo{}).Filter("id", id).Update(param.Changes)
	if err != nil {
		return err
	}
	if effect <= 0 {
		return orm.ErrNoRows
	}
	return nil
}

func GetResourceVideoForOnlineOrUpdate(offset, limit int, afterTime time.Time) ([]*ModelResourceVideo, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	var ret []*ModelResourceVideo
	//.FilterRaw(
	//		"esUpdated", "< updateTime")
	_, err := o.QueryTable(&ModelResourceVideo{}).Filter(
		"updateTime__gte", afterTime).Filter(
		"status__gte", VideoStatusOk).Offset(offset).Limit(limit).OrderBy("-updateTime").All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}
