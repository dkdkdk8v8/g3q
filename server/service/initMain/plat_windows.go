package initMain

import (
	"compoment/alert"
	"compoment/util"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"os"
	"os/exec"
	"time"
)

func (bm *DaemonRunner) ForkStart(restart bool) error {
	startProcess := []string{ProcessWork}
	for _, p := range startProcess {
		if restart {
			exitCount := 0
			nowT := time.Now()
			for {
				if !CheckPidAlive(&bm.Ctx, p, false) {
					exitCount++
				}
				if exitCount == len(startProcess) {
					break
				}
				//hard 5
				if time.Now().Sub(nowT).Seconds() > 5 {
					return errors.Errorf("restartTimeout")
				}
			}
		} else {
			if CheckPidAlive(&bm.Ctx, p, true) {
				return errors.Errorf("process[%s]Alive", p)
			}
		}
	}

	var cmds [][]string
	for _, p := range startProcess {
		cmds = append(cmds, []string{"--" + CmdProcess, p})
	}
	for _, cs := range cmds {
		var forkCmd []string
		forkCmd = append(forkCmd, cs...)
		forkCmd = append(forkCmd, os.Args[1:]...)
		forkCmd = util.RemoveString(forkCmd, []string{"--" + CmdStart, "--" + CmdRestart})

		cmd := exec.Command(os.Args[0], forkCmd...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err := cmd.Start()
		if err != nil {
			println(err.Error())
		}
		time.Sleep(time.Millisecond * 100)
	}
	return nil
}

func (ar *MonitorRunner) aliveWork(baseCtx *BaseCtx) {
	//hard
	startProcess := []string{ProcessWork}
	var cmds [][]string
	for _, p := range startProcess {
		cmds = append(cmds, []string{"--" + CmdProcess, p})
	}
	var oldArg = util.RemoveString(os.Args[1:], []string{"--" + CmdProcess, ProcessMonitor})

	for _, cs := range cmds {
		var forkCmd []string
		forkCmd = append(forkCmd, cs...)
		forkCmd = append(forkCmd, oldArg...)
		forkCmd = util.RemoveString(forkCmd, []string{"--" + CmdStart})
		for {
			cmd := exec.Command(os.Args[0], forkCmd...)
			err := cmd.Start()
			if err != nil {
				logrus.WithError(err).WithField("!", nil).Error("aliveWorkFail")
			}
			go func() {
				//avoid <defunct> process
				err = cmd.Wait()
				if err != nil {
					logrus.WithField("!", alert.Limit).WithError(err).Error("waitingForTheCommandFail")
				} else {
					logrus.Info("waitingForTheCommandOk")
				}
			}()
			//check alive
			time.Sleep(time.Second * 1)
			if CheckPidAlive(baseCtx, ProcessWork, false) {
				ar.resetTryAliveNum()
				logrus.WithField("!", alert.NoLimit).WithField("tryNum", ar.tryAliveWorkNum).Error("aliveWorkOk")
				break
			}
			if !ar.continueAlive() {
				break
			}
			ar.tryAliveWorkNum++
			time.Sleep(time.Second * time.Duration(ar.trySleepSecCfg))
		}
	}

}
