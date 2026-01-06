import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 游戏用户表
 */
@Entity('g3q_user')
export class GameUserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID', nullable: false, unique: true })
  user_id: string;

  @Column({ comment: '应用ID', nullable: false })
  app_id: string;

  @Column({ comment: '应用用户ID', nullable: false })
  app_user_id: string;

  @Column({ comment: '昵称', nullable: true })
  nick_name: string;

  @Column({ comment: '头像', nullable: true })
  avatar: string;

  @Column({ comment: '备注', nullable: true })
  remark: string;

  @Column({ comment: '是否为机器人', default: false })
  is_robot: boolean;

  @Column({ comment: '余额', default: 0 })
  balance: number;

  @Column({ comment: '冻结余额', default: 0 })
  balance_lock: number;

  @Column({ comment: '最后游戏时间', nullable: true })
  last_played: Date;

  @Column({ comment: '是否启用', default: true })
  enable: boolean;

  @Column({ comment: '启用音效', default: true })
  effect: boolean;

  @Column({ comment: '启用音乐', default: true })
  music: boolean;

  @Column({ comment: '接受语音', default: true })
  talk: boolean;

  @Column({ comment: '创建时间', default: true })
  create_at: Date;

  @Column({ comment: '更新时间', default: true })
  update_at: Date;
}
