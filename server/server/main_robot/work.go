package main

import (
	"compoment/alert"
	"compoment/logrotate"
	"compoment/ormutil"
	"compoment/rds"
	"compoment/uid"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"runtime"
	"service/comm"
	"service/initMain"
	"service/mainRobot"
	"service/modelAdmin"
	"service/modelClient"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

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
	RedisTunnel   struct {
		Host   string `yaml:"Host"`
		User   string `yaml:"User"`
		Rsa    string `yaml:"Rsa"`
		Target string `yaml:"Target"`
	} `yaml:"RedisTunnel"`
	IsSsl bool `yaml:"IsSsl"`
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
		return nil, errors.Errorf("Fatal yaml config file: %s \n", err)
	}
	return ret, nil
}

func (w *mainClientWork) Init(baseCtx *initMain.BaseCtx) error {
	if err := w.WorkRunner.Init(baseCtx); err != nil {
		return err
	}
	uid.Init(w.cfg.WorkId, 1729791888000)
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
	}

	initMain.WritePid(baseCtx, initMain.ProcessWork)

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

	logrus.Info("initModel")
	if err := ormutil.InitModel(); err != nil {
		logrus.WithError(err).Error("initModel-Fail")
		return err
	}

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

	logrus.Info("initModelAdmin")
	modelAdmin.Init()

	go func() {
		mainRobot.StartRobot()
		mainRobot.StartStress()
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
