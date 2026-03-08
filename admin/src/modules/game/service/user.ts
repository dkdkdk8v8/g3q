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

    /**
     * 管理员修改用户余额
     */
    async modifyBalance(userId: string, amount: number) {
        const user = await this.userEntity.findOneBy({ user_id: userId });
        if (!user) {
            throw new Error('用户不存在');
        }

        const balanceBefore = user.balance;
        const balanceAfter = balanceBefore + amount;
        if (balanceAfter < 0) {
            throw new Error('余额不足，修改后余额不能为负');
        }

        await this.userEntity.update({ user_id: userId }, { balance: balanceAfter });

        const record = this.userRecordEntity.create({
            user_id: userId,
            record_type: 3,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            game_record_id: 0,
            create_at: new Date(),
        });
        await this.userRecordEntity.save(record);

        return { balanceBefore, balanceAfter };
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
