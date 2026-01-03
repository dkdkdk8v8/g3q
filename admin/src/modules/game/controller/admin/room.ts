import { CoolController, BaseController } from '@cool-midway/core';

import { Get, Inject, Provide, Query } from "@midwayjs/decorator";
import { GameRpcService } from "../../service/rpc";

@Provide()
@CoolController()
export class GameQZNNController extends BaseController {

    @Inject()
    rpcService: GameRpcService

    @Get('/qznn', { summary: '获取抢庄牛牛房间数据' })
    async qznn() {
        const data = await this.rpcService.getQZNNData();
        return this.ok(data);
    }
}
