import {
  Config,
  Inject,
  InjectClient,
  Provide,
  Singleton,
} from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { ILogger } from '@midwayjs/logger';

import * as TelegramBot from 'node-telegram-bot-api';
import { CachingFactory, MidwayCache } from '@midwayjs/cache-manager';
import { TelegramMessageCache } from '../../../third/interface';
import { Context } from '@midwayjs/koa';

@Provide()
@Singleton()
export class TelegramService extends BaseService {
  telegramBotInstance: TelegramBot;

  @InjectClient(CachingFactory, 'default')
  midwayCache: MidwayCache;

  @Config('module.third.telegram.botToken')
  botToken: string;

  @Config('module.third.telegram.chatId')
  chatId: string;

  @Inject()
  logger: ILogger;

  async init() {
    await super.init();
    if (!this.telegramBotInstance) {
      this.telegramBotInstance = new TelegramBot(this.botToken, {
        polling: false,
      });
    }
  }

  private async sendMessage(
    message: string,
    parseMode: '' | 'Markdown' | 'HTML'
  ): Promise<number> {
    try {
      const res = await this.telegramBotInstance.sendMessage(
        this.chatId,
        message,
        {
          parse_mode: parseMode,
        }
      );
      return res?.message_id;
    } catch (e) {
      this.logger.error('TelegramBot发送消息失败.', e);
    }
  }

  async deleteMessage(messageId: number): Promise<void> {
    try {
      await this.telegramBotInstance.deleteMessage(this.chatId, messageId);
    } catch (e) {
      this.logger.error('TelegramBot删除消息失败.', e);
    }
  }

  async sendInfo(info: string): Promise<void> {
    await this.sendMessage(info, '');
  }

  async sendError(err: Error): Promise<void> {
    const message = `\`\`\`javascript
${err.stack}
\`\`\``;
    const lastCacheKey = 'telegram:last';
    let cache: TelegramMessageCache = await this.midwayCache.get(lastCacheKey);
    if (cache && cache.message === message) {
      await this.deleteMessage(cache.id);
    }
    const messageId = await this.sendMessage(message, 'Markdown');
    if (messageId) {
      cache = { id: messageId, message };
      await this.midwayCache.set(lastCacheKey, cache);
    }
  }
}
