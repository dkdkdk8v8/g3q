import { IJob, Job } from '@midwayjs/cron';
import { Inject } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { CachingFactory, MidwayCache } from '@midwayjs/cache-manager';
import { MoreThan, Repository, In } from 'typeorm';
import * as moment from 'moment';

import { FORMAT, ILogger, InjectClient } from '@midwayjs/core';
import { StaPeriodEntity } from '../entity/sta-period';
import { GameUserEntity } from '../entityGame/user';
import { GameRecordEntity } from '../entityGame/game-record';
import { StaUserEntity } from '../entity/sta-user';
import { StaPeriodService } from '../service/sta-period';
import { QznnCardUtil } from '../util/qznn-card';

interface StatsData {
  timeKey: Date;
  appId: string;
  gameName: string;
  roomLevel: number;
  roomType: number;
  gameUserCount: number;
  gameCount: number;
  betCount: number;
  betAmount: number;
  gameWin: number;
  firstGameUserCount: number;
  firstGameUserIds: string[];
  cardResult: Record<string, number>;
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
  cronTime: FORMAT.CRONTAB.EVERY_SECOND,
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

  private static COUNT = 10;

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
  private getStats(statsMap: Map<string, StatsData>, timeKey: Date, appId: string, gameName: string, roomLevel: number, roomType: number): StatsData {
    const mapKey = `${timeKey.getTime()}_${appId}_${gameName}_${roomLevel}_${roomType}`;
    if (!statsMap.has(mapKey)) {
      statsMap.set(mapKey, {
        timeKey,
        appId,
        gameName,
        roomLevel,
        roomType,
        gameUserCount: 0,
        gameCount: 0,
        betCount: 0,
        betAmount: 0,
        gameWin: 0,
        firstGameUserCount: 0,
        firstGameUserIds: [],
        cardResult: {},
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
        const where = { timeKey: stats.timeKey, appId: stats.appId, gameName: stats.gameName, roomLevel: stats.roomLevel, roomType: stats.roomType };
        let entity = await manager.findOne(StaPeriodEntity, {
          where,
          lock: { mode: 'pessimistic_write' },
        });
        this.logger.info(where);
        if (!entity) {
          entity = new StaPeriodEntity();
          entity.timeKey = stats.timeKey;
          entity.appId = stats.appId;
          entity.gameName = stats.gameName;
          entity.roomLevel = stats.roomLevel;
          entity.roomType = stats.roomType;
          entity.gameUserCount = 0;
          entity.gameCount = 0;
          entity.betCount = 0;
          entity.betAmount = 0;
          entity.gameWin = 0;
          entity.firstGameUserCount = 0;
          entity.firstGameUserIds = [];
          entity.cardResult = {};
        }
        entity.gameUserCount += stats.gameUserCount;
        entity.gameCount += stats.gameCount;
        entity.betCount += stats.betCount;
        entity.betAmount += stats.betAmount;
        entity.gameWin += stats.gameWin;
        entity.firstGameUserCount += stats.firstGameUserCount;

        const existingIds = Array.isArray(entity.firstGameUserIds) ? entity.firstGameUserIds : [];
        entity.firstGameUserIds = [...existingIds, ...stats.firstGameUserIds];

        const existingCardResult = entity.cardResult || {};
        for (const key in stats.cardResult) {
          existingCardResult[key] = (existingCardResult[key] || 0) + stats.cardResult[key];
        }
        entity.cardResult = existingCardResult;

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

  /**
   * 检查是否首次游戏，带缓存优化
   */
  private async checkIsFirstGame(userId: string, recordId: number): Promise<boolean> {
    const cacheKey = `game:sta:played:${userId}`;
    const hasPlayed = await this.midwayCache.get(cacheKey);
    if (hasPlayed) {
      return false;
    }
    const isFirst = await this.staPeriodService.isFirstGame(userId, recordId);
    if (!isFirst) {
      await this.midwayCache.set(cacheKey, 1, 7 * 24 * 3600);
    }
    return isFirst;
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
        take: StaPeriodJob.COUNT,
      });
      this.logger.info(`开始处理id大于${lastId}的数据，共${records.length}条`);
      const statsMap = new Map<string, StatsData>();
      const userStatsMap = new Map<string, UserStatsData>();
      let newLastId = lastId;

      // 预取用户信息
      const allUserIds = new Set<string>();
      const parsedRecords = [];
      for (const record of records) {
        const gameData = JSON.parse(record.game_data);
        parsedRecords.push({ record, gameData });
        const { Room } = gameData;
        const { Players = [] } = Room;
        for (const player of Players) {
          if (player && player.ID) allUserIds.add(player.ID);
        }
        if (record.id > newLastId) newLastId = record.id;
      }

      const userMap = new Map<string, GameUserEntity>();
      if (allUserIds.size > 0) {
        const users = await this.userEntity.find({ where: { user_id: In([...allUserIds]) } });
        for (const u of users) {
          userMap.set(u.user_id, u);
        }
      }

      const batchActiveUsers = new Set<string>();
      const batchFirstGameUsers = new Set<string>();

      await Promise.all(parsedRecords.map(async ({ record, gameData }) => {
        const { id, game_name, create_at } = record;
        const { Room } = gameData;
        let { Players = [], Config, BankerID } = Room;

        const roomLevel = Config?.Level || 0;
        const roomType = Room?.BankerType || 0;

        const timeKey = this.getTimeKey(create_at);
        const dateKey = moment(create_at).startOf('day').toDate();

        Players = Players.filter(Boolean);
        const involvedGroups = new Set<string>();

        await Promise.all(Players.map(async (player) => {
          const { ID: userId, IsOb, BalanceChange, ValidBet, Cards } = player;
          if (IsOb) return;

          const user = userMap.get(userId);
          const app_id = user?.app_id || '';
          if (!user || user.is_robot) return;
          involvedGroups.add(`${app_id}`);

          const stats = this.getStats(statsMap, timeKey, app_id, game_name, roomLevel, roomType);

          stats.betCount++;
          stats.betAmount += Math.abs(ValidBet);

          // 平台盈亏 = 用户输赢的负数
          stats.gameWin += -1 * (Number(BalanceChange) || 0);

          // 统计牌型
          if (game_name === QznnCardUtil.GameNameQZNN) {
            const cardType = QznnCardUtil.calculateCardResult(Cards);
            stats.cardResult[cardType] = (stats.cardResult[cardType] || 0) + 1;
          }

          // 首次游戏判断
          // 使用 batchFirstGameUsers 防止同批次内同一个新用户被统计多次
          if (!batchFirstGameUsers.has(userId)) {
            batchFirstGameUsers.add(userId); // 先同步标记，防止后续并发进入
            if (await this.checkIsFirstGame(userId, id)) {
              stats.firstGameUserCount += 1;
              stats.firstGameUserIds.push(userId);
            }
          }

          // 活跃用户按天去重
          const dateStr = moment(timeKey).format('YYYY-MM-DD');
          const dauKey = `${dateStr}:${userId}`;
          let isDailyActive = false;
          if (!batchActiveUsers.has(dauKey)) {
            batchActiveUsers.add(dauKey);
            isDailyActive = await this.staPeriodService.isDailyActive(timeKey, userId);
          }

          if (isDailyActive) {
            stats.gameUserCount += 1;
          }

          // 用户数据统计
          const userKey = `${dateKey.getTime()}_${userId}`;
          if (!userStatsMap.has(userKey)) {
            userStatsMap.set(userKey, {
              date: dateKey,
              userId: userId,
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
          if (BankerID && String(BankerID) === String(userId)) {
            uStats.bankerCount++;
          }
        }));

        // 增加游戏次数 (每个涉及的APP都+1)
        for (const appId of involvedGroups) {
          const stats = this.getStats(statsMap, timeKey, appId, game_name, roomLevel, roomType);
          stats.gameCount += 1;
        }
      }));

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
