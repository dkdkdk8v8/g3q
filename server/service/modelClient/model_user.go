package modelClient

import (
	"beego/v2/client/orm"
	"errors"
	"time"
)

type CdnQuality int

const (
	CdnQualityNone   CdnQuality = 0
	CdnQualitySpeed  CdnQuality = 1
	CdnQualityNormal CdnQuality = 2
	CdnQualityHigh   CdnQuality = 3
	CdnQualityOrigin CdnQuality = 4
)

type CdnGroup string

const (
	CdnGroupNormal  CdnGroup = "cdn_normal"
	CdnGroupVip     CdnGroup = "cdn_vip"
	CdnGroupSpeed   CdnGroup = "cdn_speed"
	CdnGroupSpecial CdnGroup = "cdn_special"
	CdnGroupNewUser CdnGroup = "cdn_newUser"
)

type ModelUser struct {
	Id           uint64     `orm:"column(id);auto" json:"-"`
	AppId        string     `orm:"column(appId);size(6)"`
	UserId       string     `orm:"column(userId);size(16)"`
	NickName     string     `orm:"column(nickName);size(64)"`
	Passwd       string     `orm:"column(passwd);size(32)" json:"-"`
	Salt         string     `orm:"column(salt);size(16)" json:"-"`
	RegTime      time.Time  `orm:"column(regTime);default(1970-01-01 08:00:00)" json:"-"`
	RegIp        string     `orm:"column(regIp);size(64)"`
	LastIp       string     `orm:"column(lastIp);size(64)"`
	LastTime     time.Time  `orm:"column(lastTime);default(1970-01-01 08:00:00)" json:"-"`
	CodeFrom     string     `orm:"column()"`
	RegPlat      int        `orm:"column(regPlat);default(0)"`
	Avatar       string     `orm:"column(avatar);size(512)"`
	Did          string     `orm:"column(did);size(64)"`
	VipExpire    time.Time  `orm:"column(vipExpire);default(1970-01-01 08:00:00)" json:"-"`
	VipLevel     int        `orm:"column(vipLevel);default(0)"`
	LastSignTime time.Time  `orm:"column(lastSignTime);type(datetime);default(1970-01-01 08:00:00)"`
	ContinueSign int        `orm:"column(continueSign)"`
	PayCount     int        `orm:"column(payCount)"`
	DeviceInfo   string     `orm:"column(deviceInfo);size(255)"`
	CdnGroup     CdnGroup   `orm:"column(cdnGroup)"`
	CdnQuality   CdnQuality `orm:"column(cdnQuality)"`
	Tabs         string     `orm:"column(tabs),type(text);null"`
	Created      time.Time  `orm:"column(createTime);auto_now_add;type(datetime)" json:"-"` // 创建时间
	Updated      time.Time  `orm:"column(updateTime);auto_now;type(datetime)" json:"-"`     // 更新时间
}

func (a *ModelUser) TableName() string {
	return "user"
}

func (a *ModelUser) TableUnique() [][]string {
	return [][]string{
		{"userId"},
	}
}

func (a *ModelUser) TableIndex() [][]string {
	return [][]string{
		{"userId"},
	}
}

func GetUser(userId string) (*ModelUser, error) {
	if userId == "" {
		return nil, errors.New("GetUser-Invalid")
	}
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelUser{})
	var ret ModelUser
	err := q.Filter("userId", userId).One(&ret)
	if err != nil {
		return nil, err
	}
	return &ret, nil
}
