import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository } from "typeorm";
import { GameUserEntity } from "../entityGame/user";

@Provide()
export class GameUserService extends BaseService {
    @Inject()
    ctx: Context;

    @InjectEntityModel(GameUserEntity)
    userEntity: Repository<GameUserEntity>;

    async batchDisable(ids: number[]) {
        return this.userEntity.update(ids, { enable: false });
    }

    async batchEnable(ids: number[]) {
        return this.userEntity.update(ids, { enable: true });
    }

}
