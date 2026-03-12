package initMain

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/sirupsen/logrus"
)

type Runner interface {
	Init(baseCtx *BaseCtx) error
	Start(baseCtx *BaseCtx) error
	Stop(baseCtx *BaseCtx) error
	Reload(baseCtx *BaseCtx) error
	GetSuffix() string
	CheckProcessAlive(baseCtx *BaseCtx) bool
}

type Signaler interface {
	SendStop(r []Runner)
	SendReload(r []Runner)
}

type BaseCtx struct {
	ProcessName      string
	UserData         interface{}
	IgnorePid        bool
	IsTerm           bool
	VipDefaultCfgDir string
	IsDebug          bool
	IsTest           bool
	IsTunnel         bool
}

var DefCtx *BaseCtx

type DaemonRunner struct {
	Ctx BaseCtx
}

func (bm *DaemonRunner) Run(runner Runner) {
	DefCtx = &bm.Ctx
	if runner.CheckProcessAlive(&bm.Ctx) {
		return
	}

	if err := runner.Init(&bm.Ctx); err != nil {
		logrus.WithError(err).WithField("process", runner.GetSuffix()).Error("initFail")
		return
	}

	go func() {
		if err := runner.Start(&bm.Ctx); err != nil {
			logrus.Error(err.Error())
			panic(err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)

	for sig := range sigChan {
		switch sig {
		case syscall.SIGTERM, os.Interrupt:
			if err := runner.Stop(&bm.Ctx); err != nil {
				// Stop 返回错误表示中止停服（如快照失败），保持运行等待下次信号
				logrus.WithError(err).Error("Stop aborted, server keeps running. Send signal again to retry.")
				continue
			}
			return
		case syscall.SIGHUP:
			// Handle SIGHUP signal if needed
			runner.Reload(&bm.Ctx)
		}
	}
}
