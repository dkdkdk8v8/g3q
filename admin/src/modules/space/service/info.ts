import { SpaceInfoEntity } from './../entity/info';
import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService, MODETYPE } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { PluginService } from '../../plugin/service/info';
import { Utils } from '../../../comm/utils';

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

}
