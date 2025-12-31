import { Provide } from '@midwayjs/decorator';
import { CoolController, BaseController } from '@cool-midway/core';
import { SpaceTypeEntity } from '../../entity/type';
import { SpaceTypeService } from '../../service/type';

/**
 * 空间分类
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: SpaceTypeEntity,
  service: SpaceTypeService,
  pageQueryOp: {
    keyWordLikeFields: ['name', 'path'],
    addOrderBy: {
      path: 'ASC',
    },
  }
})
export class BaseAppSpaceTypeController extends BaseController { }
