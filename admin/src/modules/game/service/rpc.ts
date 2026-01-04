import { Config, Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import axios from 'axios';
import { Context } from '@midwayjs/koa';
import { BaseSysParamService } from '../../base/service/sys/param';

@Provide()
export class GameRpcService extends BaseService {
    @Inject()
    ctx: Context;

    @Config('rpc.qznn')
    qznnUrl: string;

    @Inject()
    baseSysParamService: BaseSysParamService;


    async getUrl(path: string): Promise<string> {
        const env = process.env.NODE_ENV;
        let host: string;
        if (env === 'production') {
            host = await this.baseSysParamService.dataByKey('rpc_url');
        } else {
            host = await this.baseSysParamService.dataByKey('rpc_url_debug');
        }
        return `${host}/${path}`;
    }

    async getQZNNData(): Promise<any> {
        const url = await this.getUrl('rpc/qznn-data');
        const response = await axios.get(url);
        const { code, msg, data } = response.data;
        if (code !== 0) {
            throw new Error(`获取抢庄牛牛房间数据失败: ${msg}`);
        }
        const qznnData = JSON.parse(data);
        return qznnData;
    }
}
