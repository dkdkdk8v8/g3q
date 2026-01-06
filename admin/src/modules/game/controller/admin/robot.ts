import { CoolController, BaseController } from '@cool-midway/core';

import { Body, Inject, Post, Provide } from "@midwayjs/decorator";

import { GameUserEntity } from '../../entityGame/user';
import { GameRobotService } from '../../service/robot';

@Provide()
@CoolController({
    api: ['page', 'delete'],
    entity: GameUserEntity,
    service: GameRobotService,
    pageQueryOp: {
        fieldEq: ['enable', 'user_id'],
        where: async (ctx) => {
            return [
                ["a.is_robot = :is_robot", { is_robot: true }],
            ]
        },
    },
})
export class GameRobotController extends BaseController {

    @Inject()
    gameRobotService: GameRobotService;

    @Post('/createRobotBatch', { summary: '批量创建机器人' })
    async createRobotBatch(
        @Body('count') count: number,
        @Body('app_id') app_id: string,
        @Body('balanceMin') balanceMin: number,
        @Body('balanceMax') balanceMax: number,
    ) {
        return this.gameRobotService.createRobotBatch(count, app_id, balanceMin, balanceMax);
    }
}
