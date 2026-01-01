import {CoolController, BaseController} from '@cool-midway/core';

import {Provide} from "@midwayjs/decorator";

import {GameUserEntity} from '../../entityGame/user';

@Provide()
@CoolController({
    api: ['add', 'update', 'info', 'page', 'delete'],
    entity: GameUserEntity,
    pageQueryOp: {
        fieldEq: ['app_id', 'enable', 'user_id'],
    },
})
export class GameUserController extends BaseController {
}
