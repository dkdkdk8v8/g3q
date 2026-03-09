import { CoolController, BaseController } from '@cool-midway/core';
import { Provide } from '@midwayjs/decorator';
import { GameUserRecordEntity } from '../../entityGame/user-record';
import { GameUserEntity } from '../../entityGame/user';
import { TypeORMDataSourceManager } from '@midwayjs/typeorm';

/**
 * 资金记录
 */
@Provide()
@CoolController({
  api: ['page'],
  entity: GameUserRecordEntity,
  pageQueryOp: {
    join: [
      {
        entity: GameUserEntity,
        alias: 'u',
        condition: 'a.user_id = u.user_id',
        type: 'leftJoin',
      },
    ],
    fieldEq: [
      { requestParam: 'app_user_id', column: 'u.app_user_id' },
      'record_type',
    ],
    select: [
      'a.id',
      'a.user_id',
      'u.app_user_id',
      'u.app_id',
      'a.record_type',
      'a.balance_before',
      'a.balance_after',
      'a.valid_bet',
      'a.game_record_id',
      'a.order_id',
      'a.order_state',
      'a.create_at',
    ],
    where: async (ctx) => {
      const conditions: any[] = [];
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
            `u.app_id IN (${placeholders.join(', ')})`,
            paramObj,
          ]);
        } else {
          conditions.push(["1 = 0", {}]);
        }
      }
      return conditions;
    },
  },
})
export class GameUserRecordController extends BaseController {}
