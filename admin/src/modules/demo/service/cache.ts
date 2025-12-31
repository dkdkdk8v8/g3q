import { Provide } from '@midwayjs/decorator';
import { CoolCache } from '@cool-midway/core';

/**
 * 缓存
 */
@Provide()
export class DemoCacheService {
  // 数据缓存5秒
  @CoolCache(5)
  async get() {
    return {
      a: 1,
      b: 2,
    };
  }
}
