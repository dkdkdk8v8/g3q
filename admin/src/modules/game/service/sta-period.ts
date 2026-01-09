import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Between, LessThan, Repository, In } from 'typeorm';
import { StaPeriodEntity } from '../entity/sta-period';
import { GameUserRecordEntity } from '../entityGame/user-record';
import { CachingFactory, MidwayCache } from '@midwayjs/cache-manager';
import { InjectClient } from '@midwayjs/core';
import * as moment from 'moment';
import { StaUserEntity } from '../entity/sta-user';
import { GameUserEntity } from '../entityGame/user';

@Provide()
export class StaPeriodService extends BaseService {
    @InjectEntityModel(StaPeriodEntity)
    staPeriodEntity: Repository<StaPeriodEntity>;

    @InjectEntityModel(GameUserRecordEntity)
    userRecordEntity: Repository<GameUserRecordEntity>;

    @InjectEntityModel(StaUserEntity)
    staUserEntity: Repository<StaUserEntity>;

    @InjectEntityModel(GameUserEntity)
    gameUserEntity: Repository<GameUserEntity>;


    @InjectClient(CachingFactory, 'default')
    midwayCache: MidwayCache;

    /**
     * 获取对应时间内的统计数据
     */
    async getDateStats(startDate: string, endDate: string, app: string, showType: 'app' | 'date', sort: string, order: string) {
        const start = moment(startDate).startOf('day').toDate();
        const end = moment(endDate).endOf('day').toDate();

        const where: any = {
            timeKey: Between(start, end),
        };
        if (app) {
            where.appId = app;
        }

        const list = await this.staPeriodEntity.find({
            where,
        });

        const map = new Map<string, any>();

        for (const item of list) {
            let key = '';
            if (showType === 'app') {
                key = item.appId || 'Unknown';
            } else {
                key = moment(item.timeKey).format('YYYY-MM-DD');
            }

            if (!map.has(key)) {
                map.set(key, {
                    title: key,
                    gameUserCount: 0,
                    gameCount: 0,
                    betCount: 0,
                    betAmount: 0,
                    gameWin: 0,
                    firstGameUserCount: 0,
                });
            }
            const data = map.get(key);
            data.gameUserCount += item.gameUserCount;
            data.gameCount += item.gameCount;
            data.betCount += item.betCount;
            data.betAmount += item.betAmount;
            data.gameWin += item.gameWin;
            data.firstGameUserCount += item.firstGameUserCount;
        }

        const result = Array.from(map.values());

        // 计算衍生指标
        for (const item of result) {
            item.avgBetPerUser = item.gameUserCount > 0 ? item.betAmount / item.gameUserCount : 0;
            item.avgBetPerGame = item.betCount > 0 ? item.betAmount / item.betCount : 0;
            item.avgCountPerUser = item.gameUserCount > 0 ? item.betCount / item.gameUserCount : 0;
            item.rakeRatio = item.betAmount > 0 ? item.gameWin / item.betAmount : 0;
        }

        // 计算汇总数据
        const summary: any = {
            title: '汇总',
            gameUserCount: 0,
            gameCount: 0,
            betAmount: 0,
            betCount: 0,
            gameWin: 0,
            firstGameUserCount: 0,
            avgBetPerUser: 0,
            avgBetPerGame: 0,
            avgCountPerUser: 0,
        };

        for (const item of result) {
            summary.gameUserCount += item.gameUserCount;
            summary.gameCount += item.gameCount;
            summary.betAmount += item.betAmount;
            summary.betCount += item.betCount;
            summary.gameWin += item.gameWin;
            summary.firstGameUserCount += item.firstGameUserCount;
        }

        // 计算汇总的衍生指标
        summary.avgBetPerUser = summary.gameUserCount > 0 ? summary.betAmount / summary.gameUserCount : 0;
        summary.avgBetPerGame = summary.betCount > 0 ? summary.betAmount / summary.betCount : 0;
        summary.avgCountPerUser = summary.gameUserCount > 0 ? summary.betCount / summary.gameUserCount : 0;
        summary.rakeRatio = summary.betAmount > 0 ? summary.gameWin / summary.betAmount : 0;

        // 排序逻辑（仅对数据行排序）
        if (sort && order) {
            result.sort((a, b) => {
                const isAsc = sort === 'asc' || sort === 'ascending';
                const valA = a[order];
                const valB = b[order];
                if (valA === valB) return 0;
                if (isAsc) return valA > valB ? 1 : -1;
                return valA < valB ? 1 : -1;
            });
        } else {
            // 默认排序：按日期时倒序（最新在前），按APP时升序
            if (showType === 'date') {
                result.sort((a, b) => (a.title < b.title ? 1 : -1));
            } else {
                result.sort((a, b) => (a.gameWin > b.gameWin ? -1 : 1));
            }
        }

        // 将汇总行添加到最前面（如果有数据）
        if (result.length > 0) {
            result.unshift(summary);
        }

        return result;
    }

    /**
     * 判断是否首次游戏
     */
    async isFirstGame(userId: string, recordId: number): Promise<boolean> {
        const count = await this.userRecordEntity.count({
            where: {
                user_id: userId,
                game_record_id: LessThan(recordId),
            },
        });
        return count === 0;
    }

    /**
     * 判断日活（去重）
     */
    async isDailyActive(timeKey: Date, userId: string): Promise<boolean> {
        const dateStr = moment(timeKey).format('YYYY-MM-DD');
        const cacheKey = `game:dau:${dateStr}:${userId}`;
        const exists = await this.midwayCache.get(cacheKey);
        if (!exists) {
            await this.midwayCache.set(cacheKey, 1, 24 * 3600 * 1000);
            return true;
        }
        return false;
    }

    async getUserStats(startDate: string, endDate: string, app: string, sort: string, order: string) {
        const start = moment(startDate).startOf('day').toDate();
        const end = moment(endDate).endOf('day').toDate();

        const where: any = {
            date: Between(start, end),
        };
        if (app) {
            where.appId = app;
        }

        const list = await this.staUserEntity.find({
            where,
        });

        const map = new Map<string, any>();

        for (const item of list) {
            const key = item.userId;
            if (!map.has(key)) {
                map.set(key, {
                    userId: key,
                    appId: item.appId,
                    depositCount: 0,
                    depositAmount: 0,
                    withdrawCount: 0,
                    withdrawAmount: 0,
                    betCount: 0,
                    betAmount: 0,
                    winCount: 0,
                    bankerCount: 0,
                    betWin: 0,
                });
            }
            const data = map.get(key);
            data.depositCount += item.depositCount || 0;
            data.depositAmount += Number(item.depositAmount) || 0;
            data.withdrawCount += item.withdrawCount || 0;
            data.withdrawAmount += Number(item.withdrawAmount) || 0;
            data.betCount += item.betCount || 0;
            data.betAmount += Number(item.betAmount) || 0;
            data.winCount += item.winCount || 0;
            data.bankerCount += item.bankerCount || 0;
            data.betWin += Number(item.betWin) || 0;
        }

        const result = Array.from(map.values());

        // 关联用户表信息
        if (result.length > 0) {
            const userIds = result.map(e => e.userId);
            const users = await this.gameUserEntity.find({
                where: { user_id: In(userIds) },
                select: ['user_id', 'nick_name', 'total_deposit', 'total_with_draw', 'total_game_count', 'total_bet', 'total_net_balance']
            });
            const userMap = new Map(users.map(u => [u.user_id, u]));
            for (const item of result) {
                const u = userMap.get(item.userId);
                if (u) {
                    item.nickName = u.nick_name;
                    item.totalDeposit = u.total_deposit;
                    item.totalWithdraw = u.total_with_draw;
                    item.totalGameCount = u.total_game_count;
                    item.totalBet = u.total_bet;
                    item.totalNetBalance = u.total_net_balance;
                }
            }
        }

        // 计算衍生指标
        for (const item of result) {
            item.avgBetAmount = item.betCount > 0 ? item.betAmount / item.betCount : 0;
            item.winRate = item.betCount > 0 ? item.winCount / item.betCount : 0;
            // 返奖率 = (投注金额 + 用户输赢) / 投注金额
            item.returnRate = item.betAmount > 0 ? (item.betAmount + item.betWin) / item.betAmount : 0;
        }

        // 排序逻辑
        if (sort && order) {
            result.sort((a, b) => {
                const isAsc = sort === 'asc' || sort === 'ascending';
                const valA = a[order];
                const valB = b[order];
                if (valA === valB) return 0;
                if (isAsc) return valA > valB ? 1 : -1;
                return valA < valB ? 1 : -1;
            });
        } else {
            // 默认排序：按投注金额倒序
            result.sort((a, b) => (a.betAmount > b.betAmount ? -1 : 1));
        }

        return result;
    }
}
