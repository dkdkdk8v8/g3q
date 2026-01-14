import { Middleware } from '@midwayjs/decorator';
import { NextFunction, Context } from '@midwayjs/koa';
import { IMiddleware } from '@midwayjs/core';
import * as zlib from 'zlib';
import { promisify } from 'util';

/**
 * Gzip中间件
 */
@Middleware()
export class BaseGzipMiddleware implements IMiddleware<Context, NextFunction> {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      await next();

      const body: any = ctx.body;
      if (!body) {
        return;
      }

      // 如果已经设置了 Content-Encoding，则跳过
      if (ctx.response.get('Content-Encoding')) {
        return;
      }

      // 检查客户端是否支持 gzip
      if (!ctx.acceptsEncodings('gzip')) {
        return;
      }

      // 如果是流，使用管道压缩
      if (typeof body.pipe === 'function') {
        ctx.body = body.pipe(zlib.createGzip());
        ctx.set('Content-Encoding', 'gzip');
        ctx.remove('Content-Length');
        return;
      }

      // 处理普通数据
      let content = body;

      // 如果是对象且不是Buffer，转为JSON字符串
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        content = JSON.stringify(body);
        if (!ctx.response.get('Content-Type')) {
          ctx.set('Content-Type', 'application/json; charset=utf-8');
        }
      }

      // 压缩
      try {
        const gzip = promisify(zlib.gzip);
        const data = await gzip(content);
        ctx.body = data;
        ctx.set('Content-Encoding', 'gzip');
        ctx.remove('Content-Length');
      } catch (err) {
        console.error('Gzip compression failed', err);
      }
    };
  }
}
