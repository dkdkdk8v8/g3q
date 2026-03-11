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
    fieldEq: ['appId'],
    keyWordLikeFields: ['path', 'clientIp'],
    addOrderBy: { createTime: 'DESC' },
    where: async (ctx) => {
      const { statusCode } = ctx.request.body;
      if (statusCode === 0 || statusCode === '0') {
        return [['statusCode = :sc', { sc: 0 }]];
      }
      if (statusCode === 'fail') {
        return [['statusCode != :sc', { sc: 0 }]];
      }
      return [];
    },
  },
})
export class MerchantApiLogController extends BaseController {}
