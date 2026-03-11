import { BaseEntity } from '@cool-midway/core';
import { Column, Index, Entity } from 'typeorm';

/**
 * 运营商API调用日志
 */
@Entity('merchant_api_log')
@Index(['createTime'])
export class MerchantApiLogEntity extends BaseEntity {
  @Index()
  @Column({ comment: 'APP ID', length: 32 })
  appId: string;

  @Column({ comment: '接口路径', length: 255 })
  path: string;

  @Column({ comment: 'HTTP方法', length: 10 })
  method: string;

  @Column({ comment: '请求参数', type: 'text', nullable: true })
  reqBody: string;

  @Column({ comment: '响应内容', type: 'text', nullable: true })
  rspBody: string;

  @Index()
  @Column({ comment: '业务状态码', default: 0 })
  statusCode: number;

  @Column({ comment: '耗时(ms)', default: 0 })
  costMs: number;

  @Index()
  @Column({ comment: '请求IP', length: 64, nullable: true })
  clientIp: string;
}
