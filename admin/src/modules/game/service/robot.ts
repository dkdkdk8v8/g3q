import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository } from "typeorm";
import { GameUserEntity } from "../entityGame/user";

@Provide()
export class GameRobotService extends BaseService {
    @Inject()
    ctx: Context;

    @InjectEntityModel(GameUserEntity)
    userEntity: Repository<GameUserEntity>;

    // 随机生成8位字母数字组合
    generateAppUserId(): string {
        const length = 8;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // 批量创建机器人用户
    async createRobotBatch(count = 20, app_id = 'main', balanceMin = 100 * 100, balanceMax = 1000 * 100) {
        let successCount = 0;
        while (successCount < count) {
            try {
                const robot = new GameUserEntity();
                robot.app_user_id = this.generateAppUserId();
                robot.app_id = app_id;
                robot.user_id = robot.app_id + robot.app_user_id;
                robot.is_robot = true;
                robot.balance = Math.floor(Math.random() * (balanceMax - balanceMin + 1)) + balanceMin;
                robot.enable = true;
                robot.create_at = new Date();
                robot.update_at = new Date();
                await this.userEntity.save(robot);
                successCount++;
            } catch (e) {
                // ignore
            }
        }
    }

}
