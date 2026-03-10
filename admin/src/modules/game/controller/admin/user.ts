import { CoolController, BaseController } from '@cool-midway/core';

import { Body, Get, Inject, Post, Provide, Query } from "@midwayjs/decorator";

import { GameUserEntity } from '../../entityGame/user';
import { GameUserService } from '../../service/user';
import { TypeORMDataSourceManager } from '@midwayjs/typeorm';

@Provide()
@CoolController({
    api: ['page'],
    entity: GameUserEntity,
    service: GameUserService,
    pageQueryOp: {
        fieldEq: ['app_id', 'enable', 'app_user_id', 'is_robot'],
        where: async (ctx) => {
            const conditions: any[] = [
                ["a.is_robot = :is_robot", { is_robot: false }],
            ];
            // 非超管按绑定商户过滤
            if (ctx.admin?.username !== 'admin') {
                const dataSourceManager: TypeORMDataSourceManager =
                    await ctx.requestContext.getAsync(TypeORMDataSourceManager);
                const dataSource = dataSourceManager.getDataSource('default');
                const [row] = await dataSource.query(
                    'SELECT appIds FROM base_sys_user WHERE id = ?',
                    [ctx.admin?.userId]
                );
                let appIds: string[] = [];
                try {
                    appIds = row?.appIds ? JSON.parse(row.appIds) : [];
                } catch {}
                if (appIds.length > 0) {
                    const paramObj: Record<string, string> = {};
                    const placeholders = appIds.map((id, i) => {
                        paramObj[`appId${i}`] = id;
                        return `:appId${i}`;
                    });
                    conditions.push([
                        `a.app_id IN (${placeholders.join(', ')})`,
                        paramObj,
                    ]);
                } else {
                    // 未绑定商户，不允许查看任何用户
                    conditions.push(["1 = 0", {}]);
                }
            }
            return conditions;
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
