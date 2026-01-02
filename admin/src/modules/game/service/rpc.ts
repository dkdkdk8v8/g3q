import { Config, Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import axios from 'axios';
import { Context } from '@midwayjs/koa';

@Provide()
export class GameRpcService extends BaseService {
    @Inject()
    ctx: Context;

    @Config('rpc.qznn')
    qznnUrl: string;

    async getQZNNData(): Promise<any> {
        const url = `${this.qznnUrl}/rpc/qznn-data`;
        const response = await axios.get(url);
        const { code, msg, data } = response.data;
        const qznnData = JSON.parse(data);
        return qznnData;
    }
}
