package main

import (
	"fmt"
	"os"
	"path/filepath"
	"service/initMain"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	term        bool
	wait        time.Duration
	start       bool
	stop        bool
	reload      bool
	restart     bool
	flagProcess string
	monitorMd   int
	debug       bool
	test        bool
)

var (
	branch       string
	commit       string
	host         string
	user         string
	path         string
	btime        string
	printVersion bool
)

func printBuildInfo() {
	fmt.Printf("BuildInfo:\n")
	fmt.Printf("    branch = %s\n", branch)
	fmt.Printf("    commit = %s\n", commit)
	fmt.Printf("    host   = %s\n", host)
	fmt.Printf("    user   = %s\n", user)
	fmt.Printf("    path   = %s\n", path)
	fmt.Printf("    btime  = %s\n", btime)
}

func main() {
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		println("location load fail")
		return
	} else {
		time.Local = location
	}
	processName, err := initMain.ModifyProcessName()
	if err != nil {
		fmt.Println(err.Error())
		return
	}
	var rootCmd = &cobra.Command{
		Use:   processName,
		Short: "",
		Run: func(cmd *cobra.Command, args []string) {
			if printVersion {
				printBuildInfo()
				return
			}

			vipDefaultCfgDir := filepath.Dir(os.Args[0])
			viper.AddConfigPath(vipDefaultCfgDir + "/cfg")
			viper.SetConfigType("yaml")
			initMain.InitAlert()

			daemonRunner := initMain.DaemonRunner{Ctx: initMain.BaseCtx{ProcessName: processName, IgnorePid: debug, IsTerm: term,
				VipDefaultCfgDir: vipDefaultCfgDir, IsDebug: debug, IsTest: test}}
			authWork, err := createMainWork(debug)
			if err != nil {
				logrus.WithError(err).Error("createRemoteAuthWorkFail")
				return
			}
			authMonitor := initMain.CreateMonitorRunner(nil)

			switch flagProcess {
			case initMain.ProcessWork:
				daemonRunner.Run(authWork)
				return
			case initMain.ProcessMonitor:
				daemonRunner.Run(authMonitor)
				return
			}

			if start || stop || reload || restart {
				if start {
					daemonRunner.ForkStart(false)
				}
				//cmd logic
				if stop || restart {
					authMonitor.SendSignal(&daemonRunner.Ctx, []initMain.Runner{authWork, authMonitor}, syscall.SIGTERM)
				}
				if reload {
					authMonitor.SendSignal(&daemonRunner.Ctx, []initMain.Runner{authWork, authMonitor}, syscall.SIGHUP)
				}
				if restart {
					//check process
					daemonRunner.ForkStart(true)
				}
			} else {
				//default only run work
				daemonRunner.Run(authWork)
			}
		},
	}

	rootCmd.PersistentFlags().BoolVar(&term, initMain.CmdT, false, "log to terminal")
	rootCmd.PersistentFlags().DurationVar(&wait, initMain.CmdWait, time.Second*2, "the duration for which the server gracefully wait for existing connections to finish - e.g. 15s")
	rootCmd.PersistentFlags().BoolVar(&start, initMain.CmdStart, false, "start")
	rootCmd.PersistentFlags().BoolVar(&stop, initMain.CmdStop, false, "stop")
	rootCmd.PersistentFlags().BoolVar(&reload, initMain.CmdReload, false, "reload")
	rootCmd.PersistentFlags().BoolVar(&restart, initMain.CmdRestart, false, "restart")
	rootCmd.PersistentFlags().StringVar(&flagProcess, initMain.CmdProcess, "", "flagProcess name")
	rootCmd.PersistentFlags().IntVar(&monitorMd, initMain.CmdMonitorDuration, 2, "monitor duration second")
	rootCmd.PersistentFlags().BoolVar(&printVersion, "v", false, "print version info")
	rootCmd.PersistentFlags().BoolVar(&debug, initMain.CmdDebug, false, "debug mode")
	rootCmd.PersistentFlags().BoolVar(&test, initMain.CmdTest, false, "test")
	//rootCmd.PersistentFlags().StringVar(&configPath, initMain.CmdCfgPath, "", "config path")

	rootCmd.Execute()
}
