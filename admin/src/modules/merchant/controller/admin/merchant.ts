import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Inject, Post, Provide } from '@midwayjs/decorator';
import { MerchantEntity } from '../../entity/merchant';
import { MerchantService } from '../../service/merchant';

/**
 * 运营商管理
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: MerchantEntity,
  service: MerchantService,
  pageQueryOp: {
    fieldEq: ['enable', 'merchantType'],
    keyWordLikeFields: ['merchantName', 'appId', 'remark'],
  },
})
export class MerchantController extends BaseController {
  @Inject()
  merchantService: MerchantService;

  @Post('/resetSecret', { summary: '重置密钥' })
  async resetSecret(@Body('id') id: number) {
    return this.ok(await this.merchantService.resetSecret(id));
  }

  @Post('/testLaunchGame', { summary: '测试启动游戏链接' })
  async testLaunchGame(@Body() body: any) {
    return this.ok(await this.merchantService.testLaunchGame(body));
  }
}
