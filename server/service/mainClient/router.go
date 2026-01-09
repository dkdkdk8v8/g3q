package mainClient

import (
	"compoment/util/limiter"
	"net/http/pprof"
	"service/comm"
	"time"

	"github.com/gin-gonic/gin"
)

func InitWebHandler(engine *gin.Engine) error {
	var ipLimiter = limiter.NewKeyLimiter(time.Millisecond*100, 10, nil)
	// 基础中间件：仅保留限流和跨域，这对 WebSocket 握手是友好的
	baseGroup := engine.Use(comm.MidLimitByIp(ipLimiter), comm.MidOptionCors)

	// 纯 WebSocket 入口
	// 鉴权，在 WSEntry 内部通过 URL 参数 (Query) 获取 Token 进行校验
	baseGroup.GET("/ws", WSEntry)

	ipLimiterGroup := baseGroup
	ipLimiterGroup.GET("/api/health", comm.Health)
	ipLimiterGroup.GET("/api-speed", comm.ApiSpeed)

	return nil
}

func InitAdminWebHandler(engine *gin.Engine) error {
	// 基础中间件：仅保留限流和跨域，这对 WebSocket 握手是友好的
	baseGroup := engine.Use(comm.MidOptionCors)
	baseGroup.GET("/rpc/ws", WSEntry)
	baseGroup.GET("/rpc/qznn-data", RpcQZNNData)
	baseGroup.GET("/ping", comm.HandlerAdminWrap(Ping))
	baseGroup.GET("/deposit", comm.HandlerAdminWrap(Deposit))
	baseGroup.GET("/withdraw", comm.HandlerAdminWrap(Withdraw))

	// 增加 Basic Auth 验证，防止 pprof 信息泄露
	pprofGroup := engine.Group("/debug/pprof", gin.BasicAuth(gin.Accounts{
		"g3p": "asdflkjh@zzz",
	}))
	{
		pprofGroup.GET("/", gin.WrapF(pprof.Index))
		pprofGroup.GET("/cmdline", gin.WrapF(pprof.Cmdline))
		pprofGroup.GET("/profile", gin.WrapF(pprof.Profile))
		pprofGroup.GET("/symbol", gin.WrapF(pprof.Symbol))
		pprofGroup.GET("/trace", gin.WrapF(pprof.Trace))
		pprofGroup.GET("/allocs", gin.WrapH(pprof.Handler("allocs")))
		pprofGroup.GET("/block", gin.WrapH(pprof.Handler("block")))
		pprofGroup.GET("/goroutine", gin.WrapH(pprof.Handler("goroutine")))
		pprofGroup.GET("/heap", gin.WrapH(pprof.Handler("heap")))
		pprofGroup.GET("/mutex", gin.WrapH(pprof.Handler("mutex")))
		pprofGroup.GET("/threadcreate", gin.WrapH(pprof.Handler("threadcreate")))
	}

	return nil
}
