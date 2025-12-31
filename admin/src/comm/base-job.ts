import { IJob } from '@midwayjs/cron';
import { Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';

import { TelegramService } from '../modules/base/service/common/telegram';
import { SettingConfigInfoService } from '../modules/setting/service/config/info';
import { Utils } from './utils';
import { Logger } from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';

// 自定义定时器时间规则
export const CRONTAB_CUSTOM = {
  EVERY_PER_3_SECOND: '*/3 * * * * *', // 每隔3秒
  EVERY_DAY_START: '0 0 0 * * *', // 每日00:00:00
  EVERY_MONTH_START: '0 0 0 1 * *', // 每个月的1号00:00:00
};

export abstract class BaseJob implements IJob {
  @Inject()
  ctx: Context;

  @Inject()
  utils: Utils;

  @Logger()
  logger: ILogger;

  @Inject()
  telegramService: TelegramService;

  @Inject()
  configService: SettingConfigInfoService;

  async onTick(): Promise<void> {
    // Job任务中不会抛出错误，需要捕获
    try {
      await this.doTask();
    } catch (err) {
      await this.telegramService.sendError(err);
      this.logger.error(err);
    }
  }

  abstract doTask(): Promise<void>;
}
