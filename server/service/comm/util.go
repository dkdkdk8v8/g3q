package comm

import (
	"bytes"
	"compoment/alert"
	"compoment/crypto"
	"compoment/util"
	"compoment/util/funcline"
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"io"
	"net/http"
	"runtime"
)

type MyHandlerFunc func(ctx *gin.Context) (interface{}, error)

func GetErrRsp(err error) CommRsp {
	ret := CommRsp{}
	var asMyErr *MyError
	if errors.As(err, &asMyErr) {
		ret.Msg = asMyErr.Message
		ret.Code = asMyErr.Code
	} else {
		ret.Msg = "系统出现点问题，请稍后再试"
		ret.Code = -1
	}
	return ret
}

func Health(ctx *gin.Context) {
	ctx.Writer.WriteHeader(200)
	ctx.Writer.WriteString("ok")
}

type SpeedRspData struct {
	ClientIp string
}
type SpeedRsp struct {
	Code int          `json:"c"`
	Msg  string       `json:"m"`
	Data SpeedRspData `json:"d"`
}

func ApiSpeed(ctx *gin.Context) {
	var rsp SpeedRsp
	rsp.Data.ClientIp = ctx.ClientIP()
	HttpCorsHeaderSet(ctx.Writer)
	ctx.AbortWithStatusJSON(http.StatusOK, rsp)
}

func IsDebugEnv(ctx *gin.Context) bool {
	x := ctx.GetHeader("usdt")
	if x == "c4d23eb7ba617a46a5999a95e1073f74" {
		//pass
		return true
	}
	return false
}

func IsProto(ctx *gin.Context) bool {
	proto := ctx.GetHeader("proto")
	if proto != "" {
		return true
	}
	return false
}

//func Abort(ctx *gin.Context, err error) {
//	ctx.AbortWithStatusJSON(http.StatusOK, GetErrRsp(err))
//}

func rspNormalJson(httpCode int, rsp CommRsp, ctx *gin.Context, logT *logrus.Entry, start util.UsageTimer) {
	rspBuf, err := json.Marshal(rsp)
	if err != nil {
		logT.WithField("!", nil).WithError(err).Error("httpHandlerRspJson-Fail")
		ctx.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	HttpCorsHeaderSet(ctx.Writer)
	ctx.Data(httpCode, "application/json", rspBuf)
	if CfgLogSysHttpOut.Load() {
		logT.WithField("usage", start.UsageMs()).WithField("z-content", string(rspBuf)).Info("httpHandler-OK")
	}
}

func rspAesJson(httpCode int, rsp CommRsp, ctx *gin.Context, logT *logrus.Entry, start util.UsageTimer) {
	rspBuf, err := json.Marshal(rsp)
	if err != nil {
		logT.WithField("!", nil).WithError(err).Error("httpHandlerRspJson-Fail")
		ctx.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	aes := crypto.NewAesCBCDiy([]byte(ProtoAesKey), crypto.PAD_MODE_PKCS7PADDING)
	rspAes, err := aes.Encrypt(rspBuf)
	if err != nil {
		logT.WithField("!", nil).WithError(err).Error("httpHandlerRspAes-Fail")
		ctx.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	//rspB64 := base64.StdEncoding.EncodeToString(rspAes)
	HttpCorsHeaderSet(ctx.Writer)
	ctx.Data(httpCode, "text/plain", rspAes)

	if CfgLogSysHttpOut.Load() {
		smallLen := len(rspBuf)
		if smallLen > CfgLogContentLength.Load() {
			smallLen = CfgLogContentLength.Load()
		}
		logT.WithField(
			"usageMs", start.UsageMs()).WithField(
			"z-content", util.TruncateUTF8StringEfficient(string(rspBuf), smallLen)).WithField(
			"$", funcline.GetLineByFuncForPerformance(func() {})).Info(
			"httpHandler-OK")
	}
}

func HandlerLogWrap(fn MyHandlerFunc) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		start := util.NewUsageTimer()
		logT := logrus.WithField("url", ctx.Request.RequestURI).WithField("remoteIp", ctx.ClientIP())
		if CfgLogSysHttpIn.Load() {
			buf, err := io.ReadAll(ctx.Request.Body)
			if err == nil {
				logT.WithField("z-content", string(buf)).Info("httpHandler-IN")
				ctx.Request.Body = io.NopCloser(bytes.NewBuffer(buf))
			}
		}

		data, err := fn(ctx)
		if err != nil {
			logT.WithField("!", nil).WithError(err).WithField("usage", start.UsageMs()).Error("httpHandler-fail")
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, err.Error())
			ctx.Abort()
			return
		}
		ctx.JSON(http.StatusOK, data)
		ctx.Abort()
		return
	}
}

func HandlerAdminWrap(fn MyHandlerFunc) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		start := util.NewUsageTimer()
		logT := logrus.WithField("url", ctx.Request.RequestURI).WithField("remoteIp", ctx.ClientIP())
		if CfgLogSysHttpIn.Load() {
			buf, err := io.ReadAll(ctx.Request.Body)
			if err == nil {
				logT.WithField("z-content", util.TruncateUTF8StringEfficient(string(buf), 1024)).Info("httpHandler-IN")
				ctx.Request.Body = io.NopCloser(bytes.NewBuffer(buf))
			}
		}
		var rsp CommRsp
		if data, err := fn(ctx); err != nil {
			logT = logT.WithError(err)
			logT.WithField("!", nil).WithField("usage", start.UsageMs()).Error("httpHandler-fail")
			rsp = GetErrRsp(err)
		} else {
			rsp = CommRsp{Data: data}
		}
		rspPlain, err := json.Marshal(rsp)
		if err != nil {
			logT.WithField("!", nil).WithField("usage", start.UsageMs()).Error("httpHandler-Marshal-fail")
			ctx.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		HttpCorsHeaderSet(ctx.Writer)
		ctx.Data(http.StatusOK, "text/plain;charset=utf-8", rspPlain)
		if CfgLogSysHttpOut.Load() {
			smallLen := len(rspPlain)
			if smallLen > 512 {
				smallLen = 512
			}
			logT.WithField("usage", start.UsageMs()).WithField("z-content", util.TruncateUTF8StringEfficient(string(rspPlain), smallLen)).Info("httpHandler-OK")
		}
		ctx.Abort()
	}
}

func HandlerWrap(fn MyHandlerFunc) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		start := util.NewUsageTimer()
		//did := ctx.GetString(PostDid)
		plat := ctx.GetInt(PostPlat)
		userId := ctx.GetString(TokenId)
		ver := ctx.GetString(PostVer)
		logT := logrus.WithField(
			"url", ctx.Request.RequestURI).WithField(
			"remoteIp", ctx.ClientIP()).WithField(
			"plat", plat).WithField(
			"ver", ver)
		//if did != "" {
		//	logT = logT.WithField("did", did)
		//}
		if userId != "" {
			logT = logT.WithField("uid", userId)
		}
		if CfgLogSysHttpIn.Load() {
			buf, err := io.ReadAll(ctx.Request.Body)
			if err == nil {
				logT.WithField("z-content", string(buf)).WithField("$", funcline.GetLineByFuncForPerformance(func() {})).Info("httpHandler-IN")
				ctx.Request.Body = io.NopCloser(bytes.NewBuffer(buf))
			}
		}
		var rsp CommRsp
		if data, err := fn(ctx); err != nil {
			logT.WithError(err).WithField(
				"!", alert.Limit30Hit1M).WithField(
				"usage", start.UsageMs()).WithField(
				"$", funcline.GetLineByFuncForPerformance(func() {})).Error(
				"httpHandler-fail")
			rsp = GetErrRsp(err)
		} else {
			//ctx.JSON(http.StatusOK, CommRsp{Data: data})
			rsp = CommRsp{Data: data}
		}
		if IsProto(ctx) {
			rspNormalJson(http.StatusOK, rsp, ctx, logT, start)
		} else {
			rspAesJson(http.StatusOK, rsp, ctx, logT, start)
		}
		ctx.Abort()
	}
}

func TaskPanicRecover() {
	if err := recover(); err != nil {
		const size = 64 << 10
		buf := make([]byte, size)
		buf = buf[:runtime.Stack(buf, false)]
		logrus.WithField("!", alert.Limit).WithField("buf", string(buf)).Error("taskPanicRecover")
	}
}
