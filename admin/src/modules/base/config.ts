import { BaseLogMiddleware } from './middleware/log';
import { BaseAuthorityMiddleware } from './middleware/authority';
import { ModuleConfig } from '@cool-midway/core';

/**
 * 模块的配置
 */
export default () => {
  return {
    // 模块名称
    name: '权限管理',
    // 模块描述
    description: '基础的权限管理功能，包括登录，权限校验',
    // 中间件
    globalMiddlewares: [BaseAuthorityMiddleware, BaseLogMiddleware],
    // 模块加载顺序，默认为0，值越大越优先加载
    order: 10,
    // app参数配置允许读取的key
    allowKeys: [],
    // jwt 生成解密token的
    jwt: {
      // 单点登录
      sso: false,
      secret: 'df0db6c32ada2f0e9ab54e3017a19877', // hsxs md5 md5 md5
      // token
      token: {
        // 2小时过期，需要用刷新token
        expire: 2 * 3600,
        // 15天内，如果没操作过就需要重新登录
        refreshExpire: 24 * 3600 * 15,
      },
    },
  } as ModuleConfig;
};
