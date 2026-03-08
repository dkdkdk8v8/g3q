import { Body, Inject, Post, Provide } from '@midwayjs/decorator';
import { CoolController, BaseController } from '@cool-midway/core';
import { MerchantApiService } from '../../service/merchant-api';
import { Context } from '@midwayjs/koa';

/**
 * 运营商对外API（不需要admin登录，通过签名验证）
 * 路径前缀：/open/merchant（线上经 /api 反向代理后为 /api/open/merchant）
 * ctx.merchant 由 MerchantAuthMiddleware 注入，包含 appId
 *
 * 响应格式：{ code: 0, message: 'success', data } —— 不使用框架默认的 1000
 * 错误码体系：
 *   10xx — 认证相关（中间件处理）
 *   2001 — playerId 缺失
 *   2002 — gameCode 缺失
 *   2003 — amount 必须大于 0
 *   2004 — orderId 缺失
 *   3001 — 玩家不存在
 *   3002 — 余额不足
 *   3003 — 玩家在游戏中，无法转出
 *   3004 — 踢出玩家失败
 *   3005 — 游戏服务不可用
 *   9999 — 系统内部错误
 */
@Provide()
@CoolController('/open/merchant')
export class MerchantOpenApiController extends BaseController {
  @Inject()
  merchantApiService: MerchantApiService;

  @Inject()
  ctx: Context;

  /** 标准成功响应 */
  private success(data?: any) {
    return { code: 0, message: 'success', data };
  }

  /** 标准失败响应 */
  private error(code: number, message: string) {
    return { code, message };
  }

  /** 从中间件注入的 merchant 对象上取 appId */
  private getAppId(): string {
    return (this.ctx as any).merchant?.appId;
  }

  @Post('/launchGame', { summary: '启动游戏' })
  async launchGame(@Body() body: any) {
    const { playerId, nickname, avatar, gameCode, mode } = body;
    if (!playerId) return this.error(2001, 'playerId is required');
    if (!gameCode) return this.error(2002, 'gameCode is required');
    try {
      const result = await this.merchantApiService.launchGame({
        appId: this.getAppId(),
        playerId,
        nickname,
        avatar,
        gameCode,
        mode,
      });
      return this.success(result);
    } catch (e) {
      return this.error(e.code || 9999, e.message);
    }
  }

  @Post('/balance', { summary: '获取余额' })
  async balance(@Body() body: any) {
    const { playerId } = body;
    if (!playerId) return this.error(2001, 'playerId is required');
    try {
      const result = await this.merchantApiService.getBalance(
        this.getAppId(),
        playerId,
      );
      return this.success(result);
    } catch (e) {
      return this.error(e.code || 9999, e.message);
    }
  }

  @Post('/transferIn', { summary: '转入（充值）' })
  async transferIn(@Body() body: any) {
    const { playerId, amount, orderId, nickname, avatar } = body;
    if (!playerId) return this.error(2001, 'playerId is required');
    if (!amount || amount <= 0) return this.error(2003, 'amount must be positive');
    if (!orderId) return this.error(2004, 'orderId is required');
    try {
      const result = await this.merchantApiService.transferIn({
        appId: this.getAppId(),
        playerId,
        amount,
        orderId,
        nickname,
        avatar,
      });
      return this.success(result);
    } catch (e) {
      return this.error(e.code || 9999, e.message);
    }
  }

  @Post('/transferOut', { summary: '转出（提现）' })
  async transferOut(@Body() body: any) {
    const { playerId, amount, orderId } = body;
    if (!playerId) return this.error(2001, 'playerId is required');
    if (!amount || amount <= 0) return this.error(2003, 'amount must be positive');
    if (!orderId) return this.error(2004, 'orderId is required');
    try {
      const result = await this.merchantApiService.transferOut({
        appId: this.getAppId(),
        playerId,
        amount,
        orderId,
      });
      return this.success(result);
    } catch (e) {
      return this.error(e.code || 9999, e.message);
    }
  }

  @Post('/kick', { summary: '踢出玩家' })
  async kick(@Body() body: any) {
    const { playerId } = body;
    if (!playerId) return this.error(2001, 'playerId is required');
    try {
      const result = await this.merchantApiService.kickPlayer(
        this.getAppId(),
        playerId,
      );
      return this.success(result);
    } catch (e) {
      return this.error(e.code || 9999, e.message);
    }
  }

  @Post('/online', { summary: '查询在线状态' })
  async online(@Body() body: any) {
    const { playerId } = body;
    if (!playerId) return this.error(2001, 'playerId is required');
    try {
      const result = await this.merchantApiService.getOnlineStatus(
        this.getAppId(),
        playerId,
      );
      return this.success(result);
    } catch (e) {
      return this.error(e.code || 9999, e.message);
    }
  }

  @Post('/betRecords', { summary: '查询投注记录' })
  async betRecords(@Body() body: any) {
    const { playerId, startTime, endTime, page, size } = body;
    try {
      const result = await this.merchantApiService.getBetRecords({
        appId: this.getAppId(),
        playerId,
        startTime,
        endTime,
        page,
        size,
      });
      return this.success(result);
    } catch (e) {
      return this.error(e.code || 9999, e.message);
    }
  }
}
