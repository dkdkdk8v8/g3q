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
	runDebug "runtime/debug"
	"service/comm"
	"service/initMain"
	"service/mainClient"
	"service/modelAdmin"
	"service/modelClient"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/sasha-s/go-deadlock"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
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
	WorkId        int
	HttpHost      string
	HttpPort      string
	AdminHost     string
	AdminPort     string
	ShutDownWait  int
	LogLevel      string
	MysqlHost     string
	MysqlPort     string
	MysqlReadHost string
	MysqlReadPort string
	MysqlUser     string
	MysqlPwd      string
	MysqlConn     int
	MysqlIdle     int
	RedisAddr     string
	RedisPwd      string
	IsSsl         bool
}

type mainClientWork struct {
	initMain.WorkRunner
	cfg           *workCfg
	adminEngine   *gin.Engine
	defaultEngine *gin.Engine
}

func createMainWork(debug bool) (*mainClientWork, error) {
	if debug {
		viper.SetConfigName("server_debug.yaml")
	} else {
		viper.SetConfigName("server.yaml")
	}

	err := viper.ReadInConfig()
	if err != nil {
		return nil, errors.Errorf("Fatal server.yaml config file: %s \n", err)
	}
	ret := &mainClientWork{}
	if err := viper.Unmarshal(&ret.cfg); err != nil {
		return nil, errors.Errorf("Fatal server.yaml config file: %s \n", err)
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

	fmt.Println("startOk")
	return nil
}

func (w *mainClientWork) Stop(baseCtx *initMain.BaseCtx) error {

	w.WorkRunner.Stop(baseCtx)
	logrus.Info("shutting down")
	os.Exit(0)
	return nil
}

func (w *mainClientWork) Reload(baseCtx *initMain.BaseCtx) error {

	logrus.Info("reloadFinish")
	return nil
}
