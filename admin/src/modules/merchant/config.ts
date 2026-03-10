import { ModuleConfig } from '@cool-midway/core';
import { MerchantAuthMiddleware } from './middleware/merchant-auth';

/**
 * 运营商管理模块
 */
export default () => {
  return {
    name: '运营商管理',
    description: '运营商管理及对外API',
    middlewares: [],
    globalMiddlewares: [MerchantAuthMiddleware],
    order: 0,
  } as ModuleConfig;
};
