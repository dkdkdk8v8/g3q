package comm

import (
	"bytes"
	"compoment/alert"
	"compoment/crypto"
	"compoment/util"
	"compoment/util/limiter"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/didip/tollbooth/v7"
	tLImiter "github.com/didip/tollbooth/v7/limiter"

	//"github.com/didip/tollbooth/v7"
	//"github.com/didip/tollbooth/v7/limiter"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"io"
	"net/http"
	"strings"
)

const AppId = "XAPP"
const PostDid = "XDid"
const PostPlat = "XPlat"
const TokenId = "XId"
const PostVer = "XVer"
const ZAuth = "XAuth"
const DEFCode = "XCode"
const PostUUID = "XUuid" //UUID 只有注册时候判断设备唯一性，客户端得到did覆盖本地id，并且每次通过XDID 带上来进行登录

type PostSignCheck struct {
	AppId      string `json:"A"`
	RandStr    string `json:"R"`
	Did        string `json:"D"`
	Plat       int    `json:"F"`
	Ts         string `json:"T"`
	Version    string `json:"V"`
	PostBody   string `json:"P"`
	Code       string `json:"C"`
	Sign       string `json:"S"`
	ClientUUID string `json:"N"` //客户端的唯一id，重新删app，重新安装，理论上一样，可能会同机型有冲突（有待检查）
}

type SignAddItem struct {
	Sign string
	Num  int
}

func (s *SignAddItem) MergeItem(n IKeyValueItem) error {
	convertOld, ok := n.(*SignAddItem)
	if ok {
		s.Num += convertOld.Num
	} else {
		return errors.New("SignAddItemConvert-Fail")
	}
	return nil
}

func (s *SignAddItem) GetKey() *string {
	return &s.Sign
}

func PostSign(ctx *gin.Context) {
	if ctx.Request.Method != http.MethodPost {
		ctx.AbortWithStatus(http.StatusBadRequest)
		return
	}
	buf, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		logrus.WithField("!", alert.Limit).WithField(
			"uri", ctx.Request.RequestURI).WithField(
			"ip", ctx.ClientIP()).Error("postSignReadFail")
		ctx.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var psc PostSignCheck
	if err := json.Unmarshal(buf, &psc); err != nil {
		if strings.HasPrefix(ctx.Request.RequestURI, "/api") {
			logrus.WithField("!", alert.Limit30Hit1M).WithField(
				"uri", ctx.Request.RequestURI).WithField(
				"ip", ctx.ClientIP()).WithError(err).Error("postSignJsonFail")
		}
		ctx.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if IsDebugEnv(ctx) {
		//pass
	} else {
		if KvStore != nil {
			saveItem, err := KvStore.AddValue(&SignAddItem{Sign: psc.Sign, Num: 1})
			if err == nil {
				if convertSaveItem, ok := saveItem.(*SignAddItem); ok {
					if convertSaveItem.Num >= 3 {
						logrus.WithField("!", alert.Limit).WithField(
							"uri", ctx.Request.RequestURI).WithField(
							"ip", ctx.ClientIP()).WithField(
							"sign", convertSaveItem.Sign).WithField(
							"num", convertSaveItem.Num).Error("signReuseLimit")
						ctx.AbortWithStatus(http.StatusBadRequest)
						return
					}
				}
			}
		}
		checkSign := util.Md5([]byte(fmt.Sprintf("%s%s%d%s%s%s%s", psc.RandStr, psc.Did, psc.Plat, psc.Ts, psc.Version, psc.PostBody, PostSignKey)))
		if checkSign != psc.Sign {
			logrus.WithField("!", alert.Limit).WithField(
				"uri", ctx.Request.RequestURI).WithField(
				"ip", ctx.ClientIP()).WithField(
				"sign", psc.Sign).WithField(
				"checkSign", checkSign).Error("postSignCheckFail")
			ctx.AbortWithStatus(http.StatusForbidden)
			return
		}
		//sign check used

	}

	ctx.Set(PostDid, psc.Did)
	ctx.Set(PostPlat, psc.Plat)
	//ctx.Set(DEVICE, psc.Device)
	ctx.Set(DEFCode, psc.Code)
	ctx.Set(PostUUID, psc.ClientUUID)
	ctx.Set(PostVer, psc.Version)
	ctx.Set(AppId, psc.AppId)
	ctx.Request.Body = io.NopCloser(bytes.NewBufferString(psc.PostBody))
}

func MidToken(ctx *gin.Context) {
	start := util.NewUsageTimer()
	// 从请求头中获取Token
	token := ctx.GetHeader(ZAuth)
	code := ctx.GetString(DEFCode)
	did := ctx.GetString(PostDid)
	uuid := ctx.GetString(PostUUID)

	if IsDebugEnv(ctx) {
		//pass
		userId := ctx.GetHeader("userid")
		ctx.Set(TokenId, userId)
		ctx.Set(PostDid, "test")
	} else {
		// 验证Token
		t, err := VerifyToken(token)
		if err != nil {
			logT := logrus.WithField("token", token)
			logT.WithError(err).Error("VerifyTokenInvalid")
			rsp := GetErrRsp(err)
			rspAesJson(http.StatusOK, rsp, ctx, logT, start)
			ctx.Abort()
			return
		}
		go LogToken(t.ID, did, code, t.Plat, ctx.ClientIP(), uuid)
		ctx.Set(TokenId, t.ID)
	}
}

func MidLimitByIp(l *limiter.KeyLimiter) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ip := ctx.ClientIP()
		if !l.Allow(ip) {
			headerJson, _ := json.Marshal(ctx.Request.Header)
			logT := logrus.WithField("!", alert.Limit).WithField(
				"uri", ctx.Request.RequestURI).WithField(
				"ip", ctx.ClientIP()).WithField(
				"header", string(headerJson))
			_, err := ctx.Writer.WriteString("ipLimit")
			if err != nil {
				logT.WithError(err).Error("midIpLimit")
			} else {
				logT.Error("ipLimit")
			}
			ctx.AbortWithStatus(http.StatusForbidden)
		}
	}
}

func MidLimitByTokenIdAndPath(l *limiter.KeyLimiter) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString(TokenId)
		if userId == "" {
			return
		}
		if ctx.Request.RequestURI == "" {
			return
		}
		if err := l.Wait(userId + ctx.Request.RequestURI); err != nil {
			headerJson, _ := json.Marshal(ctx.Request.Header)
			logT := logrus.WithField("!", alert.Limit).WithField(
				"userId", userId).WithField(
				"uri", ctx.Request.RequestURI).WithField(
				"ip", ctx.ClientIP()).WithField(
				"header", string(headerJson))
			_, err := ctx.Writer.WriteString("TokenPathLimit")
			if err != nil {
				logT.WithError(err).Error("TokenPathLimit")
			} else {
				logT.Error("TokenPathLimit")
			}
			//todo 给客户端返回特定的rsp的code频率太快，稍后请求
			ctx.AbortWithStatus(http.StatusForbidden)
		}
	}
}

func MidIpLimit(l *tLImiter.Limiter) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		httpError := tollbooth.LimitByRequest(l, ctx.Writer, ctx.Request)
		if httpError != nil {
			headerJson, _ := json.Marshal(ctx.Request.Header)
			logT := logrus.WithField("!", alert.Limit).WithField(
				"uri", ctx.Request.RequestURI).WithField(
				"ip", ctx.ClientIP()).WithField(
				"header", string(headerJson))
			_, err := ctx.Writer.WriteString(httpError.Message)
			if err != nil {
				logT.WithError(err).Error("midIpLimit")
			} else {
				logT.WithError(httpError).Error("ipLimit")
			}
			ctx.AbortWithStatus(http.StatusForbidden)
		}
	}
}

func MidPostAes() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if ctx.Request.Method != http.MethodPost {
			ctx.AbortWithStatus(http.StatusBadRequest)
			return
		}
		proto := ctx.GetHeader("proto")
		if proto == "" {
			//default aes
			buf, err := io.ReadAll(ctx.Request.Body)
			if err != nil {
				headerJson, _ := json.Marshal(ctx.Request.Header)
				logrus.WithField("!", alert.Limit5Hit1M).WithField(
					"uri", ctx.Request.RequestURI).WithField(
					"ip", ctx.ClientIP()).WithField(
					"header", string(headerJson)).Error("midAesReadFail")
				ctx.AbortWithStatus(http.StatusBadRequest)
				return
			}
			b64DecBuf, err := base64.StdEncoding.DecodeString(string(buf))
			if err != nil {
				if strings.HasPrefix(ctx.Request.RequestURI, "/api") {
					headerJson, _ := json.Marshal(ctx.Request.Header)
					logrus.WithField("!", alert.Limit5Hit1M).WithField(
						"uri", ctx.Request.RequestURI).WithField(
						"ip", ctx.ClientIP()).WithField(
						"header", string(headerJson)).WithField("buf", string(buf)).Error("midAesB64Fail")
				}
				ctx.AbortWithStatus(http.StatusBadRequest)
				return
			}
			aes := crypto.NewAesCBCDiy([]byte(ProtoAesKey), crypto.PAD_MODE_PKCS7PADDING)
			decBody, err := aes.Decrypt(b64DecBuf)
			if err != nil {
				headerJson, _ := json.Marshal(ctx.Request.Header)
				logrus.WithField("!", alert.Limit5Hit1M).WithField(
					"uri", ctx.Request.RequestURI).WithField(
					"ip", ctx.ClientIP()).WithField(
					"header", string(headerJson)).Error("midAesDecryptFail")
				ctx.AbortWithStatus(http.StatusBadRequest)
				return
			}
			ctx.Header("proto", "")
			ctx.Request.Body = io.NopCloser(bytes.NewBuffer(decBody))
		} else if proto == "json" {
			//pass

		} else {
			ctx.AbortWithStatus(http.StatusForbidden)
		}
	}
}

func HttpCorsHeaderSet(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	w.Header().Set("Access-Control-Max-Age", "86400")
}

func HttpStatisticCorsHeaderSet(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	w.Header().Set("Access-Control-Max-Age", "86400")
}

func HttpStatisticCorsHeaderSetForCacheFile(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	w.Header().Set("Access-Control-Max-Age", "86400")
	//w.Header().Set("Cache-Control", "604800")
}

func MidOptionCors(ctx *gin.Context) {
	if ctx.Request.Method == http.MethodOptions {
		HttpCorsHeaderSet(ctx.Writer)
		ctx.AbortWithStatus(http.StatusOK)
		return
	}
}

func MidOptionCorsForStatic(ctx *gin.Context) {
	HttpCorsHeaderSet(ctx.Writer)
}
