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
    async getDateStats(startDate: string, endDate: string, app: string, showType: 'app' | 'date' | 'game', sort: string, order: string, gameName?: string, userType?: string) {
        const start = moment(startDate).startOf('day').toDate();
        const end = moment(endDate).endOf('day').toDate();

        const where: any = {
            timeKey: Between(start, end),
        };
        if (app) {
            where.appId = app;
        }
        if (gameName) {
            where.gameName = gameName;
        }
        if (userType === 'real') {
            where.isRobot = false;
        } else if (userType === 'robot') {
            where.isRobot = true;
        }

        const list = await this.staPeriodEntity.find({
            where,
        });

        const map = new Map<string, any>();

        for (const item of list) {
            let key = '';
            if (showType === 'app') {
                key = item.appId || '';
            } else if (showType === 'game') {
                key = item.gameName || '';
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

    async getUserStats(startDate: string, endDate: string, app: string, sort: string, order: string, userType?: string) {
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

        let result = Array.from(map.values());

        // 关联用户表信息
        if (result.length > 0) {
            const userIds = result.map(e => e.userId);
            const userWhere: any = { user_id: In(userIds) };
            if (userType === 'real') {
                userWhere.is_robot = false;
            } else if (userType === 'robot') {
                userWhere.is_robot = true;
            }

            const users = await this.gameUserEntity.find({
                where: userWhere,
                select: ['user_id', 'nick_name', 'total_deposit', 'total_with_draw', 'total_game_count', 'total_bet', 'total_net_balance']
            });
            const userMap = new Map(users.map(u => [u.user_id, u]));
            const validItems = [];
            for (const item of result) {
                const u = userMap.get(item.userId);
                if (u) {
                    item.nickName = u.nick_name;
                    item.totalDeposit = u.total_deposit;
                    item.totalWithdraw = u.total_with_draw;
                    item.totalGameCount = u.total_game_count;
                    item.totalBet = u.total_bet;
                    item.totalNetBalance = u.total_net_balance;
                    validItems.push(item);
                } else {
                    if (!userType || userType === 'all') {
                        validItems.push(item);
                    }
                }
            }
            result = validItems;
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

    /**
     * 获取当日趋势对比（当日、昨日、上周同期）
     */
    async getDayTrend(date: string, app: string, duration: number = 10, userType?: string) {
        const targetDate = moment(date);
        // 构造三个时间段：当日、昨日、上周同期
        const dates = [
            {
                key: 'current',
                start: targetDate.clone().startOf('day').toDate(),
                end: targetDate.clone().endOf('day').toDate()
            },
            {
                key: 'yesterday',
                start: targetDate.clone().subtract(1, 'days').startOf('day').toDate(),
                end: targetDate.clone().subtract(1, 'days').endOf('day').toDate()
            },
            {
                key: 'lastWeek',
                start: targetDate.clone().subtract(7, 'days').startOf('day').toDate(),
                end: targetDate.clone().subtract(7, 'days').endOf('day').toDate()
            }
        ];

        // 计算分片数量
        const totalMinutes = 24 * 60;
        const slotCount = Math.ceil(totalMinutes / (duration || 10));

        const result: any = {
            hours: [],
            current: [],
            yesterday: [],
            lastWeek: []
        };

        for (let i = 0; i < slotCount; i++) {
            result.hours.push(moment().startOf('day').add(i * (duration || 10), 'minutes').format('HH:mm'));
        }

        // 初始化数据容器
        const initData = () => Array.from({ length: slotCount }, () => ({
            gameUserCount: null as any,
            firstGameUserCount: null as any,
            betCount: null as any,
            betAmount: null as any,
            gameWin: null as any
        }));

        const dataMap = {
            current: initData(),
            yesterday: initData(),
            lastWeek: initData()
        };

        for (const d of dates) {
            const where: any = {
                timeKey: Between(d.start, d.end)
            };
            if (app) {
                where.appId = app;
            }
            if (userType === 'real') {
                where.isRobot = false;
            } else if (userType === 'robot') {
                where.isRobot = true;
            }

            const list = await this.staPeriodEntity.find({ where });

            for (const item of list) {
                const m = moment(item.timeKey);
                const index = Math.floor((m.hour() * 60 + m.minute()) / (duration || 10));
                const target = dataMap[d.key][index];
                if (target) {
                    target.gameUserCount += item.gameUserCount || 0;
                    target.firstGameUserCount += item.firstGameUserCount || 0;
                    target.betCount += item.betCount || 0;
                    target.betAmount += Number(item.betAmount) || 0;
                    target.gameWin += Number(item.gameWin) || 0;
                }
            }
        }

        // 处理当日数据：当前时间之前的数据若为null置为0，之后保留null
        if (targetDate.isSame(moment(), 'day')) {
            const now = moment();
            const currentSlot = Math.floor((now.hour() * 60 + now.minute()) / (duration || 10));

            dataMap.current.forEach((item, index) => {
                if (index <= currentSlot) {
                    item.gameUserCount = item.gameUserCount ?? 0;
                    item.firstGameUserCount = item.firstGameUserCount ?? 0;
                    item.betCount = item.betCount ?? 0;
                    item.betAmount = item.betAmount ?? 0;
                    item.gameWin = item.gameWin ?? 0;
                } else {
                    item.gameUserCount = null;
                    item.firstGameUserCount = null;
                    item.betCount = null;
                    item.betAmount = null;
                    item.gameWin = null;
                }
            });
        }

        result.current = dataMap.current;
        result.yesterday = dataMap.yesterday;
        result.lastWeek = dataMap.lastWeek;

        return result;
    }

    /**
     * 获取牌型结果统计
     */
    async getCardResultStats(date: string, app: string, userType?: string) {
        const start = moment(date).startOf('day').toDate();
        const end = moment(date).endOf('day').toDate();

        const where: any = {
            timeKey: Between(start, end),
        };
        if (app) {
            where.appId = app;
        }
        if (userType === 'real') {
            where.isRobot = false;
        } else if (userType === 'robot') {
            where.isRobot = true;
        }

        const list = await this.staPeriodEntity.find({
            where,
            select: ['timeKey', 'cardResult']
        });

        // 0-23 hours
        const result = Array.from({ length: 24 }, () => ({}));

        for (const item of list) {
            const hour = moment(item.timeKey).hour();
            const cardResult = item.cardResult || {};
            for (const key in cardResult) {
                result[hour][key] = (result[hour][key] || 0) + Number(cardResult[key]);
            }
        }

        return result;
    }
}
