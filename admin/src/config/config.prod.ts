import { CoolConfig } from '@cool-midway/core';
import { MidwayConfig } from '@midwayjs/core';

export default {
  typeorm: {
    dataSource: {
      default: {
        type: 'mysql',
        host: 'database-g3q-instance-1.c1y06igkstt7.ap-east-1.rds.amazonaws.com',
        port: 3306,
        username: 'admin',
        password: 'S40bdYFgTy8uzz6A',
        database: 'g3q_admin',
        // 自动建表 注意：线上部署的时候不要使用，有可能导致数据丢失
        synchronize: false,
        // 打印日志
        logging: false,
        // 字符集
        charset: 'utf8mb4',
        // 是否开启缓存
        cache: true,
        // 实体路径
        entities: ['**/modules/*/entity'],
      },
      game: {
        type: 'mysql',
        host: 'database-g3q-instance-1.c1y06igkstt7.ap-east-1.rds.amazonaws.com',
        port: 3306,
        username: 'admin',
        password: 'S40bdYFgTy8uzz6A',
        database: 'g3q_server',
        // 自动建表 注意：线上部署的时候不要使用，有可能导致数据丢失
        synchronize: false,
        // 打印日志
        logging: false,
        // 字符集
        charset: 'utf8mb4',
        // 是否开启缓存
        cache: false,
        // 实体路径
        entities: ['**/modules/*/entityGame'],
      },
    },
  },
  midwayLogger: {
    default: {
      level: 'info',
    },
  },
  cool: {
    // 实体与路径，跟生成代码、前端请求、swagger文档相关 注意：线上不建议开启，以免暴露敏感信息
    eps: false,
    // 是否自动导入模块数据库
    initDB: true,
    // 判断是否初始化的方式
    initJudge: 'db',
    // 是否自动导入模块菜单
    initMenu: true,
  } as CoolConfig,
} as MidwayConfig;
