import { CoolConfig, CoolCacheStore, MODETYPE } from '@cool-midway/core';
import { MidwayConfig } from '@midwayjs/core';

// redis缓存
// import { redisStore } from 'cache-manager-ioredis-yet';

export default {
  keys: 'a0d154c4f510182bcbf52a4e9cb0d123',
  koa: {
    port: 8001,
  },
  // 模板渲染
  view: {
    mapping: {
      '.html': 'ejs',
    },
  },
  // 静态文件配置
  staticFile: {
    buffer: true,
  },
  // 文件上传
  upload: {
    fileSize: '200mb',
    whitelist: null,
  },
  // 缓存 可切换成其他缓存如：redis http://www.midwayjs.org/docs/extensions/caching
  cacheManager: {
    clients: {
      default: {
        store: CoolCacheStore,
        options: {
          path: 'cache',
          ttl: 0,
        },
      },
    },
  },
  puppeteer: {
    launchOptions: {
      headless: true,
      timeout: 60 * 1000,
      userDataDir: './chrome-profile/default',
    },
  },
  cool: {
    file: {
      mode: MODETYPE.CLOUD,
    },
    // crud配置
    crud: {
      // 插入模式，save不会校验字段(允许传入不存在的字段)，insert会校验字段
      upsert: 'save',
      // 软删除
      softDelete: true,
    },
  } as CoolConfig,
} as MidwayConfig;
