package modelClient

import (
	"beego/v2/client/orm"
	_ "github.com/go-sql-driver/mysql"
)

const ServerDB = "hsxs_server"

func RegModels() {
	orm.RegisterModel(
		&ModelAdCommon{},
		&ModelLayoutClickEvent{},
		&ModelLayoutTab{},
		&ModelLayoutBlock{},
		&ModelLayoutMaterial{},
		&ModelChannelCode{},
		&ModelResourceVideo{},
		&ModelResourceVideoTag{},
		&ModelResourceActor{},
		&ModelResourceCustomTag{},
		&ModelResourceCustomTagGroup{},
		&ModelResourceVideoPlaylist{},
		&ModelSettingLine{},
		&ModelSettingConfig{},
		&ModelSettingConfigCategory{},
		&ModelSettingDiscountRule{},
		&ModelSettingDiscountSystem{},
		&ModelStaOverview{},
		&ModelResourcePublisher{},
		&ModelResourcePlayerListGroup{},
	)
}
