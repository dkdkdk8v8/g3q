package modelClient

import (
	"beego/v2/client/orm"
	"compoment/ormutil"
	"service/modelComm"
	"time"
)

type ModelResourceActor struct {
	Id      uint64 `orm:"column(id);auto"` // 标识
	Name    string `orm:"column(name)"`    // 名称
	NameSrc string `orm:"column(nameSrc)"` // 名称src
	//NameCN          string    `orm:"column(nameCN);default()"`                     // 中文名
	NameEN          string    `orm:"column(nameEN);default()"`                // 英文名
	NameJP          string    `orm:"column(nameJP);default()"`                // 日文名
	NameOther       string    `orm:"column(nameOther);size(1024);default()"`  // 别名
	Avatar          string    `orm:"column(avatar);size(512);default()"`      // 头像
	Profile         string    `orm:"column(profile);type(text);null"`         // 简介
	Country         string    `orm:"column(country);size(32);default()"`      // 国家
	Birthday        time.Time `orm:"column(birthday);type(datetime)"`         // 生日
	Height          uint16    `orm:"column(height);default(0)"`               // 身高
	Weight          uint16    `orm:"column(weight);default(0)"`               // 体重
	BustCircle      uint16    `orm:"column(bustCircle);default(0)"`           // 胸围
	WaistCircle     uint16    `orm:"column(waistCircle);default(0)"`          // 腰围
	HipsCircle      uint16    `orm:"column(hipsCircle);default(0)"`           // 臀围
	CupSize         string    `orm:"column(cupSize);size(8)"`                 // 罩杯
	FirstOnPublic   time.Time `orm:"column(firstOnPublic);type(datetime)"`    // 出道时间
	RetiredOnPublic time.Time `orm:"column(retiredOnPublic);type(datetime)" ` // 退役时间
	Source          string    `orm:"column(source);default()"`                // 来源
	Enable          bool      `orm:"column(enable);default(0)"`               // 是否上架
	VideoNum        int
	Created         time.Time `orm:"column(createTime);auto_now_add;type(datetime)"` // 创建时间
	Updated         time.Time `orm:"column(updateTime);auto_now;type(datetime)"`     // 更新时间
}

func (a *ModelResourceActor) TableName() string {
	return "resource_actor_info"
}

func (a *ModelResourceActor) TableIndex() [][]string {
	return [][]string{
		{"name"}, {"nameSrc"},
	}
}

func (a *ModelResourceActor) TableUnique() [][]string {
	return [][]string{
		{"nameSrc"},
	}
}

func InsertResourceActor(model *ModelResourceActor) error {
	o := orm.NewOrmUsingDB(ServerDB)
	_, err := o.Insert(model)
	if err != nil {
		return err
	}
	return nil
}

func GetResourceActor(nameSrc string) (*ModelResourceActor, error) {
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelResourceActor{})
	var ret ModelResourceActor
	err := q.Filter("nameSrc", nameSrc).One(&ret)
	if err != nil {
		return nil, err
	}
	return &ret, nil
}

func UpdateResourceActorById(id uint64, param *ormutil.ModelChanger) error {
	if param == nil {
		return orm.ErrNoRows
	}
	if len(param.Changes) <= 0 {
		return nil
	}
	o := orm.NewOrmUsingDB(ServerDB)
	effect, err := o.QueryTable(&ModelResourceActor{}).Filter("id", id).Update(param.Changes)
	if err != nil {
		return err
	}
	if effect <= 0 {
		return orm.ErrNoRows
	}
	return nil
}

func GetResourceActorsByIds(ids ...string) ([]*ModelResourceActor, error) {
	if len(ids) <= 0 {
		return nil, nil
	}
	o := orm.NewOrmUsingDB(ServerDB)
	q := o.QueryTable(&ModelResourceActor{})
	var ret []*ModelResourceActor
	_, err := q.Filter("id__in", ids).All(&ret)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

var GetActorIdCache = modelComm.WrapCache[ModelResourceActor](GetActorById,
	300*time.Second).(func(id uint64) (*ModelResourceActor, error))

func GetActorById(id uint64) (*ModelResourceActor, error) {
	actorModel, err := modelComm.GetModelById[ModelResourceActor](GetDb(), id)
	if err != nil {
		return nil, err
	}
	return actorModel, nil
}
