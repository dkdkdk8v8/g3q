import { IJob, Job } from '@midwayjs/cron';
import { Inject } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { CachingFactory, MidwayCache } from '@midwayjs/cache-manager';
import { MoreThan, Repository } from 'typeorm';
import * as moment from 'moment';

import { FORMAT, ILogger, InjectClient } from '@midwayjs/core';
import { StaPeriodEntity } from '../entity/sta-period';
import { GameUserEntity } from '../entityGame/user';
import { GameRecordEntity } from '../entityGame/game-record';
import { StaUserEntity } from '../entity/sta-user';
import { StaPeriodService } from '../service/sta-period';

interface StatsData {
  timeKey: Date;
  appId: string;
  gameUserCount: number;
  gameCount: number;
  betCount: number;
  betAmount: number;
  gameWin: number;
  firstGameUserCount: number;
  firstGameUserIds: string[];
}

interface UserStatsData {
  date: Date;
  userId: string;
  appId: string;
  betCount: number;
  betAmount: number;
  winCount: number;
  bankerCount: number;
  betWin: number;
}

@Job({
  cronTime: FORMAT.CRONTAB.EVERY_PER_5_SECOND,
  runOnInit: false,
  start: ['production'].includes(process.env.NODE_ENV),
})
export class StaPeriodJob implements IJob {

  @Inject()
  logger: ILogger;


  @InjectClient(CachingFactory, 'default')
  midwayCache: MidwayCache;

  @InjectEntityModel(GameUserEntity)
  userEntity: Repository<GameUserEntity>;

  @Inject()
  staPeriodService: StaPeriodService;

  @InjectEntityModel(GameRecordEntity)
  recordEntity: Repository<GameRecordEntity>;

  @InjectEntityModel(StaPeriodEntity)
  staPeriodEntity: Repository<StaPeriodEntity>;

  @InjectEntityModel(StaUserEntity)
  staUserEntity: Repository<StaUserEntity>;

  private static isRunning = false;

  async getLastId() {
    let lastId = await this.midwayCache.get('game:sta:lastId');
    if (!lastId) return 0;
    return Number(lastId);
  }

  async setLastId(id: number) {
    await this.midwayCache.set('game:sta:lastId', id);
  }

  /**
   * 获取时间分片Key
   */
  private getTimeKey(date: Date): Date {
    const recordTime = moment(date);
    recordTime.minute(Math.floor(recordTime.minute() / 10) * 10).second(0).millisecond(0);
    return recordTime.toDate();
  }

  /**
   * 获取或初始化统计对象
   */
  private getStats(statsMap: Map<string, StatsData>, timeKey: Date, appId: string): StatsData {
    const mapKey = `${timeKey.getTime()}_${appId}`;
    if (!statsMap.has(mapKey)) {
      statsMap.set(mapKey, {
        timeKey,
        appId,
        gameUserCount: 0,
        gameCount: 0,
        betCount: 0,
        betAmount: 0,
        gameWin: 0,
        firstGameUserCount: 0,
        firstGameUserIds: [],
      });
    }
    return statsMap.get(mapKey);
  }

  /**
   * 保存统计数据
   */
  private async saveStats(statsMap: Map<string, StatsData>) {
    if (statsMap.size === 0) return;
    const dataSource = this.staPeriodEntity.manager.connection;
    await dataSource.transaction(async manager => {
      for (const stats of statsMap.values()) {
        this.logger.info(stats.timeKey, stats.appId, stats.gameCount);
        let entity = await manager.findOne(StaPeriodEntity, {
          where: { timeKey: stats.timeKey, appId: stats.appId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!entity) {
          entity = new StaPeriodEntity();
          entity.timeKey = stats.timeKey;
          entity.appId = stats.appId;
          entity.gameUserCount = 0;
          entity.gameCount = 0;
          entity.betCount = 0;
          entity.betAmount = 0;
          entity.gameWin = 0;
          entity.firstGameUserCount = 0;
          entity.firstGameUserIds = [];
        }
        entity.gameUserCount += stats.gameUserCount;
        entity.gameCount += stats.gameCount;
        entity.betCount += stats.betCount;
        entity.betAmount += stats.betAmount;
        entity.gameWin += stats.gameWin;
        entity.firstGameUserCount += stats.firstGameUserCount;

        const existingIds = Array.isArray(entity.firstGameUserIds) ? entity.firstGameUserIds : [];
        entity.firstGameUserIds = [...existingIds, ...stats.firstGameUserIds];

        await manager.save(entity);
      }
    });
  }

  /**
   * 保存用户统计数据
   */
  private async saveUserStats(userStatsMap: Map<string, UserStatsData>) {
    if (userStatsMap.size === 0) return;
    const dataSource = this.staUserEntity.manager.connection;
    await dataSource.transaction(async manager => {
      for (const stats of userStatsMap.values()) {
        let entity = await manager.findOne(StaUserEntity, {
          where: { date: stats.date, userId: stats.userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!entity) {
          entity = new StaUserEntity();
          entity.date = stats.date;
          entity.userId = stats.userId;
          entity.appId = stats.appId;
          entity.betCount = 0;
          entity.betAmount = 0;
          entity.winCount = 0;
          entity.bankerCount = 0;
          entity.betWin = 0;
        }

        entity.betCount = (entity.betCount || 0) + stats.betCount;
        entity.betAmount = (Number(entity.betAmount) || 0) + stats.betAmount;
        entity.winCount = (entity.winCount || 0) + stats.winCount;
        entity.bankerCount = (entity.bankerCount || 0) + stats.bankerCount;
        entity.betWin = (Number(entity.betWin) || 0) + stats.betWin;

        await manager.save(entity);
      }
    });
  }

  async onTick(): Promise<void> {
    if (StaPeriodJob.isRunning) {
      return;
    }
    StaPeriodJob.isRunning = true;
    try {
      const lastId = await this.getLastId();
      const records = await this.recordEntity.find({
        where: { id: MoreThan(lastId) },
        order: { id: 'ASC' },
        take: 200,
      });
      this.logger.info(`开始处理id大于${lastId}的数据，共${records.length}条`);
      const statsMap = new Map<string, StatsData>();
      const userStatsMap = new Map<string, UserStatsData>();
      let newLastId = lastId;

      for (const record of records) {
        const gameData = JSON.parse(record.game_data);
        const { Room } = gameData;
        let { Players = [] } = Room;
        const { BankerID } = Room;

        const timeKey = this.getTimeKey(record.create_at);
        const dateKey = moment(record.create_at).startOf('day').toDate();

        Players = Players.filter(Boolean);
        const involvedApps = new Set<string>();

        for (const player of Players) {
          const { ID, IsOb, BalanceChange, ValidBet } = player;
          if (IsOb) continue;

          const user = await this.userEntity.findOne({ where: { user_id: ID } });
          const app_id = user?.app_id || '';
          if (!user) continue;
          // if (user.is_robot) continue; 
          involvedApps.add(app_id);

          const stats = this.getStats(statsMap, timeKey, app_id);

          stats.betCount++;
          stats.betAmount += Math.abs(ValidBet);

          // 平台盈亏 = 用户输赢的负数
          stats.gameWin += -1 * (Number(BalanceChange) || 0);

          // 首次游戏判断
          if (await this.staPeriodService.isFirstGame(ID, record.id)) {
            stats.firstGameUserCount += 1;
            stats.firstGameUserIds.push(ID);
          }

          // 活跃用户按天去重
          if (await this.staPeriodService.isDailyActive(timeKey, ID)) {
            stats.gameUserCount += 1;
          }

          // 用户数据统计
          const userKey = `${dateKey.getTime()}_${ID}`;
          if (!userStatsMap.has(userKey)) {
            userStatsMap.set(userKey, {
              date: dateKey,
              userId: ID,
              appId: app_id,
              betCount: 0,
              betAmount: 0,
              winCount: 0,
              bankerCount: 0,
              betWin: 0,
            });
          }
          const uStats = userStatsMap.get(userKey);
          uStats.betCount++;
          uStats.betAmount += Math.abs(ValidBet);
          uStats.betWin += (Number(BalanceChange) || 0);
          if ((Number(BalanceChange) || 0) > 0) {
            uStats.winCount++;
          }
          if (BankerID && String(BankerID) === String(ID)) {
            uStats.bankerCount++;
          }
        }

        // 增加游戏次数 (每个涉及的APP都+1)
        for (const appId of involvedApps) {
          const stats = this.getStats(statsMap, timeKey, appId);
          stats.gameCount += 1;
        }

        newLastId = record.id;
      }
      await this.saveStats(statsMap);
      await this.saveUserStats(userStatsMap);
      if (newLastId > lastId) {
        await this.setLastId(newLastId);
      }
    } catch (e) {
      this.logger.error(e);
    } finally {
      StaPeriodJob.isRunning = false;
    }
  }
}
