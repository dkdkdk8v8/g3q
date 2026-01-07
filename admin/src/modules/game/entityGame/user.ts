import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 游戏用户表
 */
@Entity('g3q_user')
export class GameUserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  user_id: string;

  @Column({ comment: '应用ID' })
  app_id: string;

  @Column({ comment: '应用用户ID' })
  app_user_id: string;

  @Column({ comment: '游戏ID' })
  game_id: string;

  @Column({ comment: '昵称' })
  nick_name: string;

  @Column({ comment: '头像' })
  avatar: string;

  @Column({ comment: '备注' })
  remark: string;

  @Column({ comment: '是否为机器人' })
  is_robot: boolean;

  @Column({ comment: '余额' })
  balance: number;

  @Column({ comment: '冻结余额' })
  balance_lock: number;

  @Column({ comment: '最后游戏时间' })
  last_played: Date;

  @Column({ comment: '是否启用' })
  enable: boolean;

  @Column({ comment: '启用音效' })
  effect: boolean;

  @Column({ comment: '启用音乐' })
  music: boolean;

  @Column({ comment: '接受语音' })
  talk: boolean;

  @Column({ comment: '创建时间' })
  create_at: Date;

  @Column({ comment: '更新时间' })
  update_at: Date;
}
