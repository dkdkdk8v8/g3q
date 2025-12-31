package mainSchedule

import (
	"beego/v2/task"
	"context"
	"reflect"
	"service/initMain"

	"github.com/sirupsen/logrus"
)

type ITaskSchedule interface {
	Init() error
	RunSync(ctx context.Context) error
}

var defaultRecordTask []ITaskSchedule

func InitSyncSpider() error {
	if initMain.DefCtx.IsDebug {
		//debug
		defaultRecordTask = append(defaultRecordTask) //todo add debug task
	} else {
		//production
	}

	for _, record := range defaultRecordTask {
		if err := record.Init(); err != nil {
			logrus.Errorf(reflect.TypeOf(record).Name())
			continue
		}
		record.RunSync(context.Background())
	}

	task.StartTask()

	return nil
}
