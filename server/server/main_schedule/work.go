package main

import (
	"compoment/alert"
	"compoment/logrotate"
	"compoment/myopensearch"
	"compoment/ormutil"
	"compoment/rds"
	"compoment/uid"
	"compoment/util"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"service/comm"
	"service/initMain"
	"service/mainClient"
	"service/mainSchedule"
	"service/modelCache"
	"service/modelClient"
	"service/modelScraper"
	"service/sms"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
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
	WorkId       int
	HttpHost     string
	HttpPort     string
	ShutDownWait int
	SignMem      int
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
	OpenSearchHost   string
	OpenSearchKey    string
	OpenSearchSecret string
	OpenSearchRegion string
	OpenSearchTunnel struct {
		Host   string
		User   string
		Rsa    string
		Target string
	}
}

type mainScheduleWork struct {
	initMain.WorkRunner
	cfg           *workCfg
	adminEngine   *gin.Engine
	defaultEngine *gin.Engine
}

func createMainWork(debug bool) (*mainScheduleWork, error) {
	if debug {
		viper.SetConfigName("server_debug.yaml")
	} else {
		viper.SetConfigName("server.yaml")
	}

	err := viper.ReadInConfig()
	if err != nil {
		return nil, errors.Errorf("Fatal server.yaml config file: %s \n", err)
	}
	ret := &mainScheduleWork{}
	if err := viper.Unmarshal(&ret.cfg); err != nil {
		return nil, errors.Errorf("Fatal server.yaml config file: %s \n", err)
	}

	return ret, nil
}

func (w *mainScheduleWork) Init(baseCtx *initMain.BaseCtx) error {
	if err := w.WorkRunner.Init(baseCtx); err != nil {
		return err
	}
	uid.Init(w.cfg.WorkId, 1729791888000)
	if !baseCtx.IsTerm {
		gin.SetMode(gin.ReleaseMode)
	}

	return nil
}

func (w *mainScheduleWork) Start(baseCtx *initMain.BaseCtx) error {
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

	logrus.Info("initGin")
	w.defaultEngine = gin.New()
	w.defaultEngine.Use(gin.Logger(), gin.CustomRecovery(midPanicHttp))
	mainClient.InitWebHandler(w.defaultEngine)

	logrus.Info("initSignMem")
	if err := comm.InitCache(w.cfg.SignMem); err != nil {
		logrus.WithError(err).Error("InitCache-Fail")
		return err
	}

	if w.cfg.RedisTunnel.Target != "" {
		logrus.Info("redisTunnel")
		redisTunnel := util.SSHTunnel{
			SSHUser:       w.cfg.RedisTunnel.User,
			SSHKeyPath:    w.cfg.RedisTunnel.Rsa,
			SSHHost:       w.cfg.RedisTunnel.Host,
			LocalAddress:  w.cfg.RedisAddr,
			RemoteAddress: w.cfg.RedisTunnel.Target,
			AutoReconnect: true,
			KeepAlive:     true,
			RetryInterval: time.Second * 5,
		}
		if err := redisTunnel.Start(); err != nil {
			logrus.WithError(err).Error("redisTunnel-Fail")
			return err
		}
		//有tunnel需要等一下
		time.Sleep(time.Second)
	}
	logrus.Info("redisInit")
	if redisPool, err := rds.Login(w.cfg.RedisAddr, w.cfg.RedisPwd, true); err != nil {
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
		w.cfg.MysqlUser, w.cfg.MysqlPwd,
		w.cfg.MysqlConn, w.cfg.MysqlIdle)
	ormutil.RegOrmModel(modelScraper.RegModels, modelScraper.ScraperDB, modelScraper.ScraperDB,
		w.cfg.MysqlHost, w.cfg.MysqlPort,
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

	logrus.Info("initModelCache")
	if err := modelCache.InitModelCache(); err != nil {
		logrus.WithError(err).Error("modelCache-Fail")
		return err
	}

	logrus.Info("initSms")
	if err := sms.InitSms(); err != nil {
		logrus.WithError(err).Error("smsInit-Fail")
		return err
	}
	logrus.Info("initOpenSearch")
	if w.cfg.OpenSearchTunnel.Target != "" {
		logrus.Info("openSearchTunnel")
		openSearchTunnel := util.SSHTunnel{
			SSHUser:       w.cfg.OpenSearchTunnel.User,
			SSHKeyPath:    w.cfg.OpenSearchTunnel.Rsa,
			SSHHost:       w.cfg.OpenSearchTunnel.Host,
			LocalAddress:  w.cfg.OpenSearchHost,
			RemoteAddress: w.cfg.OpenSearchTunnel.Target,
			AutoReconnect: true,
			KeepAlive:     true,
			RetryInterval: time.Second * 5,
		}
		if err := openSearchTunnel.Start(); err != nil {
			logrus.WithError(err).Error("openSearchTunnel-Fail")
			return err
		}
		//有tunnel需要等一下
		time.Sleep(time.Second * 2)
	}
	if err := myopensearch.LoginAws(w.cfg.OpenSearchHost, w.cfg.OpenSearchRegion, w.cfg.OpenSearchKey, w.cfg.OpenSearchSecret, time.Second*5); err != nil {
		logrus.WithError(err).Error("openSearch-Fail")
		return err
	}
	logrus.Info("initTask")
	if err := mainSchedule.InitSyncSpider(); err != nil {
		logrus.WithError(err).Error("initSyncSpider-Fail")
		return err
	}
	fmt.Println("startOk")
	return nil
}

func (w *mainScheduleWork) Stop(baseCtx *initMain.BaseCtx) error {

	w.WorkRunner.Stop(baseCtx)
	logrus.Info("shutting down")
	os.Exit(0)
	return nil
}

func (w *mainScheduleWork) Reload(baseCtx *initMain.BaseCtx) error {

	logrus.Info("reloadFinish")
	return nil
}
