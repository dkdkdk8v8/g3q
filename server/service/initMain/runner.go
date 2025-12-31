package initMain

import (
	"compoment/logrotate"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"service/comm"
	"syscall"
	"time"
)

type PidErrType int

const (
	PidErrTypeNotStart PidErrType = 1
	PidErrTypeNotFind  PidErrType = 2
)

var (
	ErrorProcessAlreadyExist = errors.New("processAlreadyExist")
)

type monitorFunDef func(baseCtx *BaseCtx, t PidErrType) error

type MonitorRunner struct {
	monitorFun      monitorFunDef
	selfPid         int
	isClose         bool
	tryAliveWorkNum int
	tryAliveWorkCfg int
	trySleepSecCfg  int
}

func CreateMonitorRunner(monitorFun monitorFunDef) *MonitorRunner {
	ret := &MonitorRunner{monitorFun: monitorFun}
	if ret.monitorFun == nil {
		ret.monitorFun = defaultMonitorAlert
	}
	return ret
}

//func IsTerm() bool {
//	var isTerm bool
//	flag.BoolVar(&isTerm, CmdT, false, "")
//	return isTerm
//}

func (ar *MonitorRunner) CheckProcessAlive(baseCtx *BaseCtx) bool {
	return CheckPidAlive(baseCtx, ProcessMonitor, true)
}

func (ar *MonitorRunner) Init(baseCtx *BaseCtx) error {
	return nil
}

func (ar *MonitorRunner) Start(baseCtx *BaseCtx) error {
	logName := baseCtx.ProcessName + "." + ProcessMonitor
	//hard
	if _, err := comm.InitLog(baseCtx.IsTerm, logName, false, logrotate.LogRollTypeMidNight, "info", false, false); err != nil {
		logrus.WithError(err).Error("monitorInitLog")
		return err
	}
	var monitorCheckInt int
	monitorCheckInt = 2 //util.Atoi("2")
	if monitorCheckInt == 0 {
		//code this
		//todo config
		monitorCheckInt = 2
	}
	ar.trySleepSecCfg = 1
	ar.tryAliveWorkCfg = 3

	if ar.monitorFun == nil {
		panic("check")
	}
	//check work status
	go func() {
		time.Sleep(time.Second * 20)
		for !ar.isClose {
			time.Sleep(time.Second * time.Duration(monitorCheckInt))
			alive := CheckPidAlive(baseCtx, ProcessWork, false)
			if !alive {
				if !ar.isClose {
					ar.monitorFun(baseCtx, PidErrTypeNotFind)
					logrus.Error("processCrashOrNotExist")
					//alive the work
					ar.aliveWork(baseCtx)
				}
			}
			logrus.Info("monitorCheck")
		}
	}()
	logrus.Info("monitorStart")
	return WritePid(baseCtx, ProcessMonitor)
}

func (ar *MonitorRunner) continueAlive() bool {
	return ar.tryAliveWorkNum <= ar.tryAliveWorkCfg
}

func (ar *MonitorRunner) resetTryAliveNum() {
	ar.tryAliveWorkNum = 0
}

func (ar *MonitorRunner) Stop(baseCtx *BaseCtx) error {
	//close monitor
	ar.isClose = true
	for !CheckPidAlive(baseCtx, ProcessWork, false) {
		time.Sleep(time.Millisecond * 500)
		logrus.Info("workProcessAlreadyStop")
		break
	}
	DelPid(baseCtx, ProcessMonitor)
	logrus.Info("adminProcessStop")
	return nil
}

func (ar *MonitorRunner) Reload(baseCtx *BaseCtx) error {
	logrus.Info("reloadFinish")
	return nil
}

func (ar *MonitorRunner) GetSuffix() string {
	return ProcessMonitor
}

func (ar *MonitorRunner) getPid(baseCtx *BaseCtx, suffix string) (int, error) {
	pid, err := GetPid(baseCtx, suffix)
	if err != nil {
		logrus.WithError(err).Error("workPidInvalid")
		return 0, err
	}
	return pid, nil
}

func (ar *MonitorRunner) SendSignal(baseCtx *BaseCtx, rs []Runner, signal syscall.Signal) {
	for _, r := range rs {
		filePid, err := GetPid(baseCtx, r.GetSuffix())
		if err != nil {
			logrus.WithField("suffix", r.GetSuffix()).Error("pIDInvalid")
			continue
		}
		Signal2Pid(filePid, signal)
	}
}

//type WorkRunFunDef func(ctx *BaseCtx) error

type WorkRunner struct {
	processName string
	//runnerFun   WorkRunFunDef
}

func (wr *WorkRunner) CheckProcessAlive(baseCtx *BaseCtx) bool {
	return CheckPidAlive(baseCtx, ProcessWork, true)
}

func (wr *WorkRunner) Init(baseCtx *BaseCtx) error {
	return nil
}

func (wr *WorkRunner) Start(baseCtx *BaseCtx) error {
	logName := baseCtx.ProcessName + "." + ProcessWork
	if _, err := comm.InitLog(baseCtx.IsTerm, logName, false, logrotate.LogRollTypeMidNight, "info", false, false); err != nil {
		logrus.WithError(err).Error("workInitLog")
		return err
	}

	return WritePid(baseCtx, ProcessWork)
}

func (wr *WorkRunner) Stop(baseCtx *BaseCtx) error {
	DelPid(baseCtx, ProcessWork)
	return nil
}

func (wr *WorkRunner) Reload(baseCtx *BaseCtx) error {
	logrus.Error("impYourSelf")
	return nil
}

func (wr *WorkRunner) GetSuffix() string {
	return ProcessWork
}

func GetPid(baseCtx *BaseCtx, suffix string) (int, error) {
	pidH := NewPidHelp(baseCtx.ProcessName, suffix)
	return pidH.ReadPidFile()
}
func WritePid(baseCtx *BaseCtx, suffix string) error {
	pidH := NewPidHelp(baseCtx.ProcessName, suffix)
	return pidH.WritePidFile()
}
func DelPid(baseCtx *BaseCtx, suffix string) error {
	pidH := NewPidHelp(baseCtx.ProcessName, suffix)
	return pidH.DelPidFile()
}
