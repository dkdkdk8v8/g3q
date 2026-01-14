import { CoolController, BaseController } from '@cool-midway/core';

import { Body, Get, Inject, Post, Provide, Query } from "@midwayjs/decorator";
import { StaPeriodService } from '../../service/sta-period';

@Provide()
@CoolController()
export class StaPeriodController extends BaseController {

    @Inject()
    staPeriodService: StaPeriodService;

    @Get('/getDateStats', { summary: '某个时间段的统计数据(按日期或者按应用)' })
    async getDateStats(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('app') app: string,
        @Query('gameName') gameName: string,
        @Query('showType') showType: 'app' | 'date' | 'game' | 'roomLevel' | 'roomType',
        @Query('sort') sort: string,
        @Query('order') order: string,
        @Query('roomLevel') roomLevel: string,
        @Query('roomType') roomType: string,
    ) {
        return this.staPeriodService.getDateStats(startDate, endDate, app, showType, sort, order, gameName, roomLevel, roomType);
    }

    @Get('/getUserStats', { summary: '某个时间段的统计数据(按用户)' })
    async getUserStats(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('app') app: string,
        @Query('sort') sort: string,
        @Query('order') order: string,
        @Query('userId') userId: string,
    ) {
        return this.staPeriodService.getUserStats(startDate, endDate, app, sort, order, userId);
    }

    @Get('/getDayTrend', { summary: '获取当日趋势对比' })
    async getDayTrend(
        @Query('date') date: string,
        @Query('app') app: string,
        @Query('duration') duration: number,
    ) {
        return this.staPeriodService.getDayTrend(date, app, duration);
    }

    @Get('/getCardResultStats', { summary: '获取牌型结果统计' })
    async getCardResultStats(
        @Query('date') date: string,
        @Query('app') app: string,
    ) {
        return this.staPeriodService.getCardResultStats(date, app);
    }
}
