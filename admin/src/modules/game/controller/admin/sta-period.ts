import { CoolController, BaseController } from '@cool-midway/core';

import { Body, Get, Inject, Post, Provide, Query } from "@midwayjs/decorator";
import { StaPeriodService } from '../../service/sta-period';

@Provide()
@CoolController()
export class StaPeriodController extends BaseController {

    @Inject()
    staPeriodService: StaPeriodService;

    @Get('/getDateStats', { summary: '某个时间段的统计数据' })
    async getDateStats(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('app') app: string,
        @Query('showType') showType: 'app' | 'date',
        @Query('sort') sort: string,
        @Query('order') order: string,
    ) {
        return this.staPeriodService.getDateStats(startDate, endDate, app, showType, sort, order);
    }
}
