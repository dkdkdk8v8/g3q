import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 数据统计分片
 */
@Entity('sta_period')
@Index('idx_sta_period_uq', ['timeKey', 'appId', 'gameName', 'roomLevel', 'roomType'], { unique: true })
export class StaPeriodEntity extends BaseEntity {
  @Column({ comment: '时间节点', nullable: false })
  timeKey: Date;

  @Index()
  @Column({ comment: '应用ID', default: '' })
  appId: string;

  @Column({ comment: '游戏名称', default: '' })
  gameName: string;

  @Column({ comment: '房间等级', default: 0 })
  roomLevel: number;

  @Column({ comment: '房间类型', default: 0 })
  roomType: number;

  @Column({ comment: '游戏人数', default: 0 })
  gameUserCount: number;

  @Column({ comment: '游戏局数', default: 0 })
  gameCount: number;

  @Column({ comment: '投注次数', default: 0 })
  betCount: number;

  @Column({ comment: '投注金额', type: 'bigint', default: 0 })
  betAmount: number;

  @Column({ comment: '平台盈亏', type: 'bigint', default: 0 })
  gameWin: number;

  @Column({ comment: '税收金额', type: 'bigint', default: 0 })
  taxAmount: number;

  @Column({ comment: '首次游戏人数', default: 0 })
  firstGameUserCount: number;

  @Column({ comment: '首次游戏用户ID', type: 'json' })
  firstGameUserIds: string[];

  @Column({ comment: '牌型结果', type: 'json' })
  cardResult: any;

  @Column({ comment: '单张牌频次', type: 'json' })
  cartCount: number[];

}
