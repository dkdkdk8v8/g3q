import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 用户数据统计
 */
@Entity('sta_user')
export class StaUserEntity extends BaseEntity {
  @Index()
  @Column({ comment: '时间节点', nullable: false })
  date: Date;

  @Index()
  @Column({ comment: '用户ID', default: '' })
  userId: string;

  @Index()
  @Column({ comment: '应用ID', default: '' })
  appId: string;

  @Column({ comment: '充值次数', default: 0 })
  depositCount: number;

  @Column({ comment: '充值金额', default: 0 })
  depositAmount: number;

  @Column({ comment: '提现次数', default: 0 })
  withdrawCount: number;

  @Column({ comment: '提现金额', default: 0 })
  withdrawAmount: number;

  @Column({ comment: '投注次数', default: 0 })
  betCount: number;

  @Column({ comment: '投注金额', default: 0 })
  betAmount: number;

  @Column({ comment: '胜利次数', default: 0 })
  winCount: number;

  @Column({ comment: '当庄次数', default: 0 })
  bankerCount: number;

  @Column({ comment: '输赢金额', default: 0 })
  betWin: number;
}
