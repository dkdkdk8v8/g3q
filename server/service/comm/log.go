package comm

import (
	"compoment/loghook"
	"compoment/loghook/formater"
	"compoment/logrotate"
	"compoment/util"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

func InitLog(isTerminal bool, serverName string, disableFilePos bool, rotateType string, level string, dbLog, sysLog bool) (io.Writer, error) {
	txtFmt := &formater.TextFormatter{TimestampFormat: "2006-01-02T15:04:05.000", DisableFilePos: disableFilePos}
	if isTerminal {
		txtFmt.ForceColors = true
	}
	//txtFmt.DisableSorting = true
	logrus.SetFormatter(txtFmt)
	var logfile io.Writer
	if !isTerminal {
		logDir := filepath.Dir(os.Args[0])
		if !strings.HasSuffix(logDir, "/") {
			logDir = logDir + "/"
		}
		os.Mkdir(logDir+"log/", os.ModePerm)
		defLog, err := logrotate.GetRotate(logDir+"log/"+serverName+".log", rotateType, 2)
		if err != nil {
			logrus.WithError(err).Error("OpenLogFail")
			return nil, err
		} else {
			logrus.SetOutput(defLog)
			logfile = defLog
		}
		if sysLog {
			if sysLogfile, err := logrotate.GetRotate(logDir+"log/sys.log", logrotate.LogRollTypeH, 4); err != nil {
				logrus.WithError(err).Error("OpenLogFail")
			} else {
				logfile = sysLogfile
			}
		}

		if dbLog {
			if dbLogfile, err := logrotate.GetRotate(logDir+"log/db.log", logrotate.LogRollTypeMidNight, 3); err != nil {
				logrus.WithError(err).Error("OpenLogFail")
			} else {
				dbLogger := loghook.NewLoggerWithoutHook(loghook.DBLog)
				dbLogger.SetOutput(dbLogfile)
				dbLogger.SetReportCaller(false)
			}
		}
		pLevel, err := logrus.ParseLevel(level)
		if err != nil {
			pLevel = logrus.InfoLevel
		}
		logrus.SetLevel(pLevel)
	} else {
		logfile = os.Stdout
	}
	return logfile, nil
}

var adminLog *logrotate.LogrusRotate

func InitAdminLog() error {
	logDir := filepath.Dir(os.Args[0])
	if !strings.HasSuffix(logDir, "/") {
		logDir = logDir + "/"
	}
	os.Mkdir(logDir+"sta/", os.ModePerm)
	var err error
	adminLog, err = logrotate.GetRotate(logDir+"sta/admin_sta.log", logrotate.LogRollTypeMidNight, 7)
	if err != nil {
		return err
	}

	return nil
}

const (
	LOGADMIN_TYPE_TOKEN     = 0
	LOGADMIN_TYPE_BINDPHONE = 1
	LOGADMIN_TYPE_PAYORDER  = 2
	LOGADMIN_TYPE_DEVICEREG = 3
)

var dayTokenSet map[string]bool
var dayTokenSetMutex sync.RWMutex
var dayTokenLastTime = time.Time{}

func LogToken(userId string, did string, inviteCode string, regType int, ip string, uuid string) {
	now := time.Now()
	if !util.IsSameDay(dayTokenLastTime, now) {
		dayTokenSetMutex.Lock()
		dayTokenSet = make(map[string]bool, 20000)
		dayTokenSetMutex.Unlock()
	}
	dayTokenLastTime = now
	dayTokenSetMutex.RLock()
	_, ok := dayTokenSet[userId]
	dayTokenSetMutex.RUnlock()
	if !ok {
		dayTokenSetMutex.Lock()
		dayTokenSet[userId] = true
		dayTokenSetMutex.Unlock()
		adminLog.Write([]byte(fmt.Sprintf("%d %s %s %d %d %s %s %s\n", LOGADMIN_TYPE_TOKEN, userId, did, regType, now.Unix(), inviteCode, ip, uuid)))
	}
}

func LogDeviceReg(userId string, did string, inviteCode string, regType int, ip string) {
	adminLog.Write([]byte(fmt.Sprintf("%d %s %s %d %d %s %s\n", LOGADMIN_TYPE_DEVICEREG, userId, did, regType, time.Now().Unix(), inviteCode, ip)))
}

func LogBindPhone(userId string, mobile string, inviteCode string, regType int) {
	adminLog.Write([]byte(fmt.Sprintf("%d %s %s %d %d %s\n", LOGADMIN_TYPE_BINDPHONE, userId, mobile, regType, time.Now().Unix(), inviteCode)))
}

func LogPayOrder(userId string, amount int, inComeAmount int, inviteCode string, regType int) {
	adminLog.Write([]byte(fmt.Sprintf("%d %s %d %d %s\n", LOGADMIN_TYPE_PAYORDER, userId, regType, time.Now().Unix(), inviteCode)))
}
