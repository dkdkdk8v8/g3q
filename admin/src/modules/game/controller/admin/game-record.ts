import { CoolController, BaseController } from '@cool-midway/core';
import { Provide } from '@midwayjs/decorator';
import { GameRecordEntity } from '../../entityGame/game-record';

/**
 * 游戏记录
 */
@Provide()
@CoolController({
  api: ['info'],
  entity: GameRecordEntity,
})
export class GameRecordController extends BaseController {}
