package initMain

import (
	"compoment/alert"
	"fmt"
	"github.com/mitchellh/go-ps"
	"github.com/sirupsen/logrus"
	"os"
	"path/filepath"
)

//
//func SetStdFile() {
//	logrus.SetOutput()
//}

func ModifyProcessName() (string, error) {
	return filepath.Base(os.Args[0]), nil
}

func Signal2Pid(pid int, sig os.Signal) error {
	p, err := os.FindProcess(pid)
	if err != nil {
		fmt.Println("Failed to find current work:", err)
		return err
	}
	if err := p.Signal(sig); err != nil {
		fmt.Println("Failed to send SIGHUP signal:", err)
		return err
	}
	return nil
}

func CheckPidAlive(baseCtx *BaseCtx, process string, logOut bool) bool {
	pid, err := GetPid(baseCtx, process)
	if err == nil && pid > 0 {
		processes, err := ps.Processes()
		if err != nil {
			logrus.WithField("!", alert.Limit).WithError(err).Error("processListFail")
			return true
		}
		// 遍历进程列表并输出进程信息
		bFind := false
		for _, pro := range processes {
			if pro.Pid() == pid {
				bFind = true
				break
			}
		}
		if bFind {
			//find exist process
			if logOut {
				logrus.WithField("pid", pid).WithField("process", process).Error("alreadyRunning")
			}
			return true
		}
	}
	return false
}
