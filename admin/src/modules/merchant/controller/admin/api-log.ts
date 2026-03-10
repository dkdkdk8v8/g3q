import { CoolController, BaseController } from '@cool-midway/core';
import { Provide } from '@midwayjs/decorator';
import { MerchantApiLogEntity } from '../../entity/api-log';

/**
 * 运营商API日志管理
 */
@Provide()
@CoolController({
  api: ['page'],
  entity: MerchantApiLogEntity,
  pageQueryOp: {
    fieldEq: ['appId', 'statusCode'],
    keyWordLikeFields: ['path', 'clientIp'],
    addOrderBy: { createTime: 'DESC' },
  },
})
export class MerchantApiLogController extends BaseController {}
