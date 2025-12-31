package mainClient

import (
	"compoment/util/limiter"
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
