import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository } from "typeorm";
import { GameUserEntity } from "../entityGame/user";
import { GameUserRecordEntity } from '../entityGame/user-record';
import { GameRecordEntity } from '../entityGame/game-record';

@Provide()
export class GameUserService extends BaseService {
    @Inject()
    ctx: Context;

    @InjectEntityModel(GameUserEntity)
    userEntity: Repository<GameUserEntity>;

    @InjectEntityModel(GameUserRecordEntity)
    userRecordEntity: Repository<GameUserRecordEntity>;

    @InjectEntityModel(GameRecordEntity)
    gameRecordEntity: Repository<GameRecordEntity>;


    async batchDisable(ids: number[]) {
        return this.userEntity.update(ids, { enable: false });
    }

    async batchEnable(ids: number[]) {
        return this.userEntity.update(ids, { enable: true });
    }

    async pageUserRecords(user_id: string, page = 1, size = 10): Promise<{
        list: GameUserRecordEntity[],
        pagination: {
            page: number,
            size: number,
            total: number,
        },
    }> {
        const list = await this.userRecordEntity.find({
            where: { user_id },
            order: { create_at: 'DESC' },
            skip: (page - 1) * size,
            take: size,
        });
        const total = await this.userRecordEntity.count({ where: { user_id } });
        return {
            list,
            pagination: {
                page,
                size,
                total,
            },
        }
    }

}
