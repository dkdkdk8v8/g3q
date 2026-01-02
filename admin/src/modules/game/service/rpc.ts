import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import axios from 'axios';
import { Context } from '@midwayjs/koa';
import { SettingConfigInfoService } from '../../setting/service/info';
import { TradeType } from '../../passport/enum';

@Provide()
export class RpcService extends BaseService {
  @Inject()
  ctx: Context;

  @Inject()
  configService: SettingConfigInfoService;

  async getUrl(path: string): Promise<string> {
    const env = process.env.NODE_ENV;
    let host: string;
    if (env === 'local') {
      host = 'http://127.0.0.1:18080';
    } else {
      host = 'http://10.8.2.228:8083';
    }
    return `${host}/${path}`;
  }

  async getChildWallet(appId: string, appUserid: string): Promise<any> {
    const url = await this.getUrl('rpc/wallet/child-wallet');
    const response = await axios.post(url, {
      app_id: appId,
      app_userid: appUserid,
    });
    if (!response.data) {
      return '获取子钱包数据错误，请联系管理员！';
    }
    const { code, msg, data } = response.data;
    if (code !== 0) {
      return `获取子钱包数据错误，Code:${code},Msg:${msg}`;
    }
    if (!data.ChildWallet) {
      return [];
    }
    return data.ChildWallet.sort((a, b) => {
      return b.Balance - a.Balance;
    });
  }

  async flowAction(
    orderId: string,
    orderStatus: number,
    payFee: number,
    remark: string
  ): Promise<void> {
    const url = await this.getUrl('rpc/withdraw/order/flow-action');
    const operator = this.ctx.admin.username;
    const postData = {
      orderid: orderId,
      order_status: orderStatus,
      remark: remark,
      pay_fee: payFee,
      operator,
    };
    const response = await axios.post(url, postData);
    if (!response.data) {
      throw new Error('系统错误，请联系管理员！');
    }
    const { code, msg } = response.data;
    if (code !== 0) {
      throw new Error(`审核错误，Code:${code},Msg:${msg}`);
    }
  }

  /**
   * 上传图片，返回相对路径
   * @param group 存放文件夹名称
   * @param srcName 文件源名称，包含后缀
   * @param base64 图片base64编码
   */
  async uploadPic(
    srcName: string,
    base64: string,
    group?: 'icon' | 'lobby' | 'ad' | 'ui'
  ): Promise<string> {
    if (!group) group = 'icon';
    const url = await this.getUrl('rpc/upload/pic');
    const response = await axios.post(url, {
      Group: group,
      SrcName: srcName,
      B64: base64,
    });
    const { code, msg } = response.data;
    if (code !== 0) {
      throw new Error(msg);
    }
    const host = await this.configService.getString('admin_res_cdn');
    const relativePath = response.data?.data?.RelativePicPath;
    return host + relativePath;
  }

  /**
   * 用户下分,并返回下分的金额
   * @param appId APPID
   * @param appUserid APP用户名,前缀不带appid的
   * @param client_ip 客户端IP
   */
  async transferOut(
    appId: string,
    appUserid: string,
    client_ip: string
  ): Promise<number> {
    const url = await this.getUrl('app/game/transfer/out');
    const response = await axios.post(url, {
      app_id: appId,
      app_userid: appUserid,
      client_ip: client_ip,
    });
    const { code, transfer_out, msg } = response.data;
    if (code !== 0) {
      throw new Error(msg);
    }
    return transfer_out;
  }

  async changeBalance(
    userid: string,
    tradeType: number,
    changedAmount: number,
    changedFlowRate: number,
    changeMsg: string,
    remark: string,
    clientIp: string
  ): Promise<any> {
    const url = await this.getUrl('app/wallet/change-balance');
    const postData = {
      userid,
      changed_balance: changedAmount,
      changed_msg: changeMsg,
      trade_type: tradeType,
      remark,
      client_ip: clientIp,
    };
    if (tradeType === TradeType.CAIJIN) {
      postData['changed_flow_rate'] = String(changedFlowRate);
    }
    const response = await axios.post(url, postData);
    return response.data;
  }

  async createChannelCode(): Promise<any> {
    const url = await this.getUrl('rpc/code/new');
    const response = await axios.get(url);
    const { code, msg, data } = response.data;
    if (code !== 0) {
      throw new Error(msg);
    }
    return data['Code'];
  }
}
