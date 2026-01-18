import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository } from "typeorm";
import { GameUserEntity } from "../entityGame/user";
import { GameUserRecordEntity } from '../entityGame/user-record';
import { GameRecordEntity } from '../entityGame/game-record';
import { BaseSysParamService } from '../../base/service/sys/param';

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

    @Inject()
    baseSysParamService: BaseSysParamService;


    async batchDisable(ids: number[]) {
        return this.userEntity.update(ids, { enable: false });
    }

    async batchEnable(ids: number[]) {
        return this.userEntity.update(ids, { enable: true });
    }

    async page(query, option, connectionName) {
        const host = await this.baseSysParamService.dataByKey('admin.AvatarHost');
        const result = await super.page(query, option, connectionName);
        result?.list?.map((item: GameUserEntity) => {
            if (item.avatar) item.avatar = `${host}/${item.avatar}`;
        });
        return result;
    }

    async pageUserRecords(user_id: string, page = 1, size = 10): Promise<{
        list: GameUserRecordEntity[],
        pagination: {
            page: number,
            size: number,
            total: number,
        },
    }> {
        const [list, total] = await this.userRecordEntity.createQueryBuilder('record')
            .leftJoinAndMapOne('record.gameRecord', GameRecordEntity, 'game', 'record.game_record_id = game.id')
            .where('record.user_id = :user_id', { user_id })
            .orderBy('record.create_at', 'DESC')
            .skip((page - 1) * size)
            .take(size)
            .getManyAndCount();
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
