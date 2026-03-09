import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 用户记录表
 */
@Entity('g3q_user_record')
export class GameUserRecordEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  user_id: string;

  @Column({ comment: '记录类型' })
  record_type: number;

  @Column({ comment: '变化前金额' })
  balance_before: number;

  @Column({ comment: '变化后金额' })
  balance_after: number;

  @Column({ comment: '有效投注', default: 0 })
  valid_bet: number;

  @Column({ comment: '游戏记录ID' })
  game_record_id: number;

  @Column({ comment: '订单ID', nullable: true, default: null })
  order_id: string;

  @Column({ comment: '订单状态', default: 0 })
  order_state: number;

  @Column({ comment: '创建时间' })
  create_at: Date;
}
