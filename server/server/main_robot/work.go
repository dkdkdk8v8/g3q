package main

import (
	"compoment/alert"
	"compoment/logrotate"
	"compoment/ormutil"
	"compoment/uid"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"runtime"
	"service/comm"
	"service/initMain"
	"service/mainRobot"
	"service/modelClient"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
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
	WorkId       int
	HttpHost     string
	HttpPort     string
	ShutDownWait int
	LogLevel     string
	MysqlHost    string
	MysqlPort    string
	MysqlUser    string
	MysqlPwd     string
	MysqlConn    int
	MysqlIdle    int
	RedisAddr    string
	RedisPwd     string
	RedisTunnel  struct {
		Host   string
		User   string
		Rsa    string
		Target string
	}
	IsSsl bool
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
		w.cfg.MysqlUser, w.cfg.MysqlPwd,
		w.cfg.MysqlConn, w.cfg.MysqlIdle)

	go func() {
		mainRobot.Start()
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
