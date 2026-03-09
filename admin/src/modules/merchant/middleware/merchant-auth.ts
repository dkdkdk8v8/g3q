import { Config, Middleware } from '@midwayjs/decorator';
import { NextFunction, Context } from '@midwayjs/koa';
import { IMiddleware } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantEntity } from '../entity/merchant';
import { MerchantApiLogEntity } from '../entity/api-log';
import * as crypto from 'crypto';

/**
 * 运营商API签名验证 + IP白名单中间件
 * 仅对 /open/merchant/ 路径生效
 */
@Middleware()
export class MerchantAuthMiddleware
  implements IMiddleware<Context, NextFunction>
{
  @Config('koa.globalPrefix')
  prefix: string;

  @InjectEntityModel(MerchantEntity)
  merchantEntity: Repository<MerchantEntity>;

  @InjectEntityModel(MerchantApiLogEntity)
  apiLogEntity: Repository<MerchantApiLogEntity>;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      let url = ctx.url;
      if (this.prefix) {
        url = url.replace(this.prefix, '');
      }
      url = url.split('?')[0];

      // 仅对 /open/merchant/ 路径生效
      if (!url.startsWith('/open/merchant/')) {
        await next();
        return;
      }

      const startTime = Date.now();
      const clientIp =
        (ctx.get('X-Forwarded-For') || '').split(',')[0].trim() || ctx.ip;
      const body = ctx.request.body as Record<string, any> || {};
      const appId = body.appId as string;

      // 构造日志记录
      const log = new MerchantApiLogEntity();
      log.path = url;
      log.method = ctx.method;
      log.reqBody = JSON.stringify(body);
      log.clientIp = clientIp;
      log.appId = appId || '';

      const fail = async (code: number, message: string) => {
        const rsp = { code, message };
        ctx.body = rsp;
        log.statusCode = code;
        log.rspBody = JSON.stringify(rsp);
        log.costMs = Date.now() - startTime;
        await this.apiLogEntity.save(log).catch(() => {});
      };

      // 验证必填参数
      if (!appId) {
        await fail(1001, 'appId is required');
        return;
      }

      const timestamp = body.timestamp as number;
      if (!timestamp) {
        await fail(1002, 'timestamp is required');
        return;
      }

      const sign = body.sign as string;
      if (!sign) {
        await fail(1003, 'sign is required');
        return;
      }

      // 查询运营商
      const merchant = await this.merchantEntity.findOneBy({ appId });
      if (!merchant) {
        await fail(1004, 'merchant not found');
        return;
      }

      if (!merchant.enable) {
        await fail(1005, 'merchant is disabled');
        return;
      }

      // 时间戳校验（7天过期）
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 604800) {
        await fail(1007, 'timestamp expired');
        return;
      }

      // 签名校验：将除 sign 以外的参数按 key 排序拼接，加上 secretKey，SHA256
      const expectedSign = this.generateSign(body, merchant.secretKey);
      if (sign !== expectedSign) {
        await fail(1008, 'invalid sign');
        return;
      }

      // 挂载到 ctx 上供后续使用
      ctx.merchant = merchant;

      await next();

      // 记录响应日志
      log.statusCode = (ctx.body as any)?.code ?? 0;
      log.rspBody = JSON.stringify(ctx.body);
      log.costMs = Date.now() - startTime;
      await this.apiLogEntity.save(log).catch(() => {});
    };
  }

  /**
   * 生成签名
   * 规则：将除 sign 以外的所有参数按 key 字母排序，拼接为 key=value& 形式，末尾追加 secretKey，SHA256
   */
  private generateSign(
    params: Record<string, any>,
    secretKey: string,
  ): string {
    const sorted = Object.keys(params)
      .filter(k => k !== 'sign')
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    return crypto
      .createHash('sha256')
      .update(sorted + secretKey)
      .digest('hex');
  }
}
