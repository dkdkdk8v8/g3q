import { ModuleConfig } from '@cool-midway/core';

/**
 * 关于游戏相关的所有配置
 */
export default () => {
  return {
    // 模块名称
    name: '游戏配置',
    // 模块描述
    description: '关于游戏相关的所有配置',
    // 中间件，只对本模块有效
    middlewares: [],
    // 中间件，全局有效
    globalMiddlewares: [],
    // 模块加载顺序，默认为0，值越大越优先加载
    order: 0,
  } as ModuleConfig;
};
