import { CoolController, BaseController } from '@cool-midway/core';

import { Body, Get, Inject, Post, Provide, Query } from "@midwayjs/decorator";

import { GameUserEntity } from '../../entityGame/user';
import { GameUserService } from '../../service/user';

@Provide()
@CoolController({
    api: ['page'],
    entity: GameUserEntity,
    service: GameUserService,
    pageQueryOp: {
        fieldEq: ['app_id', 'enable', 'user_id', 'is_robot'],
        where: async (ctx) => {
            return [
                ["a.is_robot = :is_robot", { is_robot: false }],
            ]
        },
    },
})
export class GameUserController extends BaseController {

    @Inject()
    gameUserService: GameUserService;

    @Post('/batchDisable', { summary: '批量禁用' })
    async batchDisable(@Body('ids') ids: number[]) {
        return this.gameUserService.batchDisable(ids);
    }

    @Post('/batchEnable', { summary: '批量启用' })
    async batchEnable(@Body('ids') ids: number[]) {
        return this.gameUserService.batchEnable(ids);
    }

    @Post('/modifyBalance', { summary: '修改用户余额' })
    async modifyBalance(@Body() body: { userId: string; amount: number }) {
        return this.ok(await this.gameUserService.modifyBalance(body.userId, body.amount));
    }

    @Get('/pageUserRecords', { summary: '获取用户资金记录' })
    async getUserRecords(
        @Query('page') page: number,
        @Query('size') size: number,
        @Query('user_id') user_id: string) {
        const res = await this.gameUserService.pageUserRecords(user_id, page, size);
        return this.ok(res);
    }
}
