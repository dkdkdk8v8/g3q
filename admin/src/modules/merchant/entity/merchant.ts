import { BaseEntity } from '@cool-midway/core';
import { Column, Index, Entity } from 'typeorm';

/**
 * 运营商表
 */
@Entity('merchant')
export class MerchantEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: 'APP ID（接口认证 & 关联玩家）', length: 32 })
  appId: string;

  @Column({ comment: '商户名称', length: 128 })
  merchantName: string;

  @Column({ comment: '签名密钥', length: 128 })
  secretKey: string;

  @Column({ comment: '回调地址（预留）', length: 512, nullable: true })
  callbackUrl: string;

  @Column({ comment: '商户类型 0-正式 1-测试', default: 0 })
  merchantType: number;

  @Column({ comment: '是否启用', default: true })
  enable: boolean;

  @Column({ comment: '备注', length: 255, nullable: true })
  remark: string;
}
