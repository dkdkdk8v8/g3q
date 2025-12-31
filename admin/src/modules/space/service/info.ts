import { SpaceInfoEntity } from './../entity/info';
import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService, MODETYPE } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { PluginService } from '../../plugin/service/info';
import { Utils } from '../../../comm/utils';
import { SettingConfigInfoService } from '../../setting/service/config/info';

/**
 * 文件信息
 */
@Provide()
export class SpaceInfoService extends BaseService {
  @InjectEntityModel(SpaceInfoEntity)
  spaceInfoEntity: Repository<SpaceInfoEntity>;

  @Inject()
  pluginService: PluginService;

  @Inject()
  util: Utils;

  @Inject()
  configService: SettingConfigInfoService;

  /**
   * 新增
   */
  // async add(param) {
  //   const result = await this.pluginService.invoke('upload', 'getMode');
  //   const config = await this.pluginService.getConfig('upload');
  //   return super.add(param);
  // }

  async modifyBefore(data: SpaceInfoEntity, type: 'delete' | 'update' | 'add') {
    if (type === 'add' || type === 'update') {
      data.url = this.util.getPathAndSearch(data.url, false);
    }
  }

  async page(query, option, connectionName) {
    const host = await this.configService.getString('admin_cdn_host');
    const result = await super.page(query, option, connectionName);
    result?.list?.map(item => (item.url = `${host}/${item.url}`));
    return result;
  }
}
