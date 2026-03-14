import { IJob, Job } from '@midwayjs/cron';
import { Inject } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { CachingFactory, MidwayCache } from '@midwayjs/cache-manager';
import { MoreThan, Repository, In, EntityManager } from 'typeorm';
import * as moment from 'moment';

import { ILogger, InjectClient } from '@midwayjs/core';
import { StaPeriodEntity } from '../entity/sta-period';
import { GameUserEntity } from '../entityGame/user';
import { GameRecordEntity } from '../entityGame/game-record';
import { StaUserEntity } from '../entity/sta-user';
import { StaPeriodService } from '../service/sta-period';
import { getGameParser, ParsedPlayer } from '../util/game-parser';

// 注册所有游戏解析器（import 时自动执行 registerGameParser）
import '../util/qznn-parser';
import '../util/brnn-parser';

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
  taxAmount: number;
  firstGameUserCount: number;
  firstGameUserIds: string[];
  cardResult: Record<string, number>;
  cartCount: number[];
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
  cronTime: '*/5 * * * * *',
  runOnInit: false,
  start: ['production', 'test'].includes(process.env.NODE_ENV),
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
    const lastId = await this.midwayCache.get('game:sta:lastId');
    if (!lastId) return 0;
    return Number(lastId);
  }

  async setLastId(id: number) {
    await this.midwayCache.set('game:sta:lastId', id);
  }

  /** 获取时间分片Key（10分钟粒度） */
  private getTimeKey(date: Date): Date {
    const recordTime = moment(date);
    recordTime.minute(Math.floor(recordTime.minute() / 10) * 10).second(0).millisecond(0);
    return recordTime.toDate();
  }

  /** 获取或初始化统计对象 */
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
        taxAmount: 0,
        firstGameUserCount: 0,
        firstGameUserIds: [],
        cardResult: {},
        cartCount: new Array(52).fill(0),
      });
    }
    return statsMap.get(mapKey);
  }

  /** 在同一事务中保存 sta_period 和 sta_user */
  private async saveAll(statsMap: Map<string, StatsData>, userStatsMap: Map<string, UserStatsData>) {
    if (statsMap.size === 0 && userStatsMap.size === 0) return;
    const dataSource = this.staPeriodEntity.manager.connection;
    await dataSource.transaction(async manager => {
      await this.savePeriodStats(manager, statsMap);
      await this.saveUserStats(manager, userStatsMap);
    });
  }

  /** 保存时间分片统计 */
  private async savePeriodStats(manager: EntityManager, statsMap: Map<string, StatsData>) {
    for (const stats of statsMap.values()) {
      const where = { timeKey: stats.timeKey, appId: stats.appId, gameName: stats.gameName, roomLevel: stats.roomLevel, roomType: stats.roomType };
      let entity = await manager.findOne(StaPeriodEntity, {
        where,
        lock: { mode: 'pessimistic_write' },
      });
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
        entity.taxAmount = 0;
        entity.firstGameUserCount = 0;
        entity.firstGameUserIds = [];
        entity.cardResult = {};
        entity.cartCount = new Array(52).fill(0);
      }
      entity.gameUserCount += stats.gameUserCount;
      entity.gameCount += stats.gameCount;
      entity.betCount += stats.betCount;
      entity.betAmount = (Number(entity.betAmount) || 0) + stats.betAmount;
      entity.gameWin = (Number(entity.gameWin) || 0) + stats.gameWin;
      entity.taxAmount = (Number(entity.taxAmount) || 0) + stats.taxAmount;
      entity.firstGameUserCount += stats.firstGameUserCount;

      const existingIds = Array.isArray(entity.firstGameUserIds) ? entity.firstGameUserIds : [];
      entity.firstGameUserIds = [...existingIds, ...stats.firstGameUserIds];

      const existingCardResult = entity.cardResult || {};
      for (const key in stats.cardResult) {
        existingCardResult[key] = (existingCardResult[key] || 0) + stats.cardResult[key];
      }
      entity.cardResult = existingCardResult;

      const existingCartCount = entity.cartCount || new Array(52).fill(0);
      for (let i = 0; i < 52; i++) {
        existingCartCount[i] = (existingCartCount[i] || 0) + stats.cartCount[i];
      }
      entity.cartCount = existingCartCount;

      await manager.save(entity);
    }
  }

  /** 保存用户统计 */
  private async saveUserStats(manager: EntityManager, userStatsMap: Map<string, UserStatsData>) {
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
  }

  /** 检查是否首次游戏，带缓存优化 */
  private async checkIsFirstGame(userId: string, recordId: number): Promise<boolean> {
    const cacheKey = `game:sta:played:${userId}`;
    const hasPlayed = await this.midwayCache.get(cacheKey);
    if (hasPlayed) {
      return false;
    }
    const isFirst = await this.staPeriodService.isFirstGame(userId, recordId);
    if (!isFirst) {
      await this.midwayCache.set(cacheKey, 1, 7 * 24 * 3600 * 1000);
    }
    return isFirst;
  }

  /**
   * 处理单条记录中的单个玩家统计
   */
  private async processPlayer(
    player: ParsedPlayer,
    userMap: Map<string, GameUserEntity>,
    record: GameRecordEntity,
    gameName: string,
    roomLevel: number,
    roomType: number,
    timeKey: Date,
    dateKey: Date,
    statsMap: Map<string, StatsData>,
    userStatsMap: Map<string, UserStatsData>,
    batchActiveUsers: Set<string>,
    batchFirstGameUsers: Set<string>,
    involvedApps: Set<string>,
  ) {
    if (player.isObserver) return;

    const user = userMap.get(player.userId);
    if (!user || user.is_robot) return;

    const appId = user.app_id || '';
    involvedApps.add(appId);

    const stats = this.getStats(statsMap, timeKey, appId, gameName, roomLevel, roomType);

    // 投注统计
    stats.betCount++;
    stats.betAmount += player.validBet;

    // 平台盈亏 = 用户输赢的负数
    stats.gameWin += -1 * player.balanceChange;

    // 税收
    stats.taxAmount += player.tax;

    // 牌型统计
    if (player.cardType) {
      stats.cardResult[player.cardType] = (stats.cardResult[player.cardType] || 0) + 1;
    }

    // 单张牌频统计
    if (player.cards && Array.isArray(player.cards)) {
      for (const card of player.cards) {
        if (typeof card === 'number' && card >= 0 && card < 52) {
          stats.cartCount[card]++;
        }
      }
    }

    // 首次游戏判断
    if (!batchFirstGameUsers.has(player.userId)) {
      batchFirstGameUsers.add(player.userId);
      if (await this.checkIsFirstGame(player.userId, record.id)) {
        stats.firstGameUserCount += 1;
        stats.firstGameUserIds.push(player.userId);
      }
    }

    // 活跃用户按天去重
    const dateStr = moment(timeKey).format('YYYY-MM-DD');
    const dauKey = `${dateStr}:${player.userId}`;
    let isDailyActive = false;
    if (!batchActiveUsers.has(dauKey)) {
      batchActiveUsers.add(dauKey);
      isDailyActive = await this.staPeriodService.isDailyActive(timeKey, player.userId);
    }
    if (isDailyActive) {
      stats.gameUserCount += 1;
    }

    // 用户数据统计
    const userKey = `${dateKey.getTime()}_${player.userId}`;
    if (!userStatsMap.has(userKey)) {
      userStatsMap.set(userKey, {
        date: dateKey,
        userId: player.userId,
        appId: appId,
        betCount: 0,
        betAmount: 0,
        winCount: 0,
        bankerCount: 0,
        betWin: 0,
      });
    }
    const uStats = userStatsMap.get(userKey);
    uStats.betCount++;
    uStats.betAmount += player.validBet;
    uStats.betWin += player.balanceChange;
    if (player.balanceChange > 0) {
      uStats.winCount++;
    }
    if (player.isBanker) {
      uStats.bankerCount++;
    }
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
      if (records.length === 0) return;

      this.logger.info(`开始处理id大于${lastId}的数据，共${records.length}条`);
      const statsMap = new Map<string, StatsData>();
      const userStatsMap = new Map<string, UserStatsData>();
      let newLastId = lastId;

      // 解析记录 & 收集所有玩家ID
      const allUserIds = new Set<string>();
      const parsedRecords: { record: GameRecordEntity; parsed: ReturnType<ReturnType<typeof getGameParser>['parse']> }[] = [];

      for (const record of records) {
        const parser = getGameParser(record.game_name);
        if (!parser) {
          this.logger.warn(`未注册的游戏类型: ${record.game_name}，跳过 record #${record.id}`);
          if (record.id > newLastId) newLastId = record.id;
          continue;
        }

        if (!record.game_data) {
          this.logger.warn(`record #${record.id} game_data 为空，跳过`);
          if (record.id > newLastId) newLastId = record.id;
          continue;
        }

        const gameData = JSON.parse(record.game_data);
        const parsed = parser.parse(gameData);
        for (const player of parsed.players) {
          if (player.userId) allUserIds.add(player.userId);
        }

        parsedRecords.push({ record, parsed });
        if (record.id > newLastId) newLastId = record.id;
      }

      // 批量预取用户信息
      const userMap = new Map<string, GameUserEntity>();
      if (allUserIds.size > 0) {
        const users = await this.userEntity.find({ where: { user_id: In([...allUserIds]) } });
        for (const u of users) {
          userMap.set(u.user_id, u);
        }
      }

      const batchActiveUsers = new Set<string>();
      const batchFirstGameUsers = new Set<string>();

      // 顺序处理每条记录（避免并发修改共享状态）
      for (const { record, parsed } of parsedRecords) {
        const { game_name, create_at } = record;
        const timeKey = this.getTimeKey(create_at);
        const dateKey = moment(create_at).startOf('day').toDate();
        const involvedApps = new Set<string>();

        for (const player of parsed.players) {
          await this.processPlayer(
            player, userMap, record,
            game_name, parsed.roomLevel, parsed.roomType,
            timeKey, dateKey,
            statsMap, userStatsMap,
            batchActiveUsers, batchFirstGameUsers,
            involvedApps,
          );
        }

        // 增加游戏次数（每个涉及的APP都+1）
        for (const appId of involvedApps) {
          const stats = this.getStats(statsMap, timeKey, appId, game_name, parsed.roomLevel, parsed.roomType);
          stats.gameCount += 1;
        }
      }

      // 同一事务中保存所有统计数据，避免部分成功导致重试时重复计数
      await this.saveAll(statsMap, userStatsMap);
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
