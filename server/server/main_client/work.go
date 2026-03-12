package main

import (
	"compoment/alert"
	"compoment/logrotate"
	"compoment/ormutil"
	"compoment/rds"
	"compoment/uid"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"
	runDebug "runtime/debug"
	"service/comm"
	"service/initMain"
	"service/mainClient"
	"service/mainClient/game"
	"service/modelAdmin"
	"service/modelClient"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/sasha-s/go-deadlock"
	"github.com/sirupsen/logrus"
)

func cors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
}

func midPanicHttp(c *gin.Context, err any) {
	const size = 64 << 10
	buf := make([]byte, size)
	buf = buf[:runtime.Stack(buf, false)]
	//log.Get().Println(err)
	//log.Get().Print(string(buf))
	logrus.WithField("host", c.Request.Host).WithField("path", c.Request.RequestURI).WithField(
		"!", alert.Limit).WithField("buf", string(buf)).Error("httpMiddleWare-panic")
	cors(c.Writer)
	c.AbortWithStatus(http.StatusBadRequest)
}

type workCfg struct {
	WorkId        int    `yaml:"WorkId"`
	HttpHost      string `yaml:"HttpHost"`
	HttpPort      string `yaml:"HttpPort"`
	AdminHost     string `yaml:"AdminHost"`
	AdminPort     string `yaml:"AdminPort"`
	ShutDownWait  int    `yaml:"ShutDownWait"`
	LogLevel      string `yaml:"LogLevel"`
	MysqlHost     string `yaml:"MysqlHost"`
	MysqlPort     string `yaml:"MysqlPort"`
	MysqlReadHost string `yaml:"MysqlReadHost"`
	MysqlReadPort string `yaml:"MysqlReadPort"`
	MysqlUser     string `yaml:"MysqlUser"`
	MysqlPwd      string `yaml:"MysqlPwd"`
	MysqlConn     int    `yaml:"MysqlConn"`
	MysqlIdle     int    `yaml:"MysqlIdle"`
	RedisAddr     string `yaml:"RedisAddr"`
	RedisPwd      string `yaml:"RedisPwd"`
	IsSsl         bool   `yaml:"IsSsl"`
}

type mainClientWork struct {
	initMain.WorkRunner
	cfg           *workCfg
	adminEngine   *gin.Engine
	defaultEngine *gin.Engine
}

func createMainWork(cfgDir string, debug bool) (*mainClientWork, error) {
	ret := &mainClientWork{}
	if err := initMain.LoadYamlConfig(cfgDir, debug, &ret.cfg); err != nil {
		return nil, errors.Errorf("Fatal %v yaml config file: %s \n", debug, err)
	}
	return ret, nil
}

func (w *mainClientWork) Init(baseCtx *initMain.BaseCtx) error {
	if err := w.WorkRunner.Init(baseCtx); err != nil {
		return err
	}
	uid.Init(w.cfg.WorkId, 1767703689000)
	if !baseCtx.IsTerm {
		gin.SetMode(gin.ReleaseMode)
	}

	return nil
}

func (w *mainClientWork) Start(baseCtx *initMain.BaseCtx) error {
	logName := baseCtx.ProcessName + "." + initMain.ProcessWork
	if logFile, err := comm.InitLog(baseCtx.IsTerm, logName, false, logrotate.LogRollTypeMidNight, w.cfg.LogLevel,
		true, true); err != nil {
		logrus.WithError(err).Error("intLog-Fail")
		return err
	} else {
		gin.DefaultWriter = logFile
		gin.DefaultErrorWriter = logFile

		crashPath := filepath.Join(filepath.Dir(os.Args[0]), "log", logName+".crash")
		if f, err := os.OpenFile(crashPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0666); err == nil {
			runDebug.SetCrashOutput(f, runDebug.CrashOptions{})
		} else {
			logrus.WithError(err).Error("SetCrashOutput-Fail")
		}

		deadlockPath := filepath.Join(filepath.Dir(os.Args[0]), "log", logName+".deadlock")
		if f, err := os.OpenFile(deadlockPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0666); err == nil {
			deadlock.Opts.LogBuf = f
		} else {
			logrus.WithError(err).Error("SetDeadlockOutput-Fail")
		}
	}

	initMain.WritePid(baseCtx, initMain.ProcessWork)

	logrus.Info("initGin")
	w.defaultEngine = gin.New()
	w.defaultEngine.Use(gin.Logger(), gin.CustomRecovery(midPanicHttp))
	mainClient.InitWebHandler(w.defaultEngine)

	w.adminEngine = gin.New()
	w.adminEngine.Use(gin.Logger(), gin.CustomRecovery(midPanicHttp))
	mainClient.InitAdminWebHandler(w.adminEngine)

	logrus.Info("redisInit")
	if redisPool, err := rds.Login(w.cfg.RedisAddr, w.cfg.RedisPwd, w.cfg.IsSsl); err != nil {
		logrus.WithError(err).Error("redisLogin-Fail")
		return err
	} else {
		if err := redisPool.Ping(); err != nil {
			logrus.WithError(err).Error("redisPing-Fail")
			return err
		}
	}

	logrus.Info("regModel")
	ormutil.RegOrmModel(modelClient.RegModels, modelClient.ServerDB, modelClient.ServerDB,
		w.cfg.MysqlHost, w.cfg.MysqlPort,
		w.cfg.MysqlReadHost, w.cfg.MysqlReadPort,
		w.cfg.MysqlUser, w.cfg.MysqlPwd,
		w.cfg.MysqlConn, w.cfg.MysqlIdle)

	ormutil.RegOrmModel(modelAdmin.RegModels, modelAdmin.ServerDB, modelAdmin.ServerDB,
		w.cfg.MysqlHost, w.cfg.MysqlPort,
		w.cfg.MysqlReadHost, w.cfg.MysqlReadPort,
		w.cfg.MysqlUser, w.cfg.MysqlPwd,
		w.cfg.MysqlConn, w.cfg.MysqlIdle)

	logrus.Info("syncModel")
	if err := ormutil.RunSyncModel(); err != nil {
		logrus.WithError(err).Error("syncModel-Fail")
		return err
	}
	logrus.Info("initModel")
	if err := ormutil.InitModel(); err != nil {
		logrus.WithError(err).Error("initModel-Fail")
		return err
	}

	logrus.Info("initModelAdmin")
	modelAdmin.Init()

	logrus.Info("ipDb")
	if err := comm.InitIpDataBase(); err != nil {
		logrus.WithError(err).Error("InitIpDb-Fail")
		return err
	}
	logrus.Info("startNetServer")

	go func() {
		startHttpListen(w.cfg.HttpHost+":"+w.cfg.HttpPort, w.defaultEngine)
	}()
	go func() {
		startHttpListen(w.cfg.AdminHost+":"+w.cfg.AdminPort, w.adminEngine)
	}()

	// 从 Redis 恢复热重启快照
	if snapshots := game.LoadSnapshotsFromRedis(); len(snapshots) > 0 {
		logrus.WithField("count", len(snapshots)).Info("Start: 正在恢复快照房间...")
		game.GetMgr().RestoreFromSnapshots(snapshots)
		logrus.Info("Start: 快照房间恢复完成")
	}

	fmt.Println("startOk")
	return nil
}

func (w *mainClientWork) Stop(baseCtx *initMain.BaseCtx) error {
	logrus.Info("Stop: 开始优雅快照...")

	// 1. 快照所有房间状态(最多等10秒)
	snapshots, err := game.GetMgr().GracefulSnapshot(10 * time.Second)
	if err != nil {
		// 快照超时: 有房间未能到达安全点，中止停服，保持运行以便排查
		logrus.WithError(err).Error("Stop: GracefulSnapshot超时，中止停服！请检查卡住的房间状态")
		return fmt.Errorf("stop aborted: %w", err)
	}

	if len(snapshots) > 0 {
		// 2. 保存快照到 Redis
		if err := game.SaveSnapshotsToRedis(snapshots); err != nil {
			logrus.WithError(err).Error("Stop: SaveSnapshotsToRedis failed，中止停服！")
			return fmt.Errorf("stop aborted: %w", err)
		}
		logrus.WithField("count", len(snapshots)).Info("Stop: 快照已保存到Redis")
	} else {
		logrus.Info("Stop: 没有房间需要快照")
	}

	w.WorkRunner.Stop(baseCtx)
	logrus.Info("shutting down")
	os.Exit(0)
	return nil
}

func (w *mainClientWork) Reload(baseCtx *initMain.BaseCtx) error {

	logrus.Info("reloadFinish")
	return nil
}
