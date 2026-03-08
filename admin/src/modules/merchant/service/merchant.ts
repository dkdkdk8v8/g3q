import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantEntity } from '../entity/merchant';
import { MerchantApiService } from './merchant-api';
import * as crypto from 'crypto';

/**
 * 运营商服务
 */
@Provide()
export class MerchantService extends BaseService {
  @InjectEntityModel(MerchantEntity)
  merchantEntity: Repository<MerchantEntity>;

  @Inject()
  merchantApiService: MerchantApiService;

  /**
   * 新增运营商，自动生成 secretKey
   */
  async add(param: any) {
    if (!param.appId) {
      throw new Error('appId is required');
    }
    param.secretKey = this.generateSecretKey();
    return this.merchantEntity.save(param);
  }

  /**
   * 重置密钥
   */
  async resetSecret(id: number) {
    const secretKey = this.generateSecretKey();
    await this.merchantEntity.update(id, { secretKey });
    return { secretKey };
  }

  /**
   * 测试启动游戏：用商户自身凭证调用 launchGame，返回两种模式的结果
   */
  async testLaunchGame(param: { id: number; gameCode?: string; playerId?: string }) {
    const merchant = await this.merchantEntity.findOneBy({ id: param.id } as any);
    if (!merchant) {
      throw new Error('商户不存在');
    }
    if (!merchant.enable) {
      throw new Error('商户已禁用');
    }
    if (merchant.merchantType !== 1) {
      throw new Error('仅测试渠道商户可使用测试链接');
    }

    const appId = merchant.appId;
    const playerId = param.playerId || 'game3q';
    const gameCode = param.gameCode || 'qznn';

    // url 模式
    const urlResult = await this.merchantApiService.launchGame({
      appId,
      playerId,
      gameCode,
    });

    // html 模式
    const htmlResult = await this.merchantApiService.launchGame({
      appId,
      playerId,
      gameCode,
      mode: 'html',
    });

    return {
      url: urlResult.url,
      html: htmlResult.html,
    };
  }

  /**
   * 生成随机密钥
   */
  private generateSecretKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
