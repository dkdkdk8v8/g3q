import { CoolController, BaseController } from '@cool-midway/core';

import { Body, Inject, Post, Provide } from "@midwayjs/decorator";

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
}
