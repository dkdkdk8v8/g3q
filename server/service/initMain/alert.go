package initMain

import (
	"compoment/alert"
	"fmt"
	"github.com/spf13/viper"
	"time"
)

var AlertNoLimit *alert.MsgSender
var AlertLimit *alert.MsgSender
var AlertCrash *alert.MsgSender
var Alert30 *alert.MsgSender
var Alert60 *alert.MsgSender
var AlertLimit5Hit1M *alert.MsgSender
var AlertLimit100Hit10M *alert.MsgSender

var AlertCfg struct {
	TgMonitorBotToken string
	TgMonitorChatID   int64
	TgNormalChatID    int64
}

func InitAlert() error {
	viper.SetConfigName("server.yaml")
	err := viper.ReadInConfig()
	if err != nil {
		fmt.Printf("Fatal server.yaml config file: %s \n", err)
		return err
	}
	if err := viper.Unmarshal(&AlertCfg); err != nil {
		fmt.Printf("Fatal server.yaml config file: %s \n", err)
		return err
	}

	tNormalCfg := &alert.TelegramRobotCfg{BotToken: AlertCfg.TgMonitorBotToken, BotChatId: AlertCfg.TgNormalChatID}
	tMonitorCfg := &alert.TelegramRobotCfg{BotToken: AlertCfg.TgMonitorBotToken, BotChatId: AlertCfg.TgMonitorChatID}

	AlertNoLimit = alert.Sender(alert.NoLimit).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
	AlertLimit = alert.Sender(alert.Limit).SetLimit(0, time.Minute*10).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
	AlertCrash = alert.Sender(alert.Crash).SetLimit(0, time.Minute).Save().SetRobotCfg(alert.RobotTypeTelegram, tMonitorCfg)
	AlertLimit5Hit1M = alert.Sender(alert.Limit5Hit1M).SetLimit(5, time.Minute).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
	AlertLimit100Hit10M = alert.Sender(alert.Limit100Hit10M).SetLimit(100, time.Minute*10).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)

	Alert30 = alert.Sender(alert.Limit30).SetLimit(0, time.Minute*30).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
	Alert60 = alert.Sender(alert.Limit60).SetLimit(0, time.Minute*60).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)

	return nil
}

func InitAlertByChatInfo(token string, chatId int64) {
	tNormalCfg := &alert.TelegramRobotCfg{BotToken: token, BotChatId: chatId}
	tMonitorCfg := &alert.TelegramRobotCfg{BotToken: token, BotChatId: chatId}

	AlertNoLimit = alert.Sender(alert.NoLimit).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
	AlertLimit = alert.Sender(alert.Limit).SetLimit(0, time.Minute*10).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
	AlertCrash = alert.Sender(alert.Crash).SetLimit(0, time.Minute).Save().SetRobotCfg(alert.RobotTypeTelegram, tMonitorCfg)
	AlertLimit5Hit1M = alert.Sender(alert.Limit5Hit1M).SetLimit(5, time.Minute).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
	AlertLimit100Hit10M = alert.Sender(alert.Limit100Hit10M).SetLimit(100, time.Minute*10).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)

	Alert30 = alert.Sender(alert.Limit30).SetLimit(0, time.Minute*30).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
	Alert60 = alert.Sender(alert.Limit60).SetLimit(0, time.Minute*60).Save().SetRobotCfg(alert.RobotTypeTelegram, tNormalCfg)
}
