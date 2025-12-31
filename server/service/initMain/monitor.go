package initMain

import (
	"compoment/alert"
	"github.com/sirupsen/logrus"
)

func defaultMonitorAlert(baseCtx *BaseCtx, t PidErrType) error {
	logT := logrus.WithField("!", alert.Crash)
	logT.Error("crash")
	return nil
}
